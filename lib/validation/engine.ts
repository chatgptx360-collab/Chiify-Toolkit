import type { EpubValidator, GeneratedFile, PackagedBinary } from '../epub/types'
import type { EpubPackage } from '../types/epub'
import type { BookMetadata, ProjectSettings } from '../types/project'
import { summariseIssues, type ValidationReport } from '../types/validation'
import type { Severity } from '../utils/result'

import { createAccessibilityChecker } from './inspectors/accessibility-checker'
import { createCompatibilityChecker } from './inspectors/compatibility-checker'
import { createCssInspector } from './inspectors/css-inspector'
import { createImageInspector } from './inspectors/image-inspector'
import { createMetadataInspector } from './inspectors/metadata-inspector'
import { createNavigationInspector } from './inspectors/navigation-inspector'
import { createPackageInspector } from './inspectors/package-inspector'
import { createXhtmlInspector } from './inspectors/xhtml-inspector'
import { createQualityAnalyzer, type CategoryChecks } from './quality'
import { prepareSubject } from './subject'
import {
  finding,
  type CompatibilityAssessment,
  type FindingImpact,
  type InspectionSubject,
  type Inspector,
  type QualityReport,
  type ValidationFinding,
} from './types'

/**
 * The validation engine.
 *
 * WHY THIS IS NOT EPUBCHECK
 * -------------------------
 * EPUBCheck is the reference implementation and the thing retailers actually
 * run. It is also a Java application. Chiify is local-first and runs in a
 * browser: shipping a JVM, or posting every author's unpublished manuscript to
 * a server to be checked, are both worse than the problem they solve.
 *
 * So the checks are native TypeScript, run against the package in memory, and
 * the UI says plainly that this is not official certification. What it does
 * catch is the entire class of problems this generator can actually produce,
 * plus the retailer requirements EPUBCheck does not check at all — a missing
 * ISBN is not a specification violation, and it is the most common reason a
 * submission is refused.
 *
 * WHY IT CANNOT CRASH
 * -------------------
 * An inspector that throws must not take the report with it. A book that
 * triggers a bug in one rule still deserves the other eighty findings, so each
 * inspector is isolated and a failure becomes a finding of its own. An author
 * seeing "one check could not run" alongside their results is far better served
 * than one seeing an error screen.
 *
 * ORDERING IS PART OF THE OUTPUT
 * ------------------------------
 * Findings come back sorted by severity, then by impact, then by category. The
 * first item in the list is always the thing to fix first, so no screen has to
 * re-sort and no two screens can disagree about priority.
 */

export interface ValidationInput {
  readonly epub: EpubPackage
  readonly files: readonly GeneratedFile[]
  readonly binaries: readonly PackagedBinary[]
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
  readonly byteSize: number
  /** Injected in tests so a report is reproducible. */
  readonly now?: Date
}

export interface ValidationEngine {
  /** The full report: findings, scores, compatibility. */
  analyse(input: ValidationInput): QualityReport
  /** The prepared subject, reused by the auto-fix engine. */
  prepare(input: ValidationInput): InspectionSubject
  readonly inspectors: readonly Inspector[]
}

export interface ValidationEngineOptions {
  /** Replace the default set, e.g. to test one inspector in isolation. */
  readonly inspectors?: readonly Inspector[]
}

/** Severity order used for sorting; higher is more urgent. */
const SEVERITY_RANK: Readonly<Record<Severity, number>> = { error: 3, warning: 2, info: 1 }

const IMPACT_RANK: Readonly<Record<FindingImpact, number>> = {
  blocking: 4,
  reading: 3,
  reach: 2,
  advisory: 1,
}

