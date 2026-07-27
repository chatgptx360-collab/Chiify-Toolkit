import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Button.
 *
 * WHY `cva` RATHER THAN CONDITIONAL STRINGS
 * -----------------------------------------
 * Variants are data. Declaring them in one table gives autocompletion on
 * `variant`/`size`, makes an invalid combination a type error, and means a
 * designer changing the "danger" treatment edits one line instead of hunting
 * through JSX.
 *
 * WHY `asChild`
 * -------------
 * A link that looks like a button must still render an `<a>`, or keyboard and
 * screen-reader semantics break (and Next.js prefetching is lost). `asChild`
 * merges the button's styling onto whatever element the caller passes, so
 * appearance and semantics stay independent.
 */
const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 select-none',
    'rounded-md font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow,opacity,transform] motion-fast',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.985]',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** The one call to action on a screen. */
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        /** Everything else that is safe and reversible. */
        secondary:
          'border border-border bg-secondary text-secondary-foreground hover:border-border-strong hover:bg-accent',
        /** Destructive and irreversible actions only. */
        danger: 'bg-danger text-danger-foreground shadow-xs hover:brightness-110',
        /** Low-emphasis actions inside dense surfaces. */
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        /** Bordered, transparent — pairs with `primary` in empty states. */
        outline:
          'border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-accent',
        /** Inline, text-level action. */
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 gap-1.5 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        /** Square, for a lone icon. Always pair with `aria-label`. */
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Shows a spinner and blocks interaction.
   *
   * The label stays mounted (hidden from paint, not from layout) so the button
   * does not resize mid-click — a small detail that stops toolbars from
   * jumping during async work.
   */
  loading?: boolean
  loadingLabel?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    asChild = false,
    loading = false,
    loadingLabel = 'Loading',
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot : 'button'

  // `Slot` forwards props onto a single child element, so the spinner markup is
  // only used for real `<button>`s. A slotted link that needs a busy state
  // renders its own indicator.
  const showSpinner = loading && !asChild

  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled ?? loading}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {showSpinner ? (
        <>
          <Loader2 className="absolute size-4 animate-spin" aria-hidden="true" />
          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </Component>
  )
})

export { buttonVariants }
