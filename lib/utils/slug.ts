/**
 * Slug + identifier helpers.
 *
 * These live in `lib/utils` rather than `lib/epub` on purpose: Phase 4 needs
 * them to name XHTML files inside an EPUB container, Phase 2 needs them for
 * project URLs. A shared implementation guarantees the id a user sees in the
 * UI is the id written into the book.
 */

/**
 * Convert arbitrary text to a URL/filename-safe slug.
 *
 * Unicode is normalised and stripped of diacritics before ASCII filtering so
 * that "Café Chapter" becomes `cafe-chapter` rather than `caf-chapter`.
 * EPUB readers vary wildly in their handling of non-ASCII filenames, which is
 * why the output is deliberately conservative.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Make `slug` unique against a set of taken values by appending `-2`, `-3`, …
 *
 * Chapter titles repeat far more often than authors expect ("Prologue",
 * "Part One"), and duplicate filenames make an EPUB fail validation, so
 * uniqueness has to be enforced at the point of generation.
 */
export function uniqueSlug(slug: string, taken: ReadonlySet<string>): string {
  const base = slug || 'section'
  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1

  return `${base}-${suffix}`
}

/**
 * A stable, sortable, collision-resistant id.
 *
 * `crypto.randomUUID` is available in every runtime this app targets (modern
 * browsers, Node 20+, edge runtimes). The prefix makes ids self-describing in
 * logs and dev tools, which matters once several entity types coexist.
 */
export function createId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
}
