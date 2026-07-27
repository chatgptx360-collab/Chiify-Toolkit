'use client'

import * as React from 'react'

export interface Disclosure {
  readonly isOpen: boolean
  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
  readonly setOpen: (open: boolean) => void
}

/**
 * Open/closed state for drawers, dialogs and expandable panels.
 *
 * Trivial on its own — the value is that every disclosure in the app exposes
 * the same four functions, so a component can accept a `Disclosure` and work
 * with any of them. The callbacks are stable, so passing them to memoised
 * children does not defeat the memoisation.
 */
export function useDisclosure(initialOpen = false): Disclosure {
  const [isOpen, setOpen] = React.useState(initialOpen)

  const open = React.useCallback(() => setOpen(true), [])
  const close = React.useCallback(() => setOpen(false), [])
  const toggle = React.useCallback(() => setOpen((current) => !current), [])

  return React.useMemo(
    () => ({ isOpen, open, close, toggle, setOpen }),
    [isOpen, open, close, toggle],
  )
}
