import { ok, type Result } from '../utils/result'
import type { EpubAccessibility } from '../types/epub'

import type { AssetManager } from './asset-manager'
import type { GenerationContext, MetadataGenerator } from './types'

/**
 * Package metadata.
 *
 * WHAT EPUB 3 ACTUALLY REQUIRES
 * -----------------------------
 * Exactly four things, and a book missing any of them is invalid:
 * `dc:identifier`, `dc:title`, `dc:language`, and a `dcterms:modified` meta.
 * That last one is the one hand-built EPUBs forget — it is not a Dublin Core
 * element, it is an EPUB 3 addition, and its absence is the most common reason
 * an otherwise correct package fails validation.
 *
 * MISSING VALUES ARE FILLED, NOT REJECTED
 * ---------------------------------------
 * An author who has not chosen an ISBN should still be able to produce a
 * readable file. So the required fields get sensible defaults — a generated
 * UUID, "Untitled", the project's language — and the *quality report* in Phase
 * 5 is where the author is told the book is not retail-ready. Refusing to
 * convert would be a worse trade: they lose the ability to read their own book
 * on a device to gain a warning they could have been given anyway.
 *
 * ACCESSIBILITY METADATA IS NOT OPTIONAL IN PRACTICE
 * --------------------------------------------------
 * The specification treats it as optional; the European Accessibility Act and
 * the major retailers do not. It is emitted for every book, computed from what
 * the content actually contains rather than asserted blindly — claiming
 * `accessibilityFeature: alternativeText` for a book whose images have no alt
 * text would be worse than claiming nothing.
 */

export interface MetadataBuilderOptions {
  readonly assets: AssetManager
  /** Fixed at generation time so a rebuild of the same book is reproducible. */
  readonly modifiedAt: Date
  /** Supplies the identifier when the author has not set one. */
  readonly generateIdentifier: () => string
}

/** Structured metadata, before it is serialised into the package document. */
export interface PackageMetadata {
  readonly identifier: string
  readonly identifierScheme: 'isbn' | 'uuid'
  readonly title: string
  readonly subtitle?: string
  readonly language: string
  readonly creators: readonly string[]
  readonly publisher?: string
  readonly description?: string
  readonly rights?: string
  readonly publicationDate?: string
  readonly subjects: readonly string[]
  readonly series?: { readonly name: string; readonly index: number }
  /** ISO-8601, second precision, `Z` suffix — the format EPUB 3 mandates. */
  readonly modified: string
  readonly accessibility: EpubAccessibility
  /** Manifest id of the cover image, when the book has one. */
  readonly coverImageId?: string
}

export function createMetadataBuilder(options: MetadataBuilderOptions): MetadataGenerator & {
  build(context: GenerationContext): PackageMetadata
} {
  const build = (context: GenerationContext): PackageMetadata => {
    const { metadata } = context

    const identifier = metadata.identifier?.trim()
    const isIsbn = Boolean(identifier && /^[\d-]{10,17}$/.test(identifier))

    const creators = metadata.authors.map((author) => author.trim()).filter(Boolean)

    return {
      identifier: identifier || options.generateIdentifier(),
      identifierScheme: isIsbn ? 'isbn' : 'uuid',
      title: metadata.title.trim() || 'Untitled',
      ...(metadata.subtitle?.trim() ? { subtitle: metadata.subtitle.trim() } : {}),
      language: metadata.language.trim() || 'en',
      creators,
      ...(metadata.publisher?.trim() ? { publisher: metadata.publisher.trim() } : {}),
      ...(metadata.description?.trim() ? { description: metadata.description.trim() } : {}),
      ...(metadata.rights?.trim() ? { rights: metadata.rights.trim() } : {}),
      ...(metadata.publicationDate ? { publicationDate: metadata.publicationDate } : {}),
      subjects: metadata.subjects ?? [],
      ...(metadata.series?.trim()
        ? { series: { name: metadata.series.trim(), index: metadata.seriesIndex ?? 1 } }
        : {}),
      // Truncated to seconds: EPUB 3 requires `CCYY-MM-DDThh:mm:ssZ` exactly,
      // and `toISOString()`'s milliseconds make the value invalid.
      modified: `${options.modifiedAt.toISOString().slice(0, 19)}Z`,
      accessibility: describeAccessibility(context),
      ...(options.assets.cover ? { coverImageId: options.assets.cover.resource.id } : {}),
    }
  }

  return {
    build,

    generate(
      context: GenerationContext,
    ): Result<Readonly<Record<string, string | readonly string[]>>> {
      const metadata = build(context)

      // The flat view the port declares. The package writer uses `build`
      // directly, because it needs the structure; this exists so a future
      // consumer (a report, a retailer export) can read metadata without
      // knowing the OPF's shape.
      return ok({
        identifier: metadata.identifier,
        title: metadata.title,
        language: metadata.language,
        creator: metadata.creators,
        modified: metadata.modified,
        ...(metadata.subtitle ? { subtitle: metadata.subtitle } : {}),
        ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.rights ? { rights: metadata.rights } : {}),
        ...(metadata.publicationDate ? { date: metadata.publicationDate } : {}),
        ...(metadata.subjects.length > 0 ? { subject: metadata.subjects } : {}),
      })
    },
  }
}

/**
 * Describe what the book actually offers, not what we wish it offered.
 *
 * Every value is derived from the content:
 *
 *   - `textual` is always present; `visual` only when there are images.
 *   - `alternativeText` is claimed only when *every* image has alt text.
 *     Partial coverage is worse than none, because a reader who trusts the
 *     claim is misled at the first undescribed figure.
 *   - `tableOfContents` and `readingOrder` are always true: the generator
 *     builds a navigation document and a linear spine for every book.
 *   - No hazards are asserted, which is itself a claim — `none` means the
 *     content has no flashing or motion, and a text book does not.
 */
function describeAccessibility(context: GenerationContext): EpubAccessibility {
  const images = context.document.chapters.flatMap((chapter) =>
    chapter.blocks.filter((block) => block.type === 'image'),
  )

  const allDescribed =
    images.length > 0 &&
    images.every((block) => block.type === 'image' && block.alt.trim().length > 0)

  const accessModes = ['textual', ...(images.length > 0 ? ['visual'] : [])]

  const features = [
    'tableOfContents',
    'readingOrder',
    'structuralNavigation',
    ...(allDescribed ? ['alternativeText'] : []),
  ]

  return {
    summary: buildSummary(images.length, allDescribed),
    accessModes,
    accessibilityFeatures: features,
    // "none" is a positive assertion that the book contains no flashing,
    // motion or sound hazards — which for generated text and images is true.
    accessibilityHazards: ['noFlashingHazard', 'noMotionSimulationHazard', 'noSoundHazard'],
  }
}

function buildSummary(imageCount: number, allDescribed: boolean): string {
  const base =
    'This publication conforms to a reflowable text layout with structural navigation and a table of contents.'

  if (imageCount === 0) return `${base} It contains no images.`

  return allDescribed
    ? `${base} All ${imageCount} images have text alternatives.`
    : `${base} Some of its ${imageCount} images do not have text alternatives.`
}
