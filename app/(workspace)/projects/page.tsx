import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectLibrary } from '@/components/projects/project-library'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Every manuscript you are preparing for publication.',
}

/**
 * Projects.
 *
 * A Server Component that renders two client islands. The page itself ships no
 * JavaScript beyond them, and keeps its `metadata` export — which it would lose
 * if the whole route were marked `'use client'` just to read the store.
 */
export default function ProjectsPage() {
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
