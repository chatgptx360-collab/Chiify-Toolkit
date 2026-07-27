/**
 * `lib/validation` — checks a generated EPUB and reports on it.
 *
 * Boundary rules:
 *   - May import from `lib/types`, `lib/utils` and `lib/epub`.
 *   - Must NOT import from `lib/parser` (it validates a book, not a manuscript),
 *     from `components`, or from React.
 *   - `lib/epub` must never import from here. The dependency runs one way, so
 *     the generator can be used without the validator and a change to a rule
 *     can never change the bytes of a book.
 *
 * It knows EPUB internals because checking a manifest requires knowing what a
 * manifest is. Nothing above it does: the UI receives findings, scores and
 * proposals, and never learns what an OPF is.
 */
export {
  createEpubValidator,
  createValidationEngine,
  toValidationReport,
  type ValidationEngine,
  type ValidationEngineOptions,
  type ValidationInput,
} from './engine'

export {
  createAutoFixEngine,
  type AutoFixEngine,
  type AutoFixOptions,
  type FixProposal,
  type FixTarget,
} from './auto-fix'

export { createQualityAnalyzer, type CategoryChecks, type QualityAnalyzer } from './quality'
export { createReportGenerator, type ReportGenerator } from './report'
export { prepareSubject, type PrepareSubjectInput } from './subject'
export { scanXml, type XmlElement, type XmlScanError, type XmlScanResult } from './xml-scan'

export { createAccessibilityChecker } from './inspectors/accessibility-checker'
export {
  createCompatibilityChecker,
  type CompatibilityChecker,
} from './inspectors/compatibility-checker'
export { createCssInspector } from './inspectors/css-inspector'
export { createImageInspector } from './inspectors/image-inspector'
export { createMetadataInspector, isValidIsbn } from './inspectors/metadata-inspector'
export { createNavigationInspector } from './inspectors/navigation-inspector'
export { createPackageInspector } from './inspectors/package-inspector'
export { createXhtmlInspector } from './inspectors/xhtml-inspector'

export {
  CATEGORY_LABEL,
  IMPACT_LABEL,
  finding,
  type CategoryScore,
  type CompatibilityAssessment,
  type CompatibilityTarget,
  type FindingImpact,
  type InspectedDocument,
  type InspectionResult,
  type InspectionSubject,
  type Inspector,
  type QualityGrade,
  type QualityReport,
  type QualityScore,
  type Readiness,
  type ReportSubject,
  type ValidationFinding,
} from './types'
