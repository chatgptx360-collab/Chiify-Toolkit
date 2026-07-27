import type { Transition, Variants } from 'framer-motion'

import { durationsInSeconds, easings } from './tokens'

/**
 * Shared motion vocabulary.
 *
 * WHY CENTRALISE THIS
 * -------------------
 * Animation is the fastest way for a UI to feel inconsistent: one component
 * springs, another eases over 400ms, a third fades instantly. Defining the
 * transitions once means every surface in the product moves with the same
 * personality, and tuning that personality is a single-file change.
 *
 * House style: short (140–320ms), decelerated, small travel distances. Motion
 * should explain where something came from, never make the user wait.
 *
 * Accessibility: components consuming these should pair them with
 * `useReducedMotion()`; `styles/globals.css` additionally neutralises CSS
 * transitions under `prefers-reduced-motion`.
 */

export const transitions = {
  /** Micro-interactions: hover, press, colour changes. */
  instant: {
    duration: durationsInSeconds.instant,
    ease: easings.standard,
  },
  /** Default for most UI state changes. */
  fast: {
    duration: durationsInSeconds.fast,
    ease: easings.standard,
  },
  /** Panels, popovers, page content. */
  normal: {
    duration: durationsInSeconds.normal,
    ease: easings.entrance,
  },
  /** Large surfaces: drawers, dialogs. */
  slow: {
    duration: durationsInSeconds.slow,
    ease: easings.entrance,
  },
  /** Physical feel for draggable/snapping elements. */
  spring: {
    type: 'spring',
    stiffness: 380,
    damping: 32,
    mass: 0.9,
  },
} as const satisfies Record<string, Transition>

/** Fade only. Safe default when travel would fight the layout. */
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.normal },
  exit: { opacity: 0, transition: transitions.fast },
} as const satisfies Variants

/** Fade + small upward travel. The app's default page/section entrance. */
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.normal },
  exit: { opacity: 0, y: -4, transition: transitions.fast },
} as const satisfies Variants

/** Scale + fade, for elements that own the user's focus (dialogs, menus). */
export const popVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transitions.fast },
  exit: { opacity: 0, scale: 0.98, transition: transitions.instant },
} as const satisfies Variants

/** Off-canvas panel, e.g. the mobile sidebar. */
export const slideInVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: transitions.slow },
  exit: { x: '-100%', transition: { ...transitions.fast, ease: easings.exit } },
} as const satisfies Variants

/**
 * Parent variant that staggers children.
 *
 * `staggerChildren` is kept small (40ms): enough to read as a cascade, short
 * enough that a 12-card grid still finishes in under a third of a second.
 */
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: { opacity: 0, transition: transitions.fast },
} as const satisfies Variants

/** Item companion to `staggerContainerVariants`. */
export const staggerItemVariants = fadeUpVariants

/** Hover/press feedback for cards and tiles. */
export const interactiveMotion = {
  whileHover: { y: -2 },
  whileTap: { y: 0, scale: 0.995 },
  transition: transitions.fast,
} as const

/** Hover/press feedback for buttons, which should not translate. */
export const pressMotion = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: transitions.instant,
} as const
