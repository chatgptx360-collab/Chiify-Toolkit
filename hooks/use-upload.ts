'use client'

import * as React from 'react'

import { isoNow, type ParsedDocument, type Project } from '@/lib/types'
import type { Result } from '@/lib/utils'

import { useDocumentActions } from './use-document'
import { useParser, type ParseState } from './use-parser'
import { useProjectActions } from './use-projects'

/**
 * Upload a manuscript to a project: read it, parse it, and record the result.
 *
 * WHY THIS COMPOSES RATHER THAN IMPLEMENTS
 * ----------------------------------------
 * Three things have to happen together and stay consistent: the file is parsed,
 * the document is stored, and the project's status and source are updated. Any
 * component doing that by hand would eventually do two of the three — a project
 * marked `ready` with no document behind it, say — so the sequence lives here
 * once.
 *
 * It does *not* apply the metadata found in the document. That is offered to
 * the author by `useMetadata`, because overwriting a title someone typed is not
 * a decision an upload should make.
 */
export interface UploadResult {
  readonly state: ParseState
  readonly upload: (file: File) => Promise<Result<ParsedDocument>>
  readonly cancel: () => void
  readonly reset: () => void
}

export function useUpload(project: Project | undefined): UploadResult {
  const { state, parse, cancel, reset } = useParser()
  const { update } = useProjectActions()
  const { store } = useDocumentActions()

  const upload = React.useCallback<UploadResult['upload']>(
    async (file) => {
      if (!project) {
        const error = {
          code: 'upload.no-project',
          message: 'Choose a project before uploading a manuscript.',
          severity: 'error' as const,
        }
        return { ok: false, error }
      }

      // Mark the project as importing first, so a slow parse is visible
      // everywhere the project appears rather than only on this screen.
      update(project.id, { status: 'importing' })

      const result = await parse(file, {
        chapterHeadingLevel: project.settings.chapterHeadingLevel,
      })

      if (!result.ok) {
        // Back to whatever it was: a failed import must not leave a project
        // stuck in a state that suggests work is still happening.
        update(project.id, { status: project.source ? 'ready' : 'draft' })
        return result
      }

      store(project.id, result.value)

      update(project.id, {
        status: 'ready',
        source: {
          fileName: file.name,
          mediaType: file.type,
          byteSize: file.size,
          uploadedAt: isoNow(),
        },
      })

      return result
    },
    [project, parse, store, update],
  )

  return { state, upload, cancel, reset }
}
