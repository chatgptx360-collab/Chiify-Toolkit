import type { NextConfig } from 'next'

/**
 * Next.js configuration.
 *
 * Kept deliberately small: every option here is a decision future phases
 * inherit. `typedRoutes` gives compile-time safety on every `<Link href>`.
 *
 * WHY THE WHOLE APP IS A STATIC EXPORT
 * ------------------------------------
 * Nothing in Chiify is rendered by a server. Manuscripts are parsed, books are
 * generated and validation runs in the visitor's own browser — that is the
 * product, not an implementation detail. So there is no server to keep, and
 * `output: 'export'` states that as a fact the build enforces: if a later phase
 * adds a route that genuinely needs a server, the build fails and the decision
 * gets made deliberately rather than discovered in production.
 *
 * It also means the app can be hosted anywhere that serves files — GitHub Pages
 * included — with no runtime and nothing to operate.
 *
 * WHY THE BASE PATH IS AN ENVIRONMENT VARIABLE
 * --------------------------------------------
 * A GitHub Pages project site is served from a subdirectory
 * (`/Chiify-Toolkit/`), while `next dev` and most other hosts serve from the
 * root. Hard-coding either breaks the other, so the deploy workflow sets this
 * and local development leaves it empty.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  output: 'export',
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Static hosts serve `/projects/` from `projects/index.html`. Without this,
  // the export writes `projects.html`, which some hosts resolve and others
  // return 404 for — a difference that only appears after deployment.
  trailingSlash: true,
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
}

export default nextConfig
