/**
 * Product-level constants.
 *
 * Anything that appears in more than one place — the product name, the
 * tagline, the support URL — lives here so a rename is one edit rather than a
 * grep. Route metadata deliberately does *not* live here; see `navigation.ts`.
 */
export const siteConfig = {
  name: 'Chiify Toolkit',
  shortName: 'Chiify',
  tagline: 'Everything you need to prepare and publish professional eBooks.',
  description:
    'Chiify Toolkit turns Microsoft Word manuscripts into valid, retailer-ready EPUB 3 books — with structure detection, metadata, validation and preview in one workspace.',
  url: 'https://chiify.app',
  locale: 'en-GB',
  /** Shown in the sidebar footer so users can report against a known build. */
  version: '0.2.0',
  phase: 'Workspace',
} as const

export type SiteConfig = typeof siteConfig
