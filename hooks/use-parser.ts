'use client'

import * as React from 'react'

import { resolveParser } from '@/lib/parser'
import type { ParsedDocument } from '@/lib/types'
import type { AppError, Result } from '@/lib/utils'

/**
 * The parsing primitive.
 *
 * Owns exactly one thing: running a file through whichever parser claims it,
 * while reporting progress and supporting cancellation. It knows nothing about
 * projects, storage or the UI, which is what makes it reusable by the upload
 * screen, the converter and anything Phase 4 adds.
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
  const controllerRef = React.useRef<AbortController | null>(null)

  // A parse that finishes after the component unmounts must not call setState.
  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    },
    [],
  )

  const update = React.useCallback((next: ParseState) => {
    if (mountedRef.current) setState(next)
  }, [])

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    update(IDLE)
  }, [update])

  const reset = React.useCallback(() => update(IDLE), [update])

  const parse = React.useCallback<UseParserResult['parse']>(
    async (file, options = {}) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      update({ stage: 'reading', progress: 0 })

      const resolution = resolveParser({ fileName: file.name, mediaType: file.type })
      if (!resolution.ok) {
        update({ stage: 'error', progress: 0, error: resolution.error })
        return resolution
      }

      let bytes: ArrayBuffer
      try {
        bytes = await file.arrayBuffer()
      } catch (cause) {
        const error: AppError = {
          code: 'upload.read-failed',
          message: `“${file.name}” could not be read from your device.`,
          severity: 'error',
          source: file.name,
          hint: 'If the file is on a network drive or in cloud storage, copy it locally first.',
          cause,
        }
        update({ stage: 'error', progress: 0, error })
        return { ok: false, error }
      }

      if (controller.signal.aborted) return { ok: false, error: cancelledError(file.name) }

      update({ stage: 'parsing', progress: READ_SHARE })

      const result = await resolution.value.parse(
        { fileName: file.name, mediaType: file.type, bytes },
        {
          chapterHeadingLevel: options.chapterHeadingLevel ?? 1,
          signal: controller.signal,
          onProgress: (ratio) =>
            update({
              stage: 'parsing',
              progress: READ_SHARE + ratio * (1 - READ_SHARE),
            }),
        },
      )

      if (controller.signal.aborted) return { ok: false, error: cancelledError(file.name) }

      update(
        result.ok
          ? { stage: 'done', progress: 1, document: result.value }
          : { stage: 'error', progress: 0, error: result.error },
      )

      controllerRef.current = null
      return result
    },
    [update],
  )

  return { state, parse, cancel, reset }
}

function cancelledError(fileName: string): AppError {
  return {
    code: 'upload.cancelled',
    message: 'Reading the manuscript was cancelled.',
    severity: 'info',
    source: fileName,
  }
}
