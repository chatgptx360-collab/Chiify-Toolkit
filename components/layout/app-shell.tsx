'use client'

import { usePathname } from 'next/navigation'
import * as React from 'react'

import { Footer } from '@/components/layout/footer'
import { PageContainer } from '@/components/layout/page-container'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useDisclosure, useKeyboardShortcut, useLocalStorageBoolean } from '@/hooks'
import { cn } from '@/lib/utils'

const COLLAPSE_STORAGE_KEY = 'chiify:sidebar-collapsed'

/**
 * The application shell.
 *
 * Owns the small amount of layout state the chrome shares — sidebar collapse
 * and the mobile drawer — and nothing else. Page state belongs to pages; a
 * shell that accumulates feature state becomes the file every phase has to
 * edit, which is exactly what this architecture is trying to avoid.
 *
 * The collapse preference is persisted, so it survives a reload. It is read
 * through `useLocalStorageBoolean`, which renders the server-safe default and
 * then the stored value without a cascading state update — unlike the theme,
 * a sidebar that starts expanded for one frame is not a jarring flash.
 */
export interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useLocalStorageBoolean(COLLAPSE_STORAGE_KEY, false)
  const mobileSidebar = useDisclosure(false)

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  // `[` matches the collapse shortcut used by the editors this audience lives
  // in; no modifier, so it stays a one-key action.
  useKeyboardShortcut('[', toggleCollapsed)

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className={cn(
          'sr-only z-[60] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
          'focus:not-sr-only focus:absolute focus:top-3 focus:left-3',
        )}
      >
        Skip to content
      </a>

      <Sidebar
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileSidebar.isOpen}
        onMobileOpenChange={mobileSidebar.setOpen}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-1 flex-col transition-[padding-left] motion-normal',
          collapsed ? 'lg:pl-(--sidebar-width-collapsed)' : 'lg:pl-(--sidebar-width)',
        )}
      >
        <Topbar pathname={pathname} onOpenMobileSidebar={mobileSidebar.open} />
        <PageContainer>{children}</PageContainer>
        <Footer />
      </div>
    </div>
  )
}
