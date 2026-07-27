/**
 * The catalogue of manuscript formats the product knows about.
 *
 * WHY THIS IS SEPARATE FROM THE PARSER REGISTRY
 * ---------------------------------------------
 * The registry answers "which parser can read this file?" — it only knows about
 * formats that have a working implementation. The upload experience needs a
 * different answer: "what should I tell the author we accept?"
 *
 * Those diverge whenever a format is announced before it is implemented, which
 * is exactly the situation in Phase 2: DOCX upload works, DOCX *parsing* lands
 * in Phase 3. Describing formats declaratively means the upload UI, the file
 * picker's `accept` attribute and the error messages all stay correct through
 * that gap, and Phase 3 flips one field.
 */

export type FormatStatus = 'supported' | 'planned'

export interface InputFormat {
  readonly id: string
  readonly label: string
  /** Lowercase, dot-prefixed. */
  readonly extensions: readonly string[]
  readonly mediaTypes: readonly string[]
  readonly status: FormatStatus
  /** Shown in the upload UI when the format is not yet usable. */
  readonly note?: string
}

export const INPUT_FORMATS: readonly InputFormat[] = [
  {
    id: 'docx',
    label: 'Microsoft Word',
    extensions: ['.docx'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    status: 'supported',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md', '.markdown'],
    mediaTypes: ['text/markdown'],
    status: 'planned',
    note: 'Planned for a later release.',
  },
  {
    id: 'html',
    label: 'HTML',
    extensions: ['.html', '.htm'],
    mediaTypes: ['text/html'],
    status: 'planned',
    note: 'Planned for a later release.',
  },
]

export const supportedFormats: readonly InputFormat[] = INPUT_FORMATS.filter(
  (format) => format.status === 'supported',
)

/** Value for an `<input type="file" accept>` attribute. */
export const fileInputAccept: string = supportedFormats
  .flatMap((format) => [...format.extensions, ...format.mediaTypes])
  .join(',')

/** Human-readable list for UI copy, e.g. `.docx`. */
export const supportedExtensionList: readonly string[] = supportedFormats.flatMap(
  (format) => format.extensions,
)

/**
 * Identify a file's format from its name and reported media type.
 *
 * Extension is checked first and treated as authoritative. Browsers report
 * `application/octet-stream` for `.docx` often enough — particularly on Linux
 * and when a file arrives via drag-and-drop from an archive tool — that
 * trusting the media type alone would reject valid manuscripts.
 */
export function identifyFormat(fileName: string, mediaType: string): InputFormat | undefined {
  const lower = fileName.toLowerCase()
  const byExtension = INPUT_FORMATS.find((format) =>
    format.extensions.some((extension) => lower.endsWith(extension)),
  )
  if (byExtension) return byExtension

  return INPUT_FORMATS.find((format) => format.mediaTypes.includes(mediaType))
}
