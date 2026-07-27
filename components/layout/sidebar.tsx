'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'

import { Logo } from '@/components/common/logo'
import { NavMenu } from '@/components/navigation/nav-menu'
import { Button } from '@/components/ui/button'
import { DialogOverlay } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { defaultRoute } from '@/lib/config/navigation'
import { siteConfig } from '@/lib/config/site'
import { cn } from '@/lib/utils'

/**
 * Sidebar.
 *
 * Two presentations, one navigation list:
 *
 *   - Desktop (`lg` and up): a persistent rail that can collapse to icons.
 *     Collapsing is a *user* preference, so it persists across sessions.
 *   - Below `lg`: an off-canvas drawer built on Radix Dialog, which brings the
 *     focus trap, escape handling, scroll lock and background inerting that an
 *     off-canvas panel needs and that hand-rolled drawers almost always miss.
 *
 * The desktop rail is not conditionally rendered by JS — it is hidden with CSS.
 * That keeps the markup identical on server and client, so there is no
 * hydration mismatch and no flash of the wrong layout on first paint.
 */

interface SidebarContentProps {
  pathname: string
  collapsed: boolean
  onNavigate?: () => void
}

function SidebarContent({ pathname, collapsed, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <NavMenu
        pathname={pathname}
        collapsed={collapsed}
        {...(onNavigate ? { onNavigate } : {})}
        className="flex-1"
      />

      <div
        className={cn('rounded-lg border border-border bg-surface/60 p-3', collapsed && 'hidden')}
      >
        <p className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">
          Build
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          v{siteConfig.version} · {siteConfig.phase}
        </p>
      </div>
    </div>
  )
}

export interface SidebarProps {
  pathname: string
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function Sidebar({
  pathname,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  return (
    <>
      {/* Desktop rail */}
      <aside
        aria-label="Sidebar"
        data-collapsed={collapsed || undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r border-border bg-surface/40 lg:flex',
          'transition-[width] motion-normal',
          collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)',
        )}
      >
        <div
          className={cn(
            'flex h-(--topbar-height) shrink-0 items-center border-b border-border px-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <Link
            href={defaultRoute}
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo markOnly={collapsed} />
          </Link>

          {collapsed ? null : (
            <Tooltip content="Collapse sidebar  [" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleCollapsed}
                aria-label="Collapse sidebar"
                aria-expanded={!collapsed}
              >
                <PanelLeftClose className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        </div>

        <SidebarContent pathname={pathname} collapsed={collapsed} />

        {collapsed ? (
          <div className="flex justify-center border-t border-border p-3">
            <Tooltip content="Expand sidebar  [" side="right">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleCollapsed}
                aria-label="Expand sidebar"
                aria-expanded={!collapsed}
              >
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
        ) : null}
      </aside>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogPrimitive.Portal>
          <DialogOverlay className="lg:hidden" />
          <DialogPrimitive.Content
            aria-label="Sidebar"
            className={cn(
              'fixed inset-y-0 left-0 z-50 flex w-(--sidebar-width) flex-col border-r border-border bg-background shadow-xl lg:hidden',
              'data-[state=open]:animate-[drawer-in_var(--duration-slow)_var(--easing-entrance)]',
              'data-[state=closed]:animate-[drawer-out_var(--duration-fast)_var(--easing-exit)]',
            )}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Move between the workspace, production and account areas.
            </DialogPrimitive.Description>

            <div className="flex h-(--topbar-height) shrink-0 items-center border-b border-border px-4">
              <Link
                href={defaultRoute}
                onClick={() => onMobileOpenChange(false)}
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Logo />
              </Link>
            </div>

            <SidebarContent
              pathname={pathname}
              collapsed={false}
              onNavigate={() => onMobileOpenChange(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
