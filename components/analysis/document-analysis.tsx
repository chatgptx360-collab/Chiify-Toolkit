'use client'

import { AlertTriangle, BookOpen, Info } from 'lucide-react'

import { Section } from '@/components/common/section'
import { StatCard } from '@/components/dashboard/stat-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { AnalysisSummary } from '@/hooks'
import { formatWordCount } from '@/lib/utils'

/**
 * The analysis of a parsed manuscript.
 *
 * Presentation only. Every value arrives pre-formatted from `useAnalysis`, so
 * this component contains no arithmetic and no judgement about what a number
 * means — which is what keeps the wording identical wherever analysis appears.
 *
 * The chapter list is the most important part of the screen: it is where an
 * author discovers that their book was split into two chapters instead of
 * twenty-four, which is the failure they most need to catch before converting.
 * It is shown before the statistics for that reason.
 */
export interface DocumentAnalysisProps {
  analysis: AnalysisSummary
}

export function DocumentAnalysis({ analysis }: DocumentAnalysisProps) {
  const { document, detection, headline, structure } = analysis

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((metric) => (
          <StatCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            {...(metric.hint ? { hint: metric.hint } : {})}
          />
        ))}
      </div>

      <Section
        title="Chapters"
        description="Check this list before converting — it is the structure your book will have."
      >
        <Card>
          <CardHeader className="gap-3 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle as="h3">
                {document.chapters.length} {document.chapters.length === 1 ? 'chapter' : 'chapters'}{' '}
                detected
              </CardTitle>
              <Badge intent={detection.intent} size="sm" withDot>
                {detection.label}
              </Badge>
            </div>

            <Progress
              value={detection.confidencePercent}
              intent={
                detection.intent === 'success'
                  ? 'success'
                  : detection.intent === 'warning'
                    ? 'warning'
                    : 'danger'
              }
              size="sm"
              label={`Chapter detection confidence: ${detection.confidencePercent}%`}
            />
            <p className="text-xs text-muted-foreground">{detection.reason}</p>
          </CardHeader>

          <CardContent>
            <ol className="divide-y divide-border">
              {document.chapters.map((chapter, index) => (
                <li key={chapter.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span
                    className="w-8 shrink-0 text-right font-mono text-xs text-subtle-foreground tabular-nums"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{chapter.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatWordCount(chapter.wordCount)} · {chapter.blocks.length}{' '}
                      {chapter.blocks.length === 1 ? 'block' : 'blocks'}
                    </p>
                  </div>

                  {chapter.kind !== 'body' ? (
                    <Badge intent="neutral" tone="outline" size="sm">
                      {chapter.kind === 'frontMatter' ? 'Front matter' : 'Back matter'}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </Section>

      {document.notices.length > 0 ? (
        <Section
          title="Things to look at"
          description="Your manuscript converted; these are worth a check before publishing."
        >
          <div className="space-y-3">
            {document.notices.map((notice, index) => (
              <Alert
                key={`${notice.code}-${index}`}
                intent={notice.severity === 'warning' ? 'warning' : 'info'}
                icon={notice.severity === 'warning' ? AlertTriangle : Info}
              >
                <AlertTitle>{notice.message}</AlertTitle>
                {notice.hint ? <AlertDescription>{notice.hint}</AlertDescription> : null}
                {notice.source ? (
                  <AlertDescription className="mt-1 font-mono text-xs break-all">
                    {notice.source}
                  </AlertDescription>
                ) : null}
              </Alert>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Contents" description="What the parser found inside your manuscript.">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {structure.map((metric) => (
                <div key={metric.id} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                  <dd className="text-sm font-medium tabular-nums">{metric.value}</dd>
                  {metric.hint ? (
                    <dd className="text-xs text-subtle-foreground">{metric.hint}</dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </Section>

      {document.assets.length > 0 ? (
        <Section title="Images" description="Extracted from the manuscript and ready to package.">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <ul className="divide-y divide-border">
                {document.assets.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <BookOpen
                      className="size-4 shrink-0 text-subtle-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {asset.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {asset.width && asset.height
                        ? `${asset.width}×${asset.height}`
                        : 'Unknown size'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>
      ) : null}
    </div>
  )
}
