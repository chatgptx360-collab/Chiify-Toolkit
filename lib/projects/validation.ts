import type { BookMetadata } from '../types/project'
import { appError, type AppError } from '../utils/result'

/**
 * Book metadata validation.
 *
 * WHY HAND-WRITTEN RATHER THAN A SCHEMA LIBRARY
 * ---------------------------------------------
 * The rules here are not "is this a string" — they are publishing rules, and
 * most of them exist because a retailer or the EPUB specification says so. A
 * schema library would validate the shape and still let a book ship with a
 * language tag no reading system understands.
 *
 * Each rule therefore states *why* it exists, and the messages are written for
 * an author: what is wrong, and what to do about it. They reuse `AppError`, so
 * the same shape flows through forms, the validation report and toasts.
 *
 * Severity matters: `error` blocks publishing, `warning` is advice the author
 * can knowingly ignore. Being strict about that distinction is what stops the
 * form from nagging about optional fields.
 */

/** BCP 47: a primary language subtag, optionally with script/region subtags. */
const BCP_47 = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/

/** ISBN-13 with optional hyphens, or a bare 10-digit ISBN. */
const ISBN = /^(?:\d[- ]?){9,12}[\dXx]$/

export interface FieldIssue extends AppError {
  /** The metadata key the issue belongs to, for form field highlighting. */
  readonly field: keyof BookMetadata
}

function fieldIssue(
  field: keyof BookMetadata,
  code: string,
  message: string,
  options: { severity?: AppError['severity']; hint?: string } = {},
): FieldIssue {
  return {
    ...appError(code, message, {
      severity: options.severity ?? 'error',
      source: field,
      ...(options.hint === undefined ? {} : { hint: options.hint }),
    }),
    field,
  }
}

/**
 * Validate metadata, returning every issue rather than the first.
 *
 * Returning all of them lets the form show a complete picture; stopping at the
 * first turns filling in a form into a guessing game.
 */
export function validateBookMetadata(metadata: BookMetadata): readonly FieldIssue[] {
  const issues: FieldIssue[] = []

  if (!metadata.title.trim()) {
    issues.push(
      fieldIssue('title', 'metadata.title-required', 'A book needs a title.', {
        hint: 'This is written into the EPUB package document and shown in every reading system.',
      }),
    )
  } else if (metadata.title.trim().length > 255) {
    issues.push(
      fieldIssue('title', 'metadata.title-too-long', 'This title is unusually long.', {
        severity: 'warning',
        hint: 'Retailers commonly truncate titles beyond 255 characters.',
      }),
    )
  }

  if (metadata.authors.length === 0 || metadata.authors.every((author) => !author.trim())) {
    issues.push(
      fieldIssue('authors', 'metadata.author-required', 'Add at least one author.', {
        hint: 'Recorded as the book’s creator. Separate multiple authors with a comma.',
      }),
    )
  }

  if (!metadata.language.trim()) {
    issues.push(
      fieldIssue('language', 'metadata.language-required', 'Choose a language.', {
        hint: 'EPUB requires it, and screen readers use it to pick the right pronunciation.',
      }),
    )
  } else if (!BCP_47.test(metadata.language.trim())) {
    issues.push(
      fieldIssue('language', 'metadata.language-invalid', 'That is not a valid language tag.', {
        hint: 'Use a BCP 47 tag such as en, en-GB or pt-BR.',
      }),
    )
  }

  if (metadata.identifier && !ISBN.test(metadata.identifier.trim())) {
    issues.push(
      fieldIssue('identifier', 'metadata.identifier-invalid', 'That does not look like an ISBN.', {
        severity: 'warning',
        hint: 'Leave it blank if you do not have one — a unique identifier is generated for you.',
      }),
    )
  }

  if (metadata.seriesIndex !== undefined && !metadata.series?.trim()) {
    issues.push(
      fieldIssue('series', 'metadata.series-name-missing', 'Add the series name.', {
        hint: 'A number on its own does not tell a reader which series the book belongs to.',
      }),
    )
  }

  if (!metadata.description?.trim()) {
    issues.push(
      fieldIssue('description', 'metadata.description-missing', 'No description yet.', {
        severity: 'warning',
        hint: 'Retailers use this as the book’s blurb. Books without one convert noticeably worse.',
      }),
    )
  }

  return issues
}

/** Only the issues that must be fixed before a book can be published. */
export function blockingIssues(issues: readonly FieldIssue[]): readonly FieldIssue[] {
  return issues.filter((issue) => issue.severity === 'error')
}

/** Index issues by field, for rendering inline messages. */
export function issuesByField(
  issues: readonly FieldIssue[],
): Partial<Record<keyof BookMetadata, FieldIssue>> {
  const map: Partial<Record<keyof BookMetadata, FieldIssue>> = {}

  for (const issue of issues) {
    // Errors take precedence over warnings on the same field: a field can only
    // show one message, and it should be the one that blocks.
    const existing = map[issue.field]
    if (!existing || (existing.severity !== 'error' && issue.severity === 'error')) {
      map[issue.field] = issue
    }
  }

  return map
}

/**
 * Parse a comma-separated author string into a list.
 *
 * The form uses a single text field because that is how authors think about
 * it ("me and my co-writer"), while the model needs an array — EPUB records
 * each creator separately.
 */
export function parseAuthors(value: string): readonly string[] {
  return value
    .split(',')
    .map((author) => author.trim())
    .filter(Boolean)
}

export function formatAuthors(authors: readonly string[]): string {
  return authors.join(', ')
}