export function createValidationEngine(options: ValidationEngineOptions = {}): ValidationEngine {
  const compatibility = createCompatibilityChecker()

  const inspectors: readonly Inspector[] = options.inspectors ?? [
    createPackageInspector(),
    createNavigationInspector(),
    createMetadataInspector(),
    createXhtmlInspector(),
    createCssInspector(),
    createImageInspector(),
    createAccessibilityChecker(),
    compatibility,
  ]

  const analyzer = createQualityAnalyzer()

  const prepare = (input: ValidationInput): InspectionSubject =>
    prepareSubject({
      epub: input.epub,
      files: input.files,
      binaries: input.binaries,
      metadata: input.metadata,
      settings: input.settings,
      byteSize: input.byteSize,
    })

  return {
    inspectors,
    prepare,

    analyse(input) {
      const subject = prepare(input)
      const collected: ValidationFinding[] = []
      const checks: CategoryChecks[] = []

      for (const inspector of inspectors) {
        try {
          const result = inspector.inspect(subject)
          collected.push(...result.findings)
          checks.push({ category: inspector.category, checks: result.checks })
        } catch (cause) {
          collected.push(
            finding(
              'validation.inspector-failed',
              inspector.category,
              'warning',
              `The ${inspector.title.toLowerCase()} check could not run.`,
              {
                impact: 'advisory',
                location: inspector.id,
                remedy: `Everything else was checked. ${describe(cause)}`,
              },
            ),
          )

          checks.push({ category: inspector.category, checks: 1 })
        }
      }

      const findings = dedupe(collected).sort(compareFindings)
      const categories = analyzer.categories(findings, checks)
      const score = analyzer.score(categories, findings)

      const assessment: CompatibilityAssessment = safeAssess(compatibility, subject)

      const images = subject.epub.resources.filter((resource) =>
        resource.mediaType.startsWith('image/'),
      ).length

      return {
        checkedAt: (input.now ?? new Date()).toISOString(),
        findings,
        summary: summariseIssues(findings),
        score,
        categories,
        compatibility: assessment,
        subject: {
          title: asText(subject.epub.metadata.title) || 'Untitled',
          authors: asList(subject.epub.metadata.creator),
          language: asText(subject.epub.metadata.language) || 'en',
          identifier: asText(subject.epub.metadata.identifier),
          chapters: subject.epub.spine.filter((item) => item.chapterId).length,
          images,
          byteSize: subject.byteSize,
        },
        inspectors: inspectors.map((inspector) => inspector.title),
        totalChecks: checks.reduce((total, entry) => total + entry.checks, 0),
      }
    },
  }
}

/**
 * The `EpubValidator` port from Phase 4.
 *
 * The port takes only a package and its files, because that is all the
 * generator knew it would need. The extra context a full report uses —
 * the author's metadata, the packaged images, the file size — is bound here at
 * construction, so an adapter satisfies the interface without widening it.
 */
export function createEpubValidator(context: {
  readonly binaries: readonly PackagedBinary[]
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
  readonly byteSize: number
}): EpubValidator {
  const engine = createValidationEngine()

  return {
    id: 'chiify-native-validator',

    async validate(epub, files): Promise<ValidationReport> {
      const report = engine.analyse({ epub, files, ...context })
      return toValidationReport(report)
    },
  }
}

/** Narrow a quality report to the interchange shape the rest of the app renders. */
export function toValidationReport(report: QualityReport): ValidationReport {
  return {
    checkedAt: report.checkedAt,
    issues: report.findings,
    summary: report.summary,
  }
}

/**
 * Two inspectors can legitimately reach the same conclusion — a missing cover
 * is both a resource problem and a Kindle rejection. The finding id encodes
 * rule and location, so the duplicate is dropped and the first (higher
 * priority, since inspectors run structure-first) is kept.
 */
function dedupe(findings: readonly ValidationFinding[]): ValidationFinding[] {
  const seen = new Set<string>()
  const result: ValidationFinding[] = []

  for (const item of findings) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }

  return result
}

function compareFindings(a: ValidationFinding, b: ValidationFinding): number {
  const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  if (bySeverity !== 0) return bySeverity

  const byImpact = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]
  if (byImpact !== 0) return byImpact

  return a.category.localeCompare(b.category) || a.rule.localeCompare(b.rule)
}

function safeAssess(
  checker: ReturnType<typeof createCompatibilityChecker>,
  subject: InspectionSubject,
): CompatibilityAssessment {
  try {
    return checker.assess(subject)
  } catch {
    return { targets: [], supported: 0, total: 0 }
  }
}

function describe(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return 'The cause was not reported.'
}

function asText(value: string | readonly string[] | undefined): string {
  if (typeof value === 'string') return value
  return value?.[0] ?? ''
}

function asList(value: string | readonly string[] | undefined): readonly string[] {
  if (typeof value === 'string') return [value]
  return value ?? []
}
