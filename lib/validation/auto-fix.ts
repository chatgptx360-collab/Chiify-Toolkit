import type { BookMetadata, ProjectSettings } from '../types/project'
import type { Severity } from '../utils/result'

import { isValidIsbn } from './inspectors/metadata-inspector'
import type { InspectionSubject, QualityReport, ValidationFinding } from './types'

/**
 * Automatic fixes.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * Nothing here changes anything. Every function returns a *proposal*: what
 * would change, from what, to what — and applying it is a separate call the UI
 * only makes after the author has seen the before and after and pressed a
 * button.
 *
 * That is not caution for its own sake. A tool that silently corrects an
 * author's metadata is a tool that eventually silently corrects something they
 * meant. The moment a writer cannot trust that the file contains what they
 * wrote, the tool has cost them more than it saved.
 *
 * WHAT IS DELIBERATELY NOT OFFERED
 * --------------------------------
 * Anything requiring authorship. There is no proposal to write a description,
 * invent subjects, or improve alt text, because the only honest version of
 * those is a blank field with a note explaining why it matters. Generating
 * plausible text and presenting it as a fix would put words in an author's book
 * that they never wrote.
 *
 * Dates and publishers sit on the edge: the value is derivable, but it is a
 * claim about the world. They are offered as proposals with the source of the
 * value stated, so the author is agreeing to a specific fact rather than
 * accepting a correction.
 */

export interface FixTarget {
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
}

export interface FixProposal {
  readonly id: string
  /** The finding rule this resolves. */
  readonly rule: string
  readonly title: string
  /** Why this value, in the author's terms. */
  readonly description: string
  readonly severity: Severity
  /** The field as an author would name it. */
  readonly field: string
  /** Shown side by side before anything is applied. */
  readonly before: string
  readonly after: string
  /** Pure: returns a new target, never mutates the one passed in. */
  apply(target: FixTarget): FixTarget
}

export interface AutoFixEngine {
  /** Proposals for the findings in a report, in the report's own order. */
  propose(report: QualityReport, subject: InspectionSubject): readonly FixProposal[]
  /** Apply several at once, so one confirmation can cover a batch. */
  applyAll(target: FixTarget, proposals: readonly FixProposal[]): FixTarget
}

export interface AutoFixOptions {
  /** Supplies the identifier, injected so a proposal is reproducible in tests. */
  readonly generateIdentifier?: () => string
  /** Today, for the publication-date proposal. */
  readonly now?: Date
}

type Builder = (
  finding: ValidationFinding,
  target: FixTarget,
  subject: InspectionSubject,
  options: Required<AutoFixOptions>,
) => FixProposal | undefined

const EMPTY = '(not set)'

