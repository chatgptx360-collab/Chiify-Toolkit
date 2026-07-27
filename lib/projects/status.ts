import type { Intent } from '../types/common'
import type { ProjectStatus } from '../types/project'

/**
 * How each project status is presented.
 *
 * Lives in the domain rather than in a component because four different
 * surfaces render it — the project card, the detail header, the dashboard and
 * (later) the conversion screen. A lookup table in one component would be
 * copied into the others within a week, and then they would drift.
 *
 * The `description` is the status expressed as something the author can act on,
 * not as a state-machine label.
 */
export interface ProjectStatusPresentation {
  readonly label: string
  readonly intent: Intent
  readonly description: string
}

export const projectStatusPresentation: Record<ProjectStatus, ProjectStatusPresentation> = {
  draft: {
    label: 'Draft',
    intent: 'neutral',
    description: 'No manuscript uploaded yet.',
  },
  importing: {
    label: 'Importing',
    intent: 'primary',
    description: 'Reading the manuscript.',
  },
  ready: {
    label: 'Ready',
    intent: 'info',
    description: 'Manuscript uploaded and ready to convert.',
  },
  converting: {
    label: 'Converting',
    intent: 'primary',
    description: 'Building the EPUB.',
  },
  converted: {
    label: 'Converted',
    intent: 'success',
    description: 'The book has been generated.',
  },
  failed: {
    label: 'Failed',
    intent: 'danger',
    description: 'Something went wrong during conversion.',
  },
}
