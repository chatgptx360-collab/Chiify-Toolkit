import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Page header.
 *
 * Every route renders exactly one of these. Standardising the title/description
 * /actions arrangement is what makes six different pages feel like one product,
 * and it guarantees each page has exactly one `<h1>` — the anchor a screen
 * reader user relies on to know where they are.
 */
export interface PageHeaderProps extends React.ComponentPropsWithoutRef<'header'> {
  title: string
  description?: string
  /** Small status pill beside the title, e.g. the phase a feature ships in. */
  badge?: { label: string; intent?: React.ComponentProps<typeof Badge>['intent'] }
  /** Buttons, aligned right on desktop and stacked below on mobile. */
  actions?: React.ReactNode
  /** Rendered above the title — normally the breadcrumb trail. */
  eyebrow?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  eyebrow,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4', className)} {...props}>
      {eyebrow}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
            {badge ? (
              <Badge intent={badge.intent ?? 'primary'} size="sm">
                {badge.label}
              </Badge>
            ) : null}
          </div>

          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
