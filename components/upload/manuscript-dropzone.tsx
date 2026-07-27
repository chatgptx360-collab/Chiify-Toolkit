'use client'

import { FileUp, Upload, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { fileInputAccept, identifyFormat, supportedExtensionList } from '@/lib/parser'
import { appError, cn, formatFileSize, type AppError } from '@/lib/utils'

/**
 * Manuscript dropzone.
 *
 * ACCESSIBILITY IS THE WHOLE DESIGN HERE
 * --------------------------------------
 * Drag-and-drop is unusable by keyboard and by most assistive technology. So
 * the *real* control is a native `<input type="file">`, visually hidden but
 * fully focusable, with a `<label>` that covers the drop area. Keyboard users
 * tab to it and press Enter; pointer users can drag onto it or click anywhere
 * in the panel. Drag-and-drop is a pointer-only enhancement layered on top,
 * never the only route.
 *
 * The result is announced through a live region, because a file appearing
 * visually tells a screen-reader user nothing.
 *
 * VALIDATION HAPPENS BEFORE ANY READING
 * -------------------------------------
 * The format and size are checked from the file's name and metadata, so an
 * unsupported 400 MB file is rejected instantly instead of after a long read.
 * The rejection message names what *is* accepted — "unsupported file" without
 * telling the author what to do is the least helpful error a product can show.
 */

/**
 * 64 MB. Comfortably above any realistic manuscript (a 200,000-word novel with
 * images is a few megabytes) and below the point where reading the file in the
 * browser becomes a memory problem on modest hardware.
 */
const MAX_BYTES = 64 * 1024 * 1024

export interface ManuscriptDropzoneProps {
  /** Called with a validated file. */
  onFileAccepted: (file: File) => void
  /** The file currently attached, if any. */
  selectedFile?: { fileName: string; byteSize: number } | undefined
  onClear?: () => void
  disabled?: boolean
}

export function ManuscriptDropzone({
  onFileAccepted,
  selectedFile,
  onClear,
  disabled = false,
}: ManuscriptDropzoneProps) {
  const inputId = React.useId()
  const [isDragging, setDragging] = React.useState(false)
  const [rejection, setRejection] = React.useState<AppError | undefined>(undefined)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const validate = React.useCallback((file: File): AppError | undefined => {
    const format = identifyFormat(file.name, file.type)

    if (!format) {
      return appError('upload.unsupported-format', `Chiify cannot read “${file.name}”.`, {
        hint: `Upload a ${supportedExtensionList.join(' or ')} file. In Word, use File → Save As and choose Word Document.`,
      })
    }

    if (format.status !== 'supported') {
      return appError('upload.format-not-yet-supported', `${format.label} is not supported yet.`, {
        hint: format.note ?? `For now, upload a ${supportedExtensionList.join(' or ')} file.`,
      })
    }

    if (file.size === 0) {
      return appError('upload.empty-file', `“${file.name}” is empty.`, {
        hint: 'Check the file opens in Word before uploading it.',
      })
    }

    if (file.size > MAX_BYTES) {
      return appError(
        'upload.file-too-large',
        `“${file.name}” is ${formatFileSize(file.size)}, which is over the ${formatFileSize(MAX_BYTES)} limit.`,
        {
          hint: 'Very large files usually contain uncompressed images. Compress them and try again.',
        },
      )
    }

    return undefined
  }, [])

  const accept = React.useCallback(
    (file: File | undefined) => {
      if (!file) return

      const problem = validate(file)
      if (problem) {
        setRejection(problem)
        return
      }

      setRejection(undefined)
      onFileAccepted(file)
    },
    [validate, onFileAccepted],
  )

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    accept(event.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        className={cn(
          'relative rounded-xl border border-dashed p-8 text-center',
          'transition-[border-color,background-color] motion-normal',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
          isDragging ? 'border-primary bg-primary-subtle' : 'border-border',
          disabled ? 'opacity-60' : 'hover:border-border-strong',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={fileInputAccept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0])
            // Reset so re-selecting the same file after a rejection still fires
            // a change event.
            event.target.value = ''
          }}
        />

        <label
          htmlFor={inputId}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-4',
            // Stretches the label's hit area over the whole panel so a click
            // anywhere opens the picker, without a second interactive element.
            'before:absolute before:inset-0 before:rounded-xl before:content-[""]',
            disabled && 'cursor-not-allowed',
          )}
        >
          <span
            className="flex size-12 items-center justify-center rounded-xl bg-primary-subtle text-primary ring-1 ring-primary/20"
            aria-hidden="true"
          >
            <FileUp className="size-6" />
          </span>

          <span className="space-y-1.5">
            <span className="block text-base font-semibold tracking-tight">
              Drop your manuscript here
            </span>
            <span className="block text-sm text-muted-foreground">
              or{' '}
              <span className="text-primary underline underline-offset-4">browse your files</span>
            </span>
          </span>
        </label>

        <p className="mt-4 text-xs text-subtle-foreground">
          {supportedExtensionList.join(', ')} · up to {formatFileSize(MAX_BYTES, 0)}
        </p>
      </div>

      {/*
        One live region for both outcomes. It stays mounted so a screen reader
        announces changes to it — a region that appears at the same moment its
        content does is frequently missed.
      */}
      <div role="status" aria-live="polite" className="space-y-3">
        {rejection ? (
          <Alert intent="danger">
            <AlertTitle>{rejection.message}</AlertTitle>
            {rejection.hint ? <AlertDescription>{rejection.hint}</AlertDescription> : null}
          </Alert>
        ) : null}

        {selectedFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 p-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-subtle text-success"
              aria-hidden="true"
            >
              <Upload className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selectedFile.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.byteSize)} · attached
              </p>
            </div>

            {onClear ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClear}
                aria-label={`Remove ${selectedFile.fileName}`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
