import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import * as React from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Stat card — one headline number.
 *
 * Two decisions worth recording:
 *
 *   1. `value` accepts a string, not a number. Formatting is the caller's job
 *      (`lib/utils/format`), which keeps units, locales and abbreviations out
 *      of a presentation component.
 *   2. Trend direction is conveyed by an arrow *and* colour, and the accessible
 *      text spells out "up"/"down". A green number alone means nothing to a
 *      screen reader and little to a colour-blind user.
 *
 * `loading` renders a skeleton at the same metrics as the real content, so a
 * dashboard resolving its data does not reflow.
 */
export interface StatCardProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string
  value: string
  icon?: LucideIcon
  /** Supporting sentence under the value. */
  hint?: string
  trend?: {
    /** Pre-formatted, e.g. `+12%`. */
    value: string
    direction: 'up' | 'down'
    /** Set when a rise is bad (error counts), so colour follows meaning. */
    inverted?: boolean
  }
  loading?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  loading = false,
  className,
  ...props
}: StatCardProps) {
  const trendIsGood = trend
    ? trend.inverted
      ? trend.direction === 'down'
      : trend.direction === 'up'
    : false
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown

  return (
    <Card className={cn('p-5', className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        {loading ? (
          <Skeleton shape="line" className="h-7 w-20" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        )}

        {trend && !loading ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              trendIsGood ? 'text-success' : 'text-danger',
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {trend.value}
            <span className="sr-only">{trend.direction === 'up' ? 'increase' : 'decrease'}</span>
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-2 text-xs text-subtle-foreground">{hint}</p> : null}
    </Card>
  )
}
