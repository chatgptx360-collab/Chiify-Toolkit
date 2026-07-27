'use client'

import * as React from 'react'

import { documentStore } from '@/lib/documents'
import type { ParsedDocument, ProjectId } from '@/lib/types'

/**
 * Read the parsed manuscript for a project.
 *
 * Subscribes directly to the document store via `useSyncExternalStore`, the
 * same pattern the project store uses — no provider to mount, and a component
 * re-renders only when the document it reads actually changes.
 *
 * Returns `undefined` when nothing has been parsed this session. That is the
 * normal state after a reload, not an error: documents are derived data and are
 * deliberately not persisted (see `lib/documents/store.ts`).
 */
export function useDocument(projectId: ProjectId | undefined): ParsedDocument | undefined {
  const subscribe = React.useCallback(
    (listener: () => void) => documentStore.subscribe(listener),
    [],
  )

  const getSnapshot = React.useCallback(
    () => (projectId ? documentStore.get(projectId) : undefined),
    [projectId],
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}

export interface DocumentActions {
  readonly store: (projectId: ProjectId, document: ParsedDocument) => void
  readonly discard: (projectId: ProjectId) => void
}

export function useDocumentActions(): DocumentActions {
  return React.useMemo(
    () => ({
      store: (projectId, document) => documentStore.set(projectId, document),
      discard: (projectId) => documentStore.remove(projectId),
    }),
    [],
  )
}
