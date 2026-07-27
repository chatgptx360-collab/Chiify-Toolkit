'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Tooltip.
 *
 * A tooltip is *supplementary* — it must never be the only place a piece of
 * information exists, because it is unavailable on touch devices. It is used
 * here for the collapsed sidebar, where the icon retains an `aria-label` and
 * the tooltip is a convenience for pointer users.
 *
 * `delayDuration` is 250ms: long enough that a cursor crossing the sidebar
 * does not fire a cascade of tooltips, short enough to feel responsive.
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-64 rounded-md border border-border bg-popover px-2.5 py-1.5',
          'text-xs text-popover-foreground shadow-md',
          'data-[state=delayed-open]:animate-[popover-in_var(--duration-fast)_var(--easing-standard)]',
          'data-[state=closed]:animate-[popover-out_var(--duration-instant)_var(--easing-exit)]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side']
  /** Set false to render children unwrapped, e.g. when space is not tight. */
  enabled?: boolean
}

/**
 * Convenience wrapper for the common case.
 *
 * `enabled` exists so callers can toggle tooltips by state (the sidebar only
 * needs them while collapsed) without conditionally rendering different trees,
 * which would remount the trigger and lose focus.
 */
export function Tooltip({ content, children, side = 'right', enabled = true }: TooltipProps) {
  if (!enabled) return <>{children}</>

  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  )
}
