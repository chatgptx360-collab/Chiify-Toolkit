'use client'

import { RefreshCw, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { logger } from '@/lib/logging'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'

/**
 * Route error boundary.
 *
 * Must be a Client Component — React error boundaries rely on client-side
 * lifecycle. `reset()` re-renders the failed segment without a full page load,
 * so a transient failure costs the user a click rather than their place in the
 * app.
 *
 * The `digest` is surfaced because it is the only handle a user has on a
 * server-side error whose real message Next.js redacts in production; without
 * it a support conversation has nothing to correlate against the logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Through the logger rather than straight to the console: a route error
    // carries whatever the failing screen was working on, which in this
    // application means the visitor's own manuscript. The logger keeps errors
    // in production — a browser console is where a bug report comes from — but
    // routes them through one place that can later become real reporting.
    logger.error('unhandled route error', error.message, error.digest ?? '')
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <EmptyState
        icon={TriangleAlert}
        size="lg"
        title="Something went wrong"
        description="This screen failed to load. Trying again usually resolves it — nothing you have saved has been lost."
        action={
          <>
            <Button variant="primary" onClick={reset}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
            {error.digest ? (
              <span className="font-mono text-xs text-subtle-foreground">
                Reference {error.digest}
              </span>
            ) : null}
          </>
        }
        className="w-full max-w-xl"
      />
    </div>
  )
}
