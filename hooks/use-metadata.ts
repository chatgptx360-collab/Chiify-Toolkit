'use client'

import * as React from 'react'

import type { BookMetadata, EmbeddedMetadata, Project, ProjectId } from '@/lib/types'

import { useDocument } from './use-document'
import { useProjectActions } from './use-projects'

/**
 * Metadata suggestions taken from the uploaded document.
 *
 * THE RULE: SUGGEST, NEVER OVERWRITE
 * ----------------------------------
 * Word's `docProps` are unreliable — `dc:creator` is often the machine's
 * account name, `dc:title` an early working title or a filename. Applying them
 * silently would quietly corrupt metadata the author had already got right, and
 * they might not notice until a retailer rejected the book.
 *
 * So a field is only suggested when the project's own value is *empty*, and
 * applying is always an explicit action. A suggestion the author ignores costs
 * nothing; a silent overwrite costs them their data.
 */

export interface MetadataSuggestion {
  readonly field: keyof BookMetadata
  readonly label: string
  readonly value: string
  /** The value to write, which for authors is a list rather than a string. */
  readonly apply: Partial<BookMetadata>
}

export interface UseMetadataResult {
  readonly embedded: EmbeddedMetadata | undefined
  /** Only fields the document offers *and* the project has not filled in. */
  readonly suggestions: readonly MetadataSuggestion[]
  readonly applyOne: (suggestion: MetadataSuggestion) => void
  readonly applyAll: () => void
}

export function useMetadata(
  projectId: ProjectId | undefined,
  project: Project | undefined,
): UseMetadataResult {
  const document = useDocument(projectId)
  const { update } = useProjectActions()
  const embedded = document?.embeddedMetadata

  const suggestions = React.useMemo<readonly MetadataSuggestion[]>(() => {
    if (!embedded || !project) return []

    const current = project.metadata
    const found: MetadataSuggestion[] = []

    // The project name is used as a default title at creation, so a title that
    // merely matches the project name is still "unset" for this purpose.
    const titleIsPlaceholder =
      current.title.trim().length === 0 || current.title.trim() === project.name.trim()

    if (embedded.title && titleIsPlaceholder && embedded.title !== current.title) {
      found.push({
        field: 'title',
        label: 'Title',
        value: embedded.title,
        apply: { title: embedded.title },
      })
    }

    if (embedded.subtitle && !current.subtitle) {
      found.push({
        field: 'subtitle',
        label: 'Subtitle',
        value: embedded.subtitle,
        apply: { subtitle: embedded.subtitle },
      })
    }

    if (embedded.authors?.length && current.authors.length === 0) {
      found.push({
        field: 'authors',
        label: embedded.authors.length === 1 ? 'Author' : 'Authors',
        value: embedded.authors.join(', '),
        apply: { authors: embedded.authors },
      })
    }

    if (embedded.description && !current.description) {
      found.push({
        field: 'description',
        label: 'Description',
        value: embedded.description,
        apply: { description: embedded.description },
      })
    }

    if (embedded.publisher && !current.publisher) {
      found.push({
        field: 'publisher',
        label: 'Publisher',
        value: embedded.publisher,
        apply: { publisher: embedded.publisher },
      })
    }

    // Language has a working default, so it is only suggested when the document
    // disagrees with it — otherwise every upload would offer "en-GB" again.
    if (embedded.language && embedded.language !== current.language) {
      found.push({
        field: 'language',
        label: 'Language',
        value: embedded.language,
        apply: { language: embedded.language },
      })
    }

    if (embedded.keywords?.length && !current.subjects?.length) {
      found.push({
        field: 'subjects',
        label: 'Keywords',
        value: embedded.keywords.join(', '),
        apply: { subjects: embedded.keywords },
      })
    }

    return found
  }, [embedded, project])

  const applyOne = React.useCallback(
    (suggestion: MetadataSuggestion) => {
      if (!project) return
      update(project.id, { metadata: suggestion.apply })
    },
    [project, update],
  )

  const applyAll = React.useCallback(() => {
    if (!project || suggestions.length === 0) return

    const merged = suggestions.reduce<Partial<BookMetadata>>(
      (accumulator, suggestion) => ({ ...accumulator, ...suggestion.apply }),
      {},
    )

    update(project.id, { metadata: merged })
  }, [project, suggestions, update])

  return { embedded, suggestions, applyOne, applyAll }
}
