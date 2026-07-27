'use client'

import * as React from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Form field wrapper.
 *
 * SOLVES ONE PROBLEM PROPERLY
 * ---------------------------
 * Wiring a label, a hint and an error message to a control means generating
 * ids and maintaining `aria-describedby` / `aria-invalid`. Done by hand at
 * every call site it is verbose and, in practice, forgotten. Done here once,
 * every field in every future phase is correct by construction:
 *
 *   - the label's `htmlFor` points at the control;
 *   - hint and error are referenced via `aria-describedby`, so a screen reader
 *     announces them as part of the field;
 *   - `aria-invalid` is set whenever an error is present;
 *   - the error is a live region, so it is announced when validation runs
 *     rather than only when the field is re-entered.
 *
 * The control is supplied via a render prop so the wrapper stays agnostic
 * about which input primitive is used.
 */
export interface FormFieldProps {
  label: string
  /** Supporting text shown under the control. */
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: FormFieldRenderProps) => React.ReactNode
}

export interface FormFieldRenderProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
  required: boolean
}

export function FormField({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const id = React.useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-relaxed font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
