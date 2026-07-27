'use client'

import * as React from 'react'

import { projectStore } from '@/lib/projects'
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/projects'
import type { Project, ProjectId } from '@/lib/types'
import type { Result } from '@/lib/utils'

/**
 * React bindings for the project store.
 *
 * WHY NOT A CONTEXT PROVIDER
 * --------------------------
 * A `ProjectsProvider` at the root would re-render every consumer whenever any
 * project changed, including the shell. `useSyncExternalStore` subscribes each
 * component directly to the store, so a component that reads one project
 * re-renders only when the store actually changes — and there is no provider to
 * remember to mount, so a component cannot silently render stale data.
 *
 * The server snapshot is an empty list. Projects live in the browser, so the
 * server genuinely has nothing to render; `useProjectsReady` distinguishes
 * "still hydrating" from "no projects yet" so the UI can show a skeleton rather
 * than flashing an empty state at someone who has twelve books.
 */

const EMPTY: readonly Project[] = []

/** Every project, newest first. */
export function useProjects(): readonly Project[] {
  return React.useSyncExternalStore(projectStore.subscribe, projectStore.list, () => EMPTY)
}

/** A single project, or `undefined` if the id does not exist. */
export function useProject(id: ProjectId | undefined): Project | undefined {
  const projects = useProjects()

  return React.useMemo(
    () => (id ? projects.find((project) => project.id === id) : undefined),
    [projects, id],
  )
}

/**
 * False until the client has read from storage.
 *
 * Rendering an empty state during hydration is the difference between "you have
 * no projects" and "your projects are loading" — and getting it wrong looks
 * like data loss.
 */
export function useProjectsReady(): boolean {
  return React.useSyncExternalStore(
    projectStore.subscribe,
    () => true,
    () => false,
  )
}

export interface ProjectActions {
  create: (input: CreateProjectInput) => Result<Project>
  update: (id: ProjectId, changes: UpdateProjectInput) => Result<Project>
  remove: (id: ProjectId) => Result<ProjectId>
}

/**
 * Write operations.
 *
 * Returns `Result` rather than throwing, so a caller decides how to surface a
 * failure — inline for a form, a toast for a background action.
 */
export function useProjectActions(): ProjectActions {
  return React.useMemo(
    () => ({
      create: projectStore.create.bind(projectStore),
      update: projectStore.update.bind(projectStore),
      remove: projectStore.remove.bind(projectStore),
    }),
    [],
  )
}
