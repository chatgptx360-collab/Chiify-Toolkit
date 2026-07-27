import type { ParsedDocument } from '../types/document'
import type { Result } from '../utils/result'

/**
 * Parser ports.
 *
 * `lib/parser` owns exactly one job: turn bytes in some authoring format into
 * the internal document model. It knows nothing about EPUB, and nothing about
 * React. Phase 3 implements `DocumentParser` for DOCX; later formats implement
 * the same interface and register themselves.
 */

/** Options a caller can pass to influence structure detection. */
export interface ParseOptions {
  /** Heading level that begins a new chapter. */
  readonly chapterHeadingLevel: 1 | 2 | 3
  /**
   * Keep unrecognised styles as `role` hints on paragraphs instead of
   * discarding them. Defaults to true: losing an author's semantic intent is
   * worse than carrying an unknown role that generators can ignore.
   */
  readonly preserveUnknownRoles?: boolean
  /** Reports progress 0–1 for long parses. */
  readonly onProgress?: (ratio: number) => void
  readonly signal?: AbortSignal
}

/** Input to a parser: a named blob of bytes. */
export interface ParseInput {
  readonly fileName: string
  readonly mediaType: string
  readonly bytes: ArrayBuffer
}

/**
 * A parser for one authoring format.
 *
 * `canParse` is separate from `parse` so the registry can pick an
 * implementation without instantiating or reading the whole file.
 */
export interface DocumentParser {
  /** Stable identifier, e.g. `docx`. */
  readonly id: string
  readonly label: string
  /** Media types this parser claims, used for `accept` attributes in the UI. */
  readonly mediaTypes: readonly string[]
  /** File extensions, lowercase and dot-prefixed, e.g. `.docx`. */
  readonly extensions: readonly string[]

  canParse(input: Pick<ParseInput, 'fileName' | 'mediaType'>): boolean
  parse(input: ParseInput, options: ParseOptions): Promise<Result<ParsedDocument>>
}
