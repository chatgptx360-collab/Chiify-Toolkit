import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Feature card — describes a capability of the product.
 *
 * Used across the placeholder pages to explain what each area will do. It is a
 * genuine, reusable component rather than page-local markup: Phase 2's
 * onboarding and the eventual marketing surfaces need exactly this shape, and
 * duplicating it would guarantee three slightly different versions.
 *
 * `status` renders as a badge with a matching intent, so "Available" and
 * "Phase 4" are visually distinct at a glance.
 */
export type FeatureStatus = 'available' | 'in-progress' | 'planned'

const statusPresentation: Record<
  FeatureStatus,
  { label: string; intent: 'success' | 'primary' | 'neutral' }
> = {
  available: { label: 'Available', intent: 'success' },
  'in-progress': { label: 'In progress', intent: 'primary' },
  planned: { label: 'Planned', intent: 'neutral' },
}

export interface FeatureCardProps extends React.ComponentPropsWithoutRef<'div'> {
  icon: LucideIcon
  title: string
  description: string
  status?: FeatureStatus
  /** Overrides the status badge text, e.g. `Phase 3`. */
  statusLabel?: string
  /** Rendered under the description — bullet points, meta, or actions. */
  footer?: React.ReactNode
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  status = 'planned',
  statusLabel,
  footer,
  className,
  ...props
}: FeatureCardProps) {
  const presentation = statusPresentation[status]

  return (
    <Card className={cn('h-full', className)} {...props}>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary ring-1 ring-primary/15"
            aria-hidden="true"
          >
            <Icon className="size-4.5" />
          </span>

          <Badge intent={presentation.intent} size="sm" withDot>
            {statusLabel ?? presentation.label}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="leading-relaxed">{description}</CardDescription>
        </div>

        {footer}
      </CardHeader>
    </Card>
  )
}
