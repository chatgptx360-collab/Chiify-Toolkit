'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { transitions } from '@/lib/design/motion'
import type { Intent, Toast, ToastOptions } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Toast system.
 *
 * WHY HAND-ROLLED
 * ---------------
 * The behaviour needed here is small and well understood: a queue, timers, and
 * an animated list. Pulling in a notification library would add a dependency
 * whose theming has to be fought into line with the design tokens anyway. This
 * implementation is ~150 lines, uses the project's own motion vocabulary, and
 * has no styling escape hatches to reconcile.
 *
 * Accessibility notes:
 *   - The viewport is a single `aria-live` region, so toasts are announced as
 *     they arrive without stealing focus.
 *   - Errors use `assertive`/`role="alert"`; everything else is polite.
 *   - Auto-dismiss timers pause on hover and on keyboard focus, so a user
 *     reading or tabbing to the action never loses it mid-read.
 */

interface ToastContextValue {
  toasts: readonly Toast[]
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000
/** Beyond this, the oldest toast is dropped — a stack is not a log. */
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<readonly Toast[]>([])
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const scheduleDismiss = React.useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    },
    [dismiss],
  )

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = `toast_${Math.random().toString(36).slice(2, 10)}`
      const next: Toast = { ...options, id }

      setToasts((current) => [...current, next].slice(-MAX_VISIBLE))
      scheduleDismiss(id, options.duration ?? DEFAULT_DURATION)

      return id
    },
    [scheduleDismiss],
  )

  const dismissAll = React.useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
    setToasts([])
  }, [])

  // Timers outlive the component if the tree unmounts mid-countdown.
  React.useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, dismissAll }),
    [toasts, toast, dismiss, dismissAll],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onPause={(id) => {
          const timer = timers.current.get(id)
          if (timer) {
            clearTimeout(timer)
            timers.current.delete(id)
          }
        }}
        onResume={(id, duration) => scheduleDismiss(id, duration)}
      />
    </ToastContext.Provider>
  )
}

/**
 * Access the toast queue.
 *
 * Throws when used outside the provider: a silently-ignored toast is a bug
 * that only shows up when a user hits the error path, which is the worst
 * possible time to discover it.
 */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>.')
  }
  return context
}

const iconByIntent: Record<Intent, LucideIcon> = {
  neutral: Info,
  primary: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

const accentByIntent: Record<Intent, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

interface ToastViewportProps {
  toasts: readonly Toast[]
  onDismiss: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string, duration: number) => void
}

function ToastViewport({ toasts, onDismiss, onPause, onResume }: ToastViewportProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      // `pointer-events-none` on the container keeps the region from blocking
      // clicks on the page behind it; each toast re-enables its own.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const intent = item.intent ?? 'neutral'
          const Icon = iconByIntent[intent]
          const duration = item.duration ?? DEFAULT_DURATION

          return (
            <motion.div
              key={item.id}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={transitions.normal}
              role={intent === 'danger' ? 'alert' : 'status'}
              aria-live={intent === 'danger' ? 'assertive' : 'polite'}
              onMouseEnter={() => onPause(item.id)}
              onMouseLeave={() => onResume(item.id, duration)}
              onFocusCapture={() => onPause(item.id)}
              onBlurCapture={() => onResume(item.id, duration)}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm gap-3 rounded-lg border border-border',
                'bg-popover p-4 text-popover-foreground shadow-lg',
              )}
            >
              <Icon
                className={cn('mt-0.5 size-4 shrink-0', accentByIntent[intent])}
                aria-hidden="true"
              />

              <div className="flex-1 space-y-1">
                <p className="text-sm leading-snug font-medium">{item.title}</p>
                {item.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick()
                      onDismiss(item.id)
                    }}
                    className="mt-1 rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="-mt-1 -mr-1 h-fit rounded-md p-1.5 text-muted-foreground transition-colors motion-fast hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Dismiss notification</span>
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
