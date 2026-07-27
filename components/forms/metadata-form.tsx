'use client'

import { Save } from 'lucide-react'
import * as React from 'react'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useProjectActions } from '@/hooks'
import { formatAuthors, issuesByField, parseAuthors, validateBookMetadata } from '@/lib/projects'
import type { BookMetadata, Project } from '@/lib/types'

/**
 * Book metadata form.
 *
 * WHY LOCAL STATE RATHER THAN WRITING ON EVERY KEYSTROKE
 * -----------------------------------------------------
 * Metadata is a set of related fields that are only coherent together — a
 * half-typed ISBN is not a state worth persisting, and auto-saving it would
 * make the validation report flicker between valid and invalid as someone
 * types. The form holds a draft and commits it on submit.
 *
 * Validation runs after the first submit attempt, then live. Before that first
 * attempt, an untouched form shows no errors — flagging fields the author has
 * not reached yet is the most common way a form feels hostile.
 *
 * The domain owns the rules (`lib/projects/validation.ts`). This component only
 * renders them, so the same rules can gate conversion in Phase 4 without being
 * reimplemented.
 */

/** BCP 47 tags covering the languages this audience publishes in most. */
const LANGUAGES = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'nl', label: 'Dutch' },
  { value: 'sv', label: 'Swedish' },
  { value: 'ja', label: 'Japanese' },
] as const

/**
 * Drop optional fields the author left blank.
 *
 * An empty `<dc:publisher/>` element is worse than no element at all — some
 * validators flag it, and retailers display it as a blank imprint. Required
 * fields are left alone; validation has already established they are filled.
 */
function normalise(metadata: BookMetadata): BookMetadata {
  const next: Record<string, unknown> = { ...metadata }

  for (const [key, value] of Object.entries(next)) {
    if (key === 'title' || key === 'language') continue
    if (typeof value === 'string' && value.trim() === '') delete next[key]
    else if (typeof value === 'string') next[key] = value.trim()
  }

  return next as unknown as BookMetadata
}

export interface MetadataFormProps {
  project: Project
}

