import type { GenerationOutcome } from '../epub/generator'
import type { DocumentId, IsoDateTime, ProjectId } from '../types/common'
import type { QualityReport } from '../validation/types'

/**
 * Generated book store.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * Phase 4 kept the generated book in the state of the component that built it,
 * which was correct while conversion and download happened on one screen. Phase
 * 5 adds two more screens that need the same book — the preview and the
 * validation report — and neither of them is a child of the converter. Passing
 * it down would mean lifting the book into a shared parent that has no other
 * reason to exist, or regenerating it on each screen, which is slow and can
 * produce a *different* file if the project changed in between.
 *
 * So the latest build is stored per project, exactly as the parsed document is,
 * and every screen reads the same one.
 *
 * WHY THE REPORT IS STORED WITH IT
 * --------------------------------
 * Validation is deterministic: the same book always produces the same report.
 * Four hooks want it — the report, the score, the diagnostics and the badge on
 * the dashboard — and computing it four times would be four times the work for
 * an identical answer. Attaching it to the build means it is computed once, and
 * it cannot outlive the book it describes, which is the failure mode a separate
 * cache would eventually have.
 *
 * IN MEMORY, FOR THE SAME REASON AS DOCUMENTS
 * -------------------------------------------
 * A generated book holds every image twice — once as a blob and once inside the
 * package. It is derived data, reproducible in seconds from the manuscript, and
 * far too large for `localStorage`. Projects are persisted; builds are not.
 */

export interface BuildRecord {
  readonly projectId: ProjectId
  /** Which parsed manuscript this was built from, so a re-upload invalidates it. */
  readonly documentId: DocumentId
  readonly builtAt: IsoDateTime
  readonly outcome: GenerationOutcome
  /** Attached by the validation hook once the report has been computed. */
  readonly report?: QualityReport
}

export interface BuildStore {
  get(projectId: ProjectId): BuildRecord | undefined
  set(record: BuildRecord): void
  /** Attach a report to an existing build; a no-op if the build has been replaced. */
  attachReport(projectId: ProjectId, report: QualityReport): void
  remove(projectId: ProjectId): void
  clear(): void
  subscribe(listener: () => void): () => void
}

export function createBuildStore(): BuildStore {
  const builds = new Map<ProjectId, BuildRecord>()
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    get(projectId) {
      return builds.get(projectId)
    },

    set(record) {
      builds.set(record.projectId, record)
      notify()
    },

    attachReport(projectId, report) {
      const existing = builds.get(projectId)
      if (!existing || existing.report === report) return

      builds.set(projectId, { ...existing, report })
      notify()
    },

    remove(projectId) {
      if (builds.delete(projectId)) notify()
    },

    clear() {
      if (builds.size === 0) return
      builds.clear()
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

/** The instance the application uses; one store, so every screen agrees. */
export const buildStore: BuildStore = createBuildStore()