const BUILDERS: Readonly<Record<string, Builder>> = {
  'metadata.missing-language': (item, target) =>
    metadataProposal(item, 'Language', 'language', target.metadata.language, 'en', {
      title: 'Set the language to English',
      description:
        'Screen readers choose a voice from this, and reading systems use it to hyphenate. Change it afterwards if the book is not in English.',
    }),

  'metadata.assumed-language': (item, target) =>
    metadataProposal(item, 'Language', 'language', target.metadata.language, 'en', {
      title: 'Confirm the book is in English',
      description:
        'The book already claims English because nothing was set. Accepting this records the choice, so it survives the next conversion — change it if the book is in another language.',
    }),

  'accessibility.missing-language': (item, target) =>
    metadataProposal(item, 'Language', 'language', target.metadata.language, 'en', {
      title: 'Declare the book’s language',
      description:
        'Every page inherits this. Without it a screen reader guesses, and an English book can be read aloud with French pronunciation.',
    }),

  'metadata.language-format': (item, target) => {
    const normalised = normaliseLanguage(target.metadata.language)
    if (!normalised || normalised === target.metadata.language) return undefined

    return metadataProposal(item, 'Language', 'language', target.metadata.language, normalised, {
      title: `Correct the language tag to ${normalised}`,
      description:
        'BCP-47 writes the language in lower case and the region in upper case, with a hyphen between them.',
    })
  },

  'metadata.unstable-identifier': (item, target, _subject, options) =>
    metadataProposal(
      item,
      'Identifier',
      'identifier',
      target.metadata.identifier ?? '',
      options.generateIdentifier(),
      {
        title: 'Give the book a permanent identifier',
        description:
          'A UUID that stays the same across rebuilds, so a reading system replaces the previous copy rather than adding a second one. It is not an ISBN — replace it before selling the book.',
      },
    ),

  'metadata.missing-identifier': (item, target, _subject, options) =>
    metadataProposal(
      item,
      'Identifier',
      'identifier',
      target.metadata.identifier ?? '',
      options.generateIdentifier(),
      {
        title: 'Generate a unique identifier',
        description:
          'A UUID makes the book valid and readable on any device. It is not an ISBN, so replace it before selling the book.',
      },
    ),

  'metadata.missing-title': (item, target, subject) => {
    const heading = firstHeading(subject)
    if (!heading) return undefined

    return metadataProposal(item, 'Title', 'title', target.metadata.title, heading, {
      title: `Use "${heading}" as the title`,
      description: 'Taken from the first heading in your manuscript.',
    })
  },

  'metadata.placeholder-title': (item, target, subject) => {
    const heading = firstHeading(subject)
    if (!heading) return undefined

    return metadataProposal(item, 'Title', 'title', target.metadata.title, heading, {
      title: `Use "${heading}" as the title`,
      description:
        'Taken from the first heading in your manuscript, replacing the placeholder Chiify used.',
    })
  },

  'metadata.title-whitespace': (item, target) => {
    const trimmed = target.metadata.title.trim()
    if (trimmed === target.metadata.title) return undefined

    return metadataProposal(item, 'Title', 'title', target.metadata.title, trimmed, {
      title: 'Remove the spaces around the title',
      description: 'Some stores display the title exactly as given, spaces included.',
    })
  },

  'metadata.isbn-format': (item, target) => {
    const raw = target.metadata.identifier ?? ''
    const digits = raw.replace(/[\s-]/g, '')

    // Only offered when removing the punctuation makes it valid — that is a
    // formatting fix. A genuinely wrong check digit is not something to guess,
    // and `metadata.isbn-invalid` deliberately has no builder at all.
    if (!isValidIsbn(digits) || digits === raw) return undefined

    return metadataProposal(item, 'ISBN', 'identifier', raw, digits, {
      title: 'Remove the punctuation from the ISBN',
      description:
        'The number itself is valid; the hyphens and spaces are what the check is failing on.',
    })
  },

  'metadata.missing-publisher': (item, target) => {
    const author = target.metadata.authors.find((name) => name.trim().length > 0)?.trim()
    if (!author) return undefined

    return metadataProposal(
      item,
      'Publisher',
      'publisher',
      target.metadata.publisher ?? '',
      author,
      {
        title: `Name ${author} as the publisher`,
        description:
          'The convention for a self-published book. Change it if you are publishing under an imprint.',
      },
    )
  },

  'metadata.missing-publication-date': (item, target, _subject, options) => {
    const today = options.now.toISOString().slice(0, 10)

    return metadataProposal(
      item,
      'Publication date',
      'publicationDate',
      target.metadata.publicationDate ?? '',
      today,
      {
        title: `Set the publication date to today (${today})`,
        description:
          'This is a claim about your book rather than a correction — set a different date if it was published before, or is due later.',
      },
    )
  },

  'structure.missing-ncx': (item, target) => {
    if (target.settings.includeTableOfContents) return undefined

    return settingsProposal(
      item,
      target,
      'Include an EPUB 2 contents file',
      'includeTableOfContents',
      true,
      'Kindle conversion and older Kobo firmware read toc.ncx. It adds a few kilobytes and a lot of device compatibility.',
    )
  },

  'resources.no-cover-at-all': (item, target) => {
    if (target.settings.generateCoverPage) return undefined

    return settingsProposal(
      item,
      target,
      'Generate a cover page',
      'generateCoverPage',
      true,
      'Chiify will build a typographic cover from the title and author. It is not artwork, but it is better than a blank tile in a library.',
    )
  },
}

