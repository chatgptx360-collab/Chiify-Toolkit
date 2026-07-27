import * as React from 'react'

import { CardDescription, CardTitle, cardVariants } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * A titled group of form fields.
 *
 * Long settings and metadata forms need grouping to stay readable. Using a
 * `<fieldset>` with a `<legend>` is what tells assistive technology that these
 * controls belong together — a heading above a `<div>` looks identical and
 * communicates nothing.
 *
 * The card styling is applied by borrowing `cardVariants` rather than nesting a
 * `<Card>` around the fieldset: an extra wrapper element would break the
 * fieldset/legend relationship that makes this accessible in the first place.
 */
export interface FormSectionProps extends React.ComponentPropsWithoutRef<'fieldset'> {
  title: string
  description?: string
  /** Fields per row on `sm` and up. */
  columns?: 1 | 2
}

export function FormSection({
  title,
  description,
  columns = 1,
  className,
  children,
  ...props
}: FormSectionProps) {
  return (
    <fieldset className={cn(cardVariants(), 'p-5 sm:p-6', className)} {...props}>
      <legend className="float-left w-full space-y-1.5 pb-5">
        <CardTitle as="h3">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </legend>

      <div className={cn('clear-both grid gap-5', columns === 2 && 'sm:grid-cols-2')}>
        {children}
      </div>
    </fieldset>
  )
}
