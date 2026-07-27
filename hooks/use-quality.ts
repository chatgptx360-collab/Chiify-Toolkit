'use client'

import * as React from 'react'

import type { Project } from '@/lib/types'
import type {
  CategoryScore,
  CompatibilityAssessment,
  QualityScore,
  ReportSubject,
} from '@/lib/validation'

import { useValidation } from './use-validation'

/**
 * The headline quality numbers for a project.
 *
 * A thin derivation of `useValidation` rather than a second engine run: the
 * score is a view of the report, and computing it separately would let a screen
 * showing "92 out of 100" sit next to a list of four errors.
 *
 * It exists as its own hook because the dashboard and the converter want the
 * number without the hundred findings behind it, and reading a whole report to
 * display one integer makes the dependency look bigger than it is.
 */

export interface QualitySummary {
  readonly score: QualityScore
  readonly categories: readonly CategoryScore[]
  readonly compatibility: CompatibilityAssessment
  readonly subject: ReportSubject
  readonly errors: number
  readonly warnings: number
  readonly infos: number
  readonly totalChecks: number
  readonly checkedAt: string
}

export function useQuality(project: Project | undefined): QualitySummary | undefined {
  const { state } = useValidation(project)

  return React.useMemo(() => {
    const report = state.report
    if (!report) return undefined

    return {
      score: report.score,
      categories: report.categories,
      compatibility: report.compatibility,
      subject: report.subject,
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      infos: report.summary.infos,
      totalChecks: report.totalChecks,
      checkedAt: report.checkedAt,
    }
  }, [state.report])
}
