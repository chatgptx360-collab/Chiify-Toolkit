import mammoth from 'mammoth'

import type { DocumentId } from '../../types/common'
import type { ParseNotice, ParsedDocument } from '../../types/document'
import { err, ok, type Result } from '../../utils/result'
import { createId } from '../../utils/slug'
import type { DocumentParser, ParseInput, ParseOptions } from '../types'

import { createChapterDetector, type ChapterDetector } from './chapter-detector'
import { conversionFailedError, emptyDocumentError, notice } from './errors'
import { convertHtmlToBlocks, createIdFactory } from './html-to-blocks'
import { parseHtml } from './html-parser'
import { createImageExtractor } from './image-extractor'
import { createMetadataExtractor, type MetadataExtractor } from './metadata-extractor'
import { createDocumentNormalizer, type DocumentNormalizer } from './normalizer'
import { createStatisticsGenerator, type StatisticsGenerator } from './statistics'
import { MAMMOTH_OPTIONS } from './style-map'
import { createDocumentValidator, type DocumentValidator } from './validator'

/**
 * The DOCX parser.
 *
 * WHAT THIS FILE IS, AND IS NOT
 * -----------------------------
 * It is an *orchestrator*. Every real decision — is this file valid, what is a
 * chapter, which characters are noise, how long is this book — lives in a
 * service with one responsibility. This file's only job is to run them in
 * order, thread the data through, and translate failures into a `Result`.
 *
 * That split is why the hard parts are testable without a DOCX file at all: the
 * chapter detector takes blocks, the statistics generator takes chapters. Only
 * this file needs a real document.
 *
 * DEPENDENCY INJECTION
 * --------------------
 * The services are constructor parameters with working defaults. Tests
 * substitute one service and keep the rest; a future Markdown parser reuses
 * the normaliser, detector and statistics generator unchanged, because none of
 * them knows what a `.docx` is.
 *
 * THE BOUNDARY
 * ------------
 * Nothing here mentions EPUB, and nothing here may. The parser's output is the
 * internal document model — the universal input layer that every future export
 * format consumes. If an EPUB concept ever appears in this directory, the
 * architecture has been broken.
 */

export interface DocxParserServices {
  readonly validator: DocumentValidator
  readonly metadataExtractor: MetadataExtractor
  readonly normalizer: DocumentNormalizer
  readonly chapterDetector: ChapterDetector
  readonly statistics: StatisticsGenerator
}

/** Progress weights, so the bar reflects where the time actually goes. */
const PROGRESS = {
  validated: 0.1,
  converted: 0.55,
  structured: 0.8,
  analysed: 1,
} as const

