import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Card — the primary surface of the product.
 *
 * Composed of small, independent parts (`CardHeader`, `CardTitle`, …) rather
 * than a single component with a dozen props. Composition keeps the API flat
 * as requirements grow: a card that needs a chart between its header and
 * content just puts one there, instead of the component sprouting a
 * `chartSlot` prop.
 *
 * Interactivity is opt-in via `interactive`, which adds hover elevation and a
 * focus ring — cards that merely display information must not look clickable.
 */
const cardVariants = cva(
  'relative rounded-xl border border-border bg-card text-card-foreground transition-[border-color,box-shadow,transform] motion-normal',
  {
    variants: {
      elevation: {
        flat: 'shadow-none',
        low: 'shadow-xs',
        medium: 'shadow-sm',
        high: 'shadow-md',
      },
      interactive: {
        true: 'cursor-pointer hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      },
    },
    defaultVariants: {
      elevation: 'low',
    },
  },
)

export interface CardProps
  extends React.ComponentPropsWithoutRef<'div'>, VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elevation, interactive, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(cardVariants({ elevation, interactive }), className)} {...props} />
  )
})

export const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div ref={ref} className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)} {...props} />
    )
  },
)

export interface CardTitleProps extends React.ComponentPropsWithoutRef<'h3'> {
  /**
   * Heading level. Cards appear at different depths on different pages, and a
   * document whose headings jump from h1 to h3 is a real screen-reader defect,
   * so the level is a prop rather than hardcoded.
   */
  as?: 'h2' | 'h3' | 'h4'
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, as: Component = 'h3', ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cn('text-base leading-tight font-semibold tracking-tight', className)}
      {...props}
    />
  )
})

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<'p'>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
})

export const CardContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  },
)

export const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6',
          className,
        )}
        {...props}
      />
    )
  },
)

export { cardVariants }
