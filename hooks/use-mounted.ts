'use client'

import * as React from 'react'

/** A store that never changes, so the snapshot functions do all the work. */
const subscribe = () => () => {}

/**
 * True only after the first client render.
 *
 * Implemented with `useSyncExternalStore` rather than `useState` + `useEffect`:
 * the server snapshot is `false` and the client snapshot is `true`, which is
 * precisely the distinction being expressed. The effect version says the same
 * thing by triggering a second render, which React now flags as a cascading
 * update.
 *
 * The narrow, legitimate use: rendering something whose value genuinely cannot
 * be known on the server (the resolved theme, `window` measurements). Gating
 * that render until after hydration avoids a mismatch without disabling SSR
 * for the whole subtree.
 *
 * It is NOT a general "fix hydration errors" tool — reaching for it to silence
 * a mismatch usually hides a real bug.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
