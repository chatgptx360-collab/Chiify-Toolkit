'use client'

import * as React from 'react'

import { buildStore } from '@/lib/builds'
import { createEpubGenerator, type GenerationOutcome, type GenerationStage } from '@/lib/epub'
import { isoNow, type Project } from '@/lib/types'
import type { AppError } from '@/lib/utils'

import { useDocument } from './use-document'
import { useProjectActions } from './use-projects'

/**
 * EPUB generation, bound to a project.
 *
 * Keeps the generator out of components entirely: a screen asks to build a
 * book and receives progress plus an artifact. It never learns what an OPF is.
 *
 * The project's status is moved to `converting` and then `converted` or
 * `failed`, so a long build is visible everywhere the project appears rather
 * than only on the screen that started it.
 */

export interface EpubState {
  readonly status: 'idle' | 'generating' | 'ready' | 'error'
  readonly stage?: GenerationStage
  readonly label?: string
  /** 0–1. */
  readonly progress: number
  readonly error?: AppError
  readonly outcome?: GenerationOutcome
}

const IDLE: EpubState = { status: 'idle', progress: 0 }

export interface UseEpubResult {
  readonly state: EpubState
  readonly generate: () => Promise<void>
  readonly download: () => void
  readonly cancel: () => void
  readonly reset: () => void
  /** False when there is no parsed manuscript to convert. */
  readonly canGenerate: boolean
}

export function useEpub(project: Project | undefined): UseEpubResult {
  const document = useDocument(project?.id)
  const { update } = useProjectActions()
  const [state, setState] = React.useState<EpubState>(IDLE)
  const controllerRef = React.useRef<AbortController | null>(null)

  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    },
    [],
  )

  const update_ = React.useCallback((next: EpubState) => {
    if (mountedRef.current) setState(next)
  }, [])

  // A new manuscript invalidates a previously generated book: offering a
  // download of the *old* EPUB after re-uploading would hand the author a file
  // that no longer matches their manuscript.
  const documentId = document?.id
  const lastDocumentRef = React.useRef(documentId)
  if (lastDocumentRef.current !== documentId) {
    lastDocumentRef.current = documentId
    if (state.status !== 'idle') setState(IDLE)
    // The stored build describes the previous manuscript, so the preview and
    // the validation report must go with it rather than describe a book the
    // author can no longer download.
    if (project) buildStore.remove(project.id)
  }

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    update_(IDLE)
  }, [update_])

  const reset = React.useCallback(() => update_(IDLE), [update_])

  const generate = React.useCallback(async () => {
    if (!project || !document) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    update_({ status: 'generating', progress: 0, stage: 'preparing' })
    update(project.id, { status: 'converting' })

    const result = await createEpubGenerator().generate(
      { document, metadata: project.metadata, settings: project.settings },
      {
        signal: controller.signal,
        onProgress: (progress) =>
          update_({
            status: 'generating',
            stage: progress.stage,
            label: progress.label,
            progress: progress.ratio,
          }),
      },
    )

    controllerRef.current = null

    if (!result.ok) {
      // A cancellation is not a failure: the project goes back to ready, not
      // to an error state the author has to clear.
      update(project.id, { status: result.error.severity === 'info' ? 'ready' : 'failed' })
      update_({ status: 'error', progress: 0, error: result.error })
      return
    }

    // Published to the build store before the local state, so the preview and
    // validation screens are ready the instant the converter says it is done.
    buildStore.set({
      projectId: project.id,
      documentId: document.id,
      builtAt: isoNow(),
      outcome: result.value,
    })

    update(project.id, { status: 'converted' })
    update_({ status: 'ready', progress: 1, outcome: result.value })
  }, [project, document, update, update_])

  /**
   * Save the generated file.
   *
   * An object URL rather than a data URI: a data URI holds the whole book in
   * the URL string, which browsers cap well below the size of an illustrated
   * manuscript. The URL is revoked on the next tick — long enough for the
   * download to start, short enough not to leak the blob for the session.
   */
  const download = React.useCallback(() => {
    const artifact = state.outcome?.artifact
    if (!artifact) return

    const url = URL.createObjectURL(artifact.blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = artifact.fileName
    window.document.body.append(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [state.outcome])

  return {
    state,
    generate,
    download,
    cancel,
    reset,
    canGenerate: Boolean(project && document),
  }
}
