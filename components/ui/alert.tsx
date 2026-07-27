import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Alert — an inline, persistent message about the current context.
 *
 * Distinct from a toast: an alert describes a *state* the user is looking at
 * ("this manuscript has 3 unresolved warnings"), a toast reports the *result*
 * of something the user just did. Mixing the two is what leads to interfaces
 * that shout transient popups about permanent problems.
 *
 * Each intent carries a default icon so meaning is never conveyed by colour
 * alone — a WCAG 1.4.1 requirement and a real help to colour-blind users.
 */
const alertVariants = cva('relative flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    intent: {
      info: 'border-info/25 bg-info-subtle text-foreground',
      success: 'border-success/25 bg-success-subtle text-foreground',
      warning: 'border-warning/25 bg-warning-subtle text-foreground',
      danger: 'border-danger/25 bg-danger-subtle text-foreground',
      neutral: 'border-border bg-muted/50 text-foreground',
    },
  },
  defaultVariants: {
    intent: 'info',
  },
})

const iconColorByIntent = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted-foreground',
} as const

const defaultIconByIntent: Record<keyof typeof iconColorByIntent, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
}

export interface AlertProps
  extends React.ComponentPropsWithoutRef<'div'>, VariantProps<typeof alertVariants> {
  /** Override the intent's default icon, or pass `null` to remove it. */
  icon?: LucideIcon | null
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, intent = 'info', icon, children, ...props },
  ref,
) {
  const resolvedIntent = intent ?? 'info'
  const Icon = icon === null ? null : (icon ?? defaultIconByIntent[resolvedIntent])

  return (
    <div
      ref={ref}
      // `danger` is the only intent that interrupts; the rest wait for a pause
      // in speech rather than cutting the user off mid-sentence.
      role={resolvedIntent === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ intent: resolvedIntent }), className)}
      {...props}
    >
      {Icon ? (
        <Icon
          className={cn('mt-0.5 size-4 shrink-0', iconColorByIntent[resolvedIntent])}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  )
})

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<'p'>
>(function AlertTitle({ className, ...props }, ref) {
  return <p ref={ref} className={cn('font-medium', className)} {...props} />
})

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(function AlertDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
})

export { alertVariants }
