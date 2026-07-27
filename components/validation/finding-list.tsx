'use client'

import { AlertTriangle, ChevronDown, Info, Wand2, XCircle } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DiagnosticGroup } from '@/hooks'
import { IMPACT_LABEL, type FixProposal, type ValidationFinding } from '@/lib/validation'
import type { Severity } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * The findings list.
 *
 * WHY IT IS GROUPED AND COLLAPSED
 * -------------------------------
 * A flat list of sixty findings is a wall an author bounces off. Grouped by
 * area, the first thing they see is "metadata: 3 errors" — which is a decision
 * they can act on — and the group carrying errors is the one that opens by
 * default.
 *
 * WHY EVERY FINDING SHOWS ITS REMEDY
 * ----------------------------------
 * "structure.nav-broken-link" is a fact. "Tapping this in a reader does
 * nothing" is what makes an author fix it. The rule id is never shown; the
 * consequence always is.
 *
 * WHY A FIX IS AN OFFER
 * ---------------------
 * Where an automatic fix exists it appears as a button beside the finding, and
 * pressing it opens the before-and-after rather than applying anything. The
 * component cannot change the book — it takes a callback and calls it.
 */

const SEVERITY_ICON = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const

const SEVERITY_TONE: Readonly<Record<Severity, string>> = {
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

const SEVERITY_INTENT: Readonly<Record<Severity, 'danger' | 'warning' | 'info'>> = {
  error: 'danger',
  warning: 'warning',
  info: 'info',
}

export interface FindingListProps {
  groups: readonly DiagnosticGroup[]
  proposalFor: (finding: ValidationFinding) => FixProposal | undefined
  onFix: (proposal: FixProposal) => void
}

export function FindingList({ groups, proposalFor, onFix }: FindingListProps) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <FindingGroup
          key={group.category}
          group={group}
          proposalFor={proposalFor}
          onFix={onFix}
          // Open where something is wrong; collapsed where it is only notes.
          defaultOpen={group.errors > 0 || group.warnings > 0}
        />
      ))}
    </div>
  )
}

interface FindingGroupProps extends Omit<FindingListProps, 'groups'> {
  group: DiagnosticGroup
  defaultOpen: boolean
}

function FindingGroup({ group, proposalFor, onFix, defaultOpen }: FindingGroupProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const contentId = React.useId()

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-ring hover:bg-muted/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{group.label}</span>

          {group.errors > 0 ? (
            <Badge intent="danger" size="sm">
              {group.errors} {group.errors === 1 ? 'error' : 'errors'}
            </Badge>
          ) : null}

          {group.warnings > 0 ? (
            <Badge intent="warning" size="sm">
              {group.warnings} {group.warnings === 1 ? 'warning' : 'warnings'}
            </Badge>
          ) : null}

          {group.errors === 0 && group.warnings === 0 ? (
            <Badge intent="neutral" size="sm">
              {group.findings.length} {group.findings.length === 1 ? 'note' : 'notes'}
            </Badge>
          ) : null}
        </span>

        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground motion-fast', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul id={contentId} className="divide-y divide-border border-t border-border">
          {group.findings.map((item) => (
            <FindingRow key={item.id} finding={item} proposal={proposalFor(item)} onFix={onFix} />
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

function FindingRow({
  finding,
  proposal,
  onFix,
}: {
  finding: ValidationFinding
  proposal: FixProposal | undefined
  onFix: (proposal: FixProposal) => void
}) {
  const Icon = SEVERITY_ICON[finding.severity]

  return (
    <li className="flex gap-3 p-4">
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', SEVERITY_TONE[finding.severity])}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-medium">{finding.message}</p>

          {proposal ? (
            <Button variant="secondary" size="sm" onClick={() => onFix(proposal)}>
              <Wand2 aria-hidden="true" />
              Fix this
            </Button>
          ) : null}
        </div>

        {finding.remedy ? <p className="text-sm text-muted-foreground">{finding.remedy}</p> : null}

        <p className="flex flex-wrap items-center gap-2 text-xs text-subtle-foreground">
          <Badge intent={SEVERITY_INTENT[finding.severity]} size="sm" tone="outline">
            {IMPACT_LABEL[finding.impact]}
          </Badge>
          {finding.location ? <span className="font-mono">{finding.location}</span> : null}
        </p>
      </div>
    </li>
  )
}
