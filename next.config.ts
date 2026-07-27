import type { NextConfig } from 'next'

/**
 * Next.js configuration.
 *
 * Kept deliberately small: every option here is a decision future phases inherit.
 * `typedRoutes` is enabled so that adding a route in Phase 2+ immediately gives
 * compile-time safety on every `<Link href>` across the app.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
}

export default nextConfig
