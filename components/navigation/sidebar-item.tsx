'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import type { NavItem } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A single sidebar link.
 *
 * Details that matter:
 *   - `aria-current="page"` marks the active route for assistive technology;
 *     the highlight alone is invisible to it.
 *   - The active indicator is a bar rendered inside the link, not a background
 *     colour change alone, so the current page is distinguishable without
 *     relying on colour perception.
 *   - When collapsed, the label is hidden visually but the link keeps an
 *     accessible name, and a tooltip serves pointer users.
 */
export interface SidebarItemProps {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}

export function SidebarItem({ item, active, collapsed, onNavigate }: SidebarItemProps) {
  const Icon = item.icon

  return (
    <Tooltip content={item.label} side="right" enabled={collapsed}>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium',
          'transition-[background-color,color] motion-fast',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          collapsed && 'justify-center px-0',
        )}
      >
        {active ? (
          <span
            className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
            aria-hidden="true"
          />
        ) : null}

        <Icon
          className={cn(
            'size-4 shrink-0 transition-colors motion-fast',
            active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
          )}
          aria-hidden="true"
        />

        <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>

        {item.badge && !collapsed ? (
          <Badge size="sm" intent="neutral">
            {item.badge}
          </Badge>
        ) : null}
      </Link>
    </Tooltip>
  )
}
