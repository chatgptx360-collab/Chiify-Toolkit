/**
 * `lib/parser/docx` — Microsoft Word → internal document model.
 *
 * The services are exported individually so they can be tested in isolation and
 * reused: the normaliser, chapter detector and statistics generator take
 * *blocks*, not DOCX, and a future Markdown or HTML parser should reuse them
 * rather than reimplementing the same rules.
 *
 * Boundary: nothing in this directory may import from `lib/epub`,
 * `lib/converter` or `components`. The parser is the universal input layer;
 * the moment it knows what an EPUB is, that stops being true.
 */
export { createDocxParser, type DocxParserServices } from './parser'
export { createDocumentValidator, MAX_DOCX_BYTES, type DocumentValidator } from './validator'
export { createMetadataExtractor, type MetadataExtractor } from './metadata-extractor'
export {
  createDocumentNormalizer,
  plainText,
  type DocumentNormalizer,
  type NormalizationResult,
} from './normalizer'
export {
  countWords,
  createChapterDetector,
  type ChapterDetector,
  type DetectedChapters,
} from './chapter-detector'
export { createStatisticsGenerator, type StatisticsGenerator } from './statistics'
export {
  ASSET_URL_PREFIX,
  createImageExtractor,
  readImageDimensions,
  type ImageExtractor,
} from './image-extractor'
export { convertHtmlToBlocks, createIdFactory, type IdFactory } from './html-to-blocks'
export { parseHtml, textContent, type HtmlElement, type HtmlNode } from './html-parser'
export { DOCX_ERROR } from './errors'
