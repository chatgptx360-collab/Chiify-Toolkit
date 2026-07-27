'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Dropdown menu.
 *
 * Radix provides roving focus, type-ahead, and the `menu`/`menuitem` roles.
 * This wrapper only supplies presentation, plus the shared item styling that
 * the theme picker and future account/context menus all reuse.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const contentClassName = cn(
  'z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-popover p-1',
  'text-popover-foreground shadow-lg',
  'data-[state=open]:animate-[popover-in_var(--duration-fast)_var(--easing-standard)]',
  'data-[state=closed]:animate-[popover-out_var(--duration-instant)_var(--easing-exit)]',
)

const itemClassName = cn(
  'relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
  'outline-none select-none',
  'transition-colors motion-instant',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
)

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(contentClassName, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
})

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item ref={ref} className={cn(itemClassName, className)} {...props} />
  )
})

export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(itemClassName, 'pr-8', className)}
      {...props}
    >
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4 text-primary" aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
})

export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-2xs font-medium tracking-wide text-subtle-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
})

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
})
