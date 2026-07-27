'use client'

import { Menu, Search } from 'lucide-react'
import * as React from 'react'

import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { ThemeToggle } from '@/components/common/theme-toggle'
import { Button } from '@/components/ui/button'
import { buildBreadcrumbs } from '@/lib/config/navigation'
import { cn } from '@/lib/utils'

/**
 * Top bar.
 *
 * Holds orientation on the left (menu button on mobile, breadcrumb trail) and
 * global controls on the right. It is sticky rather than fixed so it
 * participates in the document flow and never overlaps the first heading —
 * a fixed bar plus `padding-top` is the arrangement that breaks the moment a
 * page is scrolled to an anchor.
 *
 * Search is present but disabled: the shell should show its final shape now,
 * and a control that is visibly "coming" is more honest than a rearranged
 * layout in Phase 2. It is `disabled`, so it is skipped by keyboard navigation
 * rather than trapping focus on a dead control.
 */
export interface TopbarProps {
  pathname: string
  onOpenMobileSidebar: () => void
}

export function Topbar({ pathname, onOpenMobileSidebar }: TopbarProps) {
  const breadcrumbs = React.useMemo(() => buildBreadcrumbs(pathname), [pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-(--topbar-height) shrink-0 items-center gap-3',
        'border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6',
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileSidebar}
        aria-label="Open navigation menu"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <Breadcrumb items={breadcrumbs} className="hidden sm:block" />

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="hidden gap-2 text-muted-foreground md:inline-flex"
        >
          <Search className="size-4" aria-hidden="true" />
          <span>Search</span>
          <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs">
            ⌘K
          </kbd>
        </Button>

        <ThemeToggle />
      </div>
    </header>
  )
}
