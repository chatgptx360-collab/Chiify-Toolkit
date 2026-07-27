/// <reference lib="webworker" />

import { cloneableError, crashError, type GenerateRequest, type GenerateResponse } from './protocol'

/**
 * The generation worker.
 *
 * The same shape as the parsing worker, for the same reasons: the EPUB engine
 * is unchanged and unaware, JSZip and xmlbuilder2 arrive on first use rather
 * than on page load, and packaging an illustrated book no longer blocks the
 * frame that is drawing its own progress bar.
 *
 * The generated book comes back as a `Blob`, which structured clone handles
 * natively and which the main thread can hand straight to a download or to the
 * preview. No serialisation of the archive happens at the boundary.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.addEventListener('message', (event: MessageEvent<GenerateRequest>) => {
  void run(event.data)
})

async function run(request: GenerateRequest): Promise<void> {
  const post = (message: GenerateResponse): void => {
    scope.postMessage(message)
  }

  try {
    const { createEpubGenerator } = await import('../epub')

    const result = await createEpubGenerator().generate(
      {
        document: request.document,
        metadata: request.metadata,
        settings: request.settings,
      },
      {
        onProgress: (progress) =>
          post({
            type: 'progress',
            ratio: progress.ratio,
            stage: progress.stage,
            label: progress.label,
          }),
      },
    )

    if (!result.ok) {
      post({ type: 'done', result: { ok: false, error: cloneableError(result.error) } })
      return
    }

    // Notices are `AppError`s and may carry a `cause`; strip it as everywhere.
    post({
      type: 'done',
      result: {
        ok: true,
        value: { ...result.value, notices: result.value.notices.map(cloneableError) },
      },
    })
  } catch (cause) {
    post({ type: 'crashed', error: crashError(cause, 'generate') })
  }
}
