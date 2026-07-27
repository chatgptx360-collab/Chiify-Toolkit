'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import * as React from 'react'

import { FormField } from '@/components/forms/form-field'
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
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useProjectActions } from '@/hooks'

/**
 * Create-project dialog.
 *
 * Deliberately asks for **one** field. Every other piece of metadata can be
 * filled in later and most of it is unknowable at this moment; a six-field
 * creation form is the fastest way to make starting a book feel like paperwork.
 * The name doubles as the initial book title, which the store handles.
 *
 * Validation is submit-time rather than on every keystroke: telling someone
 * their empty field is invalid before they have typed anything is noise, not
 * help.
 */
export function CreateProjectDialog() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | undefined>(undefined)
  const { create } = useProjectActions()
  const { toast } = useToast()
  const router = useRouter()

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setName('')
      setError(undefined)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = create({ name })
    if (!result.ok) {
      setError(result.error.message)
      return
    }

    handleOpenChange(false)
    toast({
      title: 'Project created',
      description: `“${result.value.name}” is ready for a manuscript.`,
      intent: 'success',
    })
    // Land the author on the project they just made, which is where every
    // next action lives.
    router.push(`/projects/${result.value.id}` as Route)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* `DialogTrigger` is what returns focus to this button on close. */}
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus aria-hidden="true" />
          New project
        </Button>
      </DialogTrigger>

      <DialogContent>
        {/* See MetadataForm for why `noValidate` — our messages, not the browser's. */}
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              One project holds one book — its manuscript, metadata and every file generated from
              it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="pb-4">
            <FormField
              label="Project name"
              required
              hint="Usually the working title. You can change it at any time."
              {...(error ? { error } : {})}
            >
              {(field) => (
                <Input
                  {...field}
                  // The dialog mounts on open, so autofocus lands correctly and
                  // does not fight Radix's initial focus.
                  autoFocus
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (error) setError(undefined)
                  }}
                  placeholder="The Long Winter"
                  invalid={Boolean(error)}
                />
              )}
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
