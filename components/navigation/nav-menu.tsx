'use client'

import { isNavItemActive, navigationSections } from '@/lib/config/navigation'
import { cn } from '@/lib/utils'

import { SidebarItem } from './sidebar-item'

/**
 * The grouped navigation list.
 *
 * Extracted from the sidebar so the desktop rail and the mobile drawer render
 * the *same* component. Two copies of a nav list is how a link ends up in one
 * and not the other; there is exactly one here.
 *
 * Structure is a `<nav>` containing one `<ul>` per section, each labelled by
 * its heading — that gives screen-reader users a navigable outline instead of
 * one flat list of nine links.
 */
export interface NavMenuProps {
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
  className?: string
}

export function NavMenu({ pathname, collapsed = false, onNavigate, className }: NavMenuProps) {
  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-6', className)}>
      {navigationSections.map((section) => (
        <div key={section.id} className="space-y-1">
          <h2
            id={`nav-section-${section.id}`}
            className={cn(
              'px-2.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase',
              collapsed && 'sr-only',
            )}
          >
            {section.label}
          </h2>

          <ul aria-labelledby={`nav-section-${section.id}`} className="space-y-0.5">
            {section.items
              .filter((item) => !item.hidden)
              .map((item) => (
                <li key={item.href}>
                  <SidebarItem
                    item={item}
                    active={isNavItemActive(item, pathname)}
                    collapsed={collapsed}
                    {...(onNavigate ? { onNavigate } : {})}
                  />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
