/**
 * Presentation-layer formatting helpers.
 *
 * Pure functions only — no React, no DOM. Keeping them here (rather than
 * inline in components) means Phase 3+ can reuse them in parser/report output
 * and they stay trivially testable.
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Human-readable file size.
 *
 * Uses binary steps with decimal labels, which is what desktop OSes show and
 * therefore what an author comparing their manuscript file expects.
 */
export function formatFileSize(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const unit = BYTE_UNITS[exponent] ?? 'B'
  const value = bytes / 1024 ** exponent

  return `${exponent === 0 ? value : Number(value.toFixed(fractionDigits))} ${unit}`
}

/** Compact word count, e.g. `84,120 words` / `1.2k words`. */
export function formatWordCount(words: number, compact = false): string {
  if (!Number.isFinite(words) || words < 0) return '0 words'
  const label = words === 1 ? 'word' : 'words'

  if (compact && words >= 1000) {
    return `${Number((words / 1000).toFixed(1))}k ${label}`
  }

  return `${words.toLocaleString('en-GB')} ${label}`
}

/** Absolute date, e.g. `27 Jul 2026`. */
export function formatDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
  ['second', 1000],
]

/**
 * Relative time, e.g. `3 days ago`.
 *
 * Takes an explicit `now` so callers can pass a server-rendered timestamp and
 * avoid hydration mismatches — a real bug class when the server and client
 * evaluate `Date.now()` milliseconds apart around a unit boundary.
 */
export function formatRelativeTime(value: Date | string | number, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const deltaMs = date.getTime() - now.getTime()
  const formatter = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= unitMs || unit === 'second') {
      return formatter.format(Math.round(deltaMs / unitMs), unit)
    }
  }

  return 'just now'
}

/** Clamp a 0–1 ratio to a whole percentage. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%'
  return `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`
}

/** Truncate to a character budget on a word boundary where possible. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const slice = text.slice(0, maxLength - 1)
  const lastSpace = slice.lastIndexOf(' ')

  return `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`
}

/** Sentence-safe title case for headings generated from identifiers. */
export function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}
