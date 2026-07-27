'use client'

import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Progress bar.
 *
 * Radix supplies the ARIA contract (`role="progressbar"` plus the value
 * attributes). This wrapper adds the intent colours and an indeterminate mode,
 * which the conversion pipeline needs for stages whose length is unknown until
 * the manuscript has been read.
 */
const indicatorVariants = cva('h-full w-full flex-1 rounded-full transition-transform', {
  variants: {
    intent: {
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
    },
  },
  defaultVariants: {
    intent: 'primary',
  },
})

export interface ProgressProps
  extends
    Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, 'value'>,
    VariantProps<typeof indicatorVariants> {
  /** 0–100. Omit (or pass `null`) for an indeterminate bar. */
  value?: number | null
  size?: 'sm' | 'md'
  /** Required unless an external `aria-labelledby` is supplied. */
  label?: string
}

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress({ className, value = null, intent, size = 'md', label, ...props }, ref) {
  const isIndeterminate = value === null
  const clamped = isIndeterminate ? 0 : Math.min(Math.max(value, 0), 100)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={isIndeterminate ? null : clamped}
      aria-label={label}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1' : 'h-2',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          indicatorVariants({ intent }),
          // A determinate bar slides its full-width indicator into view; an
          // indeterminate one sweeps a short segment across the track.
          isIndeterminate
            ? 'w-1/3 flex-none animate-[progress-sweep_1.2s_ease-in-out_infinite]'
            : 'motion-normal',
        )}
        style={isIndeterminate ? undefined : { transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
