'use client'

import { Code2, FileDown, FileText, FolderOpen, RefreshCw, Wand2 } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { EmptyState } from '@/components/common/empty-state'
import { Section } from '@/components/common/section'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectPicker } from '@/components/projects/project-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  CompatibilityMatrix,
  FindingList,
  FixDialog,
  QualityScoreCard,
} from '@/components/validation'
import {
  useDiagnostics,
  useProjects,
  useProjectsReady,
  useQuality,
  useReport,
  useValidation,
} from '@/hooks'
import type { FixProposal } from '@/lib/validation'

/**
 * The validation workspace.
 *
 * WHAT THE SCREEN IS ARRANGED AROUND
 * ----------------------------------
 * One question, asked in the order an author asks it: can I publish this
 * (the score and the verdict), what is wrong (the findings), where will it
 * work (the compatibility matrix), and can I take this away (the export).
 *
 * The screen holds no domain logic. Every number comes from a hook, the fix
 * dialog raises a callback, and applying a change is one call to
 * `useDiagnostics`. That is what lets the same report appear on the dashboard
 * later without any of this being reimplemented.
 */
export function ValidationWorkspace() {
  const projects = useProjects()
  const ready = useProjectsReady()
  const { toast } = useToast()

  const [selectedId, setSelectedId] = React.useState('')
  const activeId = selectedId || projects[0]?.id || ''
  const project = projects.find((candidate) => candidate.id === activeId)

  const { revalidate, canValidate } = useValidation(project)
  const quality = useQuality(project)
  const diagnostics = useDiagnostics(project)
  const report = useReport(project)

  const [pending, setPending] = React.useState<FixProposal | undefined>(undefined)

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
        description="Validation runs against a generated book, and a book belongs to a project. Create one, convert your manuscript, and the report appears here."
        action={<CreateProjectDialog />}
      />
    )
  }

  function handleConfirm(proposal: FixProposal) {
    const applied = diagnostics.apply(proposal)
    setPending(undefined)

    if (!applied) {
      toast({
        title: 'That change could not be saved',
        description: 'The project may have been deleted in another tab.',
        intent: 'danger',
      })
      return
    }

    toast({
      title: `${proposal.field} updated`,
      description: 'Convert the book again to produce a file that includes it.',
      intent: 'success',
    })
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="gap-4 pb-4">
          <CardTitle as="h3">Book to check</CardTitle>
          <ProjectPicker
            projects={projects}
            value={activeId}
            onChange={setSelectedId}
            hint="Checks run against the book Chiify generated, not against the manuscript."
          />
        </CardHeader>
      </Card>

      {!canValidate || !quality ? (
        <EmptyState
          icon={FileText}
          size="lg"
          title="Nothing has been generated yet"
          description="Convert this manuscript to produce a book. Its full report — every finding, grouped by area, with a concrete fix for each — appears here the moment it is built."
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
        <>
          <Section
            title="Result"
            description={`Checked ${new Date(quality.checkedAt).toLocaleString()}.`}
            actions={
              <Button variant="ghost" size="sm" onClick={revalidate}>
                <RefreshCw aria-hidden="true" />
                Run again
              </Button>
            }
          >
            <QualityScoreCard quality={quality} />
          </Section>

          <Section
            title="Findings"
            description={
              diagnostics.proposals.length > 0
                ? `${diagnostics.proposals.length} of these can be fixed automatically — you will see the change before it is applied.`
                : 'Every finding says what it costs and how to resolve it.'
            }
            actions={
              diagnostics.proposals.length > 1 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const count = diagnostics.applyAll()
                    toast({
                      title: `${count} ${count === 1 ? 'change' : 'changes'} applied`,
                      description: 'Convert the book again to include them.',
                      intent: count > 0 ? 'success' : 'danger',
                    })
                  }}
                >
                  <Wand2 aria-hidden="true" />
                  Apply all {diagnostics.proposals.length}
                </Button>
              ) : null
            }
          >
            {diagnostics.groups.length === 0 ? (
              <Card className="p-6">
                <p className="text-sm">Nothing to report. Every check passed on this book.</p>
              </Card>
            ) : (
              <FindingList
                groups={diagnostics.groups}
                proposalFor={diagnostics.proposalFor}
                onFix={setPending}
              />
            )}
          </Section>

          <Section
            title="Devices and stores"
            description={`${quality.compatibility.supported} of ${quality.compatibility.total} accept this book as it stands.`}
          >
            <CompatibilityMatrix compatibility={quality.compatibility} />
          </Section>

          <Section
            title="Export"
            description="Take the report with you. Every format states that this is Chiify's own check rather than official certification."
          >
            <Card>
              <CardContent className="flex flex-wrap gap-2 pt-6">
                <Button variant="secondary" onClick={() => report.download('html')}>
                  <FileText aria-hidden="true" />
                  Download as a page
                </Button>
                <Button variant="secondary" onClick={() => report.download('json')}>
                  <Code2 aria-hidden="true" />
                  Download as JSON
                </Button>
                <Button variant="secondary" onClick={() => report.download('text')}>
                  <FileDown aria-hidden="true" />
                  Download as text
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const copied = await report.copy('text')
                    toast({
                      title: copied ? 'Report copied' : 'Could not reach the clipboard',
                      ...(copied
                        ? {}
                        : { description: 'Your browser blocked it. Download the file instead.' }),
                      intent: copied ? 'success' : 'warning',
                    })
                  }}
                >
                  Copy to clipboard
                </Button>
              </CardContent>
            </Card>

            <p className="text-xs text-subtle-foreground">
              The page export opens in any browser and prints to PDF — that is how to send it to an
              editor or attach it to a submission.
            </p>
          </Section>
        </>
      )}

      <FixDialog
        proposal={pending}
        onOpenChange={(open) => {
          if (!open) setPending(undefined)
        }}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
