'use client'

import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import type { MetadataSuggestion } from '@/hooks'
import { truncate } from '@/lib/utils'

/**
 * Metadata found inside the document, offered as prefills.
 *
 * Each suggestion is applied by an explicit click. Word's document properties
 * are frequently wrong — the author is often the machine's account name — so
 * the author confirms rather than discovers later that their book is credited
 * to "Windows User".
 *
 * Renders nothing when there is nothing to suggest, so it can be dropped into a
 * page unconditionally without adding an empty card.
 */
export interface MetadataSuggestionsProps {
  suggestions: readonly MetadataSuggestion[]
  onApply: (suggestion: MetadataSuggestion) => void
  onApplyAll: () => void
}

export function MetadataSuggestions({
  suggestions,
  onApply,
  onApplyAll,
}: MetadataSuggestionsProps) {
  const { toast } = useToast()

  if (suggestions.length === 0) return null

  return (
    <Card className="border-primary/30">
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle as="h3" className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Found in your manuscript
            </CardTitle>
            <CardDescription>
              Word stored this metadata in the file. Nothing is applied until you choose it.
            </CardDescription>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onApplyAll()
              toast({
                title: 'Metadata applied',
                description: `${suggestions.length} ${suggestions.length === 1 ? 'field was' : 'fields were'} filled in.`,
                intent: 'success',
              })
            }}
          >
            Use all
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="divide-y divide-border">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.field}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{suggestion.label}</p>
                <p className="truncate text-sm font-medium">{truncate(suggestion.value, 120)}</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onApply(suggestion)
                  toast({ title: `${suggestion.label} applied`, intent: 'success' })
                }}
              >
                Use this
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
