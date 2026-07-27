import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'

import type { Intent } from './common'

/**
 * Types shared by presentation components.
 *
 * Kept apart from the domain models so a UI change can never force a change to
 * the publishing domain — the dependency runs one way: UI → domain.
 */

/** A navigation destination rendered in the sidebar or a menu. */
export interface NavItem {
  readonly label: string
  readonly href: Route
  readonly icon: LucideIcon
  /** One-line explanation used in tooltips and the command palette later. */
  readonly description: string
  /** Short status pill, e.g. `Phase 3`. */
  readonly badge?: string
  /** Hides the item from navigation while keeping the route addressable. */
  readonly hidden?: boolean
}

/** A titled group of navigation items. */
export interface NavSection {
  readonly id: string
  readonly label: string
  readonly items: readonly NavItem[]
}

/** One step of a breadcrumb trail. The final crumb has no `href`. */
export interface BreadcrumbItem {
  readonly label: string
  readonly href?: Route
}

/** Standard size scale used by Button, Badge, Input and friends. */
export type ComponentSize = 'sm' | 'md' | 'lg'

/** Re-exported so components can import one UI vocabulary from one place. */
export type { Intent }

/** Toast payload; the runtime lives in `components/ui/toast.tsx`. */
export interface ToastOptions {
  readonly title: string
  readonly description?: string
  readonly intent?: Intent
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed. */
  readonly duration?: number
  readonly action?: {
    readonly label: string
    readonly onClick: () => void
  }
}

export interface Toast extends ToastOptions {
  readonly id: string
}