export function createDocxParser(services: Partial<DocxParserServices> = {}): DocumentParser {
  const {
    validator = createDocumentValidator(),
    metadataExtractor = createMetadataExtractor(),
    normalizer = createDocumentNormalizer(),
    chapterDetector = createChapterDetector(),
    statistics = createStatisticsGenerator(),
  } = services

  return {
    id: 'docx',
    label: 'Microsoft Word',
    mediaTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],

    canParse(input) {
      return (
        input.fileName.toLowerCase().endsWith('.docx') ||
        input.mediaType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    },

    async parse(input: ParseInput, options: ParseOptions): Promise<Result<ParsedDocument>> {
      const notices: ParseNotice[] = []
      const report = (ratio: number): void => options.onProgress?.(ratio)

      // 1. Validate. Cheap checks first; nothing is read until they pass.
      const validation = await validator.validate({
        fileName: input.fileName,
        byteSize: input.bytes.byteLength,
        bytes: input.bytes,
      })

      if (!validation.ok) return validation
      if (options.signal?.aborted) return err(cancelled(input.fileName))

      report(PROGRESS.validated)

      // 2. Metadata, read from the package rather than the body. Never fatal.
      const embeddedMetadata = await metadataExtractor.extract(validation.value.zip)

      // 3. Convert the body. Mammoth owns the Word XML; the image extractor
      //    collects assets as it goes so alt text stays attached to bytes.
      const images = createImageExtractor()

      let html: string
      try {
        const conversion = await mammoth.convertToHtml(
          // Both keys are supplied deliberately. Mammoth ships two builds and
          // they disagree: the Node one reads `buffer`, the browser one (which
          // bundlers select via the package's `browser` field) reads
          // `arrayBuffer`. Passing both means this file works unchanged in a
          // page, in a worker and in a test process, with no environment
          // sniffing — each build simply ignores the key it does not know.
          //
          // The cast is needed because Mammoth's typings model the input as a
          // union of exactly one source, and type `buffer` as Node's `Buffer`.
          // At runtime it only ever calls JSZip, which accepts a `Uint8Array`
          // — using one keeps this file free of a Node-only global.
          dualInput(input.bytes),
          {
            ...MAMMOTH_OPTIONS,
            convertImage: mammoth.images.imgElement(async (image) => {
              // `altText` is present at runtime but missing from Mammoth's
              // published typings, so it is read through a narrow local type
              // rather than by widening the whole image to `any`.
              const { altText } = image as { altText?: string }
              const bytes = await image.readAsArrayBuffer()

              return images.add(bytes, image.contentType, altText)
            }),
          },
        )

        html = conversion.value

        // Mammoth reports unconvertible constructs. They are informational:
        // the manuscript converted, but something in it was not representable.
        for (const message of conversion.messages.slice(0, 20)) {
          notices.push(
            notice('docx.unsupported-feature', message.message, {
              severity: message.type === 'error' ? 'warning' : 'info',
              hint: 'This part of the document was skipped. The rest converted normally.',
            }),
          )
        }
      } catch (cause) {
        return err(conversionFailedError(input.fileName, cause))
      }

      if (options.signal?.aborted) return err(cancelled(input.fileName))
      report(PROGRESS.converted)

      // 4. HTML → blocks → normalised blocks.
      const ids = createIdFactory()
      const { blocks: rawBlocks, usedAnchors } = convertHtmlToBlocks(parseHtml(html), ids)

      const assets = images.assets()
      const { blocks, notices: normalisationNotices } = normalizer.normalize(rawBlocks, {
        knownAssetIds: new Set(assets.map((asset) => asset.id)),
        knownAnchors: new Set(usedAnchors),
      })

      notices.push(...normalisationNotices)

      if (blocks.length === 0) return err(emptyDocumentError(input.fileName))

      const unsupportedImages = images.unsupported()
      if (unsupportedImages.length > 0) {
        notices.push(
          notice(
            'docx.unsupported-image-format',
            `${unsupportedImages.length} ${unsupportedImages.length === 1 ? 'image uses' : 'images use'} a format some e-readers cannot display.`,
            {
              source: unsupportedImages.map((image) => image.asset.fileName).join(', '),
              hint: 'Re-save these as JPEG or PNG in Word for the widest compatibility.',
            },
          ),
        )
      }

      if (options.signal?.aborted) return err(cancelled(input.fileName))
      report(PROGRESS.structured)

      // 5. Structure and measure.
      const { chapters, detection } = chapterDetector.detect(blocks, {
        chapterHeadingLevel: options.chapterHeadingLevel,
      })

      if (detection.confidence < 0.5) {
        notices.push(
          notice('docx.low-detection-confidence', detection.reason, {
            hint: 'Check the chapter list below. Applying Word’s “Heading 1” style to each chapter title gives the most reliable results.',
          }),
        )
      }

      const stats = statistics.generate(chapters)

      report(PROGRESS.analysed)

      return ok({
        id: createId('doc') as DocumentId,
        sourceFileName: input.fileName,
        parsedAt: new Date().toISOString(),
        chapters,
        assets,
        stats,
        detection,
        embeddedMetadata,
        notices,
      })
    },
  }
}

/** See the call site: satisfies both of Mammoth's builds at once. */
function dualInput(bytes: ArrayBuffer): Parameters<typeof mammoth.convertToHtml>[0] {
  return { arrayBuffer: bytes, buffer: new Uint8Array(bytes) } as unknown as Parameters<
    typeof mammoth.convertToHtml
  >[0]
}

function cancelled(fileName: string) {
  return {
    code: 'docx.cancelled',
    message: 'Reading the manuscript was cancelled.',
    severity: 'info' as const,
    source: fileName,
  }
}
