import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import type { BreadcrumbItem } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Breadcrumb trail.
 *
 * Semantics that matter here:
 *   - A `<nav>` with an accessible name, so screen-reader users can jump to it
 *     and know which navigation landmark they landed in.
 *   - An ordered list, because the sequence is the meaning.
 *   - The last crumb is plain text with `aria-current="page"` rather than a
 *     link to the page you are already on.
 *   - Chevrons are `aria-hidden`, otherwise every level is read as "greater
 *     than".
 */
export interface BreadcrumbProps extends React.ComponentPropsWithoutRef<'nav'> {
  items: readonly BreadcrumbItem[]
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3 text-subtle-foreground" aria-hidden="true" />
              ) : null}

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors motion-fast hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-foreground">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
