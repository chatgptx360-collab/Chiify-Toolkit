import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

import { siteConfig } from '@/lib/config/site'
import '@/styles/globals.css'

import { Providers } from './providers'

/**
 * Root layout.
 *
 * Stays a Server Component: metadata, fonts and the document shell are all
 * server concerns, and keeping the boundary here means the client bundle only
 * contains what `Providers` and the shell actually need.
 *
 * Fonts are loaded through `next/font`, which self-hosts them at build time.
 * That removes a third-party request on first paint, eliminates layout shift
 * via the automatic size-adjust fallback, and means no external font CDN is in
 * the critical path.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-family',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: ['EPUB', 'DOCX to EPUB', 'eBook publishing', 'self-publishing', 'manuscript'],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  robots: { index: true, follow: true },
}

/**
 * `themeColor` matches the app background per scheme so mobile browser chrome
 * blends into the page instead of framing it in white.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` is required and narrowly scoped: next-themes
    // writes the theme class onto <html> before React hydrates, which React
    // would otherwise report as a mismatch. It suppresses the warning for this
    // element's attributes only, not for the tree below it.
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
