'use client'

import { ArrowRight, FolderOpen, Wand2 } from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'
import * as React from 'react'

import { EmptyState } from '@/components/common/empty-state'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { ManuscriptDropzone } from '@/components/upload/manuscript-dropzone'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/forms/form-field'
import { Select } from '@/components/ui/select'
import { SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useProjectActions, useProjects, useProjectsReady } from '@/hooks'
import { blockingIssues, validateBookMetadata } from '@/lib/projects'
import { isoNow } from '@/lib/types'

/**
 * The conversion workspace.
 *
 * Phase 2 delivers everything up to the point of conversion: choose a project,
 * attach a manuscript, and see whether the book is ready. The conversion button
 * is disabled with an explicit reason rather than hidden — a control that
 * appears only once preconditions are met leaves the author guessing what the
 * preconditions were.
 *
 * Readiness is computed from the *same* validation rules the metadata form
 * uses, so the two screens can never disagree about whether a book is
 * publishable.
 */
export function ConversionWorkspace() {
  const projects = useProjects()
  const ready = useProjectsReady()
  const { update } = useProjectActions()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = React.useState<string>('')

  // Default to the most recently updated project, which is almost always the
  // one the author just came from.
  const activeId = selectedId || projects[0]?.id || ''
  const project = projects.find((candidate) => candidate.id === activeId)

  const metadataErrors = React.useMemo(
    () => (project ? blockingIssues(validateBookMetadata(project.metadata)) : []),
    [project],
  )

  if (!ready) {
    return (
      <SkeletonGroup label="Loading your projects" className="space-y-4">
        <SkeletonCard />
      </SkeletonGroup>
    )
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        size="lg"
        title="Create a project first"
        description="Conversion works on a project, so its metadata and settings travel with the book. Create one, attach your manuscript, and convert from here."
        action={<CreateProjectDialog />}
      />
    )
  }

  function handleFile(file: File) {
    if (!project) return

    const result = update(project.id, {
      source: {
        fileName: file.name,
        mediaType: file.type,
        byteSize: file.size,
        uploadedAt: isoNow(),
      },
      status: 'ready',
    })

    if (!result.ok) {
      toast({
        title: 'Could not attach the file',
        description: result.error.message,
        intent: 'danger',
      })
      return
    }

    toast({
      title: 'Manuscript attached',
      description: `“${file.name}” is ready.`,
      intent: 'success',
    })
  }

  const blockers = [
    project?.source ? null : 'Attach a manuscript.',
    metadataErrors.length > 0
      ? `Complete the book metadata (${metadataErrors.length} ${metadataErrors.length === 1 ? 'field needs' : 'fields need'} attention).`
      : null,
    'The conversion engine arrives in Phases 3 and 4.',
  ].filter((blocker): blocker is string => blocker !== null)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle as="h3">Book to convert</CardTitle>
            {project ? <ProjectStatusBadge status={project.status} /> : null}
          </div>

          <FormField label="Project" hint="Metadata and settings come from the project you choose.">
            {(field) => (
              <Select
                {...field}
                value={activeId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {projects.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </CardHeader>

        {project ? (
          <CardContent className="space-y-5">
            <ManuscriptDropzone onFileAccepted={handleFile} selectedFile={project.source} />

            {metadataErrors.length > 0 ? (
              <Alert intent="warning">
                <AlertTitle>This book&rsquo;s metadata is incomplete</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 space-y-1">
                    {metadataErrors.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                  <Button variant="link" className="mt-2 h-auto p-0" asChild>
                    <Link href={`/projects/${project.id}` as Route}>
                      Fill it in
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Not ready to convert</p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {blockers.map((blocker) => (
                    <li key={blocker}>· {blocker}</li>
                  ))}
                </ul>
              </div>

              <Button variant="primary" disabled className="shrink-0">
                <Wand2 aria-hidden="true" />
                Convert to EPUB
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
