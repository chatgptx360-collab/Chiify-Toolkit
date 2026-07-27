'use client'

import * as React from 'react'

import {
  DEFAULT_DEVICE_ID,
  DEFAULT_PREFERENCES,
  createPreviewRenderer,
  deviceById,
  type PreviewChapter,
  type PreviewDevice,
  type ReaderPreferences,
} from '@/lib/preview'
import type { Project } from '@/lib/types'

import { useBuild } from './use-build'

/**
 * Read the generated book.
 *
 * WHY THE RENDERED DOCUMENT IS MEMOISED ON THE CHAPTER AND THE PREFERENCES
 * -----------------------------------------------------------------------
 * The rendered string is handed to an iframe's `srcdoc`. A new string — even an
 * identical one — makes the browser tear the document down and rebuild it,
 * which scrolls the reader back to the top. Memoising means dragging the font
 * size slider re-renders the page in place, and changing nothing changes
 * nothing.
 *
 * WHY POSITION IS TRACKED BY HREF AND NOT BY INDEX
 * ------------------------------------------------
 * Rebuilding the book can change how many chapters there are. An index survives
 * that and points somewhere else; an href either still exists or the reader
 * falls back to the first page, which is the honest outcome.
 */

export interface UsePreviewResult {
  readonly chapters: readonly PreviewChapter[]
  readonly chapter: PreviewChapter | undefined
  /** The full HTML document for the current chapter and settings. */
  readonly document: string | undefined
  readonly preferences: ReaderPreferences
  readonly device: PreviewDevice
  readonly setPreferences: (changes: Partial<ReaderPreferences>) => void
  readonly setDevice: (id: string) => void
  readonly goTo: (href: string) => void
  readonly next: () => void
  readonly previous: () => void
  readonly position: { readonly index: number; readonly total: number }
  readonly canPreview: boolean
}

const EMPTY_CHAPTERS: readonly PreviewChapter[] = []

export function usePreview(project: Project | undefined): UsePreviewResult {
  const build = useBuild(project?.id)

  const [preferences, setPreferencesState] = React.useState<ReaderPreferences>(DEFAULT_PREFERENCES)
  const [deviceId, setDeviceId] = React.useState(DEFAULT_DEVICE_ID)
  const [href, setHref] = React.useState<string | undefined>(undefined)

  const renderer = React.useMemo(() => {
    if (!build) return undefined

    return createPreviewRenderer({
      epub: build.outcome.epub,
      files: build.outcome.files,
      binaries: build.outcome.binaries,
    })
  }, [build])

  // Memoised so the empty-book case does not produce a new array each render,
  // which would invalidate every downstream memo on every keystroke.
  const chapters = React.useMemo(() => renderer?.chapters ?? EMPTY_CHAPTERS, [renderer])

  // Reading order, not manifest order: the cover and the contents are pages a
  // reader can open, but paging forward should follow the book.
  const reading = React.useMemo(
    () => chapters.filter((chapter) => chapter.linear || chapter.href.endsWith('cover.xhtml')),
    [chapters],
  )

  const chapter =
    (href ? chapters.find((candidate) => candidate.href === href) : undefined) ?? reading[0]

  const document = React.useMemo(
    () => (renderer && chapter ? renderer.render(chapter, preferences) : undefined),
    [renderer, chapter, preferences],
  )

  const index = chapter ? reading.findIndex((candidate) => candidate.href === chapter.href) : -1

  const goTo = React.useCallback((target: string) => setHref(target), [])

  const step = React.useCallback(
    (delta: number) => {
      const current = reading.findIndex((candidate) => candidate.href === chapter?.href)
      const next = reading[current + delta]
      if (next) setHref(next.href)
    },
    [reading, chapter],
  )

  const setPreferences = React.useCallback((changes: Partial<ReaderPreferences>) => {
    setPreferencesState((current) => ({ ...current, ...changes }))
  }, [])

  return {
    chapters,
    chapter,
    document,
    preferences,
    device: deviceById(deviceId),
    setPreferences,
    setDevice: setDeviceId,
    goTo,
    next: () => step(1),
    previous: () => step(-1),
    position: { index: index === -1 ? 0 : index, total: reading.length },
    canPreview: Boolean(build && chapters.length > 0),
  }
}
