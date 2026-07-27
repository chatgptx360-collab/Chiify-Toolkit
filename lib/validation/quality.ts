import type { ValidationCategory } from '../types/validation'
import type { Severity } from '../utils/result'

import {
  CATEGORY_LABEL,
  type CategoryScore,
  type QualityGrade,
  type QualityScore,
  type Readiness,
  type ValidationFinding,
} from './types'

/**
 * Quality scoring.
 *
 * WHY A SCORE AT ALL
 * ------------------
 * A list of forty findings is accurate and useless: an author cannot tell from
 * it whether their book is nearly ready or badly broken. A single number
 * answers that question, and the per-category breakdown then says where to
 * spend the next hour.
 *
 * HOW IT IS CALCULATED, AND WHY IT IS NOT A CONSTANT
 * --------------------------------------------------
 * Each inspector reports how many assertions it made about *this* book. A
 * finding deducts a fraction of one check, weighted by severity. So:
 *
 *     score = 100 x (1 - deductions / checks)
 *
 * Two warnings out of eight metadata checks is a worse metadata score than two
 * warnings out of eighty markup checks, which is correct: the first book has a
 * quarter of its metadata wrong, the second has two small blemishes. A score
 * that ignored the denominator would call them equal, and a score that came
 * from a lookup table would be a lie the author would eventually catch.
 *
 * THE OVERALL SCORE IS NOT THE MEAN
 * ---------------------------------
 * Categories are weighted by how much they cost the reader. A book can be
 * beautiful and unopenable; structure and markup therefore carry more than
 * compatibility, which describes stores rather than the file.
 *
 * READINESS IS SEPARATE FROM SCORE
 * --------------------------------
 * They answer different questions and can disagree. A book with one error and
 * nothing else wrong scores in the nineties and is still not publishable. So
 * readiness is derived from errors and blocking impact, never from the number.
 */

/** What one finding costs, as a fraction of one check. */
const SEVERITY_COST: Readonly<Record<Severity, number>> = {
  error: 1,
  warning: 0.4,
  info: 0.1,
}

/**
 * How much each category contributes to the overall score.
 *
 * Structure and markup decide whether the book works at all. Accessibility and
 * metadata decide whether it can be sold. Resources and compatibility are real
 * but recoverable — an oversized image costs money, not readers.
 */
const CATEGORY_WEIGHT: Readonly<Record<ValidationCategory, number>> = {
  structure: 0.25,
  markup: 0.2,
  accessibility: 0.2,
  metadata: 0.2,
  resources: 0.075,
  compatibility: 0.075,
}

const GRADE_THRESHOLDS: readonly { readonly min: number; readonly grade: QualityGrade }[] = [
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 60, grade: 'D' },
  { min: 0, grade: 'F' },
]

export interface CategoryChecks {
  readonly category: ValidationCategory
  readonly checks: number
}

export interface QualityAnalyzer {
  categories(
    findings: readonly ValidationFinding[],
    checks: readonly CategoryChecks[],
  ): readonly CategoryScore[]
  score(categories: readonly CategoryScore[], findings: readonly ValidationFinding[]): QualityScore
}

export function createQualityAnalyzer(): QualityAnalyzer {
  return {
    categories(findings, checks) {
      const byCategory = new Map<ValidationCategory, number>()

      for (const entry of checks) {
        byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.checks)
      }

      return [...byCategory.entries()]
        .map(([category, count]): CategoryScore => {
          const own = findings.filter((item) => item.category === category)

          const deductions = own.reduce((total, item) => total + SEVERITY_COST[item.severity], 0)

          // A category cannot score below zero however many findings it has:
          // "worse than nothing" is not a meaningful reading.
          const ratio = count === 0 ? 1 : Math.max(0, 1 - deductions / count)

          return {
            category,
            label: CATEGORY_LABEL[category],
            score: Math.round(ratio * 100),
            checks: count,
            errors: own.filter((item) => item.severity === 'error').length,
            warnings: own.filter((item) => item.severity === 'warning').length,
            infos: own.filter((item) => item.severity === 'info').length,
          }
        })
        .sort((a, b) => a.score - b.score)
    },

    score(categories, findings) {
      let weighted = 0
      let totalWeight = 0

      for (const category of categories) {
        const weight = CATEGORY_WEIGHT[category.category]
        weighted += category.score * weight
        totalWeight += weight
      }

      const overall = totalWeight === 0 ? 100 : Math.round(weighted / totalWeight)
      const grade = GRADE_THRESHOLDS.find((entry) => overall >= entry.min)?.grade ?? 'F'
      const readiness = readinessOf(findings)

      return { overall, grade, readiness, headline: headlineFor(readiness, findings, overall) }
    },
  }
}

function readinessOf(findings: readonly ValidationFinding[]): Readiness {
  if (findings.some((item) => item.severity === 'error')) return 'not-publishable'
  if (findings.some((item) => item.impact === 'reach' && item.severity === 'warning')) {
    return 'needs-work'
  }

  return 'retail-ready'
}

function headlineFor(
  readiness: Readiness,
  findings: readonly ValidationFinding[],
  overall: number,
): string {
  const errors = findings.filter((item) => item.severity === 'error').length
  const warnings = findings.filter((item) => item.severity === 'warning').length

  if (readiness === 'not-publishable') {
    return `${errors} ${errors === 1 ? 'problem has' : 'problems have'} to be fixed before this book can be published.`
  }

  if (readiness === 'needs-work') {
    return `This book is valid and will open everywhere. ${warnings} ${warnings === 1 ? 'thing' : 'things'} would stop a retailer accepting it.`
  }

  return `This book passed every check, scoring ${overall} out of 100. It is ready to publish.`
}
