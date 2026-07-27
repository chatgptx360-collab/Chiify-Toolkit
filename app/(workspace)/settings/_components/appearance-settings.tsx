'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { useMounted } from '@/hooks'
import { cn } from '@/lib/utils'

/**
 * Appearance picker.
 *
 * A real, working setting — the one thing on this page that is not waiting on a
 * later phase. It is built as a radio group rather than a row of buttons
 * because that is what it is: three mutually exclusive options. Radios give
 * arrow-key navigation and correct announcement for free, where buttons would
 * need both re-implemented.
 *
 * Colocated under `_components` because it is used by exactly one route. The
 * leading underscore keeps the folder out of the router, and colocation keeps
 * single-use components from silting up the shared component library.
 */
const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Bright surfaces' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'The default' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Follow your OS' },
] as const

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const groupName = React.useId()

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        // Before hydration the stored theme is unknown, so nothing is marked
        // selected rather than guessing and flipping a moment later.
        const selected = mounted && theme === option.value

        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer flex-col gap-2 rounded-lg border p-4',
              'transition-[border-color,background-color] motion-fast',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              selected
                ? 'border-primary bg-primary-subtle'
                : 'border-border hover:border-border-strong hover:bg-accent/50',
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={selected}
              onChange={() => setTheme(option.value)}
              className="sr-only"
            />

            <option.icon
              className={cn('size-4', selected ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.hint}</span>
          </label>
        )
      })}
    </div>
  )
}
