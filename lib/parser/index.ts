/**
 * `lib/parser` — input formats → internal document model.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `lib/epub`, `lib/converter`, `components`, or React.
 *
 * The DOCX implementation lives in `./docx`; `registerBuiltInParsers` installs
 * it. Import from here rather than reaching into the implementation, so a
 * second input format can be added without touching a call site.
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
export { registerBuiltInParsers } from './register'
export { createDocxParser, MAX_DOCX_BYTES } from './docx'
export type { DocumentParser, ParseInput, ParseOptions } from './types'
