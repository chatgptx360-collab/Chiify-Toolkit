import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Text input and textarea.
 *
 * `invalid` drives both the visual treatment and `aria-invalid`, so the error
 * state can never be visible to sighted users while remaining invisible to
 * assistive technology — a common and easily avoided accessibility bug.
 */
const inputVariants = cva(
  [
    'w-full rounded-md border bg-background text-foreground',
    'placeholder:text-subtle-foreground',
    'transition-[border-color,box-shadow,background-color] motion-fast',
    'outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'read-only:bg-muted/40',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-11 px-4 text-sm',
      },
      invalid: {
        true: 'border-danger focus-visible:border-danger focus-visible:outline-danger',
        false: 'border-input hover:border-border-strong',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
    },
  },
)

export interface InputProps
  extends
    Omit<React.ComponentPropsWithoutRef<'input'>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Rendered inside the field, before the text. Purely decorative. */
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, invalid, startIcon, endIcon, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid ?? undefined}
      className={cn(
        inputVariants({ size, invalid }),
        startIcon ? 'pl-9' : undefined,
        endIcon ? 'pr-9' : undefined,
        className,
      )}
      {...props}
    />
  )

  if (!startIcon && !endIcon) return field

  return (
    <div className="relative w-full">
      {startIcon ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {startIcon}
        </span>
      ) : null}
      {field}
      {endIcon ? (
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {endIcon}
        </span>
      ) : null}
    </div>
  )
})

export interface TextareaProps
  extends
    React.ComponentPropsWithoutRef<'textarea'>,
    Pick<VariantProps<typeof inputVariants>, 'invalid'> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid ?? undefined}
      className={cn(
        inputVariants({ invalid }),
        'min-h-24 resize-y px-3 py-2 text-sm leading-relaxed',
        'h-auto',
        className,
      )}
      {...props}
    />
  )
})

export { inputVariants }
