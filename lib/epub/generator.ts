import type { BookMetadata, ProjectSettings } from '../types/project'
import type { ParsedDocument } from '../types/document'
import type { EpubArtifact, EpubPackage, EpubResource, EpubSpineItem } from '../types/epub'
import { appError, err, ok, type AppError, type Result } from '../utils/result'
import { createId } from '../utils/slug'

import { createAssetManager, type AssetManager } from './asset-manager'
import { buildCoverPage, COVER_HREF } from './cover-generator'
import { createMetadataBuilder } from './metadata-builder'
import { createNameRegistry } from './naming'
import { createNavigationBuilder, NAV_HREF, NCX_HREF } from './navigation-builder'
import { buildPackageDocument } from './package-document'
import { createEpubPackager } from './packager'
import { createStylesheetGenerator } from './stylesheet-generator'
import { createXhtmlGenerator } from './xhtml-generator'
import type { GeneratedFile, GenerationContext, PackagedBinary } from './types'

/**
 * The EPUB generation engine.
 *
 * WHAT THIS FILE IS
 * -----------------
 * An orchestrator, in the same shape as the DOCX parser: it runs the
 * generators in order, assembles the manifest and spine, and reports progress.
 * Every real decision — how a block becomes XHTML, what the CSS says, which
 * image is the cover, how the package document is laid out — lives in a
 * service with one responsibility.
 *
 * THE BOUNDARY, IN BOTH DIRECTIONS
 * --------------------------------
 * This engine reads the internal document model and **nothing else**. It never
 * sees a `.docx`, never calls the parser, and does not know one exists. That is
 * what makes it reusable: a Markdown importer added later produces the same
 * model and this code generates the same EPUB from it, unchanged.
 *
 * The reverse also holds — nothing outside `lib/epub` knows what an OPF is. The
 * UI asks for an artifact and receives a `Blob`.
 *
 * PROGRESS IS WEIGHTED BY REAL COST
 * ---------------------------------
 * The stage weights below are not evenly spaced. Packaging an illustrated book
 * genuinely dominates the wall clock, and a bar that advances in equal steps
 * for unequal work is the most common complaint about conversion UI.
 */

export type GenerationStage =
  'preparing' | 'chapters' | 'stylesheet' | 'navigation' | 'metadata' | 'packaging' | 'done'

export interface GenerationProgress {
  readonly stage: GenerationStage
  /** Human-readable, ready to display. */
  readonly label: string
  /** 0–1 across the whole generation. */
  readonly ratio: number
}

/** Where the time actually goes, as a cumulative fraction. */
const STAGE_WEIGHT: Record<GenerationStage, number> = {
  preparing: 0.05,
  chapters: 0.45,
  stylesheet: 0.5,
  navigation: 0.6,
  metadata: 0.65,
  packaging: 1,
  done: 1,
}

const STAGE_LABEL: Record<GenerationStage, string> = {
  preparing: 'Preparing your book…',
  chapters: 'Creating chapters…',
  stylesheet: 'Applying typography…',
  navigation: 'Building the table of contents…',
  metadata: 'Writing metadata…',
  packaging: 'Compressing…',
  done: 'Finished',
}

export interface GenerateEpubInput {
  readonly document: ParsedDocument
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
}

export interface GenerateEpubOptions {
  readonly onProgress?: (progress: GenerationProgress) => void
  readonly signal?: AbortSignal
  /** Injected for reproducible output in tests. */
  readonly now?: Date
  readonly generateIdentifier?: () => string
}

export interface GenerationOutcome {
  readonly artifact: EpubArtifact
  /** The described package, which Phase 5 validates without unzipping. */
  readonly epub: EpubPackage
  /** Text resources, kept so validation and preview can read them directly. */
  readonly files: readonly GeneratedFile[]
  /** Non-fatal observations worth showing the author. */
  readonly notices: readonly AppError[]
}

