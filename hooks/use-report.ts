'use client'

import * as React from 'react'

import type { Project } from '@/lib/types'
import { createReportGenerator, type QualityReport } from '@/lib/validation'

import { useValidation } from './use-validation'

/**
 * Export a validation report.
 *
 * WHY DOWNLOADING IS PART OF THE HOOK
 * -----------------------------------
 * Turning a string into a saved file is six lines of DOM plumbing — a blob, an
 * object URL, a synthetic anchor click, a revoke. Repeating that in three
 * components is how one of them ends up leaking the URL, and none of it is a
 * decision a component should be making. The component asks for a format.
 *
 * WHY A DATA URI IS NOT USED
 * --------------------------
 * A data URI holds the whole report in the URL string, and browsers cap that
 * well below the size of a report on a book with hundreds of findings. The
 * object URL is revoked on the next tick: long enough for the download to
 * start, short enough not to hold the report for the session.
 */

export type ReportFormat = 'html' | 'json' | 'text'

export interface UseReportResult {
  readonly report: QualityReport | undefined
  /** Render without saving, for a preview or the clipboard. */
  readonly render: (format: ReportFormat) => string | undefined
  readonly download: (format: ReportFormat) => void
  readonly copy: (format: ReportFormat) => Promise<boolean>
  readonly canExport: boolean
}

const EXTENSION: Readonly<Record<ReportFormat, string>> = {
  html: 'html',
  json: 'json',
  text: 'txt',
}

const MEDIA_TYPE: Readonly<Record<ReportFormat, string>> = {
  html: 'text/html;charset=utf-8',
  json: 'application/json;charset=utf-8',
  text: 'text/plain;charset=utf-8',
}

export function useReport(project: Project | undefined): UseReportResult {
  const { state } = useValidation(project)
  const generator = React.useMemo(() => createReportGenerator(), [])
  const report = state.report

  const render = React.useCallback(
    (format: ReportFormat): string | undefined => {
      if (!report) return undefined

      if (format === 'json') return generator.toJson(report)
      if (format === 'text') return generator.toText(report)

      return generator.toHtml(report)
    },
    [report, generator],
  )

  const download = React.useCallback(
    (format: ReportFormat) => {
      const content = render(format)
      if (!content || !report) return

      const blob = new Blob([content], { type: MEDIA_TYPE[format] })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')

      anchor.href = url
      anchor.download = generator.fileName(report, EXTENSION[format])
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    [render, report, generator],
  )

  const copy = React.useCallback(
    async (format: ReportFormat): Promise<boolean> => {
      const content = render(format)
      if (!content) return false

      try {
        await navigator.clipboard.writeText(content)
        return true
      } catch {
        // Clipboard access is denied in some contexts and on some browsers.
        // Failing silently would leave the author thinking they had copied it.
        return false
      }
    },
    [render],
  )

  return { report, render, download, copy, canExport: Boolean(report) }
}
