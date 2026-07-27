import { redirect } from 'next/navigation'

import { defaultRoute } from '@/lib/config/navigation'

/**
 * Root route.
 *
 * The product is a workspace, so `/` has no content of its own — it forwards to
 * the dashboard. Redirecting here (rather than making `/` the dashboard) keeps
 * one canonical URL per screen, which matters for breadcrumbs, active-link
 * matching and the marketing landing page that will eventually claim `/`.
 */
export default function RootPage() {
  redirect(defaultRoute)
}
