import type { DocumentId, IsoDateTime, ProjectId } from './common'

/**
 * A project is the user-facing unit of work: one manuscript on its way to
 * becoming one or more published files.
 *
 * Metadata is kept *separate* from the parsed document (see `document.ts`)
 * because it is authored by the user and must survive re-uploading a corrected
 * manuscript. Coupling them would mean a re-parse silently discards the ISBN.
 */

export type ProjectStatus = 'draft' | 'importing' | 'ready' | 'converting' | 'converted' | 'failed'

/**
 * Publishing metadata.
 *
 * Field names follow Dublin Core, which is what the EPUB 3 package document
 * requires. Matching the spec's vocabulary here means Phase 4's metadata
 * generator is a mapping, not a translation.
 */
export interface BookMetadata {
  readonly title: string
  readonly subtitle?: string
  readonly authors: readonly string[]
  readonly language: string
  readonly description?: string
  readonly publisher?: string
  readonly identifier?: string
  readonly publicationDate?: IsoDateTime
  readonly rights?: string
  readonly series?: string
  readonly seriesIndex?: number
  readonly subjects?: readonly string[]
}

/** The uploaded source file, described without holding its bytes. */
export interface SourceFile {
  readonly fileName: string
  readonly mediaType: string
  readonly byteSize: number
  readonly uploadedAt: IsoDateTime
}

/** Author-facing knobs that affect generated output. */
export interface ProjectSettings {
  /** Which heading level starts a new chapter. */
  readonly chapterHeadingLevel: 1 | 2 | 3
  readonly includeTableOfContents: boolean
  readonly generateCoverPage: boolean
  /** Name of a built-in typographic theme applied to generated CSS. */
  readonly theme: string
}

export interface Project {
  readonly id: ProjectId
  readonly name: string
  readonly status: ProjectStatus
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
  readonly source?: SourceFile
  /** Set once the source file has been parsed into the document model. */
  readonly documentId?: DocumentId
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

/** Defaults applied to a newly created project. */
export const defaultProjectSettings: ProjectSettings = {
  chapterHeadingLevel: 1,
  includeTableOfContents: true,
  generateCoverPage: true,
  theme: 'classic',
}

export const defaultBookMetadata: BookMetadata = {
  title: '',
  authors: [],
  language: 'en',
}
