'use client'

import * as LabelPrimitive from '@radix-ui/react-label'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Label.
 *
 * Built on Radix's primitive rather than a bare `<label>` because it also
 * suppresses text selection on double-click, which otherwise makes rapid
 * checkbox clicking select the label text.
 */
export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Appends a required marker that is announced, not just drawn. */
  required?: boolean
}

export const Label = React.forwardRef<React.ComponentRef<typeof LabelPrimitive.Root>, LabelProps>(
  function Label({ className, required = false, children, ...props }, ref) {
    return (
      <LabelPrimitive.Root
        ref={ref}
        className={cn(
          'flex items-center gap-1 text-sm leading-none font-medium text-foreground',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
        {required ? (
          <>
            <span aria-hidden="true" className="text-danger">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </LabelPrimitive.Root>
    )
  },
)
