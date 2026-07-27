/**
 * Design tokens, expressed in TypeScript.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `styles/globals.css` is the source of truth for anything the *browser*
 * renders. But some consumers cannot read CSS custom properties:
 *
 *   - Framer Motion transitions need numeric seconds and cubic-bezier arrays.
 *   - Chart/preview code in later phases needs colour values in JS.
 *   - Tests and docs need to assert against a scale.
 *
 * So this module mirrors the *non-colour* scales and exposes the colour scale
 * as `var()` references rather than literals. Referencing the variable means a
 * theme switch still works — a hardcoded hex would freeze the component in one
 * theme, which is the classic bug this indirection prevents.
 *
 * RULE: never add a value here that does not exist in globals.css.
 */

/** Motion durations in milliseconds. Mirrors `--duration-*`. */
export const durations = {
  instant: 80,
  fast: 140,
  normal: 220,
  slow: 320,
  slower: 480,
} as const

export type DurationToken = keyof typeof durations

/** Same scale in seconds, which is the unit Framer Motion expects. */
export const durationsInSeconds = {
  instant: durations.instant / 1000,
  fast: durations.fast / 1000,
  normal: durations.normal / 1000,
  slow: durations.slow / 1000,
  slower: durations.slower / 1000,
} as const

/**
 * Easing curves as cubic-bezier control points. Mirrors `--easing-*`.
 *
 * `standard` is the workhorse (a fast-out/slow-in curve borrowed from the
 * Linear/Vercel school of motion), `entrance` is more decelerated for elements
 * appearing, `exit` accelerates away.
 */
export const easings = {
  standard: [0.32, 0.72, 0, 1],
  entrance: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

export type EasingToken = keyof typeof easings

/** Border radius scale. Mirrors the `--radius-*` theme namespace. */
export const radii = {
  xs: '0.375rem',
  sm: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.375rem',
  full: '9999px',
} as const

export type RadiusToken = keyof typeof radii

/**
 * Spacing scale in rem. Tailwind generates spacing from a single `--spacing`
 * multiplier (0.25rem), so this table names the steps the design language
 * actually uses rather than inventing a parallel scale.
 */
export const spacing = {
  none: '0rem',
  '3xs': '0.125rem',
  '2xs': '0.25rem',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
} as const

export type SpacingToken = keyof typeof spacing

/** Type scale. Mirrors the `--text-*` theme namespace. */
export const typography = {
  '2xs': { size: '0.6875rem', lineHeight: '1rem', tracking: '0.02em' },
  xs: { size: '0.75rem', lineHeight: '1.125rem', tracking: '0em' },
  sm: { size: '0.875rem', lineHeight: '1.375rem', tracking: '0em' },
  base: { size: '1rem', lineHeight: '1.625rem', tracking: '0em' },
  lg: { size: '1.125rem', lineHeight: '1.75rem', tracking: '0em' },
  xl: { size: '1.375rem', lineHeight: '1.875rem', tracking: '-0.01em' },
  '2xl': { size: '1.75rem', lineHeight: '2.125rem', tracking: '-0.018em' },
  '3xl': { size: '2.25rem', lineHeight: '2.625rem', tracking: '-0.022em' },
  '4xl': { size: '3rem', lineHeight: '3.25rem', tracking: '-0.028em' },
} as const

export type TypographyToken = keyof typeof typography

/** Elevation scale. Mirrors `--elevation-*` / the `--shadow-*` namespace. */
export const elevation = {
  none: 'none',
  xs: 'var(--elevation-xs)',
  sm: 'var(--elevation-sm)',
  md: 'var(--elevation-md)',
  lg: 'var(--elevation-lg)',
  xl: 'var(--elevation-xl)',
} as const

export type ElevationToken = keyof typeof elevation

/**
 * Semantic colours as `var()` references.
 *
 * Deliberately NOT hex literals — see the note at the top of the file.
 */
export const colors = {
  background: 'var(--background)',
  surface: 'var(--surface)',
  surfaceRaised: 'var(--surface-raised)',
  card: 'var(--card)',
  popover: 'var(--popover)',
  overlay: 'var(--overlay)',
  foreground: 'var(--foreground)',
  mutedForeground: 'var(--muted-foreground)',
  subtleForeground: 'var(--subtle-foreground)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  ring: 'var(--ring)',
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
} as const

export type ColorToken = keyof typeof colors

/**
 * Responsive breakpoints in pixels. Mirrors the `--breakpoint-*` namespace
 * (Tailwind defaults plus the two custom stops).
 *
 * Exposed in JS so `useMediaQuery` and layout logic agree with CSS instead of
 * drifting apart — a mismatch between a JS breakpoint and a CSS one produces
 * layout bugs that only appear in a narrow window of viewport widths.
 */
export const breakpoints = {
  xs: 400,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  '3xl': 1600,
} as const

export type Breakpoint = keyof typeof breakpoints

/** Container widths. Mirrors `--container-*`. */
export const containers = {
  prose: '46rem',
  content: '84rem',
} as const

/** Fixed shell measurements shared between CSS and layout logic. */
export const layout = {
  sidebarWidth: '16rem',
  sidebarWidthCollapsed: '4.25rem',
  topbarHeight: '3.5rem',
} as const

/** The complete token set, for docs pages and tooling. */
export const tokens = {
  durations,
  durationsInSeconds,
  easings,
  radii,
  spacing,
  typography,
  elevation,
  colors,
  breakpoints,
  containers,
  layout,
} as const

export type DesignTokens = typeof tokens
