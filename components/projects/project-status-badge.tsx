import { Badge } from '@/components/ui/badge'
import { projectStatusPresentation } from '@/lib/projects'
import type { ProjectStatus } from '@/lib/types'

/**
 * A project's status, rendered consistently everywhere it appears.
 *
 * Thin by design — its value is that the mapping from status to label and
 * colour lives in the domain (`lib/projects/status.ts`) and this is the only
 * component that reads it. Four surfaces show a status; none of them can now
 * invent their own wording.
 */
export interface ProjectStatusBadgeProps {
  status: ProjectStatus
  size?: 'sm' | 'md'
}

export function ProjectStatusBadge({ status, size = 'sm' }: ProjectStatusBadgeProps) {
  const presentation = projectStatusPresentation[status]

  return (
    <Badge intent={presentation.intent} size={size} withDot>
      {presentation.label}
    </Badge>
  )
}
