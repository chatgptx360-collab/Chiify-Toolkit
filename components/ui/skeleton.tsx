import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Loading skeleton.
 *
 * Two accessibility decisions worth stating:
 *
 *   1. Skeletons are `aria-hidden`. A screen reader user gains nothing from
 *      hearing "grey rectangle" nine times; the *container* announces loading
 *      via `SkeletonGroup`'s live region instead.
 *   2. The shimmer is a CSS animation, so `prefers-reduced-motion` in
 *      `globals.css` neutralises it automatically.
 */
export interface SkeletonProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Rounds to a pill for text lines, or a circle for avatars. */
  shape?: 'line' | 'block' | 'circle'
}

export function Skeleton({ className, shape = 'block', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-muted',
        shape === 'line' && 'h-3.5 rounded-full',
        shape === 'block' && 'rounded-lg',
        shape === 'circle' && 'aspect-square rounded-full',
        className,
      )}
      {...props}
    />
  )
}

export interface SkeletonGroupProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Announced to assistive technology while the group is mounted. */
  label?: string
}

/**
 * Wraps a set of skeletons and announces the loading state once.
 *
 * `aria-busy` plus a polite live region is the pattern that tells a screen
 * reader "content is coming" without spamming it as individual placeholders
 * mount.
 */
export function SkeletonGroup({
  className,
  label = 'Loading content',
  children,
  ...props
}: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn(className)} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** Card-shaped skeleton, matching the real `Card` metrics so nothing shifts. */
export function SkeletonCard({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 sm:p-6', className)} {...props}>
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-9" />
        <div className="flex-1 space-y-2">
          <Skeleton shape="line" className="w-1/3" />
          <Skeleton shape="line" className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <Skeleton shape="line" className="w-full" />
        <Skeleton shape="line" className="w-11/12" />
        <Skeleton shape="line" className="w-2/3" />
      </div>
    </div>
  )
}

/** Repeated text lines, the most common skeleton shape. */
export function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { lines?: number }) {
  return (
    <div className={cn('space-y-2.5', className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} shape="line" className={index === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  )
}
