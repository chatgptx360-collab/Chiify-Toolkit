'use client'

import { ArrowRight, FolderOpen, Loader2, Wand2 } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAnalysis, useProjects, useProjectsReady, useUpload } from '@/hooks'
import { blockingIssues, validateBookMetadata } from '@/lib/projects'
import { formatWordCount } from '@/lib/utils'

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
  const { toast } = useToast()
  const [selectedId, setSelectedId] = React.useState<string>('')

  // Default to the most recently updated project, which is almost always the
  // one the author just came from.
  const activeId = selectedId || projects[0]?.id || ''
  const project = projects.find((candidate) => candidate.id === activeId)

  const { state, upload, cancel } = useUpload(project)
  const analysis = useAnalysis(project?.id)
  const busy = state.stage === 'reading' || state.stage === 'parsing'

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

  async function handleFile(file: File) {
    const result = await upload(file)

    if (!result.ok) {
      if (result.error.severity !== 'info') {
        toast({
          title: result.error.message,
          ...(result.error.hint ? { description: result.error.hint } : {}),
          intent: 'danger',
          duration: 8000,
        })
      }
      return
    }

    toast({
      title: 'Manuscript ready',
      description: `${result.value.chapters.length} chapters and ${formatWordCount(result.value.stats.wordCount)} found.`,
      intent: 'success',
    })
  }

  const blockers = [
    analysis ? null : 'Upload a manuscript so Chiify can read it.',
    metadataErrors.length > 0
      ? `Complete the book metadata (${metadataErrors.length} ${metadataErrors.length === 1 ? 'field needs' : 'fields need'} attention).`
      : null,
    'EPUB generation arrives in Phase 4.',
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
            <ManuscriptDropzone
              onFileAccepted={handleFile}
              disabled={busy}
              selectedFile={project.source}
            />

            {busy ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                    {state.stage === 'reading' ? 'Reading the file…' : 'Analysing your manuscript…'}
                  </p>
                  <Button variant="ghost" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
                <Progress
                  value={Math.round(state.progress * 100)}
                  label="Reading your manuscript"
                />
              </div>
            ) : null}

            {analysis && !busy ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {analysis.headline.slice(0, 3).map((metric) => (
                  <div key={metric.id} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">{metric.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

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
