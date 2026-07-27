/**
 * Analysis components.
 *
 * Presentation only: every value arrives pre-formatted from `useAnalysis` and
 * `useMetadata`, so these components hold no arithmetic and no rules about what
 * a statistic means. That keeps the analysis screen, the dashboard and any
 * future report describing the same document in the same words.
 */
export { DocumentAnalysis, type DocumentAnalysisProps } from './document-analysis'
export { MetadataSuggestions, type MetadataSuggestionsProps } from './metadata-suggestions'
