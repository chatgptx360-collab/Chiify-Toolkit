'use client'

import { AlertTriangle, CheckCircle2, Download, Loader2, Wand2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { UseEpubResult } from '@/hooks'
import type { GenerationStage } from '@/lib/epub'
import { formatFileSize } from '@/lib/utils'

/**
 * Generate, then download.
 *
 * The stage list is visible throughout rather than only while running: an
 * author who has not converted before can see what the tool is about to do,
 * and one watching a slow build can see which step is taking the time. A bare
 * spinner tells them neither.
 *
 * Presentation only — every value comes from `useEpub`.
 */
const STAGES: readonly { id: GenerationStage; label: string }[] = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'chapters', label: 'Creating chapters' },
  { id: 'stylesheet', label: 'Applying typography' },
  { id: 'navigation', label: 'Building contents' },
  { id: 'metadata', label: 'Writing metadata' },
  { id: 'packaging', label: 'Compressing' },
]

export interface GenerationPanelProps {
  epub: UseEpubResult
  /** Reasons the book is not ready, shown when generation is unavailable. */
  blockers?: readonly string[]
}

export function GenerationPanel({ epub, blockers = [] }: GenerationPanelProps) {
  const { state, generate, download, cancel, canGenerate } = epub
  const running = state.status === 'generating'
  const currentIndex = state.stage ? STAGES.findIndex((stage) => stage.id === state.stage) : -1

  return (
    <div className="space-y-4">
      {running ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              {state.label ?? 'Working…'}
            </p>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </div>

          <Progress
            value={Math.round(state.progress * 100)}
            label={`Building your EPUB: ${Math.round(state.progress * 100)}%`}
          />

          <ol className="grid gap-1.5 sm:grid-cols-3">
            {STAGES.map((stage, index) => (
              <li
                key={stage.id}
                className="flex items-center gap-2 text-xs"
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                <span
                  className={
                    index < currentIndex
                      ? 'size-1.5 rounded-full bg-success'
                      : index === currentIndex
                        ? 'size-1.5 animate-pulse rounded-full bg-primary'
                        : 'size-1.5 rounded-full bg-border-strong'
                  }
                  aria-hidden="true"
                />
                <span
                  className={index <= currentIndex ? 'text-foreground' : 'text-subtle-foreground'}
                >
                  {stage.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {state.status === 'error' && state.error ? (
        <Alert intent={state.error.severity === 'info' ? 'info' : 'danger'}>
          <AlertTitle>{state.error.message}</AlertTitle>
          {state.error.hint ? <AlertDescription>{state.error.hint}</AlertDescription> : null}
        </Alert>
      ) : null}

      {state.status === 'ready' && state.outcome ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-subtle p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Your EPUB is ready</p>
              <p className="text-xs text-muted-foreground">
                {state.outcome.artifact.fileName} ·{' '}
                {formatFileSize(state.outcome.artifact.byteSize)} ·{' '}
                {state.outcome.epub.spine.filter((item) => item.chapterId).length} chapters
              </p>
            </div>

            <Button variant="primary" onClick={download} className="shrink-0">
              <Download aria-hidden="true" />
              Download
            </Button>
          </div>

          {state.outcome.notices.length > 0 ? (
            <div className="space-y-2">
              {state.outcome.notices.map((notice) => (
                <Alert
                  key={notice.code}
                  intent={notice.severity === 'warning' ? 'warning' : 'info'}
                  {...(notice.severity === 'warning' ? { icon: AlertTriangle } : {})}
                >
                  <AlertTitle>{notice.message}</AlertTitle>
                  {notice.hint ? <AlertDescription>{notice.hint}</AlertDescription> : null}
                </Alert>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-subtle-foreground">
            Validation and an in-app reader arrive in Phase 5. Until then, this file opens in Apple
            Books, Calibre, Kobo and any other EPUB 3 reader.
          </p>
        </div>
      ) : null}

      {!running && state.status !== 'ready' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {blockers.length > 0 ? (
              <>
                <p className="text-sm font-medium">Not ready to convert</p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {blockers.map((blocker) => (
                    <li key={blocker}>· {blocker}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Ready to convert</p>
                <Badge intent="success" size="sm" withDot>
                  EPUB 3
                </Badge>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            onClick={generate}
            disabled={!canGenerate || blockers.length > 0}
            className="shrink-0"
          >
            <Wand2 aria-hidden="true" />
            Generate EPUB
          </Button>
        </div>
      ) : null}
    </div>
  )
}
