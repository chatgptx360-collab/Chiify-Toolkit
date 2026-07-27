import * as React from 'react'

import { siteConfig } from '@/lib/config/site'
import { cn } from '@/lib/utils'

/**
 * Wordmark.
 *
 * The mark is inline SVG rather than an image file: it inherits `currentColor`
 * so it works in both themes without a second asset, it costs no extra request,
 * and it stays crisp at any size. The glyph is an open book formed from two
 * page shapes — a publishing product should not use a generic geometric logo.
 */
export interface LogoProps extends React.ComponentPropsWithoutRef<'span'> {
  /** Hide the wordmark, leaving only the glyph (collapsed sidebar). */
  markOnly?: boolean
}

export function Logo({ markOnly = false, className, ...props }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)} {...props}>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs"
        aria-hidden="true"
      >
        <LogoMark className="size-4" />
      </span>

      {markOnly ? null : (
        <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
          {siteConfig.name}
        </span>
      )}

      <span className="sr-only">{siteConfig.name}</span>
    </span>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 6.5C10.4 4.9 8.3 4 6 4H3v14h3c2.3 0 4.4.9 6 2.5" />
      <path d="M12 6.5C13.6 4.9 15.7 4 18 4h3v14h-3c-2.3 0-4.4.9-6 2.5" />
      <path d="M12 6.5v14" />
    </svg>
  )
}
