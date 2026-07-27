'use client'

import * as React from 'react'

import { logger } from '@/lib/logging'
import type { ParsedDocument } from '@/lib/types'
import { appError, type AppError, type Result } from '@/lib/utils'
import { cancelledError, runParse, type WorkerJob } from '@/lib/workers'

/**
 * The parsing primitive.
 *
 * Owns exactly one thing: running a file through the parser while reporting
 * progress and supporting cancellation. It knows nothing about projects,
 * storage or the UI, which is what makes it reusable by the upload screen, the
 * converter and anything a later phase adds.
 *
 * WHY THE WORK IS NOT DONE HERE
 * -----------------------------
 * Parsing happens in a worker (`lib/workers`). On a long manuscript it takes
 * seconds, and on the main thread those seconds are ones where the progress bar
 * cannot repaint and the cancel button cannot be clicked — the interface
 * appears to have crashed at precisely the moment it is working hardest.
 *
 * The hook is unchanged in shape by that: it still returns a promise and a
 * cancel function. What changed is that cancelling now stops the work
 * immediately instead of at the parser's next checkpoint.
 *
 * `useUpload` composes this with the project store. Components should generally
 * use that; this hook is for callers that want the model and nothing else.
 */

export type ParseStage = 'idle' | 'reading' | 'parsing' | 'done' | 'error'

export interface ParseState {
  readonly stage: ParseStage
  /** 0–1. Reading the file is included, so the bar starts moving immediately. */
  readonly progress: number
  readonly error?: AppError
  readonly document?: ParsedDocument
}

const IDLE: ParseState = { stage: 'idle', progress: 0 }

/** Reading the file off disk is roughly a tenth of the work. */
const READ_SHARE = 0.1

export interface UseParserResult {
  readonly state: ParseState
  readonly parse: (
    file: File,
    options?: { chapterHeadingLevel?: 1 | 2 | 3 },
  ) => Promise<Result<ParsedDocument>>
  readonly cancel: () => void
  readonly reset: () => void
}

export function useParser(): UseParserResult {
  const [state, setState] = React.useState<ParseState>(IDLE)
  const jobRef = React.useRef<WorkerJob<ParsedDocument> | null>(null)

  // A parse that finishes after the component unmounts must not call setState,
  // and a worker left running after unmount is a leaked thread.
  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
      jobRef.current?.cancel()
    },
    [],
  )

  const update = React.useCallback((next: ParseState) => {
    if (mountedRef.current) setState(next)
  }, [])

  const cancel = React.useCallback(() => {
    jobRef.current?.cancel()
    jobRef.current = null
    update(IDLE)
  }, [update])

  const reset = React.useCallback(() => update(IDLE), [update])

  const parse = React.useCallback<UseParserResult['parse']>(
    async (file, options = {}) => {
      jobRef.current?.cancel()

      update({ stage: 'reading', progress: 0 })

      let bytes: ArrayBuffer
      try {
        bytes = await file.arrayBuffer()
      } catch (cause) {
        logger.error('reading the file failed', cause)

        const error = appError(
          'upload.read-failed',
          `“${file.name}” could not be read from your device.`,
          {
            source: file.name,
            hint: 'If the file is on a network drive or in cloud storage, copy it to your computer first, then try again.',
            cause,
          },
        )

        update({ stage: 'error', progress: 0, error })
        return { ok: false, error }
      }

      update({ stage: 'parsing', progress: READ_SHARE })

      const job = runParse(
        {
          fileName: file.name,
          mediaType: file.type,
          bytes,
          chapterHeadingLevel: options.chapterHeadingLevel ?? 1,
        },
        (ratio) => update({ stage: 'parsing', progress: READ_SHARE + ratio * (1 - READ_SHARE) }),
      )

      jobRef.current = job

      const result = await job.promise

      // Cancelling replaces the job reference, so a stale one finishing must
      // not overwrite the state of whatever replaced it.
      if (jobRef.current !== job) {
        return { ok: false, error: cancelledError('parse', file.name) }
      }

      jobRef.current = null

      update(
        result.ok
          ? { stage: 'done', progress: 1, document: result.value }
          : { stage: 'error', progress: 0, error: result.error },
      )

      return result
    },
    [update],
  )

  return { state, parse, cancel, reset }
}
