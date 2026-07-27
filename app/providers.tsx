'use client'

import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

// The parser registry is deliberately NOT populated here.
//
// It was, until measurement showed what that cost: importing `lib/parser` from
// the provider tree put mammoth and JSZip — over 700 KB — into a chunk every
// page loaded, so opening the dashboard downloaded the entire DOCX engine to
// render a list of projects.
//
// Registration now happens inside the worker that actually parses (see
// `lib/workers`), where the import is dynamic. Nothing on the main thread needs
// the registry: the upload control validates against the format catalogue,
// which is a standalone module with no dependencies.

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
