import type { GeneratedFile, PackagedBinary } from '../epub/types'
import type { EpubPackage } from '../types/epub'
import type { BookMetadata, ProjectSettings } from '../types/project'
import type { ValidationCategory, ValidationIssue, ValidationSummary } from '../types/validation'
import type { Severity } from '../utils/result'

import type { XmlElement, XmlScanError } from './xml-scan'

/**
 * Validation domain types.
 *
 * WHERE THIS SITS
 * ---------------
 * `lib/validation` reads an EPUB package and reports on it. The dependency runs
 * one way only: validation imports from `lib/epub`, and `lib/epub` has never
 * heard of validation. That is what lets the generator be used without the
 * validator, and what stops a fix to a rule from being able to change the
 * bytes of a book.
 *
 * It knows EPUB internals because it must — checking a manifest requires
 * knowing what a manifest is. Nothing above it does: the UI receives findings,
 * scores and proposals, and never learns what an OPF is.
 *
 * ONE FINDING SHAPE, EXTENDED
 * ---------------------------
 * `ValidationIssue` (Phase 1) is the shape the whole application already
 * renders. A finding is that, plus two things the report needs and the issue
 * list does not: what the problem actually costs the author, and how confident
 * the rule is. Extending rather than replacing means the dashboard, the
 * validation page and any export are still reading one type.
 */

/**
 * What a finding costs, which is not the same as how severe it is.
 *
 * Severity answers "is the book broken". Impact answers "what happens to me if
 * I ignore this", and that is the question an author is actually asking. A
 * missing ISBN is not an error — the file opens perfectly — but it will get the
 * book refused by every retailer, which matters more to them than a warning
 * about an image format one old device cannot display.
 */
export type FindingImpact =
  /** The file is invalid or will not open. */
  | 'blocking'
  /** It opens, but the reading experience is visibly wrong. */
  | 'reading'
  /** It opens and reads fine, but a store or device will refuse or degrade it. */
  | 'reach'
  /** Worth knowing; nothing is wrong. */
  | 'advisory'

export interface ValidationFinding extends ValidationIssue {
  readonly impact: FindingImpact
  /** Set when the auto-fix engine can offer a concrete change for this rule. */
  readonly fixable?: boolean
}

/**
 * Everything an inspector is allowed to look at.
 *
 * Assembled once by the engine, so seven inspectors do not each re-scan the
 * same markup. Inspectors receive it read-only and return findings; none of
 * them can mutate the book, which is the structural version of the promise
 * that validation never silently changes the author's content.
 */
export interface InspectionSubject {
  readonly epub: EpubPackage
  readonly files: readonly GeneratedFile[]
  readonly binaries: readonly PackagedBinary[]
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
  /** Scanned XHTML documents, in spine order where one applies. */
  readonly documents: readonly InspectedDocument[]
  /** Every href the manifest declares, for resolving references. */
  readonly manifestHrefs: ReadonlySet<string>
  /** Total size of the packaged book in bytes. */
  readonly byteSize: number
}

export interface InspectedDocument {
  /** Path relative to the package document, e.g. `text/chapter-01.xhtml`. */
  readonly href: string
  readonly source: string
  readonly elements: readonly XmlElement[]
  readonly ids: ReadonlySet<string>
  readonly errors: readonly XmlScanError[]
  readonly mediaType: string
}

/**
 * One area of the book, checked in isolation.
 *
 * `checks` is the number of assertions the inspector actually made on *this*
 * book, not a constant. It is what turns findings into a score: a book with two
 * warnings out of eight metadata checks is in worse shape than one with two
 * warnings out of eighty markup checks, and a score that ignored the
 * denominator would call them equal.
 */
export interface Inspector {
  readonly id: string
  readonly category: ValidationCategory
  readonly title: string
  inspect(subject: InspectionSubject): InspectionResult
}

export interface InspectionResult {
  readonly findings: readonly ValidationFinding[]
  readonly checks: number
}

