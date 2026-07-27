import { BookOpen, FileCheck2, FolderOpen, LayoutDashboard, Settings, Wand2 } from 'lucide-react'
import type { Route } from 'next'

import type { BreadcrumbItem, NavItem, NavSection } from '../types/ui'

/**
 * The navigation registry — one source of truth for the app's routes.
 *
 * WHY A REGISTRY
 * --------------
 * The sidebar, the mobile drawer, breadcrumbs, page titles and (later) the
 * command palette all need to know the same things about a route. Deriving
 * them from one array means adding a page in Phase 2 is a single entry, and it
 * is structurally impossible for the sidebar to know about a route the
 * breadcrumbs do not.
 *
 * `href` is typed as `Route`, so `typedRoutes` rejects an entry pointing at a
 * page that does not exist.
 */

export const navigationSections: readonly NavSection[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard' as Route,
        icon: LayoutDashboard,
        description: 'Library overview, recent activity and conversion health.',
      },
      {
        label: 'Projects',
        href: '/projects' as Route,
        icon: FolderOpen,
        description: 'Every manuscript you are preparing for publication.',
      },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    items: [
      {
        label: 'Converter',
        href: '/converter' as Route,
        icon: Wand2,
        description: 'Turn a Word manuscript into a structured EPUB 3 book.',
      },
      {
        label: 'Preview',
        href: '/preview' as Route,
        icon: BookOpen,
        description: 'Read the generated book exactly as a reading system will.',
      },
      {
        label: 'Validation',
        href: '/validation' as Route,
        icon: FileCheck2,
        description: 'Specification, accessibility and retailer readiness checks.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        label: 'Settings',
        href: '/settings' as Route,
        icon: Settings,
        description: 'Defaults, appearance and workspace preferences.',
      },
    ],
  },
]

/** Flattened view, used for lookups. */
export const navigationItems: readonly NavItem[] = navigationSections.flatMap(
  (section) => section.items,
)

/** The route a bare visit to `/` should land on. */
export const defaultRoute = '/dashboard' as Route

/**
 * Find the navigation entry that owns a pathname.
 *
 * Matches the longest `href` that the pathname starts with, so a future
 * `/projects/[id]` still resolves to the Projects entry — which is what keeps
 * the sidebar highlighted on detail pages without extra configuration.
 */
export function findNavItem(pathname: string): NavItem | undefined {
  let match: NavItem | undefined

  for (const item of navigationItems) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!match || item.href.length > match.href.length) match = item
    }
  }

  return match
}

/** True when a nav item should render as the current page. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/**
 * Resolves a dynamic path segment to a human label.
 *
 * Returning `undefined` falls back to title-casing the segment. This is a
 * *function* rather than a lookup table because the data needed to name a
 * segment (a project's title, later a chapter's) lives in a store this module
 * must not depend on — `lib/config` cannot import `lib/projects` without
 * inverting the dependency between configuration and domain.
 */
export type SegmentLabelResolver = (segment: string, path: string) => string | undefined

/**
 * Build a breadcrumb trail for a pathname.
 *
 * Registered routes use their navigation label. Unregistered segments — the ids
 * and slugs of dynamic routes — go through `resolveLabel`, then fall back to
 * title-casing, which is a reasonable last resort for a slug and an ugly but
 * honest one for an opaque id.
 */
export function buildBreadcrumbs(
  pathname: string,
  resolveLabel?: SegmentLabelResolver,
): readonly BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  const crumbs: BreadcrumbItem[] = []
  let accumulated = ''

  for (const [index, segment] of segments.entries()) {
    accumulated += `/${segment}`
    const known = navigationItems.find((item) => item.href === accumulated)
    const isLast = index === segments.length - 1

    crumbs.push({
      label: known?.label ?? resolveLabel?.(segment, accumulated) ?? toTitle(segment),
      ...(isLast ? {} : { href: accumulated as Route }),
    })
  }

  return crumbs
}

function toTitle(segment: string): string {
  return segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
