'use client'

import { RefreshCw, TriangleAlert } from 'lucide-react'
import * as React from 'react'

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
    // Phase 6 replaces this with real error reporting. Logging to the console
    // in the meantime keeps failures visible in development instead of silent.
    console.error('Unhandled route error:', error)
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
