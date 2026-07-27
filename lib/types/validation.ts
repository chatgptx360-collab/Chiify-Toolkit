import type { Severity } from '../utils/result'

/**
 * Validation reporting model (Phase 5).
 *
 * Deliberately generic over *what* is being validated: the same report shape
 * describes manuscript problems found during parsing, EPUB spec violations
 * found after generation, and accessibility findings. One shape means one set
 * of UI components renders all of them.
 */

export type ValidationCategory =
  'structure' | 'metadata' | 'markup' | 'accessibility' | 'resources' | 'compatibility'

export interface ValidationIssue {
  readonly id: string
  /** Stable rule identifier, e.g. `epub.nav.missing-toc`. */
  readonly rule: string
  readonly category: ValidationCategory
  readonly severity: Severity
  readonly message: string
  /** Human-readable location, e.g. `text/chapter-03.xhtml:42`. */
  readonly location?: string
  /** The concrete fix, phrased for an author rather than a developer. */
  readonly remedy?: string
}

export interface ValidationReport {
  readonly checkedAt: string
  readonly issues: readonly ValidationIssue[]
  readonly summary: ValidationSummary
}

export interface ValidationSummary {
  readonly errors: number
  readonly warnings: number
  readonly infos: number
  /** A book passes when it has zero errors; warnings are advisory. */
  readonly passed: boolean
}

/**
 * Derive a summary from a list of issues.
 *
 * Lives with the types (not in a component) so the dashboard, the validation
 * page and any future export report cannot disagree about what "passed" means.
 */
export function summariseIssues(issues: readonly ValidationIssue[]): ValidationSummary {
  let errors = 0
  let warnings = 0
  let infos = 0

  for (const issue of issues) {
    if (issue.severity === 'error') errors += 1
    else if (issue.severity === 'warning') warnings += 1
    else infos += 1
  }

  return { errors, warnings, infos, passed: errors === 0 }
}
