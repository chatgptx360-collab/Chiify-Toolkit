import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Section — a titled band of content within a page.
 *
 * The point is vertical rhythm. Pages composed of `Section`s cannot drift into
 * bespoke margins, and the heading level is explicit so the document outline
 * stays correct as sections are nested or reordered.
 */
export interface SectionProps extends React.ComponentPropsWithoutRef<'section'> {
  title?: string
  description?: string
  /** Heading level for `title`. Defaults to `h2`, one below the page `h1`. */
  headingLevel?: 'h2' | 'h3'
  /** Controls, aligned to the right of the title row. */
  actions?: React.ReactNode
}

export function Section({
  title,
  description,
  headingLevel: Heading = 'h2',
  actions,
  className,
  children,
  ...props
}: SectionProps) {
  const headingId = React.useId()

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn('space-y-4', className)}
      {...props}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            {title ? (
              <Heading id={headingId} className="text-sm font-semibold tracking-tight">
                {title}
              </Heading>
            ) : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  )
}
