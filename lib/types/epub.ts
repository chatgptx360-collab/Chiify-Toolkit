import type { ChapterId } from './common'

/**
 * EPUB output model.
 *
 * This describes the *shape of a book package*, not a zip file. Phase 4's
 * generator builds one of these from the internal document model, and only the
 * final packaging step turns it into bytes. Keeping the description separate
 * from the serialisation means the preview (Phase 5) can render the exact same
 * structure the download contains, without unzipping anything.
 */

/** Only EPUB 3.x is targeted; EPUB 2 fallbacks are a compatibility concern. */
export type EpubVersion = '3.0' | '3.2' | '3.3'

/** A file that will exist inside the EPUB container. */
export interface EpubResource {
  /** Path relative to the OPF, e.g. `text/chapter-01.xhtml`. */
  readonly href: string
  /** Unique id referenced by the spine and by `properties`. */
  readonly id: string
  readonly mediaType: string
  /** OPF manifest properties, e.g. `nav`, `cover-image`, `scripted`. */
  readonly properties?: readonly string[]
}

/** One entry in the reading order. */
export interface EpubSpineItem {
  readonly idref: string
  readonly linear: boolean
  /** Back-reference so the preview can map a spine item to a chapter. */
  readonly chapterId?: ChapterId
}

/** A node in the navigation document (`nav.xhtml`), nestable to any depth. */
export interface EpubNavItem {
  readonly label: string
  readonly href: string
  readonly children?: readonly EpubNavItem[]
}

/**
 * EPUB 3 accessibility metadata.
 *
 * Modelled explicitly rather than as loose key/value pairs because the major
 * retailers now reject or downrank books without it, and because the
 * accessibility report in Phase 5 needs to check specific fields.
 */
export interface EpubAccessibility {
  readonly summary?: string
  readonly accessModes: readonly string[]
  readonly accessibilityFeatures: readonly string[]
  readonly accessibilityHazards: readonly string[]
}

/** The complete, in-memory description of a generated book. */
export interface EpubPackage {
  readonly version: EpubVersion
  readonly resources: readonly EpubResource[]
  readonly spine: readonly EpubSpineItem[]
  readonly navigation: readonly EpubNavItem[]
  readonly accessibility: EpubAccessibility
  /** Serialised OPF metadata block, keyed by Dublin Core property name. */
  readonly metadata: Readonly<Record<string, string | readonly string[]>>
}

/** Result of packaging an `EpubPackage` into a distributable file. */
export interface EpubArtifact {
  readonly fileName: string
  readonly mediaType: 'application/epub+zip'
  readonly byteSize: number
  /** Held as a Blob so the browser can download it without a server round-trip. */
  readonly blob: Blob
}
