'use client'

import { ArrowRight, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FixProposal } from '@/lib/validation'

/**
 * Confirm a fix before it is applied.
 *
 * THE POINT OF THIS COMPONENT
 * ---------------------------
 * It is the visible half of a rule the domain layer enforces: nothing is
 * changed without the author seeing exactly what changes. The before and after
 * are shown side by side, labelled with the field, in the author's own words —
 * not a diff, not a rule id, not "1 issue resolved".
 *
 * It is a dialog rather than an inline confirmation because the change is to
 * data the author typed. A misclick that silently rewrites a title is the
 * failure this whole flow exists to make impossible.
 */

export interface FixDialogProps {
  proposal: FixProposal | undefined
  onOpenChange: (open: boolean) => void
  onConfirm: (proposal: FixProposal) => void
}

export function FixDialog({ proposal, onOpenChange, onConfirm }: FixDialogProps) {
  return (
    <Dialog open={Boolean(proposal)} onOpenChange={onOpenChange}>
      <DialogContent>
        {proposal ? (
          <>
            <DialogHeader>
              <DialogTitle>{proposal.title}</DialogTitle>
              <DialogDescription>{proposal.description}</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {proposal.field}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground line-through">
                    {proposal.before}
                  </span>
                  <ArrowRight className="size-4 text-subtle-foreground" aria-hidden="true" />
                  <span className="rounded-md bg-success-subtle px-2 py-1 font-medium text-success">
                    {proposal.after}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-xs text-subtle-foreground">
                This changes your project, not the book you already generated. Convert again to
                produce a file that includes it.
              </p>
            </DialogBody>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => onConfirm(proposal)}>
                <Wand2 aria-hidden="true" />
                Apply this change
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
