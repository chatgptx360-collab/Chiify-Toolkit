'use client'

import { Trash2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'

/**
 * Live design-system reference.
 *
 * Every primitive is rendered from the same components the product uses, so
 * this cannot drift from reality the way a screenshot or a written spec would.
 * It gives Phase 2 onwards one place to check how a variant actually looks in
 * both themes, and it doubles as a smoke test that the interactive primitives —
 * dialog focus trapping, toast queueing — still work.
 */
export function DesignSystemPreview() {
  const { toast } = useToast()

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-medium tracking-wider text-subtle-foreground uppercase">
          Buttons
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">
            <Trash2 aria-hidden="true" />
            Danger
          </Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="secondary" loading>
            Working
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium tracking-wider text-subtle-foreground uppercase">
          Badges
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge intent="neutral">Neutral</Badge>
          <Badge intent="primary" withDot>
            Primary
          </Badge>
          <Badge intent="success" withDot>
            Converted
          </Badge>
          <Badge intent="warning" withDot>
            2 warnings
          </Badge>
          <Badge intent="danger" withDot>
            Failed
          </Badge>
          <Badge intent="info" tone="outline">
            Outline
          </Badge>
          <Badge intent="primary" tone="solid">
            Solid
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium tracking-wider text-subtle-foreground uppercase">
          Feedback
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <Alert intent="success">
            <AlertTitle>Book generated</AlertTitle>
            <AlertDescription>Your EPUB passed every specification check.</AlertDescription>
          </Alert>
          <Alert intent="warning">
            <AlertTitle>3 images without alt text</AlertTitle>
            <AlertDescription>
              Readers using assistive technology will not know what these images show.
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-2 pt-1">
          <Progress value={64} label="Example determinate progress" />
          <Progress
            value={null}
            intent="primary"
            size="sm"
            label="Example indeterminate progress"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium tracking-wider text-subtle-foreground uppercase">
          Overlays
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this project?</DialogTitle>
                <DialogDescription>
                  This removes the manuscript, its metadata and every generated file.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <p className="text-muted-foreground">
                  Focus is trapped inside this dialog, Escape closes it, and focus returns to the
                  button that opened it.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger">Delete project</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Conversion complete',
                description: 'Your book is ready to preview and download.',
                intent: 'success',
                action: { label: 'Preview', onClick: () => undefined },
              })
            }
          >
            Show toast
          </Button>

          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Could not read the manuscript',
                description: 'The file appears to be password protected.',
                intent: 'danger',
              })
            }
          >
            Show error toast
          </Button>
        </div>
      </div>
    </div>
  )
}
