'use client'

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { CompatibilityAssessment, CompatibilityTarget } from '@/lib/validation'
import { cn } from '@/lib/utils'

/**
 * Where this book will and will not work.
 *
 * WHY A LIST OF PLACES RATHER THAN A LIST OF RULES
 * ------------------------------------------------
 * An author does not think "my book violates the cover-image requirement". They
 * think "can I put this on Amazon". The matrix answers the question they
 * actually have, and the reason sits underneath it.
 *
 * Status is carried by an icon and a word, never by colour alone — the same
 * rule the alert and badge primitives follow, for the same reason.
 */

const STATUS = {
  supported: { icon: CheckCircle2, label: 'Accepted', tone: 'text-success' },
  degraded: { icon: AlertTriangle, label: 'Works, with caveats', tone: 'text-warning' },
  rejected: { icon: XCircle, label: 'Will be refused', tone: 'text-danger' },
} as const

export interface CompatibilityMatrixProps {
  compatibility: CompatibilityAssessment
}

export function CompatibilityMatrix({ compatibility }: CompatibilityMatrixProps) {
  if (compatibility.targets.length === 0) return null

  return (
    <Card className="divide-y divide-border">
      {compatibility.targets.map((target) => (
        <TargetRow key={target.id} target={target} />
      ))}
    </Card>
  )
}

function TargetRow({ target }: { target: CompatibilityTarget }) {
  const status = STATUS[target.status]
  const Icon = status.icon

  return (
    <div className="flex gap-3 p-4">
      <Icon className={cn('mt-0.5 size-4 shrink-0', status.tone)} aria-hidden="true" />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{target.name}</p>
          <p className={cn('text-xs font-medium', status.tone)}>{status.label}</p>
        </div>

        <p className="text-xs text-subtle-foreground">{target.vendor}</p>

        {target.notes.length > 0 ? (
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {target.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
