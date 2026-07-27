import { defaultBookMetadata, defaultProjectSettings } from '../types/project'
import type { BookMetadata, Project, ProjectSettings, SourceFile } from '../types/project'
import { isoNow, type ProjectId } from '../types/common'
import { appError, err, ok, type Result } from '../utils/result'
import { createId } from '../utils/slug'

/**
 * Project storage.
 *
 * WHY AN INTERFACE WITH A LOCAL IMPLEMENTATION
 * -------------------------------------------
 * Chiify is local-first: a manuscript never has to leave the author's machine,
 * which is both a privacy position and the reason the app works offline. But
 * "Cloud Sync" and "User Accounts" are on the roadmap, so the storage mechanism
 * has to be replaceable without touching a single component.
 *
 * `ProjectStore` is that seam. Components never import an implementation —
 * they use the hooks in `hooks/use-projects.ts`, which read from whichever
 * store is installed. Swapping `localStorage` for IndexedDB or an API is a
 * change to one file.
 *
 * WHY `localStorage` RATHER THAN INDEXEDDB TODAY
 * ---------------------------------------------
 * Project records are small JSON documents — a few kilobytes each. IndexedDB's
 * asynchronous, transactional API earns its complexity when storing manuscript
 * *bytes*, which is a Phase 3 concern and will use a separate blob store. Using
 * the simpler API for the simpler data keeps this layer readable.
 *
 * The store is an observable: it notifies subscribers on every write so
 * `useSyncExternalStore` can drive the UI without a global React context.
 */

const STORAGE_KEY = 'chiify:projects:v1'

/** Fields a caller supplies when creating a project. */
export interface CreateProjectInput {
  readonly name: string
  readonly metadata?: Partial<BookMetadata>
  readonly settings?: Partial<ProjectSettings>
}

/** Fields that may be changed after creation. */
export interface UpdateProjectInput {
  readonly name?: string
  readonly metadata?: Partial<BookMetadata>
  readonly settings?: Partial<ProjectSettings>
  readonly source?: SourceFile
  readonly status?: Project['status']
}

export interface ProjectStore {
  /** Snapshot of every project, newest first. Stable between writes. */
  list(): readonly Project[]
  get(id: ProjectId): Project | undefined
  create(input: CreateProjectInput): Result<Project>
  update(id: ProjectId, changes: UpdateProjectInput): Result<Project>
  remove(id: ProjectId): Result<ProjectId>
  /** Register a listener; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

/**
 * Persisted record shape.
 *
 * Versioned by the storage key rather than by a field inside the payload: a
 * breaking change bumps `:v1` to `:v2` and old data is simply not read, which
 * is the honest behaviour for a local cache and avoids shipping migration code
 * for a schema nobody depends on yet.
 */
interface StoredState {
  readonly projects: readonly Project[]
}

function readState(): StoredState {
  if (typeof window === 'undefined') return { projects: [] }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { projects: [] }

    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as StoredState).projects)
    ) {
      return { projects: [] }
    }

    return parsed as StoredState
  } catch {
    // Corrupt or inaccessible storage must not take the app down. An empty
    // library is recoverable; a white screen is not.
    return { projects: [] }
  }
}

function writeState(state: StoredState): Result<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return ok(undefined)
  } catch (cause) {
    return err(
      appError('projects.storage-write-failed', 'Your changes could not be saved.', {
        hint: 'Browser storage may be full or disabled. Check your privacy settings and try again.',
        cause,
      }),
    )
  }
}

function mergeMetadata(base: BookMetadata, changes: Partial<BookMetadata>): BookMetadata {
  // Explicit merge rather than a spread of `changes`: with
  // `exactOptionalPropertyTypes`, spreading an object whose optional keys are
  // present-but-undefined would overwrite good values with `undefined`.
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) next[key] = value
  }
  return next as unknown as BookMetadata
}

function mergeSettings(base: ProjectSettings, changes: Partial<ProjectSettings>): ProjectSettings {
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) next[key] = value
  }
  return next as unknown as ProjectSettings
}

/**
 * Create a store backed by `localStorage`.
 *
 * State is cached in memory and re-read only when another tab writes, so
 * `list()` returns a referentially stable array. That stability is what allows
 * `useSyncExternalStore` to avoid re-rendering on every unrelated update —
 * returning a fresh array from every snapshot call causes an infinite render
 * loop, which is the classic mistake with this hook.
 */
export function createLocalProjectStore(): ProjectStore {
  let cache: readonly Project[] | null = null
  const listeners = new Set<() => void>()

  function snapshot(): readonly Project[] {
    cache ??= [...readState().projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return cache
  }

  function commit(projects: readonly Project[]): Result<void> {
    const result = writeState({ projects })
    if (!result.ok) return result

    cache = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    for (const listener of listeners) listener()
    return ok(undefined)
  }

  return {
    list: snapshot,

    get(id) {
      return snapshot().find((project) => project.id === id)
    },

    create(input) {
      const name = input.name.trim()
      if (!name) {
        return err(
          appError('projects.name-required', 'Give your project a name.', {
            hint: 'Usually the working title of the book.',
          }),
        )
      }

      const timestamp = isoNow()
      const project: Project = {
        id: createId('prj') as ProjectId,
        name,
        status: 'draft',
        // The project name is the most likely book title, so it is used as the
        // default — an author who names a project "The Long Winter" should not
        // have to type it again on the metadata form.
        metadata: mergeMetadata({ ...defaultBookMetadata, title: name }, input.metadata ?? {}),
        settings: mergeSettings(defaultProjectSettings, input.settings ?? {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      const result = commit([project, ...snapshot()])
      return result.ok ? ok(project) : result
    },

    update(id, changes) {
      const existing = snapshot().find((project) => project.id === id)
      if (!existing) return err(projectNotFound(id))

      const name = changes.name?.trim()
      if (changes.name !== undefined && !name) {
        return err(
          appError('projects.name-required', 'A project needs a name.', {
            source: id,
          }),
        )
      }

      const updated: Project = {
        ...existing,
        ...(name ? { name } : {}),
        ...(changes.status ? { status: changes.status } : {}),
        ...(changes.source ? { source: changes.source } : {}),
        metadata: changes.metadata
          ? mergeMetadata(existing.metadata, changes.metadata)
          : existing.metadata,
        settings: changes.settings
          ? mergeSettings(existing.settings, changes.settings)
          : existing.settings,
        updatedAt: isoNow(),
      }

      const result = commit(snapshot().map((project) => (project.id === id ? updated : project)))
      return result.ok ? ok(updated) : result
    },

    remove(id) {
      const exists = snapshot().some((project) => project.id === id)
      if (!exists) return err(projectNotFound(id))

      const result = commit(snapshot().filter((project) => project.id !== id))
      return result.ok ? ok(id) : result
    },

    subscribe(listener) {
      listeners.add(listener)

      // Another tab writing to the same key must invalidate this tab's cache,
      // or two windows of the same app silently disagree about the library.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY) return
        cache = null
        for (const current of listeners) current()
      }
      window.addEventListener('storage', onStorage)

      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}

function projectNotFound(id: string) {
  return appError('projects.not-found', 'That project no longer exists.', {
    source: id,
    hint: 'It may have been deleted in another tab.',
  })
}

/**
 * The store instance the application uses.
 *
 * A module-level singleton because every consumer must observe the same data.
 * Replacing this line is the entire cost of moving to IndexedDB or a server.
 */
export const projectStore: ProjectStore = createLocalProjectStore()
