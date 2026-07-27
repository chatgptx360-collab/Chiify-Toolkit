import { Check, Circle, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Roadmap card — a delivery phase and what it contains.
 *
 * Renders the project's own plan inside the product. That is useful now (the
 * dashboard has something real to show instead of fake statistics) and it is
 * the component Phase 2 reuses for per-project progress, since "a titled list
 * of steps with completion states" is the same widget either way.
 */
export type PhaseState = 'complete' | 'active' | 'upcoming'

const stateIcon: Record<PhaseState, typeof Check> = {
  complete: Check,
  active: Loader2,
  upcoming: Circle,
}

export interface RoadmapCardProps extends React.ComponentPropsWithoutRef<'div'> {
  phase: string
  title: string
  description: string
  state: PhaseState
  items: readonly string[]
}

export function RoadmapCard({
  phase,
  title,
  description,
  state,
  items,
  className,
  ...props
}: RoadmapCardProps) {
  const Icon = stateIcon[state]

  return (
    <Card
      className={cn('h-full', state === 'active' && 'border-primary/40 shadow-md', className)}
      {...props}
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <Badge
            intent={state === 'complete' ? 'success' : state === 'active' ? 'primary' : 'neutral'}
            tone={state === 'upcoming' ? 'outline' : 'subtle'}
            size="sm"
          >
            {phase}
          </Badge>

          <Icon
            className={cn(
              'size-4',
              state === 'complete' && 'text-success',
              state === 'active' && 'animate-spin text-primary',
              state === 'upcoming' && 'text-subtle-foreground',
            )}
            aria-hidden="true"
          />
          <span className="sr-only">
            {state === 'complete' ? 'Complete' : state === 'active' ? 'In progress' : 'Upcoming'}
          </span>
        </div>

        <div className="space-y-1.5">
          <CardTitle as="h3">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span
                className={cn(
                  'mt-1.75 size-1.5 shrink-0 rounded-full',
                  state === 'complete' ? 'bg-success' : 'bg-border-strong',
                )}
                aria-hidden="true"
              />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
