import { AppShell } from '@/components/layout/app-shell'

/**
 * Workspace layout.
 *
 * `(workspace)` is a route group: it applies the application chrome to every
 * page inside it without adding a `/workspace` segment to any URL. The reason
 * to have it at all is future-proofing — a marketing site, a sign-in page or a
 * standalone reader view all need to render *without* the sidebar, and with
 * this group in place they are added as sibling groups rather than as a
 * rewrite of the root layout.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
