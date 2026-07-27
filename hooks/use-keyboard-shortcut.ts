'use client'

import * as React from 'react'

export interface ShortcutOptions {
  /** Requires Cmd on macOS, Ctrl elsewhere — the platform-correct default. */
  readonly meta?: boolean
  readonly shift?: boolean
  readonly alt?: boolean
  readonly enabled?: boolean
  /**
   * Fire even when a text field has focus. Off by default: a bare `n` shortcut
   * that triggers while the user types "notes" into an input is a bug users
   * find within seconds.
   */
  readonly allowInInput?: boolean
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Bind a global keyboard shortcut.
 *
 * Exists in Phase 1 because the shell already needs one (`[` toggles the
 * sidebar) and because the command palette on the roadmap will need exactly
 * this behaviour. Centralising the modifier normalisation means shortcuts
 * behave the same on macOS and Windows without each call site testing the
 * platform.
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {},
): void {
  const { meta = false, shift = false, alt = false, enabled = true, allowInInput = false } = options

  // Keeps the listener stable while always calling the latest handler, so a
  // consumer does not have to memoise its callback to avoid re-binding.
  const handlerRef = React.useRef(handler)
  React.useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  React.useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key.toLowerCase()) return

      const modifierPressed = event.metaKey || event.ctrlKey
      if (meta !== modifierPressed) return
      if (shift !== event.shiftKey) return
      if (alt !== event.altKey) return

      if (!allowInInput) {
        const target = event.target
        const isEditable =
          target instanceof HTMLElement &&
          (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)
        if (isEditable) return
      }

      event.preventDefault()
      handlerRef.current(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, meta, shift, alt, enabled, allowInInput])
}
