'use client'

import * as React from 'react'

/**
 * `localStorage`-backed state.
 *
 * WHY `useSyncExternalStore` RATHER THAN `useState` + `useEffect`
 * --------------------------------------------------------------
 * `localStorage` *is* an external store, so modelling it as one is not
 * ceremony — it is the API React provides for exactly this case, and it buys
 * three things the effect-based version cannot:
 *
 *   1. No cascading render. The effect version renders the fallback, then
 *      immediately sets state and renders again.
 *   2. A defined server snapshot, so SSR is explicit rather than accidental.
 *   3. Every hook reading the same key stays in sync, including across tabs —
 *      two components reading the same preference can never disagree.
 *
 * Writes notify subscribers manually because the browser's `storage` event
 * only fires in *other* tabs, never the one that made the change.
 */

const listeners = new Map<string, Set<() => void>>()

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener()
}

function subscribeToKey(key: string, onChange: () => void): () => void {
  let keyListeners = listeners.get(key)
  if (!keyListeners) {
    keyListeners = new Set()
    listeners.set(key, keyListeners)
  }
  keyListeners.add(onChange)

  // Cross-tab updates.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    keyListeners.delete(onChange)
    if (keyListeners.size === 0) listeners.delete(key)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Read and write a boolean preference.
 *
 * Booleans cover every preference the shell currently stores. A generic
 * serialising version can be added when something needs it — guessing at the
 * shape now would mean carrying JSON parsing and its failure modes for no
 * current benefit.
 */
export function useLocalStorageBoolean(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const subscribe = React.useCallback(
    (onChange: () => void) => subscribeToKey(key, onChange),
    [key],
  )

  const getSnapshot = React.useCallback((): boolean => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? fallback : stored === 'true'
    } catch {
      // Private browsing modes and blocked storage throw on access; the
      // preference is not important enough to break the app over.
      return fallback
    }
  }, [key, fallback])

  const getServerSnapshot = React.useCallback(() => fallback, [fallback])

  const value = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = React.useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Ignore — the in-memory update below still applies for this session.
      }
      notify(key)
    },
    [key],
  )

  return [value, setValue]
}
