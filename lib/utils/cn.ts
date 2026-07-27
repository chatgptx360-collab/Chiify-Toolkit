import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names, resolving Tailwind conflicts.
 *
 * `clsx` handles conditionals/arrays/objects; `twMerge` makes the *last*
 * conflicting utility win, so a caller can always override a component's
 * internal styling (`<Button className="rounded-full">`) without `!important`
 * or specificity tricks. Every component in this codebase accepts `className`
 * and pipes it through here — that is what makes the primitives composable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
