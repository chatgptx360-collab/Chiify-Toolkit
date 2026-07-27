'use client'

import * as React from 'react'

import { breakpoints, type Breakpoint } from '@/lib/design/tokens'

/**
 * Subscribe to a CSS media query.
 *
 * Uses `useSyncExternalStore` rather than `useEffect` + `useState` because it
 * is the only pattern that gives React a consistent value during concurrent
 * rendering — the effect-based version can render one frame with a stale match
 * and produce a visible layout flicker.
 *
 * The server snapshot is `false`: markup is rendered for the smallest layout
 * and enhanced on the client. Guessing a viewport on the server is how
 * hydration mismatches happen.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True at or above a named breakpoint, e.g. `useBreakpoint('lg')`. */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`)
}

/**
 * True below the `lg` stop, where the shell switches the sidebar to a drawer.
 *
 * Named rather than inlined so the one place that defines "mobile layout" is
 * shared by every component that needs to know.
 */
export function useIsMobileLayout(): boolean {
  return !useBreakpoint('lg')
}
