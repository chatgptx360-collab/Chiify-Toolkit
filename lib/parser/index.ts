/**
 * `lib/parser` — input formats → internal document model.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `lib/epub`, `lib/converter`, `components`, or React.
 *
 * Phase 3 adds `lib/parser/docx/*` and calls `registerParser` from there.
 */
export {
  acceptedExtensions,
  acceptedMediaTypes,
  getParser,
  listParsers,
  registerParser,
  resolveParser,
} from './registry'
export {
  INPUT_FORMATS,
  fileInputAccept,
  identifyFormat,
  supportedExtensionList,
  supportedFormats,
  type FormatStatus,
  type InputFormat,
} from './formats'
export type { DocumentParser, ParseInput, ParseOptions } from './types'
