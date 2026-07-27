import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Select.
 *
 * WHY A NATIVE `<select>` RATHER THAN A CUSTOM LISTBOX
 * ---------------------------------------------------
 * The options in this product are short, flat lists (language, heading level,
 * theme). For that shape the native control is simply better:
 *
 *   - On mobile it opens the OS picker, which is far easier to use than a
 *     scrolling div and works with the platform's own accessibility features.
 *   - Keyboard behaviour, type-ahead and screen-reader announcement are
 *     correct without any implementation.
 *   - It costs no JavaScript and no dependency.
 *
 * The trade-off is that option rows cannot be styled. That is a real
 * limitation, and the moment a select needs icons, descriptions or search, it
 * should be replaced with a listbox primitive — not worked around here.
 *
 * The chevron is drawn by us because `appearance-none` removes the native one;
 * it is `pointer-events-none` so clicks fall through to the control.
 */
export interface SelectProps extends Omit<React.ComponentPropsWithoutRef<'select'>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size = 'md', invalid = false, children, ...props },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none rounded-md border bg-background text-foreground',
          'transition-[border-color,box-shadow] motion-fast',
          'outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' && 'h-8 pr-8 pl-2.5 text-xs',
          size === 'md' && 'h-9 pr-9 pl-3 text-sm',
          size === 'lg' && 'h-11 pr-10 pl-4 text-sm',
          invalid
            ? 'border-danger focus-visible:border-danger focus-visible:outline-danger'
            : 'border-input hover:border-border-strong',
          className,
        )}
        {...props}
      >
        {children}
      </select>

      <ChevronDown
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'sm' ? 'right-2.5 size-3.5' : 'right-3 size-4',
        )}
        aria-hidden="true"
      />
    </div>
  )
})
