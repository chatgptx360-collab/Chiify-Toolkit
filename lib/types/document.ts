import type { AssetId, ChapterId, DocumentId } from './common'

/**
 * The Internal Document Model (IDM).
 *
 * THE SINGLE MOST IMPORTANT ARCHITECTURAL DECISION IN THIS PROJECT
 * ---------------------------------------------------------------
 * Every input format (DOCX today; Markdown, HTML, Google Docs later) is parsed
 * *into* this model, and every output format (EPUB today; PDF, MOBI, HTML,
 * Markdown later) is generated *from* it. That gives an N+M problem instead of
 * an N×M one: adding an export target never requires touching a parser, and
 * adding an import format never requires touching a generator.
 *
 * Design rules for this model:
 *   1. It is *semantic*, not visual. A node says "this is a heading", never
 *      "this is 18pt Cambria bold". Visual decisions belong to the theme layer
 *      so the same manuscript can render differently per output format.
 *   2. It is plain data — serialisable, structurally cloneable, and safe to
 *      hand to a Web Worker (Phase 6 will move parsing off the main thread).
 *   3. It is a discriminated union on `type`, so exhaustive `switch` statements
 *      in generators fail to compile when a new node type is introduced.
 *
 * Phase 3 populates this model. Phase 4 consumes it. Nothing here depends on
 * React, the DOM, or any file format.
 */

/** Inline formatting marks that can apply to a run of text. */
export type TextMark = 'strong' | 'emphasis' | 'underline' | 'strikethrough' | 'code'

/** The smallest unit of content: a styled run of text. */
export interface TextRun {
  readonly text: string
  readonly marks?: readonly TextMark[]
  /** Present when the run is a hyperlink. */
  readonly href?: string
  /** Superscript/subscript, used heavily by footnote markers. */
  readonly script?: 'super' | 'sub'
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type BlockAlignment = 'start' | 'center' | 'end' | 'justify'

interface BlockBase {
  readonly id: string
}

export interface HeadingBlock extends BlockBase {
  readonly type: 'heading'
  readonly level: HeadingLevel
  readonly content: readonly TextRun[]
}

export interface ParagraphBlock extends BlockBase {
  readonly type: 'paragraph'
  readonly content: readonly TextRun[]
  readonly alignment?: BlockAlignment
  /**
   * Named semantic role carried over from the source document's style, e.g.
   * `epigraph`, `dedication`. Generators map roles to CSS classes; unknown
   * roles degrade to a normal paragraph rather than being dropped.
   */
  readonly role?: string
}

export interface ListBlock extends BlockBase {
  readonly type: 'list'
  readonly ordered: boolean
  readonly items: readonly ListItem[]
}

export interface ListItem {
  readonly id: string
  readonly content: readonly TextRun[]
  /** Nested lists are modelled as children, not as flattened indent levels. */
  readonly children?: readonly ListBlock[]
}

export interface ImageBlock extends BlockBase {
  readonly type: 'image'
  readonly assetId: AssetId
  /** Required by EPUB accessibility rules; empty string marks it decorative. */
  readonly alt: string
  readonly caption?: readonly TextRun[]
}

export interface QuoteBlock extends BlockBase {
  readonly type: 'quote'
  readonly content: readonly ParagraphBlock[]
  readonly attribution?: readonly TextRun[]
}

export interface CodeBlock extends BlockBase {
  readonly type: 'code'
  readonly code: string
  readonly language?: string
}

export interface TableBlock extends BlockBase {
  readonly type: 'table'
  readonly caption?: readonly TextRun[]
  readonly header?: readonly TableRow[]
  readonly rows: readonly TableRow[]
}

export interface TableRow {
  readonly id: string
  readonly cells: readonly TableCell[]
}

export interface TableCell {
  readonly id: string
  readonly content: readonly TextRun[]
  readonly colSpan?: number
  readonly rowSpan?: number
}

/** A scene break / thematic break (`* * *` in a manuscript). */
export interface DividerBlock extends BlockBase {
  readonly type: 'divider'
}

export interface PageBreakBlock extends BlockBase {
  readonly type: 'pageBreak'
}

/** Footnote/endnote body. The marker itself is a `TextRun` with `script`. */
export interface NoteBlock extends BlockBase {
  readonly type: 'note'
  readonly marker: string
  readonly content: readonly ParagraphBlock[]
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | ImageBlock
  | QuoteBlock
  | CodeBlock
  | TableBlock
  | DividerBlock
  | PageBreakBlock
  | NoteBlock

export type BlockType = Block['type']

/**
 * Where a chapter sits in the book.
 *
 * EPUB navigation and reading-system UI treat these differently (front matter
 * is usually excluded from "Chapter 1 of 20" counters), so the distinction is
 * modelled rather than inferred from position.
 */
export type ChapterKind = 'frontMatter' | 'body' | 'backMatter'

export interface Chapter {
  readonly id: ChapterId
  readonly title: string
  /** Stable slug used for the generated XHTML filename and in-book links. */
  readonly slug: string
  readonly kind: ChapterKind
  readonly order: number
  readonly blocks: readonly Block[]
  /** Cached statistic; recomputed by the parser, never edited by hand. */
  readonly wordCount: number
}

/** A binary resource referenced by the document (images today, fonts later). */
export interface DocumentAsset {
  readonly id: AssetId
  readonly fileName: string
  readonly mediaType: string
  readonly byteSize: number
  readonly width?: number
  readonly height?: number
}

/**
 * The parsed manuscript.
 *
 * Note the absence of publishing metadata (title, author, ISBN): that is
 * `BookMetadata` on the project, because it is authored by the user and must
 * survive re-parsing the source file.
 */
export interface ParsedDocument {
  readonly id: DocumentId
  readonly sourceFileName: string
  readonly chapters: readonly Chapter[]
  readonly assets: readonly DocumentAsset[]
  readonly stats: DocumentStats
}

export interface DocumentStats {
  readonly wordCount: number
  readonly characterCount: number
  readonly chapterCount: number
  readonly imageCount: number
  readonly estimatedReadingMinutes: number
}
