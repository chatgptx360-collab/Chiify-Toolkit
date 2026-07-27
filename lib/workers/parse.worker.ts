/// <reference lib="webworker" />

import { cloneableError, crashError, type ParseRequest, type ParseResponse } from './protocol'

/**
 * The parsing worker.
 *
 * Thin by design: it receives bytes, calls the parser, and posts what comes
 * back. Every decision about how a `.docx` becomes a document model stays in
 * `lib/parser`, which has no idea it is running off the main thread — that
 * independence is exactly what made this file possible to add in one phase
 * rather than as a rewrite.
 *
 * The parser is imported dynamically. A static import would put mammoth in the
 * worker's initial chunk, which is downloaded when the worker is constructed —
 * and the worker is constructed when the converter screen mounts, not when an
 * author actually picks a file.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.addEventListener('message', (event: MessageEvent<ParseRequest>) => {
  void run(event.data)
})

async function run(request: ParseRequest): Promise<void> {
  const post = (message: ParseResponse): void => {
    scope.postMessage(message)
  }

  try {
    const { registerBuiltInParsers, resolveParser } = await import('../parser')

    // Registration lives with the work rather than in the provider tree, so
    // the engine is loaded by the thread that uses it and by no other.
    registerBuiltInParsers()

    const resolution = resolveParser({
      fileName: request.fileName,
      mediaType: request.mediaType,
    })

    if (!resolution.ok) {
      post({ type: 'done', result: { ok: false, error: cloneableError(resolution.error) } })
      return
    }

    const result = await resolution.value.parse(
      {
        fileName: request.fileName,
        mediaType: request.mediaType,
        bytes: request.bytes,
      },
      {
        chapterHeadingLevel: request.chapterHeadingLevel,
        onProgress: (ratio) => post({ type: 'progress', ratio }),
      },
    )

    if (!result.ok) {
      post({ type: 'done', result: { ok: false, error: cloneableError(result.error) } })
      return
    }

    // The document owns every image as an ArrayBuffer. Transferring them hands
    // the memory over rather than copying it, which on an illustrated book is
    // the difference between one allocation and two.
    const transfer = result.value.assets.map((asset) => asset.bytes)

    scope.postMessage({ type: 'done', result }, transfer)
  } catch (cause) {
    post({ type: 'crashed', error: crashError(cause, 'parse') })
  }
}
