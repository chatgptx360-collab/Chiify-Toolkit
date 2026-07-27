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
  /**
   * A hard line break follows this run.
   *
   * Modelled as a property of a run rather than as a block, because a break
   * inside a stanza of poetry or an address is *within* a paragraph — splitting
   * the paragraph would change its meaning and its styling.
   */
  readonly breakAfter?: boolean
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type BlockAlignment = 'start' | 'center' | 'end' | 'justify'

interface BlockBase {
  readonly id: string
  /**
   * Bookmark names that target this block.
   *
   * Word bookmarks are link destinations, so they are recorded on the block
   * they point at rather than as content of their own. Generators emit them as
   * `id` attributes; a format with no anchor concept simply ignores them.
   */
  readonly anchors?: readonly string[]
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
  /** Safe, collision-free name assigned during extraction. */
  readonly fileName: string
  readonly mediaType: string
  readonly byteSize: number
  /** Pixel dimensions, read from the image header where the format exposes them. */
  readonly width?: number
  readonly height?: number
  /** Dots per inch, when the format records it. Used to warn about print quality. */
  readonly dpi?: number
  /**
   * The image itself.
   *
   * Held as an `ArrayBuffer` so the model stays structured-cloneable — it can
   * cross a Web Worker boundary intact, which is what lets Phase 6 move parsing
   * off the main thread without changing this type. Export engines read these
   * bytes directly; nothing needs to go back to the source file.
   */
  readonly bytes: ArrayBuffer
}

/**
 * How a chapter boundary was identified.
 *
 * Recorded because the fallbacks are guesses, and an author who can see *why*
 * the book was split the way it was can correct their manuscript rather than
 * fighting the tool. Ordered from most to least reliable.
 */
export type ChapterStrategy =
  /** A real `Heading 1` (or the configured level). Unambiguous. */
  | 'heading'
  /** An explicit page break between sections. */
  | 'pageBreak'
  /** A lower heading level, used when the configured level never appears. */
  | 'headingFallback'
  /** A short, bold, standalone paragraph that reads like a title. */
  | 'titleHeuristic'
  /** No structure found; the manuscript is one chapter. */
  | 'single'

export interface ChapterDetectionResult {
  readonly strategy: ChapterStrategy
  /**
   * 0–1. How much the parser trusts the split.
   *
   * A number, not a boolean, because "we found headings but only two of them
   * in 400 pages" is neither success nor failure — it is a result the UI should
   * show with a caveat.
   */
  readonly confidence: number
  readonly chapterCount: number
  /** Human-readable justification, shown in the analysis screen. */
  readonly reason: string
}

/**
 * Metadata found *inside* the source document.
 *
 * Kept separate from `BookMetadata` (which the author owns) so re-parsing can
 * suggest values without silently overwriting anything typed by hand. The UI
 * offers these as prefills; the author decides.
 */
export interface EmbeddedMetadata {
  readonly title?: string
  readonly subtitle?: string
  readonly authors?: readonly string[]
  readonly description?: string
  readonly publisher?: string
  readonly language?: string
  readonly keywords?: readonly string[]
  readonly createdAt?: string
  readonly modifiedAt?: string
}

/**
 * A rough readability band.
 *
 * Deliberately a coarse label rather than a precise index: readability formulas
 * are approximations calibrated on English prose, and presenting "Flesch 62.4"
 * implies a precision the input does not support. Authors want to know whether
 * their prose reads long, not a decimal.
 */
export type ReadingComplexity = 'simple' | 'moderate' | 'complex'

/** Per-chapter extremes, referenced by id so the UI can link to them. */
export interface ChapterExtreme {
  readonly chapterId: ChapterId
  readonly title: string
  readonly wordCount: number
}

export interface DocumentStats {
  readonly wordCount: number
  readonly characterCount: number
  readonly paragraphCount: number
  readonly headingCount: number
  readonly chapterCount: number
  readonly imageCount: number
  readonly tableCount: number
  readonly listCount: number
  readonly footnoteCount: number
  readonly linkCount: number
  /** Minutes, at a typical adult silent-reading pace. */
  readonly estimatedReadingMinutes: number
  /** Printed pages at a conventional trade-paperback density. */
  readonly estimatedPageCount: number
  readonly averageParagraphLength: number
  readonly averageSentenceLength: number
  readonly longestChapter?: ChapterExtreme
  readonly shortestChapter?: ChapterExtreme
  readonly readingComplexity: ReadingComplexity
}

/**
 * The parsed manuscript.
 *
 * Note the absence of publishing metadata the *author* owns (title, ISBN):
 * that is `BookMetadata` on the project, so re-parsing a corrected manuscript
 * cannot discard it. What the document itself declared is offered separately as
 * `embeddedMetadata`.
 */
export interface ParsedDocument {
  readonly id: DocumentId
  readonly sourceFileName: string
  readonly parsedAt: string
  readonly chapters: readonly Chapter[]
  readonly assets: readonly DocumentAsset[]
  readonly stats: DocumentStats
  readonly detection: ChapterDetectionResult
  readonly embeddedMetadata: EmbeddedMetadata
  /**
   * Non-fatal problems found while parsing.
   *
   * A manuscript with an unreadable image still converts; the author needs to
   * know which image, not a failed conversion. Fatal problems are returned as
   * an `err` instead and never reach this field.
   */
  readonly notices: readonly ParseNotice[]
}

/** A non-fatal parsing problem, shaped for direct display. */
export interface ParseNotice {
  readonly code: string
  readonly message: string
  readonly severity: 'info' | 'warning'
  /** Where it happened, e.g. a chapter title or image filename. */
  readonly source?: string
  readonly hint?: string
}