/** Per-category score, derived from that category's findings and check count. */
export interface CategoryScore {
  readonly category: ValidationCategory
  readonly label: string
  /** 0–100. */
  readonly score: number
  readonly checks: number
  readonly errors: number
  readonly warnings: number
  readonly infos: number
}

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

/**
 * Whether the book can be published, which is a different question from
 * whether it is good.
 */
export type Readiness =
  /** No errors and nothing that blocks a retailer. */
  | 'retail-ready'
  /** Valid and readable, but a store will ask for changes. */
  | 'needs-work'
  /** Invalid: it will be rejected or will not open. */
  | 'not-publishable'

export interface QualityScore {
  /** 0–100, the weighted mean of the category scores. */
  readonly overall: number
  readonly grade: QualityGrade
  readonly readiness: Readiness
  /** The single sentence to show at the top of the report. */
  readonly headline: string
}

/** How a named reading system or store handles this particular book. */
export interface CompatibilityTarget {
  readonly id: string
  readonly name: string
  readonly vendor: string
  readonly status: 'supported' | 'degraded' | 'rejected'
  /** Plain-language notes, already ordered worst first. */
  readonly notes: readonly string[]
}

export interface CompatibilityAssessment {
  readonly targets: readonly CompatibilityTarget[]
  readonly supported: number
  readonly total: number
}

/** What the report says about the book itself, so an export stands alone. */
export interface ReportSubject {
  readonly title: string
  readonly authors: readonly string[]
  readonly language: string
  readonly identifier: string
  readonly chapters: number
  readonly images: number
  readonly byteSize: number
}

/**
 * The complete result of a validation run.
 *
 * `ValidationReport` (Phase 1) remains the interchange shape, and
 * `toValidationReport` narrows this to it. The extra fields exist because a
 * quality report answers a broader question than "is it valid".
 */
export interface QualityReport {
  readonly checkedAt: string
  readonly findings: readonly ValidationFinding[]
  readonly summary: ValidationSummary
  readonly score: QualityScore
  readonly categories: readonly CategoryScore[]
  readonly compatibility: CompatibilityAssessment
  readonly subject: ReportSubject
  /** Which inspectors ran, so a report explains its own coverage. */
  readonly inspectors: readonly string[]
  readonly totalChecks: number
}

/** Labels used by the score bars and by every exported report. */
export const CATEGORY_LABEL: Readonly<Record<ValidationCategory, string>> = {
  structure: 'Structure',
  metadata: 'Metadata',
  markup: 'Markup',
  accessibility: 'Accessibility',
  resources: 'Images and resources',
  compatibility: 'Device compatibility',
}

export const IMPACT_LABEL: Readonly<Record<FindingImpact, string>> = {
  blocking: 'Blocks publication',
  reading: 'Affects reading',
  reach: 'Limits where it sells',
  advisory: 'Good to know',
}

/**
 * Build a finding.
 *
 * A helper rather than object literals in seven files, because
 * `exactOptionalPropertyTypes` makes conditional fields verbose and because the
 * id must be derived from the rule and location the same way everywhere — the
 * engine deduplicates on it.
 */
export function finding(
  rule: string,
  category: ValidationCategory,
  severity: Severity,
  message: string,
  options: {
    readonly impact?: FindingImpact
    readonly location?: string
    readonly remedy?: string
    readonly fixable?: boolean
  } = {},
): ValidationFinding {
  const impact = options.impact ?? defaultImpact(severity)

  return {
    id: options.location ? `${rule}::${options.location}` : rule,
    rule,
    category,
    severity,
    message,
    impact,
    ...(options.location === undefined ? {} : { location: options.location }),
    ...(options.remedy === undefined ? {} : { remedy: options.remedy }),
    ...(options.fixable === undefined ? {} : { fixable: options.fixable }),
  }
}

function defaultImpact(severity: Severity): FindingImpact {
  if (severity === 'error') return 'blocking'
  if (severity === 'warning') return 'reading'
  return 'advisory'
}
