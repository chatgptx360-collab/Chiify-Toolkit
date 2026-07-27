import type { GenerationOutcome } from '../epub/generator'
import type { ParsedDocument } from '../types/document'
import type { BookMetadata, ProjectSettings } from '../types/project'
import { appError, type AppError, type Result } from '../utils/result'
import { logger } from '../logging'

import {
  crashError,
  type GenerateRequest,
  type GenerateResponse,
  type ParseRequest,
  type ParseResponse,
  type ProgressMessage,
} from './protocol'

/**
 * Running an engine off the main thread.
 *
 * WHY THERE IS A FALLBACK
 * -----------------------
 * Workers are available in every browser Chiify targets, and they are still not
 * guaranteed at runtime: a strict Content-Security-Policy can block worker
 * construction, some embedded webviews omit them, and there is no worker at all
 * in Node, where the test suite runs. A hook that assumed one would turn a
 * recoverable slowdown into a blank screen.
 *
 * So the same work runs in-thread when a worker cannot be created. The
 * application is slower and the interface stutters, which is a fair trade
 * against not working, and the fallback is logged so the cause is visible
 * rather than mysterious.
 *
 * WHY CANCELLING TERMINATES
 * -------------------------
 * An `AbortSignal` cannot cross the boundary, and it would be worse if it
 * could: cooperative cancellation stops at the next checkpoint, while
 * terminating the worker stops now. An author who has changed their mind about
 * a 400-page manuscript gets the interface back immediately.
 *
 * Each job gets a fresh worker. Construction costs a few milliseconds against
 * operations that take seconds, and it means a crashed job cannot leave a
 * poisoned worker behind for the next one.
 */

export interface WorkerJob<TValue> {
  readonly promise: Promise<Result<TValue>>
  /** Stops the work immediately. The promise resolves with a cancellation. */
  cancel(): void
}

export interface ParseInput {
  readonly fileName: string
  readonly mediaType: string
  readonly bytes: ArrayBuffer
  readonly chapterHeadingLevel: 1 | 2 | 3
}

export interface GenerateInput {
  readonly document: ParsedDocument
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
}

export function runParse(
  input: ParseInput,
  onProgress: (ratio: number) => void,
): WorkerJob<ParsedDocument> {
  const request: ParseRequest = { kind: 'parse', ...input }

  return run<ParsedDocument, ParseResponse>({
    operation: 'parse',
    createWorker: () => new Worker(new URL('./parse.worker.ts', import.meta.url)),
    request,
    // The buffer is handed over rather than copied; the caller has already
    // finished with it.
    transfer: [input.bytes],
    onProgress: (message) => onProgress(message.ratio),
    inThread: async (signal) => {
      const { registerBuiltInParsers, resolveParser } = await import('../parser')

      registerBuiltInParsers()

      const resolution = resolveParser({
        fileName: input.fileName,
        mediaType: input.mediaType,
      })

      if (!resolution.ok) return resolution

      return resolution.value.parse(
        { fileName: input.fileName, mediaType: input.mediaType, bytes: input.bytes },
        { chapterHeadingLevel: input.chapterHeadingLevel, signal, onProgress },
      )
    },
  })
}

export function runGenerate(
  input: GenerateInput,
  onProgress: (progress: { ratio: number; stage?: string; label?: string }) => void,
): WorkerJob<GenerationOutcome> {
  const request: GenerateRequest = { kind: 'generate', ...input }

  return run<GenerationOutcome, GenerateResponse>({
    operation: 'generate',
    createWorker: () => new Worker(new URL('./generate.worker.ts', import.meta.url)),
    request,
    transfer: [],
    onProgress: (message) =>
      onProgress({
        ratio: message.ratio,
        ...(message.stage === undefined ? {} : { stage: message.stage }),
        ...(message.label === undefined ? {} : { label: message.label }),
      }),
    inThread: async (signal) => {
      const { createEpubGenerator } = await import('../epub')

      return createEpubGenerator().generate(input, {
        signal,
        onProgress: (progress) =>
          onProgress({ ratio: progress.ratio, stage: progress.stage, label: progress.label }),
      })
    },
  })
}

