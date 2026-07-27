'use client'

import { Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useProjectActions } from '@/hooks'
import type { Project } from '@/lib/types'

/**
 * Delete confirmation.
 *
 * Deletion is irreversible and local — there is no server-side copy to restore
 * from — so it gets an explicit confirmation naming the project. The dialog
 * states exactly what is lost rather than asking "are you sure?", which is a
 * question nobody reads.
 *
 * The confirm button is `danger` and is *not* the default focus: Radix focuses
 * the first tabbable element, which is Cancel, so pressing Enter out of habit
 * cancels rather than destroys.
 */
export interface DeleteProjectDialogProps {
  project: Project
  /** Rendered as the trigger. Defaults to an icon button. */
  trigger?: React.ReactNode
  /** Called after a successful delete, e.g. to navigate away. */
  onDeleted?: () => void
}

export function DeleteProjectDialog({ project, trigger, onDeleted }: DeleteProjectDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { remove } = useProjectActions()
  const { toast } = useToast()

  function handleDelete() {
    const result = remove(project.id)

    if (!result.ok) {
      toast({
        title: 'Could not delete the project',
        description: result.error.message,
        intent: 'danger',
      })
      return
    }

    setOpen(false)
    toast({
      title: 'Project deleted',
      description: `“${project.name}” and its files have been removed.`,
      intent: 'neutral',
    })
    onDeleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        `DialogTrigger` rather than an onClick handler: it supplies
        aria-haspopup/aria-expanded and, crucially, returns focus to this button
        when the dialog closes. A hand-rolled trigger drops focus to the top of
        the document, which strands keyboard users.
      */}
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${project.name}`}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{project.name}”?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-4">
          <p className="text-muted-foreground">
            The project, its metadata, its settings and any uploaded manuscript will be removed from
            this device. Files you have already downloaded are unaffected.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 aria-hidden="true" />
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
