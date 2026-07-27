'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMounted } from '@/hooks'

/**
 * Theme toggle.
 *
 * WHY A MENU RATHER THAN A SWITCH
 * -------------------------------
 * A two-state switch cannot express "follow my system", which is what most
 * users actually want and what the OS-level dark-mode schedule depends on. The
 * three-way choice is standard in the products this app takes its cues from.
 *
 * The trigger renders a neutral icon until mounted: the resolved theme is not
 * knowable during SSR, so rendering a sun or moon on the server guarantees a
 * hydration mismatch. The button's size never changes, so nothing shifts.
 */
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const mounted = useMounted()

  const ActiveIcon = !mounted ? Monitor : resolvedTheme === 'light' ? Sun : Moon
  const activeLabel = mounted
    ? (THEME_OPTIONS.find((option) => option.value === theme)?.label ?? 'System')
    : 'System'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Change theme (currently ${activeLabel})`}>
          <ActiveIcon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          {...(mounted && theme ? { value: theme } : {})}
          onValueChange={setTheme}
        >
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden="true" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
