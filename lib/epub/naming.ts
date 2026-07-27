import { slugify, uniqueSlug } from '../utils/slug'

/**
 * Filename generation for the EPUB container.
 *
 * WHY THIS IS ITS OWN SERVICE
 * ---------------------------
 * Filenames inside an EPUB are not cosmetic. They appear in the manifest, the
 * spine, the navigation document and in every internal hyperlink, so a name
 * that is generated inconsistently in two places produces a book with broken
 * references — the single most common way a hand-rolled EPUB fails validation.
 * Generating every name through one service means the manifest and the links
 * cannot disagree.
 *
 * THE RULES, AND WHY THEY ARE THIS STRICT
 * ---------------------------------------
 * The OCF specification allows a wide range of characters, but reading systems
 * do not agree on how to handle them:
 *
 *   - **ASCII only.** Non-ASCII names must be percent-encoded in the manifest,
 *     and several e-readers (older Kobo firmware in particular) fail to decode
 *     them, producing a book whose images silently do not load.
 *   - **Lowercase.** Some readers unpack to a case-insensitive filesystem. A
 *     book containing both `Chapter1.xhtml` and `chapter1.xhtml` is valid per
 *     the spec and corrupt on Windows.
 *   - **No spaces.** Legal, but they must be encoded as `%20` in hrefs, and the
 *     encoding is another thing two code paths can disagree about.
 *
 * The conservative subset costs nothing — an author never sees these names —
 * and removes an entire class of device-specific failure.
 */

/** Reserved on Windows; a book containing one cannot be unpacked there. */
const RESERVED_STEMS = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
])

/**
 * Longest permitted stem.
 *
 * The limit is the *path*, not the name: some reading systems unpack into a
 * deep temporary directory and hit the platform's 255-byte path limit. Keeping
 * stems short leaves headroom, and a chapter title longer than this is not
 * more identifiable for being complete.
 */
const MAX_STEM_LENGTH = 48

/**
 * Make a single path segment safe.
 *
 * Always returns a usable name: an empty or entirely non-ASCII input falls back
 * to `fallback` rather than producing an empty string, because a resource with
 * no name would break the manifest.
 */
export function safeFileName(name: string, extension: string, fallback = 'file'): string {
  const stem = slugify(name).slice(0, MAX_STEM_LENGTH) || fallback
  const guarded = RESERVED_STEMS.has(stem) ? `${stem}-file` : stem

  return `${guarded}${extension.startsWith('.') ? extension : `.${extension}`}`
}

/**
 * Assigns unique names within one container.
 *
 * Duplicate filenames are the failure mode this exists to prevent: two chapters
 * called "Interlude" produce `interlude.xhtml` twice, and the second silently
 * overwrites the first — a book that is missing a chapter but passes a
 * superficial check because the manifest still lists two entries.
 *
 * Uniqueness is tracked case-insensitively, for the reason given above.
 */
export interface NameRegistry {
  /** Reserve a name, adding `-2`, `-3`… if it is taken. */
  claim(name: string, extension: string, fallback?: string): string
  /** Reserve an exact name that must not be altered (e.g. `nav.xhtml`). */
  reserve(name: string): void
  has(name: string): boolean
}

export function createNameRegistry(): NameRegistry {
  const taken = new Set<string>()

  return {
    claim(name, extension, fallback = 'file') {
      const desired = safeFileName(name, extension, fallback)
      const dot = desired.lastIndexOf('.')
      const stem = desired.slice(0, dot)
      const suffix = desired.slice(dot)

      const unique = uniqueSlug(stem, new Set([...taken].map(stripExtension)))
      const result = `${unique}${suffix}`

      taken.add(result.toLowerCase())
      return result
    },

    reserve(name) {
      taken.add(name.toLowerCase())
    },

    has(name) {
      return taken.has(name.toLowerCase())
    },
  }
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

/**
 * Make an id safe for an XML `ID` attribute.
 *
 * Manifest ids are referenced by the spine and by `<meta refines>`, and XML
 * requires them to start with a letter or underscore. A chapter slug beginning
 * with a digit — "1984" is a real book title — would otherwise produce an
 * invalid package that some readers reject outright.
 */
export function safeXmlId(value: string, prefix = 'id'): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+/, '')

  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `${prefix}-${cleaned || 'x'}`
}

/**
 * Resolve an href from one container path to another.
 *
 * Every href in an EPUB is relative to the *referencing document*, not to the
 * package root. A chapter in `text/` linking to an image in `images/` must
 * write `../images/plate.png`; writing the package-root path is the second most
 * common broken-reference bug after inconsistent naming.
 */
export function relativeHref(fromPath: string, toPath: string): string {
  const from = fromPath.split('/').slice(0, -1)
  const to = toPath.split('/')
  const file = to.pop() ?? ''

  let shared = 0
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) {
    shared += 1
  }

  const up = Array.from({ length: from.length - shared }, () => '..')
  const down = to.slice(shared)

  return [...up, ...down, file].join('/')
}
