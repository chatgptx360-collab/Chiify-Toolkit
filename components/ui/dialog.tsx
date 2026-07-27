'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Dialog / modal.
 *
 * WHY RADIX
 * ---------
 * A correct modal needs a focus trap, focus restoration, inert background
 * content, scroll locking, escape handling and the right ARIA wiring. Getting
 * all of that right by hand is a project in itself, and getting it *wrong*
 * locks keyboard users out of the app. Radix supplies the behaviour; this file
 * supplies only the appearance.
 *
 * Animation uses Radix's `data-state` attributes rather than Framer Motion:
 * exit animations need the element to stay mounted, which Radix already
 * coordinates internally. Durations reference the motion tokens so dialogs
 * move at the same speed as everything else.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-overlay backdrop-blur-sm',
        'data-[state=open]:animate-[overlay-in_var(--duration-fast)_var(--easing-standard)]',
        'data-[state=closed]:animate-[overlay-out_var(--duration-fast)_var(--easing-exit)]',
        className,
      )}
      {...props}
    />
  )
})

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Hides the built-in close button for flows that must be completed. */
  hideCloseButton?: boolean
}

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, children, hideCloseButton = false, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-border bg-popover text-popover-foreground shadow-xl',
          'data-[state=open]:animate-[dialog-in_var(--duration-normal)_var(--easing-entrance)]',
          'data-[state=closed]:animate-[dialog-out_var(--duration-fast)_var(--easing-exit)]',
          className,
        )}
        {...props}
      >
        {children}
        {hideCloseButton ? null : (
          <DialogPrimitive.Close
            className={cn(
              'absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground',
              'transition-colors motion-fast hover:bg-accent hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Close dialog</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})

export function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-4', className)} {...props} />
}

export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('max-h-[60vh] overflow-y-auto px-6 pb-2 text-sm', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 p-6 pt-4 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('pr-8 text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  )
})

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})
