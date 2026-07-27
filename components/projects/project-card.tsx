'use client'

import { FileText, Users } from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'

import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/lib/types'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'

/**
 * A project in the library list.
 *
 * The whole card is a link, implemented by stretching the anchor over the card
 * with a pseudo-element rather than wrapping everything in an `<a>`. That keeps
 * the accessible name to the project title instead of the card's entire text
 * content, and it leaves room for secondary controls (which sit above the
 * overlay with `relative z-10`) without nesting interactive elements.
 *
 * `now` is passed in rather than read from `Date.now()` here so a list of
 * cards renders one consistent set of relative timestamps, and so the value is
 * stable between server and client.
 */
export interface ProjectCardProps {
  project: Project
  now: Date
  /** Secondary controls, e.g. a delete button. Rendered above the card link. */
  actions?: React.ReactNode
}

export function ProjectCard({ project, now, actions }: ProjectCardProps) {
  const authors = project.metadata.authors.filter(Boolean)

  return (
    <Card
      interactive
      className="group relative flex h-full flex-col focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0">
            <Link
              href={`/projects?id=${project.id}` as Route}
              // `before:` stretches the hit area over the whole card while the
              // link's accessible name stays just the title.
              className="outline-none before:absolute before:inset-0 before:rounded-xl before:content-['']"
            >
              <span className="line-clamp-2">{project.name}</span>
            </Link>
          </CardTitle>

          {actions ? <div className="relative z-10 shrink-0">{actions}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          <span className="text-xs text-subtle-foreground">
            Updated {formatRelativeTime(project.updatedAt, now)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="mt-auto space-y-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Users className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />
          <span className="truncate">
            {authors.length > 0 ? authors.join(', ') : 'No author yet'}
          </span>
        </p>

        <p className="flex items-center gap-2">
          <FileText className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />
          <span className="truncate">
            {project.source
              ? `${project.source.fileName} · ${formatFileSize(project.source.byteSize)}`
              : 'No manuscript uploaded'}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