export function createAutoFixEngine(options: AutoFixOptions = {}): AutoFixEngine {
  const resolved: Required<AutoFixOptions> = {
    generateIdentifier: options.generateIdentifier ?? defaultIdentifier,
    now: options.now ?? new Date(),
  }

  return {
    propose(report, subject) {
      const target: FixTarget = { metadata: subject.metadata, settings: subject.settings }
      const proposals: FixProposal[] = []
      const seen = new Set<string>()

      for (const item of report.findings) {
        const builder = BUILDERS[item.rule]
        if (!builder) continue

        const proposal = builder(item, target, subject, resolved)
        if (!proposal || seen.has(proposal.id)) continue

        seen.add(proposal.id)
        proposals.push(proposal)
      }

      return proposals
    },

    applyAll(target, proposals) {
      return proposals.reduce((current, proposal) => proposal.apply(current), target)
    },
  }
}

/** A proposal that changes one metadata field. */
function metadataProposal(
  item: ValidationFinding,
  field: string,
  key: 'title' | 'language' | 'identifier' | 'publisher' | 'publicationDate',
  before: string,
  after: string,
  copy: { readonly title: string; readonly description: string },
): FixProposal | undefined {
  if (after.length === 0 || before === after) return undefined

  return {
    id: `${item.rule}:${key}`,
    rule: item.rule,
    title: copy.title,
    description: copy.description,
    severity: item.severity,
    field,
    before: before.length === 0 ? EMPTY : before,
    after,
    apply: (current) => ({
      ...current,
      metadata: { ...current.metadata, [key]: after },
    }),
  }
}

/** A proposal that changes one project setting. */
function settingsProposal(
  item: ValidationFinding,
  target: FixTarget,
  title: string,
  key: 'includeTableOfContents' | 'generateCoverPage',
  after: boolean,
  description: string,
): FixProposal | undefined {
  if (target.settings[key] === after) return undefined

  return {
    id: `${item.rule}:${key}`,
    rule: item.rule,
    title,
    description,
    severity: item.severity,
    field: title,
    before: target.settings[key] ? 'On' : 'Off',
    after: after ? 'On' : 'Off',
    apply: (current) => ({
      ...current,
      settings: { ...current.settings, [key]: after },
    }),
  }
}

/**
 * The first heading in the book.
 *
 * Read from the generated markup rather than from the document model, because
 * the auto-fix engine is given a package to reason about and nothing else. It
 * skips the cover page, whose heading is the placeholder title being replaced.
 */
function firstHeading(subject: InspectionSubject): string | undefined {
  for (const document of subject.documents) {
    if (document.mediaType !== 'application/xhtml+xml') continue
    if (document.href.endsWith('cover.xhtml') || document.href === 'nav.xhtml') continue

    const heading = document.elements.find((element) => /^h[1-6]$/.test(element.localName))
    const text = heading?.text.trim()

    if (text && text.length > 0) return text
  }

  return undefined
}

/** `EN_us` and `en_GB` become `en-US` and `en-GB`. */
function normaliseLanguage(value: string): string | undefined {
  const parts = value.trim().replace(/_/g, '-').split('-').filter(Boolean)
  const language = parts[0]?.toLowerCase()

  if (!language || !/^[a-z]{2,3}$/.test(language)) return undefined

  const region = parts[1]?.toUpperCase()

  return region && /^[A-Z]{2}$/.test(region) ? `${language}-${region}` : language
}

/**
 * A UUID, without a dependency.
 *
 * `crypto.randomUUID` exists in every browser Chiify supports and in Node 19+,
 * but this module is also imported by tests running under older toolchains, so
 * it falls back rather than assuming.
 */
function defaultIdentifier(): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`

  return `urn:uuid:${uuid}`
}
