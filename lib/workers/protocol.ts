import type { GenerationOutcome } from '../epub/generator'
import type { ParsedDocument } from '../types/document'
import type { BookMetadata, ProjectSettings } from '../types/project'
import type { AppError, Result } from '../utils/result'

/**
 * The worker protocol.
 *
 * WHY THERE IS A PROTOCOL AT ALL
 * ------------------------------
 * Parsing a manuscript and building a book are the two operations in Chiify
 * that take real time — seconds on a long, illustrated book. Run on the main
 * thread they freeze the entire interface: the progress bar they are reporting
 * to cannot repaint, the cancel button cannot be clicked, and the browser
 * eventually offers to kill the page. Moving them to a worker is the single
 * change that makes the application feel like software rather than a demo.
 *
 * It also has a second effect that turned out to matter as much. Both engines
 * pull in large libraries — mammoth and JSZip together are over 700 KB — and
 * because a hook re-exported them, every page shipped them. Someone opening the
 * dashboard downloaded the entire DOCX parser to look at a list of projects.
 * Behind a worker they are fetched on first use and never on the main thread.
 *
 * WHAT CAN CROSS THE BOUNDARY
 * ---------------------------
 * Structured clone, not JSON: `ArrayBuffer`, `Blob` and `Map` survive, but
 * functions do not. That shapes the protocol in two ways.
 *
 *   - Progress cannot be a callback. It is a message, posted as work proceeds.
 *   - `AbortSignal` cannot be sent. Cancellation terminates the worker instead,
 *     which stops the work immediately rather than at the next checkpoint —
 *     strictly better than the cooperative version, and free.
 *
 * `cause` is stripped from every error that crosses. It holds whatever the
 * failure carried — often a native exception, sometimes a value from a
 * dependency — and a single non-cloneable field would turn a useful error
 * message into "an object could not be cloned". The cause is logged where it
 * happened; what the author needs is the message and the hint.
 */

export interface ParseRequest {
  readonly kind: 'parse'
  readonly fileName: string
  readonly mediaType: string
  /** Transferred, not copied — a 60 MB manuscript is not duplicated. */
  readonly bytes: ArrayBuffer
  readonly chapterHeadingLevel: 1 | 2 | 3
}

export interface GenerateRequest {
  readonly kind: 'generate'
  readonly document: ParsedDocument
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
}

export type WorkerRequest = ParseRequest | GenerateRequest

/** Progress, as a message rather than a callback. */
export interface ProgressMessage {
  readonly type: 'progress'
  /** 0–1 across the whole operation. */
  readonly ratio: number
  /** Present for generation, which has named stages. */
  readonly stage?: string
  readonly label?: string
}

export interface DoneMessage<TValue> {
  readonly type: 'done'
  readonly result: Result<TValue>
}

/**
 * The worker itself threw.
 *
 * Distinct from a `done` carrying a failed `Result`: that is an expected
 * outcome the engine describes, this is a bug or an out-of-memory. Both reach
 * the author as an `AppError`; only one is worth a log line at error level.
 */
export interface CrashMessage {
  readonly type: 'crashed'
  readonly error: AppError
}

export type ParseResponse = ProgressMessage | DoneMessage<ParsedDocument> | CrashMessage
export type GenerateResponse = ProgressMessage | DoneMessage<GenerationOutcome> | CrashMessage

/**
 * Strip anything that cannot survive a structured clone.
 *
 * Applied to every error leaving a worker. Losing `cause` costs nothing the
 * author can use and prevents a clone failure from replacing a written
 * explanation with a DOM exception.
 */
export function cloneableError(error: AppError): AppError {
  const { code, message, severity, source, hint } = error

  return {
    code,
    message,
    severity,
    ...(source === undefined ? {} : { source }),
    ...(hint === undefined ? {} : { hint }),
  }
}

/** The message a crashed worker sends, built from whatever was thrown. */
export function crashError(cause: unknown, operation: 'parse' | 'generate'): AppError {
  const outOfMemory =
    cause instanceof Error && /out of memory|allocation failed/i.test(cause.message)

  if (outOfMemory) {
    return {
      code: `${operation}.out-of-memory`,
      message: 'This book is too large for your browser to hold in memory.',
      severity: 'error',
      hint: 'Close other tabs and try again. If it still fails, splitting the manuscript into two files is the reliable fix.',
    }
  }

  return {
    code: `${operation}.unexpected-failure`,
    message:
      operation === 'parse'
        ? 'Something went wrong while reading your manuscript.'
        : 'Something went wrong while building your book.',
    severity: 'error',
    hint: 'This is a fault in Chiify rather than in your file. Trying again is worth a moment — if it happens twice, the file is likely to be unusual in a way worth reporting.',
  }
}
