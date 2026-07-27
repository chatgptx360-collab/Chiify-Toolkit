'use client'

import * as React from 'react'

/**
 * A `Date` that is stable for the lifetime of a component.
 *
 * WHY THIS EXISTS
 * ---------------
 * Relative timestamps ("3 minutes ago") need a reference point. Calling
 * `new Date()` during render creates two problems:
 *
 *   1. The server and the client evaluate it milliseconds apart. Around a unit
 *      boundary that produces "in 0 seconds" on the server and "1 second ago"
 *      on the client — a genuine hydration mismatch.
 *   2. A list of twenty cards each calling it can disagree with itself.
 *
 * Fixing the value once per mount solves both. The consequence is that
 * timestamps do not tick while a page is open, which is the right trade for a
 * workspace: a list of manuscripts is not a live feed, and re-rendering every
 * card each minute to advance a label nobody is watching is wasted work.
 *
 * The server snapshot is the epoch, so nothing relative is rendered until the
 * client takes over — `formatRelativeTime` output only appears post-hydration.
 */
const SERVER_NOW = new Date(0)

export function useStableNow(): Date {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const clientNow = React.useMemo(() => new Date(), [])

  return mounted ? clientNow : SERVER_NOW
}
