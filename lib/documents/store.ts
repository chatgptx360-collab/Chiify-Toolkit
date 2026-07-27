import type { ParsedDocument } from '../types/document'
import type { ProjectId } from '../types/common'

/**
 * Parsed document store.
 *
 * WHY THIS IS IN MEMORY, AND NOT PERSISTED
 * ----------------------------------------
 * A parsed manuscript holds every image as raw bytes. A single illustrated book
 * is tens of megabytes — orders of magnitude past what `localStorage` accepts,
 * and a poor fit for it in any case, since the data is a *derived artefact*
 * rather than something the author typed. Persisting it would trade a large,
 * fragile cache for the ability to skip a parse that takes under a second.
 *
 * So the model lives for the session. Projects (small, authored, precious) are
 * persisted by `lib/projects`; documents (large, derived, reproducible) are
 * not. That split is deliberate and is why the two stores are separate modules
 * rather than one.
 *
 * The consequence is stated in the UI: reopening a project asks for the
 * manuscript again. When Phase 6 adds an IndexedDB blob store, this interface
 * is what it implements — no component changes.
 *
 * Keyed by project rather than document id, because every screen that wants a
 * document already knows which project it is looking at.
 */
export interface DocumentStore {
  get(projectId: ProjectId): ParsedDocument | undefined
  set(projectId: ProjectId, document: ParsedDocument): void
  remove(projectId: ProjectId): void
  clear(): void
  subscribe(listener: () => void): () => void
}

export function createDocumentStore(): DocumentStore {
  const documents = new Map<ProjectId, ParsedDocument>()
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    get(projectId) {
      return documents.get(projectId)
    },

    set(projectId, document) {
      documents.set(projectId, document)
      notify()
    },

    remove(projectId) {
      if (documents.delete(projectId)) notify()
    },

    clear() {
      if (documents.size === 0) return
      documents.clear()
      notify()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * The instance the application uses.
 *
 * A module singleton for the same reason the project store is one: every
 * consumer must observe the same data. Replacing this line is the whole cost of
 * moving to persistent storage.
 */
export const documentStore: DocumentStore = createDocumentStore()
