'use client'

import * as React from 'react'

import type { Project, ValidationCategory } from '@/lib/types'
import {
  CATEGORY_LABEL,
  createAutoFixEngine,
  createValidationEngine,
  type FixProposal,
  type ValidationFinding,
} from '@/lib/validation'

import { useBuild } from './use-build'
import { useProjectActions } from './use-projects'
import { useValidation } from './use-validation'

/**
 * Findings, grouped, with the fixes that can be applied to them.
 *
 * WHY GROUPING IS A HOOK AND NOT A COMPONENT
 * ------------------------------------------
 * The grouping *is* the diagnosis: which area of the book is in trouble, and
 * what would fix it. Doing it in the component that renders the list would mean
 * re-implementing it in the export, and the two would eventually disagree about
 * something an author is making decisions from.
 *
 * NOTHING IS APPLIED WITHOUT A CALL
 * ---------------------------------
 * `proposals` describes changes; `apply` performs one. The separation is the
 * whole promise of the auto-fix engine — the author sees the before and after
 * and chooses. `apply` writes to the project, not to the generated book, so the
 * change survives and takes effect on the next conversion rather than editing a
 * file that has already been built.
 */

export interface DiagnosticGroup {
  readonly category: ValidationCategory
  readonly label: string
  readonly findings: readonly ValidationFinding[]
  readonly errors: number
  readonly warnings: number
}

export interface UseDiagnosticsResult {
  readonly groups: readonly DiagnosticGroup[]
  readonly proposals: readonly FixProposal[]
  /** Look up the proposal that resolves a finding, if there is one. */
  readonly proposalFor: (finding: ValidationFinding) => FixProposal | undefined
  /** Apply one proposal to the project. Returns false if the project is gone. */
  readonly apply: (proposal: FixProposal) => boolean
  readonly applyAll: () => number
}

export function useDiagnostics(project: Project | undefined): UseDiagnosticsResult {
  const { state } = useValidation(project)
  const build = useBuild(project?.id)
  const { update } = useProjectActions()

  const proposals = React.useMemo(() => {
    if (!state.report || !build || !project) return []

    // The subject is rebuilt rather than kept from the validation run: it is
    // cheap, and holding it across renders would pin every image in the book
    // in memory for as long as the screen is open.
    const subject = createValidationEngine().prepare({
      epub: build.outcome.epub,
      files: build.outcome.files,
      binaries: build.outcome.binaries,
      metadata: project.metadata,
      settings: project.settings,
      byteSize: build.outcome.artifact.byteSize,
    })

    return createAutoFixEngine().propose(state.report, subject)
  }, [state.report, build, project])

  const groups = React.useMemo(() => {
    const findings = state.report?.findings ?? []
    const byCategory = new Map<ValidationCategory, ValidationFinding[]>()

    for (const item of findings) {
      const existing = byCategory.get(item.category)
      if (existing) existing.push(item)
      else byCategory.set(item.category, [item])
    }

    return (
      [...byCategory.entries()]
        .map(([category, items]): DiagnosticGroup => ({
          category,
          label: CATEGORY_LABEL[category],
          findings: items,
          errors: items.filter((item) => item.severity === 'error').length,
          warnings: items.filter((item) => item.severity === 'warning').length,
        }))
        // Worst first: the group with errors is the one to open.
        .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings)
    )
  }, [state.report])

  const projectId = project?.id
  const metadata = project?.metadata
  const settings = project?.settings

  const apply = React.useCallback(
    (proposal: FixProposal): boolean => {
      if (!projectId || !metadata || !settings) return false

      const next = proposal.apply({ metadata, settings })
      const result = update(projectId, { metadata: next.metadata, settings: next.settings })

      return result.ok
    },
    [projectId, metadata, settings, update],
  )

  const applyAll = React.useCallback((): number => {
    if (!projectId || !metadata || !settings || proposals.length === 0) return 0

    const next = createAutoFixEngine().applyAll({ metadata, settings }, proposals)
    const result = update(projectId, { metadata: next.metadata, settings: next.settings })

    return result.ok ? proposals.length : 0
  }, [projectId, metadata, settings, proposals, update])

  const proposalFor = React.useCallback(
    (item: ValidationFinding) => proposals.find((proposal) => proposal.rule === item.rule),
    [proposals],
  )

  return { groups, proposals, proposalFor, apply, applyAll }
}
