import { create } from 'xmlbuilder2'

import type { EpubResource, EpubSpineItem, EpubVersion } from '../types/epub'

import { XML_NAMESPACES } from './constants'
import type { PackageMetadata } from './metadata-builder'
import { NCX_HREF } from './navigation-builder'
import { safeXmlId } from './naming'
import type { GeneratedFile } from './types'

/**
 * The package document (`content.opf`).
 *
 * This is the file that *is* the book, as far as a reading system is concerned:
 * it declares the metadata, lists every resource, and defines the reading
 * order. A file present in the container but absent from the manifest does not
 * exist; a manifest entry pointing at a missing file is a fatal error.
 *
 * Three details that hand-built packages routinely get wrong, and which are
 * handled explicitly below:
 *
 *   1. **`dcterms:modified` is required.** It is an EPUB 3 addition rather than
 *      a Dublin Core element, so it is easy to miss, and its absence alone
 *      makes a package invalid.
 *   2. **The `unique-identifier` attribute must point at a real `dc:identifier`
 *      id.** A mismatch is a dangling reference.
 *   3. **`<meta refines>` must reference an existing id**, which is why the
 *      creator elements are given ids before their roles are declared.
 */

export interface PackageDocumentInput {
  readonly version: EpubVersion
  readonly metadata: PackageMetadata
  readonly resources: readonly EpubResource[]
  readonly spine: readonly EpubSpineItem[]
  /** Included for reading systems that still fall back to the EPUB 2 TOC. */
  readonly includeNcx: boolean
  /** Guide entries, for the same older reading systems. */
  readonly guide?: readonly { type: string; title: string; href: string }[]
}

const UNIQUE_IDENTIFIER_ID = 'pub-id'

