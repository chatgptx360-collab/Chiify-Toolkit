/**
 * `lib/epub` — internal document model → EPUB 3 package.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `lib/parser` (it never sees a .docx), from
 *     `components`, or from React.
 *
 * Phase 4 adds implementations here and exposes them to the converter as
 * pipeline stages.
 */
export {
  CORE_IMAGE_MEDIA_TYPES,
  EPUB_MEDIA_TYPE,
  MEDIA_TYPE_BY_EXTENSION,
  OCF_PATHS,
  XML_NAMESPACES,
  mediaTypeForPath,
} from './constants'
export type {
  CssGenerator,
  EpubPackager,
  EpubValidator,
  GeneratedFile,
  GenerationContext,
  MetadataGenerator,
  NavigationBuilder,
  PackagedBinary,
  XhtmlGenerator,
} from './types'
