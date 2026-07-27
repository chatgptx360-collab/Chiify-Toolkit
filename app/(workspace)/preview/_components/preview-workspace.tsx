'use client'

import { BookOpen, ChevronLeft, ChevronRight, FolderOpen, Wand2 } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { EmptyState } from '@/components/common/empty-state'
import { ChapterList, ReaderControls, ReaderFrame } from '@/components/preview'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectPicker } from '@/components/projects/project-picker'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { usePreview, useProjects, useProjectsReady } from '@/hooks'

/**
 * The reading preview.
 *
 * WHY THE CONTROLS ARE BESIDE THE BOOK AND NOT BEHIND A MENU
 * ----------------------------------------------------------
 * The preview is only useful if the author changes the settings. Left at the
 * defaults it shows a book at a comfortable size on a comfortable screen, which
 * is the one case that was never in doubt. Putting text size, theme and screen
 * width permanently on view is an invitation to move them, and moving them is
 * the entire point.
 *
 * WHY NAVIGATION USES THE BOOK'S OWN CONTENTS
 * -------------------------------------------
 * The chapter list is built from the navigation document inside the EPUB, so
 * paging through the preview exercises the same structure a device will. A
 * chapter missing from the contents is missing here too — found by reading,
 * not only by a validation finding.
 */
export function PreviewWorkspace() {
  const projects = useProjects()
  const ready = useProjectsReady()

  const [selectedId, setSelectedId] = React.useState('')
  const activeId = selectedId || projects[0]?.id || ''
  const project = projects.find((candidate) => candidate.id === activeId)

  const preview = usePreview(project)

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
        description="The preview reads a generated book, and a book belongs to a project. Create one, convert your manuscript, and it opens here."
        action={<CreateProjectDialog />}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 pb-4">
          <CardTitle as="h3">Book to read</CardTitle>
          <ProjectPicker
            projects={projects}
            value={activeId}
            onChange={setSelectedId}
            hint="The preview renders the exact files inside the EPUB you would download."
          />
        </CardHeader>
      </Card>

      {!preview.canPreview ? (
        <EmptyState
          icon={BookOpen}
          size="lg"
          title="No book to preview"
          description="Convert this manuscript first. Once a book has been generated it opens here in a reader that uses the same XHTML and CSS the EPUB contains."
          action={
            <Button variant="outline" asChild>
              <Link href="/converter">
                <Wand2 aria-hidden="true" />
                Go to the converter
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr_17rem]">
          <Card className="order-2 h-fit p-4 lg:order-1">
            <p className="mb-3 px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Contents
            </p>
            <ChapterList
              chapters={preview.chapters}
              currentHref={preview.chapter?.href}
              onSelect={preview.goTo}
            />
          </Card>

          <div className="order-1 space-y-4 lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{preview.chapter?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.position.index + 1} of {preview.position.total} · {preview.device.name} ·{' '}
                  {preview.device.width}px
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={preview.previous}
                  disabled={preview.position.index === 0}
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={preview.next}
                  disabled={preview.position.index >= preview.position.total - 1}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <ReaderFrame
              document={preview.document}
              device={preview.device}
              title={preview.chapter?.title ?? 'Book'}
              className="rounded-xl border border-border bg-muted/30 p-4"
            />

            <p className="text-center text-xs text-subtle-foreground">
              Links between chapters are inert in the preview — a relative link inside a sandboxed
              frame would replace the page with a browser error. Footnote links within a chapter
              work.
            </p>
          </div>

          <Card className="order-3 h-fit p-5">
            <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Reader settings
            </p>
            <ReaderControls
              preferences={preview.preferences}
              device={preview.device}
              onPreferencesChange={preview.setPreferences}
              onDeviceChange={preview.setDevice}
            />
            <p className="mt-5 border-t border-border pt-4 text-xs text-subtle-foreground">
              These are settings a reader controls and you do not. A book that only works at the
              defaults is a book that fails for the people who most need it to work.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
