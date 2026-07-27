'use client'

import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { registerBuiltInParsers } from '@/lib/parser'

// Installed at module scope rather than in an effect: the registry must be
// populated before any component renders an accepted-file-types list or
// resolves a parser, and `registerBuiltInParsers` is idempotent, so React's
// development double-render cannot register the DOCX parser twice.
registerBuiltInParsers()

/**
 * Client provider tree.
 *
 * Isolated into its own file so `app/layout.tsx` can stay a Server Component.
 * Only this subtree is marked `'use client'`, which keeps the layout's metadata
 * export and server rendering intact while still giving the app the context it
 * needs.
 *
 * Order matters: theme is outermost because everything below it renders in a
 * theme; toasts are innermost so they render above page content.
 *
 * Provider policy for later phases: a provider is added here only when its
 * state is genuinely global. Project data, conversion progress and editor state
 * are route-scoped and belong to their own layouts — a monolithic root context
 * re-renders the entire tree on every change and is the usual reason a
 * workspace app becomes sluggish.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      // Dark-first: the CSS `:root` block holds the dark palette, so this
      // default and the server-rendered HTML agree before any JS runs.
      defaultTheme="dark"
      enableSystem
      // Suppresses transition flicker while the theme class swaps.
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={250} skipDelayDuration={300}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