export function MetadataForm({ project }: MetadataFormProps) {
  const { update } = useProjectActions()
  const { toast } = useToast()

  const [draft, setDraft] = React.useState<BookMetadata>(project.metadata)
  const [authorsText, setAuthorsText] = React.useState(() =>
    formatAuthors(project.metadata.authors),
  )
  const [submitted, setSubmitted] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  /**
   * Re-sync the draft when the project's metadata changes underneath us.
   *
   * Applying a suggestion from the parsed document writes straight to the
   * project. Without this, the form would keep showing its original draft and
   * the next save would quietly overwrite the value the author had just
   * accepted — the field would appear to revert on its own.
   *
   * `dirty` guards it: once the author has typed, their in-progress edits win
   * over an external change. Adjusting state during render (rather than in an
   * effect) is React's documented pattern for deriving state from a changed
   * prop, and avoids rendering the stale value for a frame first.
   */
  const [syncedMetadata, setSyncedMetadata] = React.useState(project.metadata)

  if (project.metadata !== syncedMetadata && !dirty) {
    setSyncedMetadata(project.metadata)
    setDraft(project.metadata)
    setAuthorsText(formatAuthors(project.metadata.authors))
  }

  const issues = React.useMemo(() => validateBookMetadata(draft), [draft])
  const fieldIssues = React.useMemo(
    () => (submitted ? issuesByField(issues) : {}),
    [issues, submitted],
  )
  const errorCount = issues.filter((issue) => issue.severity === 'error').length

  /**
   * Update one field of the draft.
   *
   * `undefined` removes the key rather than storing `undefined` — under
   * `exactOptionalPropertyTypes` those are different types, and the distinction
   * is meaningful: an absent `seriesIndex` means "not part of a series", which
   * is what the EPUB metadata generator needs to see.
   *
   * Empty strings are kept while editing, so a cleared required field still
   * fails validation instead of silently reverting. `normalise` strips them on
   * save.
   */
  function set<TKey extends keyof BookMetadata>(key: TKey, value: BookMetadata[TKey]) {
    setDirty(true)
    setDraft((current) => {
      const next: Record<string, unknown> = { ...current }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next as unknown as BookMetadata
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    if (errorCount > 0) {
      // The inline messages carry the detail; the toast exists so a submit from
      // the bottom of a long form does not appear to do nothing.
      toast({
        title: 'Metadata is incomplete',
        description: `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'} before saving.`,
        intent: 'warning',
      })
      return
    }

    const result = update(project.id, { metadata: normalise(draft) })
    if (!result.ok) {
      toast({ title: 'Could not save', description: result.error.message, intent: 'danger' })
      return
    }

    // Saved: the draft and the project now agree, so an external change may
    // sync again.
    setDirty(false)
    setSyncedMetadata(result.value.metadata)
    toast({ title: 'Metadata saved', intent: 'success' })
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning')

  return (
    // `noValidate` disables the browser's own constraint UI, not the semantics.
    // The `required` attribute stays on each control so assistive technology
    // still announces the field as required — but the native error bubble would
    // otherwise intercept submit before `handleSubmit` runs, suppressing our
    // messages entirely and showing an unstyled tooltip that vanishes on the
    // next click. Our validation is the authoritative one, so it must be the
    // one that gets to speak.
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormSection
        title="The book"
        description="Written into the EPUB package document and read by every retailer."
        columns={2}
      >
        <FormField
          label="Title"
          required
          hint="Shown in a reader's library."
          {...(fieldIssues.title ? { error: fieldIssues.title.message } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="The Long Winter"
              invalid={Boolean(fieldIssues.title)}
            />
          )}
        </FormField>

        <FormField label="Subtitle" hint="Optional. Kept separate from the title.">
          {(field) => (
            <Input
              {...field}
              value={draft.subtitle ?? ''}
              onChange={(event) => set('subtitle', event.target.value)}
              placeholder="A Novel"
            />
          )}
        </FormField>

        <FormField
          label="Authors"
          required
          hint="Separate multiple authors with a comma."
          {...(fieldIssues.authors ? { error: fieldIssues.authors.message } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={authorsText}
              onChange={(event) => {
                setDirty(true)
                setAuthorsText(event.target.value)
                set('authors', parseAuthors(event.target.value))
              }}
              placeholder="Ada Lovelace, Charles Babbage"
              invalid={Boolean(fieldIssues.authors)}
            />
          )}
        </FormField>

        <FormField
          label="Language"
          required
          hint="Screen readers use this to choose a pronunciation."
          {...(fieldIssues.language ? { error: fieldIssues.language.message } : {})}
        >
          {(field) => (
            <Select
              {...field}
              value={draft.language}
              onChange={(event) => set('language', event.target.value)}
              invalid={Boolean(fieldIssues.language)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </FormSection>

      <FormSection title="Description" description="Used by retailers as the book's blurb.">
        <FormField
          label="Description"
          hint="A few sentences. Plain text — formatting is not carried through."
          {...(fieldIssues.description ? { error: fieldIssues.description.message } : {})}
        >
          {(field) => (
            <Textarea
              {...field}
              rows={5}
              value={draft.description ?? ''}
              onChange={(event) => set('description', event.target.value)}
              placeholder="What is this book about?"
            />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title="Publication"
        description="Optional, but expected by most stores."
        columns={2}
      >
        <FormField label="Publisher" hint="Leave blank if you self-publish.">
          {(field) => (
            <Input
              {...field}
              value={draft.publisher ?? ''}
              onChange={(event) => set('publisher', event.target.value)}
              placeholder="Imprint name"
            />
          )}
        </FormField>

        <FormField
          label="ISBN"
          hint="A unique identifier is generated for you if this is blank."
          {...(fieldIssues.identifier ? { error: fieldIssues.identifier.message } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={draft.identifier ?? ''}
              onChange={(event) => set('identifier', event.target.value)}
              placeholder="978-3-16-148410-0"
              invalid={Boolean(fieldIssues.identifier)}
            />
          )}
        </FormField>

        <FormField
          label="Series"
          hint="Leave blank for a standalone book."
          {...(fieldIssues.series ? { error: fieldIssues.series.message } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={draft.series ?? ''}
              onChange={(event) => set('series', event.target.value)}
              placeholder="The Winter Cycle"
              invalid={Boolean(fieldIssues.series)}
            />
          )}
        </FormField>

        <FormField label="Number in series" hint="For example, 2 for the second book.">
          {(field) => (
            <Input
              {...field}
              type="number"
              min={1}
              value={draft.seriesIndex ?? ''}
              onChange={(event) =>
                set(
                  'seriesIndex',
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
            />
          )}
        </FormField>
      </FormSection>

      {submitted && warnings.length > 0 ? (
        <Alert intent="warning">
          <AlertTitle>
            {warnings.length} {warnings.length === 1 ? 'suggestion' : 'suggestions'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1">
              {warnings.map((warning) => (
                <li key={warning.code}>{warning.hint ?? warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary">
          <Save aria-hidden="true" />
          Save metadata
        </Button>
        <p className="text-xs text-subtle-foreground">
          Warnings do not block saving — they are things retailers prefer.
        </p>
      </div>
    </form>
  )
}
