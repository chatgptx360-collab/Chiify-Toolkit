/**
 * `lib/epub` — internal document model → EPUB 3 package.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `lib/parser` (it never sees a `.docx`), from
 *     `components`, or from React.
 *
 * The engine reads the internal document model and nothing else, which is what
 * makes it reusable: a Markdown importer added later produces the same model,
 * and this code generates the same EPUB from it unchanged. In the other
 * direction, nothing outside this directory knows what an OPF is — callers ask
 * for an artifact and receive a `Blob`.
 *
 * Services are exported individually so Phase 5 can validate and preview
 * against the same pieces the generator used, rather than re-deriving them.
 */
export {
  CORE_IMAGE_MEDIA_TYPES,
  EPUB_MEDIA_TYPE,
  MEDIA_TYPE_BY_EXTENSION,
  OCF_PATHS,
  XML_NAMESPACES,
  mediaTypeForPath,
} from './constants'

export {
  createEpubGenerator,
  type EpubGenerator,
  type GenerateEpubInput,
  type GenerateEpubOptions,
  type GenerationOutcome,
  type GenerationProgress,
  type GenerationStage,
} from './generator'

export { createAssetManager, type AssetManager, type PlacedAsset } from './asset-manager'
export { createEpubPackager, type PackagerOptions } from './packager'
export { createStylesheetGenerator, STYLESHEET_HREF, THEMES } from './stylesheet-generator'
export { createXhtmlGenerator } from './xhtml-generator'
export { createNavigationBuilder, NAV_HREF, NCX_HREF } from './navigation-builder'
export { createMetadataBuilder, type PackageMetadata } from './metadata-builder'
export { buildPackageDocument, type PackageDocumentInput } from './package-document'
export { buildContainerXml, MIMETYPE_CONTENT } from './container'
export { buildCoverPage, COVER_HREF } from './cover-generator'
export {
  createNameRegistry,
  relativeHref,
  safeFileName,
  safeXmlId,
  type NameRegistry,
} from './naming'

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
