'use client'

import { ManuscriptDropzone } from '@/components/upload/manuscript-dropzone'
import { useToast } from '@/components/ui/toast'
import { useProjectActions } from '@/hooks'
import { isoNow, type Project } from '@/lib/types'

/**
 * Attach or replace a project's manuscript.
 *
 * WHAT PHASE 2 STORES, AND WHAT IT DOES NOT
 * -----------------------------------------
 * Only the file's *description* is recorded — name, media type, size, when it
 * was attached. The bytes are not persisted, because there is nothing to do
 * with them until the DOCX parser exists in Phase 3, and storing tens of
 * megabytes per project in browser storage before anything reads it would be
 * a liability rather than a feature.
 *
 * The consequence is visible and stated in the UI: the manuscript must be
 * re-attached in the session that converts it. Phase 3 adds a blob store
 * alongside this, and `SourceFile` already carries everything needed to
 * reference it.
 *
 * Status moves to `ready` on attach, which is what the dashboard and the
 * converter both key off.
 */
export interface ProjectSourceProps {
  project: Project
}

export function ProjectSource({ project }: ProjectSourceProps) {
  const { update } = useProjectActions()
  const { toast } = useToast()

  function handleFile(file: File) {
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
      description: `“${file.name}” is ready to convert.`,
      intent: 'success',
    })
  }

  return (
    <div className="space-y-3">
      <ManuscriptDropzone
        onFileAccepted={handleFile}
        selectedFile={
          project.source
            ? { fileName: project.source.fileName, byteSize: project.source.byteSize }
            : undefined
        }
      />

      {project.source ? (
        <p className="text-xs text-subtle-foreground">
          Only the file&rsquo;s details are stored on this device. Re-attach the manuscript in the
          session you convert it — reading and storing document contents arrives with the parsing
          engine in Phase 3.
        </p>
      ) : null}
    </div>
  )
}
