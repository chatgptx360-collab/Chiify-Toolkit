'use client'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Separator.
 *
 * Defaults to `decorative`, which renders it as `role="none"`. That is
 * deliberate: most rules in this UI are visual rhythm, and announcing
 * "separator" between every one of them is noise. Pass `decorative={false}`
 * when the rule genuinely marks a change of context.
 */
export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = 'horizontal', decorative = true, ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
})
