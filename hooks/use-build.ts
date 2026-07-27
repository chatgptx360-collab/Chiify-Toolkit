'use client'

import * as React from 'react'

import { buildStore, type BuildRecord } from '@/lib/builds'
import type { ProjectId } from '@/lib/types'

/**
 * Read the most recent generated book for a project.
 *
 * The same `useSyncExternalStore` binding as `useDocument`, for the same
 * reasons: no provider to mount, and a screen re-renders only when the build it
 * is reading actually changes.
 *
 * `undefined` means nothing has been generated this session — the normal state
 * after a reload, since builds are derived data and are not persisted.
 */
export function useBuild(projectId: ProjectId | undefined): BuildRecord | undefined {
  const subscribe = React.useCallback((listener: () => void) => buildStore.subscribe(listener), [])

  const getSnapshot = React.useCallback(
    () => (projectId ? buildStore.get(projectId) : undefined),
    [projectId],
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
