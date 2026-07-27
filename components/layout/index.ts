/**
 * Layout components — the application chrome.
 *
 * These are the only components allowed to position themselves globally
 * (fixed/sticky) or to own viewport-level state. Everything else composes
 * inside the content area.
 */
export { AppShell, type AppShellProps } from './app-shell'
export { Footer, type FooterProps } from './footer'
export { PageContainer, type PageContainerProps } from './page-container'
export { Sidebar, type SidebarProps } from './sidebar'
export { Topbar, type TopbarProps } from './topbar'
