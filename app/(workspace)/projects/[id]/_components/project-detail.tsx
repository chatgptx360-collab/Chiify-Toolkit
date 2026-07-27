'use client'

import { ArrowLeft, FileWarning, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { DocumentAnalysis } from '@/components/analysis/document-analysis'
import { MetadataSuggestions } from '@/components/analysis/metadata-suggestions'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { MetadataForm } from '@/components/forms/metadata-form'
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonCard, SkeletonGroup, SkeletonText } from '@/components/ui/skeleton'
import { useAnalysis, useMetadata, useProject, useProjectsReady, useStableNow } from '@/hooks'
import { projectStatusPresentation } from '@/lib/projects'
import type { ProjectId } from '@/lib/types'
import { formatDate, formatRelativeTime } from '@/lib/utils'

import { ProjectSettingsForm } from './project-settings-form'
import { ProjectSource } from './project-source'

/**
 * Project detail.
 *
 * Handles the three states a client-side record can be in — loading, missing,
 * and present — explicitly. The missing case matters more than it looks: a
 * bookmarked project URL survives a browser data clear, and landing on a blank
 * page in that situation reads as a crash.
 */
export interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const project = useProject(projectId as ProjectId)
  const ready = useProjectsReady()
  const now = useStableNow()
  const router = useRouter()
  const analysis = useAnalysis(projectId as ProjectId)
  const { suggestions, applyOne, applyAll } = useMetadata(projectId as ProjectId, project)

  if (!ready) {
    return (
      <SkeletonGroup label="Loading project" className="space-y-8">
        <SkeletonText lines={2} className="max-w-md" />
        <SkeletonCard />
        <SkeletonCard />
      </SkeletonGroup>
    )
  }

  if (!project) {
    return (
      <EmptyState
        icon={FileWarning}
        size="lg"
        title="That project no longer exists"
        description="It may have been deleted, or this link may point at a project stored on another device. Projects are kept locally in your browser."
        action={
          <Button variant="primary" asChild>
            <Link href="/projects">
              <ArrowLeft aria-hidden="true" />
              Back to projects
            </Link>
          </Button>
        }
      />
    )
  }

  const status = projectStatusPresentation[project.status]

  return (
    <div className="space-y-10">
      <PageHeader
        title={project.name}
        description={status.description}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/converter">
                <Wand2 aria-hidden="true" />
                Convert
              </Link>
            </Button>
            <DeleteProjectDialog
              project={project}
              onDeleted={() => router.push('/projects')}
              trigger={
                <Button variant="ghost" className="text-muted-foreground hover:text-danger">
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <div className="mt-2">
            <ProjectStatusBadge status={project.status} size="md" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Created</p>
          <p className="mt-2 text-sm font-medium">{formatDate(project.createdAt)}</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Last updated</p>
          <p className="mt-2 text-sm font-medium">{formatRelativeTime(project.updatedAt, now)}</p>
        </Card>
      </div>

      <Section
        title="Manuscript"
        description="The source document every generated file is built from."
      >
        <ProjectSource project={project} />
      </Section>

      {analysis ? (
        <Section title="Analysis" description="What Chiify found when it read your manuscript.">
          <DocumentAnalysis analysis={analysis} />
        </Section>
      ) : null}

      <Section
        title="Book metadata"
        description="Written into the EPUB package document and read by every retailer."
      >
        <div className="space-y-4">
          <MetadataSuggestions suggestions={suggestions} onApply={applyOne} onApplyAll={applyAll} />
          <MetadataForm project={project} />
        </div>
      </Section>

      <Section title="Conversion settings" description="How this manuscript is turned into a book.">
        <ProjectSettingsForm project={project} />
      </Section>

      <Section title="Generated files" description="Everything produced from this manuscript.">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle as="h3">No files yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              {analysis
                ? 'Your manuscript has been read and structured. EPUB generation arrives in Phase 4.'
                : 'Upload a manuscript first, then convert it to produce an EPUB.'}
            </p>
            <p className="text-xs text-subtle-foreground">
              Generated books, their validation report and every download will be listed here.
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}
