import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Badge — a compact status label.
 *
 * Intent variants mirror the semantic colour tokens exactly, so a "warning"
 * badge is the same hue as a warning alert and a warning toast. Consistency
 * here is what lets users learn the colour language once.
 *
 * The `subtle` tone is the default: solid intent colours at badge size are
 * loud, and a page full of them destroys the visual hierarchy.
 */
const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      intent: {
        neutral: '',
        primary: '',
        success: '',
        warning: '',
        danger: '',
        info: '',
      },
      tone: {
        subtle: '',
        solid: 'border-transparent',
        outline: 'bg-transparent',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        md: 'px-2.5 py-0.5 text-xs',
      },
    },
    compoundVariants: [
      {
        tone: 'subtle',
        intent: 'neutral',
        class: 'border-border bg-muted text-muted-foreground',
      },
      {
        tone: 'subtle',
        intent: 'primary',
        class: 'border-transparent bg-primary-subtle text-primary-on-subtle',
      },
      {
        tone: 'subtle',
        intent: 'success',
        class: 'border-transparent bg-success-subtle text-success-on-subtle',
      },
      {
        tone: 'subtle',
        intent: 'warning',
        class: 'border-transparent bg-warning-subtle text-warning-on-subtle',
      },
      {
        tone: 'subtle',
        intent: 'danger',
        class: 'border-transparent bg-danger-subtle text-danger-on-subtle',
      },
      {
        tone: 'subtle',
        intent: 'info',
        class: 'border-transparent bg-info-subtle text-info-on-subtle',
      },

      { tone: 'solid', intent: 'neutral', class: 'bg-foreground text-background' },
      { tone: 'solid', intent: 'primary', class: 'bg-primary text-primary-foreground' },
      { tone: 'solid', intent: 'success', class: 'bg-success text-success-foreground' },
      { tone: 'solid', intent: 'warning', class: 'bg-warning text-warning-foreground' },
      { tone: 'solid', intent: 'danger', class: 'bg-danger text-danger-foreground' },
      { tone: 'solid', intent: 'info', class: 'bg-info text-primary-foreground' },

      { tone: 'outline', intent: 'neutral', class: 'border-border text-muted-foreground' },
      { tone: 'outline', intent: 'primary', class: 'border-primary/40 text-primary' },
      { tone: 'outline', intent: 'success', class: 'border-success/40 text-success' },
      { tone: 'outline', intent: 'warning', class: 'border-warning/40 text-warning' },
      { tone: 'outline', intent: 'danger', class: 'border-danger/40 text-danger' },
      { tone: 'outline', intent: 'info', class: 'border-info/40 text-info' },
    ],
    defaultVariants: {
      intent: 'neutral',
      tone: 'subtle',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends React.ComponentPropsWithoutRef<'span'>, VariantProps<typeof badgeVariants> {
  /** Renders a small filled dot in the intent colour. */
  withDot?: boolean
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, intent, tone, size, withDot = false, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ intent, tone, size }), className)} {...props}>
      {withDot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  )
})

export { badgeVariants }
