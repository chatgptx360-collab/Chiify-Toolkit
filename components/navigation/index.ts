/**
 * Navigation components.
 *
 * All of them read from the registry in `lib/config/navigation.ts` rather than
 * holding their own link lists, so routes exist in exactly one place.
 */
export { Breadcrumb, type BreadcrumbProps } from './breadcrumb'
export { NavMenu, type NavMenuProps } from './nav-menu'
export { SidebarItem, type SidebarItemProps } from './sidebar-item'
