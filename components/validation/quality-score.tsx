'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { QualitySummary } from '@/hooks'
import type { QualityGrade, Readiness } from '@/lib/validation'
import { cn } from '@/lib/utils'

/**
 * The quality score, and the breakdown behind it.
 *
 * WHY THE SCORE IS NEVER SHOWN ALONE
 * ----------------------------------
 * A number on its own invites the wrong behaviour: an author optimises the
 * number rather than the book, and a high score hides a single error that makes
 * the file unpublishable. So the readiness verdict sits beside it, the headline
 * sentence explains it, and the bars say where the marks were lost. The score
 * is a summary of the report, never a substitute for it.
 *
 * WHY READINESS IS ITS OWN BADGE
 * ------------------------------
 * "94 out of 100" and "not publishable" are both true of a book with one error,
 * and only the second one changes what the author does next.
 */

const GRADE_TONE: Readonly<Record<QualityGrade, string>> = {
  A: 'text-success',
  B: 'text-success',
  C: 'text-warning',
  D: 'text-warning',
  F: 'text-danger',
}

const READINESS: Readonly<
  Record<Readiness, { label: string; intent: 'success' | 'warning' | 'danger' }>
> = {
  'retail-ready': { label: 'Ready to publish', intent: 'success' },
  'needs-work': { label: 'Needs work before selling', intent: 'warning' },
  'not-publishable': { label: 'Not publishable yet', intent: 'danger' },
}

export interface QualityScoreCardProps {
  quality: QualitySummary
}

export function QualityScoreCard({ quality }: QualityScoreCardProps) {
  const readiness = READINESS[quality.score.readiness]

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <p
              className={cn('text-5xl font-semibold tabular-nums', GRADE_TONE[quality.score.grade])}
            >
              {quality.score.overall}
            </p>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                out of 100 · grade {quality.score.grade}
              </p>
              <Badge intent={readiness.intent} size="sm" withDot>
                {readiness.label}
              </Badge>
            </div>
          </div>

          <p className="max-w-prose text-sm">{quality.score.headline}</p>
        </div>

        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
          <Metric label="Errors" value={quality.errors} tone={quality.errors > 0 ? 'danger' : ''} />
          <Metric
            label="Warnings"
            value={quality.warnings}
            tone={quality.warnings > 0 ? 'warning' : ''}
          />
          <Metric label="Notes" value={quality.infos} tone="" />
        </dl>
      </div>

      <ul className="mt-6 space-y-3 border-t border-border pt-5">
        {quality.categories.map((category) => (
          <li
            key={category.category}
            className="grid grid-cols-[10rem_1fr_auto] items-center gap-3"
          >
            <span className="truncate text-sm text-muted-foreground">{category.label}</span>

            <span
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${category.label}: ${category.score} out of 100, from ${category.checks} checks`}
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  category.score >= 90
                    ? 'bg-success'
                    : category.score >= 70
                      ? 'bg-warning'
                      : 'bg-danger',
                )}
                style={{ width: `${category.score}%` }}
              />
            </span>

            <span className="text-sm tabular-nums">{category.score}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-subtle-foreground">
        {quality.totalChecks} checks run against the generated package. Chiify is not EPUBCheck and
        this is not official certification — retailers run their own validation at submission.
      </p>
    </Card>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-lg font-medium tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