interface RunOptions<TValue, TResponse> {
  readonly operation: 'parse' | 'generate'
  createWorker(): Worker
  readonly request: unknown
  readonly transfer: Transferable[]
  onProgress(message: ProgressMessage): void
  inThread(signal: AbortSignal): Promise<Result<TValue>>
  readonly _response?: TResponse
}

function run<TValue, TResponse extends ProgressMessage | { type: string }>(
  options: RunOptions<TValue, TResponse>,
): WorkerJob<TValue> {
  const worker = createWorkerOrNull(options)

  if (!worker) return runInThread(options)

  let settled = false
  let cancelled = false
  const done = logger.time(`${options.operation}:worker`)

  const promise = new Promise<Result<TValue>>((resolve) => {
    const finish = (result: Result<TValue>): void => {
      if (settled) return
      settled = true
      done()
      worker.terminate()
      resolve(result)
    }

    worker.addEventListener('message', (event: MessageEvent<ParseResponse | GenerateResponse>) => {
      const message = event.data

      if (message.type === 'progress') {
        options.onProgress(message)
        return
      }

      if (message.type === 'crashed') {
        logger.error(`${options.operation} worker crashed`, message.error)
        finish({ ok: false, error: message.error })
        return
      }

      finish(message.result as Result<TValue>)
    })

    // Fires when the worker throws outside a handler, or is killed by the
    // browser. Without this the promise would never settle and the interface
    // would show a progress bar for ever.
    worker.addEventListener('error', (event) => {
      if (cancelled) return
      logger.error(`${options.operation} worker failed to run`, event.message)
      finish({ ok: false, error: crashError(new Error(event.message), options.operation) })
    })

    worker.addEventListener('messageerror', () => {
      logger.error(`${options.operation} worker sent an uncloneable message`)
      finish({
        ok: false,
        error: appError(
          `${options.operation}.transfer-failed`,
          'The result could not be handed back from the background task.',
          {
            hint: 'This is a fault in Chiify. Reloading the page and trying once more usually clears it.',
          },
        ),
      })
    })

    worker.postMessage(options.request, options.transfer)
  })

  return {
    promise,
    cancel() {
      if (settled) return
      cancelled = true
      settled = true
      done()
      worker.terminate()
    },
  }
}

/**
 * The in-thread path.
 *
 * Identical in behaviour and slower in feel. The dynamic import matters as much
 * as the worker does: it is what keeps the engines out of the main bundle even
 * for a visitor whose browser refuses to create workers.
 */
function runInThread<TValue, TResponse>(options: RunOptions<TValue, TResponse>): WorkerJob<TValue> {
  const controller = new AbortController()
  const done = logger.time(`${options.operation}:in-thread`)

  const promise = options
    .inThread(controller.signal)
    .catch((cause: unknown) => {
      logger.error(`${options.operation} failed in-thread`, cause)
      return { ok: false, error: crashError(cause, options.operation) } as Result<TValue>
    })
    .then((result) => {
      done()
      return result
    })

  return {
    promise,
    cancel: () => controller.abort(),
  }
}

function createWorkerOrNull<TValue, TResponse>(
  options: RunOptions<TValue, TResponse>,
): Worker | null {
  if (typeof Worker === 'undefined') return null

  try {
    return options.createWorker()
  } catch (cause) {
    // Blocked by a Content-Security-Policy, or unsupported in this webview.
    logger.warn(`${options.operation} worker unavailable; running on the main thread`, cause)
    return null
  }
}

/** Cancellation, phrased the same way wherever it is produced. */
export function cancelledError(operation: 'parse' | 'generate', subject: string): AppError {
  return appError(
    `${operation}.cancelled`,
    operation === 'parse'
      ? `Reading “${subject}” was cancelled.`
      : 'Building the EPUB was cancelled.',
    { severity: 'info' },
  )
}
