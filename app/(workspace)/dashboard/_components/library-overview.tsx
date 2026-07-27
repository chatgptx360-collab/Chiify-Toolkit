'use client'

import { ArrowRight, BookOpen, CheckCircle2, FileText, FolderOpen, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { EmptyState } from '@/components/common/empty-state'
import { Section } from '@/components/common/section'
import { StatCard } from '@/components/dashboard/stat-card'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectCard } from '@/components/projects/project-card'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { useProjects, useProjectsReady, useStableNow } from '@/hooks'
import { formatFileSize } from '@/lib/utils'

/**
 * The dashboard's data-driven half.
 *
 * Every number here is derived from the store rather than stored separately.
 * A cached "projectCount" is a second source of truth that drifts the first
 * time a delete path forgets to decrement it; deriving costs nothing at this
 * scale and cannot go stale.
 *
 * Recent projects are capped at three. A dashboard's job is orientation, not
 * completeness — the full list is one click away and already has search.
 */
const RECENT_LIMIT = 3

export function LibraryOverview() {
  const projects = useProjects()
  const ready = useProjectsReady()
  const now = useStableNow()

  if (!ready) {
    return (
      <SkeletonGroup label="Loading your library" className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </SkeletonGroup>
    )
  }

  const withManuscript = projects.filter((project) => project.source)
  const converted = projects.filter((project) => project.status === 'converted')
  const totalBytes = withManuscript.reduce(
    (sum, project) => sum + (project.source?.byteSize ?? 0),
    0,
  )
  const recent = projects.slice(0, RECENT_LIMIT)

  return (
    <>
      <Section title="Overview" description="Your publishing activity at a glance.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Projects"
            value={String(projects.length)}
            icon={FolderOpen}
            hint="Books in your workspace"
          />
          <StatCard
            label="Manuscripts attached"
            value={String(withManuscript.length)}
            icon={FileText}
            hint={totalBytes > 0 ? `${formatFileSize(totalBytes)} in total` : 'No source files yet'}
          />
          <StatCard
            label="Books converted"
            value={String(converted.length)}
            icon={BookOpen}
            hint="EPUB 3 files generated"
          />
          <StatCard
            label="Validation passes"
            value="0"
            icon={CheckCircle2}
            hint="Available once validation ships in Phase 5"
          />
        </div>
      </Section>

      <Section
        title="Recent projects"
        description="The books you have worked on most recently."
        actions={
          projects.length > RECENT_LIMIT ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                View all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null
        }
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nothing here yet"
            description="Create your first project to start preparing a book. Everything you upload stays on this device."
            action={<CreateProjectDialog />}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
