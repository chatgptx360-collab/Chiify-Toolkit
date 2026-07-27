import * as React from 'react'

import { siteConfig } from '@/lib/config/site'
import { cn } from '@/lib/utils'

/**
 * Application footer.
 *
 * Intentionally minimal — in a workspace app the footer carries provenance,
 * not navigation. It is a real `<footer>` landmark so screen-reader users can
 * jump to it, and it stays out of the tab order because it contains no
 * controls yet. Later phases add legal and support links here without changing
 * the shell.
 */
export type FooterProps = React.ComponentPropsWithoutRef<'footer'>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      className={cn(
        'mt-auto flex flex-col gap-2 border-t border-border px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6',
        className,
      )}
      {...props}
    >
      <p className="text-xs text-muted-foreground">
        {siteConfig.name} — {siteConfig.tagline}
      </p>
      <p className="text-xs text-subtle-foreground">
        v{siteConfig.version} · EPUB 3 publishing toolkit
      </p>
    </footer>
  )
}
