'use client'

import { useSearchParams } from 'next/navigation'

import { PageHeader } from '@/components/common/page-header'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectLibrary } from '@/components/projects/project-library'

import { ProjectDetail } from './project-detail'

/**
 * The projects screen — library, or one project.
 *
 * WHY ONE ROUTE AND A QUERY PARAMETER
 * -----------------------------------
 * A project id is created in the visitor's own browser and never leaves it.
 * `/projects/prj_a1b2` therefore *looks* like the address of a resource and is
 * not one: sending that link to somebody else opens an empty screen, because
 * the project exists only in the storage of the browser that made it.
 * `/projects?id=prj_a1b2` reads as what it is — a view of a local record.
 *
 * The practical consequence is that the whole application prerenders to static
 * files, since there is no longer a route whose paths can only be known at
 * runtime. That is what makes it hostable on GitHub Pages, and it costs
 * nothing: no part of this app was ever rendered by a server.
 *
 * The URL is still the source of truth rather than component state, so the back
 * button, a refresh and a bookmark all behave the way a visitor expects.
 */
export function ProjectsWorkspace() {
  const id = useSearchParams().get('id')

  if (id) return <ProjectDetail projectId={id} />

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="A project holds one book — its manuscript, its metadata and every file generated from it."
        actions={<CreateProjectDialog />}
      />

      <ProjectLibrary />
    </div>
  )
}
