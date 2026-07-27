'use client'

import * as React from 'react'

import { formatWordCount } from '@/lib/utils'
import type { Intent, ParsedDocument, ProjectId } from '@/lib/types'

import { useDocument } from './use-document'

/**
 * Presentation-ready analysis of a parsed manuscript.
 *
 * WHY THIS EXISTS RATHER THAN COMPONENTS READING `document.stats`
 * ---------------------------------------------------------------
 * The raw statistics are numbers; a screen needs *labelled, formatted,
 * ordered* values plus a judgement about what deserves attention. Putting that
 * translation in a hook means the analysis panel, the dashboard and any future
 * report render identical wording, and the formatting rules are testable
 * without a renderer.
 *
 * The hook returns `undefined` when nothing has been parsed, so a caller can
 * distinguish "no analysis" from "an analysis full of zeroes".
 */

export interface AnalysisMetric {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly hint?: string
}

export interface AnalysisSummary {
  readonly document: ParsedDocument
  /** Headline figures, in the order they should be shown. */
  readonly headline: readonly AnalysisMetric[]
  /** Secondary structural counts. */
  readonly structure: readonly AnalysisMetric[]
  /** How much the chapter split should be trusted. */
  readonly detection: {
    readonly label: string
    readonly intent: Intent
    readonly confidencePercent: number
    readonly reason: string
  }
  readonly warningCount: number
}

const COMPLEXITY_LABEL = {
  simple: 'Straightforward',
  moderate: 'Moderate',
  complex: 'Demanding',
} as const

const COMPLEXITY_HINT = {
  simple: 'Short sentences and everyday words',
  moderate: 'Typical for general non-fiction',
  complex: 'Long sentences or specialist vocabulary',
} as const

export function useAnalysis(projectId: ProjectId | undefined): AnalysisSummary | undefined {
  const document = useDocument(projectId)

  return React.useMemo(() => {
    if (!document) return undefined

    const { stats, detection } = document
    const extremes = describeExtremes(stats)

    return {
      document,
      headline: [
        {
          id: 'words',
          label: 'Words',
          value: stats.wordCount.toLocaleString('en-GB'),
          hint: `${stats.characterCount.toLocaleString('en-GB')} characters`,
        },
        {
          id: 'chapters',
          label: 'Chapters',
          value: String(stats.chapterCount),
          // Spread conditionally: `exactOptionalPropertyTypes` distinguishes an
          // absent hint from one explicitly set to `undefined`.
          ...(extremes ? { hint: extremes } : {}),
        },
        {
          id: 'reading-time',
          label: 'Reading time',
          value: formatDuration(stats.estimatedReadingMinutes),
          hint: 'At an average reading pace',
        },
        {
          id: 'pages',
          label: 'Estimated pages',
          value: stats.estimatedPageCount.toLocaleString('en-GB'),
          hint: 'At trade-paperback density',
        },
      ],
      structure: [
        { id: 'paragraphs', label: 'Paragraphs', value: String(stats.paragraphCount) },
        { id: 'headings', label: 'Headings', value: String(stats.headingCount) },
        { id: 'images', label: 'Images', value: String(stats.imageCount) },
        { id: 'tables', label: 'Tables', value: String(stats.tableCount) },
        { id: 'lists', label: 'Lists', value: String(stats.listCount) },
        { id: 'footnotes', label: 'Footnotes', value: String(stats.footnoteCount) },
        { id: 'links', label: 'Links', value: String(stats.linkCount) },
        {
          id: 'complexity',
          label: 'Reading level',
          value: COMPLEXITY_LABEL[stats.readingComplexity],
          hint: COMPLEXITY_HINT[stats.readingComplexity],
        },
        {
          id: 'avg-paragraph',
          label: 'Average paragraph',
          value: formatWordCount(stats.averageParagraphLength),
        },
      ],
      detection: {
        label: describeConfidence(detection.confidence),
        intent: confidenceIntent(detection.confidence),
        confidencePercent: Math.round(detection.confidence * 100),
        reason: detection.reason,
      },
      warningCount: document.notices.filter((notice) => notice.severity === 'warning').length,
    }
  }, [document])
}

function describeExtremes(stats: ParsedDocument['stats']): string | undefined {
  if (!stats.longestChapter) return undefined
  if (!stats.shortestChapter) return `${formatWordCount(stats.longestChapter.wordCount)}`

  return `Longest ${formatWordCount(stats.longestChapter.wordCount, true)}, shortest ${formatWordCount(stats.shortestChapter.wordCount, true)}`
}

/** Minutes into something a person would say. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`
}

function describeConfidence(confidence: number): string {
  if (confidence >= 0.8) return 'High confidence'
  if (confidence >= 0.5) return 'Worth checking'
  return 'Low confidence'
}

function confidenceIntent(confidence: number): Intent {
  if (confidence >= 0.8) return 'success'
  if (confidence >= 0.5) return 'warning'
  return 'danger'
}
