import type { BookMetadata, ProjectSettings } from '../types/project'
import type { Chapter, ParsedDocument } from '../types/document'
import type { EpubArtifact, EpubNavItem, EpubPackage, EpubResource } from '../types/epub'
import type { ValidationReport } from '../types/validation'
import type { Result } from '../utils/result'

/**
 * EPUB generation ports.
 *
 * Phase 4 builds an EPUB from four independent generators plus a packager.
 * Splitting them this way is not ceremony — each one has a different reason to
 * change:
 *
 *   - `XhtmlGenerator`  changes when the document model gains a block type.
 *   - `CssGenerator`    changes when a typographic theme is added.
 *   - `NavigationBuilder` changes when TOC rules change.
 *   - `MetadataGenerator` changes when a retailer demands a new field.
 *   - `EpubPackager`    changes when the container format changes (almost never).
 *
 * Interfaces rather than concrete classes also mean Phase 5's preview can
 * substitute a lightweight HTML renderer for the real packager.
 */

/** Everything a generator needs, assembled once by the conversion stage. */
export interface GenerationContext {
  readonly document: ParsedDocument
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
}

/** Renders one chapter of the document model into an XHTML resource. */
export interface XhtmlGenerator {
  readonly id: string
  generate(chapter: Chapter, context: GenerationContext): Result<GeneratedFile>
}

/** Produces the book's stylesheet for a named typographic theme. */
export interface CssGenerator {
  readonly id: string
  readonly themes: readonly string[]
  generate(context: GenerationContext): Result<GeneratedFile>
}

/** Builds the EPUB 3 navigation document tree. */
export interface NavigationBuilder {
  build(context: GenerationContext): Result<readonly EpubNavItem[]>
}

/** Maps project metadata onto Dublin Core package properties. */
export interface MetadataGenerator {
  generate(context: GenerationContext): Result<Readonly<Record<string, string | readonly string[]>>>
}

/** A generated text resource, before it is written into the container. */
export interface GeneratedFile {
  readonly resource: EpubResource
  readonly content: string
}

/** Turns a described package into a downloadable file. */
export interface EpubPackager {
  package(
    epub: EpubPackage,
    files: readonly GeneratedFile[],
    binaries: readonly PackagedBinary[],
  ): Promise<Result<EpubArtifact>>
}

export interface PackagedBinary {
  readonly resource: EpubResource
  readonly bytes: ArrayBuffer
}

/** Checks a generated package against the EPUB specification. */
export interface EpubValidator {
  readonly id: string
  validate(epub: EpubPackage, files: readonly GeneratedFile[]): Promise<ValidationReport>
}
