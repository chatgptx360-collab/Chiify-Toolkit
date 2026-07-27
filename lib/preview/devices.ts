/**
 * Device profiles for the preview.
 *
 * WHY WIDTHS AND NOT SCREENSHOTS
 * ------------------------------
 * A reflowable book has no fixed appearance, so "what it looks like on a Kindle"
 * is not a well-formed question — it depends on the reader's font size, their
 * margins, and their orientation. What *is* well-formed is "does anything
 * overflow at 375 pixels", and that is what these profiles answer. A table
 * that needs 600 pixels is broken on a phone whatever the font.
 *
 * The e-reader profile is the important one and the one authors never think to
 * check: a 6-inch e-ink screen is narrower than a phone and its text is
 * typically larger, which is the combination that reveals wide tables and
 * unscaled images.
 */

export interface PreviewDevice {
  readonly id: string
  readonly name: string
  /** CSS pixels of the viewport, not the physical panel. */
  readonly width: number
  readonly height: number
  /** What this size is actually testing. */
  readonly note: string
}

export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  {
    id: 'phone',
    name: 'Phone',
    width: 375,
    height: 667,
    note: 'The narrowest common screen. Anything that overflows here overflows everywhere.',
  },
  {
    id: 'ereader',
    name: 'E-reader',
    width: 400,
    height: 600,
    note: 'A 6-inch e-ink screen — narrow, with larger default text than a phone.',
  },
  {
    id: 'tablet',
    name: 'Tablet',
    width: 768,
    height: 1024,
    note: 'Where a two-column layout would appear, and where wide tables finally fit.',
  },
  {
    id: 'desktop',
    name: 'Desktop',
    width: 1024,
    height: 768,
    note: 'A reading app on a laptop, where the measure matters more than the width.',
  },
]

export const DEFAULT_DEVICE_ID = 'phone'

export function deviceById(id: string): PreviewDevice {
  return PREVIEW_DEVICES.find((device) => device.id === id) ?? (PREVIEW_DEVICES[0] as PreviewDevice)
}

/**
 * Reader settings the preview can simulate.
 *
 * These are the four things every reading system lets a reader change, and
 * therefore the four an author cannot control. Being able to move them is the
 * point of the preview: a book that only works at the default size is a book
 * that fails for the readers who most need it to work.
 */
export interface ReaderPreferences {
  /** Multiplier on the base font size, 0.8–1.8. */
  readonly fontScale: number
  readonly lineHeight: number
  /** Maximum line length in characters, which is what a measure really is. */
  readonly measure: number
  readonly theme: ReaderTheme
  readonly justify: boolean
}

export type ReaderTheme = 'light' | 'sepia' | 'dark'

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  fontScale: 1,
  lineHeight: 1.6,
  measure: 66,
  theme: 'light',
  justify: false,
}

interface ThemeColours {
  readonly background: string
  readonly foreground: string
  readonly muted: string
}

/**
 * Reading themes, as the reading system would apply them.
 *
 * Sepia is included because it is the default on several devices, and because
 * it is where a book that specifies its own text colour falls apart most
 * visibly.
 */
export const READER_THEMES: Readonly<Record<ReaderTheme, ThemeColours>> = {
  light: { background: '#ffffff', foreground: '#1a1a1a', muted: '#666666' },
  sepia: { background: '#f6efe0', foreground: '#42382a', muted: '#7a6b52' },
  dark: { background: '#121212', foreground: '#e6e6e6', muted: '#9a9a9a' },
}
