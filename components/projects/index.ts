/**
 * Project workspace components.
 *
 * They read and write through the hooks in `hooks/use-projects.ts`, never
 * through the store directly — that keeps the storage mechanism replaceable
 * (IndexedDB, then a server) without touching a component.
 */
export { CreateProjectDialog } from './create-project-dialog'
export { DeleteProjectDialog, type DeleteProjectDialogProps } from './delete-project-dialog'
export { ProjectCard, type ProjectCardProps } from './project-card'
export { ProjectLibrary } from './project-library'
export { ProjectPicker, type ProjectPickerProps } from './project-picker'
export { ProjectStatusBadge, type ProjectStatusBadgeProps } from './project-status-badge'
