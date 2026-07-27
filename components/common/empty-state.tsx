import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Empty state.
 *
 * Empty states are a product surface, not an error. A good one explains what
 * belongs here, why it is empty, and offers the single next action. This
 * component enforces that shape so no screen ships with a bare "No data".
 *
 * The icon sits in a tinted, ringed plate — the same treatment used for
 * feature icons elsewhere — so an empty screen still looks designed.
 */
export interface EmptyStateProps extends React.ComponentPropsWithoutRef<'div'> {
  icon: LucideIcon
  title: string
  description: string
  /** Primary action, and optionally a secondary beside it. */
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-center',
        'spotlight',
        size === 'sm' && 'gap-3 px-6 py-10',
        size === 'md' && 'gap-4 px-6 py-14',
        size === 'lg' && 'gap-5 px-8 py-20',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-primary-subtle text-primary ring-1 ring-primary/20',
          size === 'sm' ? 'size-10' : 'size-12',
        )}
        aria-hidden="true"
      >
        <Icon className={size === 'sm' ? 'size-5' : 'size-6'} />
      </span>

      <div className="space-y-1.5">
        <p className={cn('font-semibold tracking-tight', size === 'lg' ? 'text-lg' : 'text-base')}>
          {title}
        </p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      </div>

      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}
