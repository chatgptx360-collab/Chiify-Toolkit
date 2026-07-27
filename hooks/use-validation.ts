'use client'

import * as React from 'react'

import { buildStore } from '@/lib/builds'
import type { Project } from '@/lib/types'
import { createValidationEngine, type QualityReport } from '@/lib/validation'

import { useBuild } from './use-build'

/**
 * Validate the generated book for a project.
 *
 * WHY IT RUNS AUTOMATICALLY
 * -------------------------
 * A validation report the author has to ask for is a report most authors never
 * see, and the ones who skip it are the ones who most need it. Checking takes
 * milliseconds on a book of any realistic size, so there is nothing to save by
 * waiting to be asked.
 *
 * WHY THE RESULT GOES BACK INTO THE BUILD STORE
 * ---------------------------------------------
 * Four screens want this report — the report itself, the score, the
 * diagnostics list and the converter's summary. Validation is deterministic, so
 * computing it once and attaching it to the build gives all four the same
 * answer for the price of one, and the cache cannot outlive the book it
 * describes because it is part of it.
 *
 * `revalidate` exists for one case: the author applied a fix and rebuilt. It
 * forces a fresh run rather than reading the attached report.
 */

export interface ValidationState {
  readonly status: 'idle' | 'validating' | 'ready'
  readonly report?: QualityReport
}

export interface UseValidationResult {
  readonly state: ValidationState
  readonly revalidate: () => void
  /** False when there is no generated book to check. */
  readonly canValidate: boolean
}

export function useValidation(project: Project | undefined): UseValidationResult {
  const build = useBuild(project?.id)
  const [nonce, setNonce] = React.useState(0)

  const engine = React.useMemo(() => createValidationEngine(), [])

  const report = React.useMemo(() => {
    if (!build || !project) return undefined

    // Reuse unless the author explicitly asked again: the same book always
    // produces the same report.
    if (build.report && nonce === 0) return build.report

    return engine.analyse({
      epub: build.outcome.epub,
      files: build.outcome.files,
      binaries: build.outcome.binaries,
      metadata: project.metadata,
      settings: project.settings,
      byteSize: build.outcome.artifact.byteSize,
    })
    // `nonce` is a deliberate dependency: it is how `revalidate` forces a run.
  }, [build, project, engine, nonce])

  const projectId = project?.id

  React.useEffect(() => {
    if (projectId && report) buildStore.attachReport(projectId, report)
  }, [projectId, report])

  const revalidate = React.useCallback(() => setNonce((value) => value + 1), [])

  return {
    state: report ? { status: 'ready', report } : { status: 'idle' },
    revalidate,
    canValidate: Boolean(build),
  }
}
