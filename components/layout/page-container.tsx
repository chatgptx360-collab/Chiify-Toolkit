'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { transitions } from '@/lib/design/motion'
import { cn } from '@/lib/utils'

/**
 * Main content area, with the page transition.
 *
 * WHY THE TRANSITION LIVES HERE
 * -----------------------------
 * Keying the motion wrapper on `pathname` makes every route animate in
 * consistently, and no page has to remember to wrap itself. The travel is
 * 6px over 220ms: enough to register as a change of context, short enough that
 * a user clicking quickly through the sidebar never waits on it.
 *
 * `exit` animations are deliberately absent. The App Router unmounts the old
 * route before the new one commits, so an exit animation would either need
 * route interception or would simply be dropped — a fade-in alone is the
 * honest, jank-free choice.
 */
export interface PageContainerProps extends React.ComponentPropsWithoutRef<'main'> {
  /** Constrain to the reading-width container instead of the app width. */
  width?: 'content' | 'prose' | 'full'
}

export function PageContainer({
  width = 'content',
  className,
  children,
  ...props
}: PageContainerProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <main
      id="main-content"
      // `tabIndex={-1}` makes the skip link's target focusable without adding
      // it to the tab order, so "Skip to content" actually moves focus.
      tabIndex={-1}
      className={cn('flex-1 outline-none', className)}
      {...props}
    >
      <motion.div
        key={pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.normal}
        className={cn(
          'mx-auto w-full px-4 py-8 sm:px-6 sm:py-10',
          width === 'content' && 'max-w-(--container-content)',
          width === 'prose' && 'max-w-(--container-prose)',
        )}
      >
        {children}
      </motion.div>
    </main>
  )
}
