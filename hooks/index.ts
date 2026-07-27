/**
 * Shared React hooks.
 *
 * A hook belongs here when it is generic (no domain knowledge) and used by
 * more than one component. Feature-specific hooks live beside their feature —
 * `hooks/` is not a dumping ground for every `useState` wrapper.
 */
export { useDisclosure, type Disclosure } from './use-disclosure'
export { useKeyboardShortcut, type ShortcutOptions } from './use-keyboard-shortcut'
export { useLocalStorageBoolean } from './use-local-storage'
export { useBreakpoint, useIsMobileLayout, useMediaQuery } from './use-media-query'
export { useMounted } from './use-mounted'