export function buildPackageDocument(input: PackageDocumentInput): GeneratedFile {
  const { metadata } = input

  const document = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(XML_NAMESPACES.opf, 'package')
    .att('version', input.version)
    .att('unique-identifier', UNIQUE_IDENTIFIER_ID)
    .att('xml:lang', metadata.language)

  // ---- Metadata -----------------------------------------------------------

  const meta = document.ele('metadata').att('xmlns:dc', XML_NAMESPACES.dc)

  meta
    .ele('dc:identifier')
    .att('id', UNIQUE_IDENTIFIER_ID)
    .txt(
      metadata.identifierScheme === 'isbn'
        ? `urn:isbn:${metadata.identifier.replace(/-/g, '')}`
        : metadata.identifier,
    )
    .up()

  meta.ele('dc:title').att('id', 'title').txt(metadata.title).up()
  // `title-type: main` disambiguates when a subtitle is also present, which is
  // what stops a retailer concatenating the two into one long title.
  meta.ele('meta').att('refines', '#title').att('property', 'title-type').txt('main').up()

  if (metadata.subtitle) {
    meta.ele('dc:title').att('id', 'subtitle').txt(metadata.subtitle).up()
    meta.ele('meta').att('refines', '#subtitle').att('property', 'title-type').txt('subtitle').up()
  }

  meta.ele('dc:language').txt(metadata.language).up()

  metadata.creators.forEach((creator, index) => {
    const id = `creator-${index + 1}`
    meta.ele('dc:creator').att('id', id).txt(creator).up()
    // MARC relator `aut` states that this person wrote the book, rather than
    // edited or illustrated it. Retailers use it to build the author page.
    meta
      .ele('meta')
      .att('refines', `#${id}`)
      .att('property', 'role')
      .att('scheme', 'marc:relators')
      .txt('aut')
      .up()
    // Sorting the author list by surname is what makes a library sort
    // correctly; without it "Ada Lovelace" files under A.
    meta.ele('meta').att('refines', `#${id}`).att('property', 'file-as').txt(fileAs(creator)).up()
  })

  if (metadata.publisher) meta.ele('dc:publisher').txt(metadata.publisher).up()
  if (metadata.description) meta.ele('dc:description').txt(metadata.description).up()
  if (metadata.rights) meta.ele('dc:rights').txt(metadata.rights).up()
  if (metadata.publicationDate) {
    meta.ele('dc:date').txt(metadata.publicationDate.slice(0, 10)).up()
  }

  for (const subject of metadata.subjects) {
    meta.ele('dc:subject').txt(subject).up()
  }

  // Series information has no Dublin Core element. `belongs-to-collection` is
  // the EPUB 3 mechanism, and it is what makes a series shelf work in Apple
  // Books and Kobo.
  if (metadata.series) {
    meta
      .ele('meta')
      .att('property', 'belongs-to-collection')
      .att('id', 'series')
      .txt(metadata.series.name)
      .up()
    meta.ele('meta').att('refines', '#series').att('property', 'collection-type').txt('series').up()
    meta
      .ele('meta')
      .att('refines', '#series')
      .att('property', 'group-position')
      .txt(String(metadata.series.index))
      .up()
  }

  // The required EPUB 3 modification timestamp.
  meta.ele('meta').att('property', 'dcterms:modified').txt(metadata.modified).up()

  // ---- Accessibility ------------------------------------------------------

  const { accessibility } = metadata

  if (accessibility.summary) {
    meta.ele('meta').att('property', 'schema:accessibilitySummary').txt(accessibility.summary).up()
  }

  for (const mode of accessibility.accessModes) {
    meta.ele('meta').att('property', 'schema:accessMode').txt(mode).up()
  }

  // `accessModeSufficient` states that the listed modes are enough on their
  // own — i.e. the book can be read as text alone. It is what an accessibility
  // audit looks for, and it is distinct from listing the modes present.
  meta.ele('meta').att('property', 'schema:accessModeSufficient').txt('textual').up()

  for (const feature of accessibility.accessibilityFeatures) {
    meta.ele('meta').att('property', 'schema:accessibilityFeature').txt(feature).up()
  }

  for (const hazard of accessibility.accessibilityHazards) {
    meta.ele('meta').att('property', 'schema:accessibilityHazard').txt(hazard).up()
  }

  // The legacy cover declaration. EPUB 3 uses the `cover-image` manifest
  // property, but Apple Books and several older systems read this meta, so
  // both are emitted.
  if (metadata.coverImageId) {
    meta.ele('meta').att('name', 'cover').att('content', metadata.coverImageId).up()
  }

  meta.up()

  // ---- Manifest -----------------------------------------------------------

  const manifest = document.ele('manifest')

  for (const resource of input.resources) {
    const item = manifest
      .ele('item')
      .att('id', resource.id)
      .att('href', resource.href)
      .att('media-type', resource.mediaType)

    if (resource.properties && resource.properties.length > 0) {
      item.att('properties', resource.properties.join(' '))
    }

    item.up()
  }

  manifest.up()

  // ---- Spine --------------------------------------------------------------

  const spine = document.ele('spine')
  // `toc` points at the NCX. Required by EPUB 2, ignored by EPUB 3, and the
  // reason older devices can still open the book.
  if (input.includeNcx) spine.att('toc', 'ncx')

  for (const item of input.spine) {
    const element = spine.ele('itemref').att('idref', item.idref)
    // `linear="no"` marks content outside the main reading flow, so a reading
    // system does not page into the cover when the reader reaches the end of
    // the previous section.
    if (!item.linear) element.att('linear', 'no')
    element.up()
  }

  spine.up()

  // ---- Guide --------------------------------------------------------------

  if (input.guide && input.guide.length > 0) {
    const guide = document.ele('guide')

    for (const entry of input.guide) {
      guide
        .ele('reference')
        .att('type', entry.type)
        .att('title', entry.title)
        .att('href', entry.href)
        .up()
    }

    guide.up()
  }

  return {
    resource: {
      id: safeXmlId('package', 'pkg'),
      href: 'content.opf',
      mediaType: 'application/oebps-package+xml',
    },
    content: document.end({ prettyPrint: true, indent: '  ' }),
  }
}

/**
 * "Ada Lovelace" → "Lovelace, Ada".
 *
 * Deliberately simple. Real name handling is unbounded — particles, suffixes,
 * mononyms, cultures that put the family name first — and guessing wrongly is
 * worse than a plain reversal. Single-word names are left alone, which covers
 * the mononym case correctly.
 */
function fileAs(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.trim()

  const last = parts[parts.length - 1] ?? ''
  const rest = parts.slice(0, -1).join(' ')

  return `${last}, ${rest}`
}

export { NCX_HREF, UNIQUE_IDENTIFIER_ID }
