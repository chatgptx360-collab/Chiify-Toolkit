'use client'

import { FolderOpen, Search } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/common/empty-state'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog'
import { ProjectCard } from '@/components/projects/project-card'
import { Input } from '@/components/ui/input'
import { SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { useProjects, useProjectsReady, useStableNow } from '@/hooks'

/**
 * The project library.
 *
 * Three distinct states, and conflating any two of them is a bug users notice:
 *
 *   1. **Loading** — the client has not read storage yet. Shows skeletons.
 *      Showing "no projects" here looks like data loss.
 *   2. **Empty** — genuinely no projects. Shows an empty state with the one
 *      action that matters.
 *   3. **Filtered to nothing** — projects exist but none match the search.
 *      Offers a way back, not an invitation to create another book.
 *
 * Search is client-side over an in-memory list, which is correct at this scale:
 * an author's library is tens of books, not thousands, and a debounced request
 * would be slower and more code.
 */
export function ProjectLibrary() {
  const projects = useProjects()
  const ready = useProjectsReady()
  const now = useStableNow()
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return projects

    return projects.filter((project) => {
      const haystack = [project.name, project.metadata.title, ...project.metadata.authors]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [projects, query])

  if (!ready) {
    return (
      <SkeletonGroup
        label="Loading your projects"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </SkeletonGroup>
    )
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        size="lg"
        title="Your library is empty"
        description="A project holds one book — its manuscript, its metadata and every file generated from it. Create one to get started."
        action={<CreateProjectDialog />}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <label htmlFor="project-search" className="sr-only">
            Search projects
          </label>
          <Input
            id="project-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or author"
            startIcon={<Search />}
          />
        </div>

        <p className="text-xs text-subtle-foreground" role="status" aria-live="polite">
          {filtered.length === projects.length
            ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
            : `${filtered.length} of ${projects.length} shown`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          size="sm"
          title="No projects match that search"
          description={`Nothing in your library matches “${query.trim()}”. Try a different title or author.`}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                now={now}
                actions={<DeleteProjectDialog project={project} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
