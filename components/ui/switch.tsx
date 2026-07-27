'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Switch.
 *
 * Built on `<input type="checkbox" role="switch">` rather than a `<button>`
 * with hand-managed ARIA. The checkbox brings form participation, the correct
 * checked semantics, label association and keyboard behaviour; `role="switch"`
 * changes only how it is announced — "on/off" rather than "checked/unchecked",
 * which is what a settings toggle should say.
 *
 * The input is visually hidden but *not* removed: it remains the focusable,
 * clickable element, and the visible track is a sibling styled with `peer-*`
 * variants. Hiding it with `display: none` would make it unfocusable, which is
 * the usual way custom switches become keyboard-inaccessible.
 *
 * A switch applies its change immediately. Anything needing confirmation is a
 * checkbox plus a Save button, not a switch.
 */
export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> {
  /** Text rendered beside the control and wired to it as a label. */
  label: string
  description?: string
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, description, id, disabled, ...props },
  ref,
) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const descriptionId = description ? `${inputId}-description` : undefined

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-describedby={descriptionId}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />

        {/*
          The knob is a *descendant* of the track, not a sibling of the input,
          so `peer-checked:` cannot target it directly — the variant only
          matches later siblings. Hence the `[&>span]` child selector, which
          resolves to `.peer:checked ~ .track > span`.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'flex h-5 w-9 items-center rounded-full border border-transparent bg-muted p-0.5',
            'transition-colors motion-fast',
            'peer-checked:bg-primary peer-checked:[&>span]:translate-x-4',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
            'peer-disabled:opacity-50',
          )}
        >
          <span className="size-4 rounded-full bg-switch-knob shadow-xs transition-transform motion-fast" />
        </span>
      </span>

      <span className="min-w-0 flex-1 space-y-0.5">
        <label
          htmlFor={inputId}
          className={cn(
            'block cursor-pointer text-sm leading-tight font-medium',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  )
})
