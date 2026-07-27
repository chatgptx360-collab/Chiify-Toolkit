'use client'

import { FileText, Loader2, RotateCcw } from 'lucide-react'

import { ManuscriptDropzone } from '@/components/upload/manuscript-dropzone'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { useDocument, useUpload } from '@/hooks'
import type { Project } from '@/lib/types'
import { formatWordCount } from '@/lib/utils'

/**
 * Attach a manuscript and parse it.
 *
 * WHAT CHANGED IN PHASE 3
 * -----------------------
 * Phase 2 recorded a file's name and size. This now runs the real pipeline:
 * the file is validated, converted, structured and measured, and the resulting
 * document model is what every later phase consumes.
 *
 * The stage labels are honest about where the time goes. "Reading" covers
 * pulling bytes off disk, which for a large illustrated manuscript is a real
 * fraction of the wait; "Analysing" is the parse itself. A single
 * indeterminate spinner would hide a genuinely slow step behind a shrug.
 */
export interface ProjectSourceProps {
  project: Project
}

const STAGE_LABEL = {
  idle: '',
  reading: 'Reading the file…',
  parsing: 'Analysing your manuscript…',
  done: 'Finished',
  error: 'Could not read the manuscript',
} as const

export function ProjectSource({ project }: ProjectSourceProps) {
  const { state, upload, cancel } = useUpload(project)
  const document = useDocument(project.id)
  const { toast } = useToast()

  const busy = state.stage === 'reading' || state.stage === 'parsing'

  async function handleFile(file: File) {
    const result = await upload(file)

    if (!result.ok) {
      // `info` severity means the user cancelled; that needs no alarm.
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
      description: `${result.value.chapters.length} ${result.value.chapters.length === 1 ? 'chapter' : 'chapters'} and ${formatWordCount(result.value.stats.wordCount)} found.`,
      intent: 'success',
    })
  }

  return (
    <div className="space-y-4">
      <ManuscriptDropzone
        onFileAccepted={handleFile}
        disabled={busy}
        selectedFile={
          project.source
            ? { fileName: project.source.fileName, byteSize: project.source.byteSize }
            : undefined
        }
      />

      {busy ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              {STAGE_LABEL[state.stage]}
            </p>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </div>
          <Progress value={Math.round(state.progress * 100)} label="Reading your manuscript" />
        </div>
      ) : null}

      {state.stage === 'error' && state.error ? (
        <Alert intent="danger">
          <AlertTitle>{state.error.message}</AlertTitle>
          {state.error.hint ? <AlertDescription>{state.error.hint}</AlertDescription> : null}
        </Alert>
      ) : null}

      {document && !busy ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/60 p-3">
          <FileText className="size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{document.chapters.length} chapters</span>
            <span className="text-muted-foreground">
              {' '}
              · {formatWordCount(document.stats.wordCount)} · {document.stats.imageCount} images
            </span>
          </p>
        </div>
      ) : null}

      {project.source && !document && !busy ? (
        <Alert intent="info" icon={RotateCcw}>
          <AlertTitle>Upload this manuscript again to work with it</AlertTitle>
          <AlertDescription>
            Chiify keeps your project details on this device, but the manuscript itself is read
            fresh each session rather than stored — it is usually tens of megabytes once images are
            included. Drop “{project.source.fileName}” above to continue.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