export interface EpubGenerator {
  generate(
    input: GenerateEpubInput,
    options?: GenerateEpubOptions,
  ): Promise<Result<GenerationOutcome>>
}

export function createEpubGenerator(): EpubGenerator {
  return {
    async generate(input, options = {}) {
      const notices: AppError[] = []
      const now = options.now ?? new Date()

      const report = (stage: GenerationStage, within = 1): void => {
        const previous = stage === 'preparing' ? 0 : STAGE_WEIGHT[previousStage(stage)]
        const ratio = previous + (STAGE_WEIGHT[stage] - previous) * within

        options.onProgress?.({ stage, label: STAGE_LABEL[stage], ratio })
      }

      const cancelled = (): boolean => options.signal?.aborted ?? false

      // ---- Prepare ------------------------------------------------------

      report('preparing')

      const chapters = input.document.chapters.filter((chapter) => chapter.blocks.length > 0)

      if (chapters.length === 0) {
        return err(
          appError('epub.no-content', 'There is nothing to convert.', {
            hint: 'This manuscript has no readable chapters. Upload it again, or check it opens correctly in Word.',
          }),
        )
      }

      if (chapters.length < input.document.chapters.length) {
        notices.push(
          appError(
            'epub.empty-chapters-skipped',
            `${input.document.chapters.length - chapters.length} empty ${
              input.document.chapters.length - chapters.length === 1
                ? 'chapter was'
                : 'chapters were'
            } left out.`,
            {
              severity: 'info',
              hint: 'A chapter with no content would appear as a blank page in the finished book.',
            },
          ),
        )
      }

      // One registry across chapters *and* images, so a chapter and an
      // illustration can never claim the same name.
      const registry = createNameRegistry()
      registry.reserve(NAV_HREF)
      registry.reserve(NCX_HREF)
      registry.reserve('content.opf')

      const fileNameByChapter = new Map<string, string>()
      for (const chapter of chapters) {
        fileNameByChapter.set(chapter.id, registry.claim(chapter.slug, '.xhtml', 'chapter'))
      }

      const assets: AssetManager = createAssetManager(input.document, { registry })

      if (assets.nonCoreFormats.length > 0) {
        notices.push(
          appError(
            'epub.non-core-image-format',
            `${assets.nonCoreFormats.length} ${assets.nonCoreFormats.length === 1 ? 'image uses' : 'images use'} a format some e-readers cannot display.`,
            {
              severity: 'warning',
              source: assets.nonCoreFormats.map((asset) => asset.resource.href).join(', '),
              hint: 'JPEG and PNG are supported everywhere. Re-save these images in one of those formats for the widest compatibility.',
            },
          ),
        )
      }

      const context: GenerationContext = {
        document: { ...input.document, chapters },
        metadata: input.metadata,
        settings: input.settings,
      }

      // ---- Chapters -----------------------------------------------------

      const xhtml = createXhtmlGenerator({ assets, fileNameByChapter })
      const files: GeneratedFile[] = []
      const spine: EpubSpineItem[] = []

      if (input.settings.generateCoverPage) {
        const cover = buildCoverPage(context, { assets })
        files.push(cover)
        // Non-linear: the cover is outside the reading flow.
        spine.push({ idref: cover.resource.id, linear: false })
      }

      for (const [index, chapter] of chapters.entries()) {
        if (cancelled()) return err(cancelledError())

        const result = xhtml.generate(chapter, context)
        if (!result.ok) return result

        files.push(result.value)
        spine.push({ idref: result.value.resource.id, linear: true, chapterId: chapter.id })

        report('chapters', (index + 1) / chapters.length)
      }

      // ---- Stylesheet ---------------------------------------------------

      report('stylesheet')

      const css = createStylesheetGenerator().generate(context)
      if (!css.ok) return css
      files.push(css.value)

      // ---- Navigation ---------------------------------------------------

      report('navigation')

      const navigation = createNavigationBuilder({ fileNameByChapter })
      const navItems = navigation.build(context)
      if (!navItems.ok) return navItems

      const navDocument = navigation.buildNavDocument(context, navItems.value)
      files.push(navDocument)

      // The navigation document is itself a readable page, so it belongs in
      // the spine — but non-linear, so the reader is not paged into it.
      spine.push({ idref: navDocument.resource.id, linear: false })

      // ---- Metadata -----------------------------------------------------

      report('metadata')

      const metadataBuilder = createMetadataBuilder({
        assets,
        modifiedAt: now,
        generateIdentifier:
          options.generateIdentifier ?? (() => `urn:uuid:${createId('chiify').slice(7)}`),
      })

      const packageMetadata = metadataBuilder.build(context)

      if (!input.metadata.identifier?.trim()) {
        notices.push(
          appError(
            'epub.generated-identifier',
            'A unique identifier was generated for this book.',
            {
              severity: 'info',
              hint: 'Retailers require an ISBN. Add yours in the metadata form before publishing commercially.',
            },
          ),
        )
      }

      const ncx = input.settings.includeTableOfContents
        ? navigation.buildNcxDocument(context, navItems.value, packageMetadata.identifier)
        : undefined

      if (ncx) files.push(ncx)

      const binaries: PackagedBinary[] = assets.assets.map((asset) => ({
        resource: asset.resource,
        bytes: asset.bytes,
      }))

      const resources: EpubResource[] = [
        ...files.map((file) => file.resource),
        ...binaries.map((binary) => binary.resource),
      ]

      const epub: EpubPackage = {
        version: '3.0',
        resources,
        spine,
        navigation: navItems.value,
        accessibility: packageMetadata.accessibility,
        metadata: {
          identifier: packageMetadata.identifier,
          title: packageMetadata.title,
          language: packageMetadata.language,
          creator: packageMetadata.creators,
          modified: packageMetadata.modified,
        },
      }

      const packageDocument = buildPackageDocument({
        version: '3.0',
        metadata: packageMetadata,
        resources,
        spine,
        includeNcx: Boolean(ncx),
        guide: buildGuide(input.settings.generateCoverPage, chapters.length > 0),
      })

      // The package document is not itself in the manifest — a file cannot
      // list itself — so it is appended only to the write list.
      const writeList = [...files, packageDocument]

      // ---- Package ------------------------------------------------------

      if (cancelled()) return err(cancelledError())

      report('packaging', 0)

      const packager = createEpubPackager({
        ...(options.signal ? { signal: options.signal } : {}),
        onProgress: (ratio) => report('packaging', ratio),
      })

      const artifact = await packager.package(epub, writeList, binaries)
      if (!artifact.ok) return artifact

      report('done')

      return ok({ artifact: artifact.value, epub, files: writeList, notices })
    },
  }
}

/**
 * The EPUB 2 `guide`.
 *
 * Superseded by the landmarks navigation in EPUB 3, and still read by older
 * Kindle conversion tooling and some retailer ingestion pipelines. Two entries
 * cost nothing and prevent a "no cover found" rejection.
 */
function buildGuide(
  hasCover: boolean,
  hasContent: boolean,
): readonly { type: string; title: string; href: string }[] {
  const entries: { type: string; title: string; href: string }[] = []

  if (hasCover) entries.push({ type: 'cover', title: 'Cover', href: COVER_HREF })
  if (hasContent) entries.push({ type: 'toc', title: 'Contents', href: NAV_HREF })

  return entries
}

const STAGE_ORDER: readonly GenerationStage[] = [
  'preparing',
  'chapters',
  'stylesheet',
  'navigation',
  'metadata',
  'packaging',
  'done',
]

function previousStage(stage: GenerationStage): GenerationStage {
  const index = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER[Math.max(0, index - 1)] ?? 'preparing'
}

function cancelledError(): AppError {
  return appError('epub.cancelled', 'Building the EPUB was cancelled.', { severity: 'info' })
}
