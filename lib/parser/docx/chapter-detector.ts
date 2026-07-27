import type {
  Block,
  Chapter,
  ChapterDetectionResult,
  ChapterKind,
  ChapterStrategy,
  HeadingBlock,
  HeadingLevel,
} from '../../types/document'
import type { ChapterId } from '../../types/common'
import { slugify, uniqueSlug } from '../../utils/slug'

import { plainText } from './normalizer'

/**
 * Chapter detection.
 *
 * THE PROBLEM
 * -----------
 * A Word file is a flat stream of paragraphs. "Chapter" is not a concept it
 * has. Authors who use Word's heading styles give us the structure directly;
 * most authors do not — they centre a bold line and press Ctrl+Enter.
 *
 * So detection is a ladder of strategies, tried in order of how much they can
 * be trusted, and the result carries a **confidence score** rather than
 * pretending certainty. That score is the honest part: it lets the UI say
 * "we found 24 chapters, and we are fairly sure" versus "we could not find any
 * structure, so this is one long chapter — is that right?".
 *
 * WHY CONFIDENCE IS A NUMBER
 * --------------------------
 * "Found headings" is not binary. Two `Heading 1`s in a 400-page manuscript
 * almost certainly means the author styled a title page and nothing else. The
 * score accounts for how *evenly* the breaks are distributed and how plausible
 * the resulting chapter sizes are, so a bad split scores low even when the
 * strategy that produced it is the reliable one.
 */

export interface ChapterDetectorOptions {
  /** Heading level the author says starts a chapter. */
  readonly chapterHeadingLevel: HeadingLevel
}

export interface DetectedChapters {
  readonly chapters: readonly Chapter[]
  readonly detection: ChapterDetectionResult
}

export interface ChapterDetector {
  detect(blocks: readonly Block[], options: ChapterDetectorOptions): DetectedChapters
}

/** Titles that mark front or back matter rather than a numbered chapter. */
const FRONT_MATTER = [
  'title page',
  'copyright',
  'dedication',
  'epigraph',
  'contents',
  'table of contents',
  'foreword',
  'preface',
  'prologue',
  'introduction',
  'acknowledgements',
  'acknowledgments',
  'about this book',
]

const BACK_MATTER = [
  'epilogue',
  'afterword',
  'appendix',
  'glossary',
  'bibliography',
  'references',
  'notes',
  'index',
  'about the author',
  'also by',
  'acknowledgements',
  'acknowledgments',
]

/**
 * A paragraph shorter than this many words may be a title in disguise.
 *
 * Chapter titles are short. Six words covers "Chapter Twelve: The Long Winter"
 * while excluding almost all real prose.
 */
const TITLE_MAX_WORDS = 8

export function createChapterDetector(): ChapterDetector {
  return {
    detect(blocks, options) {
      if (blocks.length === 0) {
        return {
          chapters: [],
          detection: {
            strategy: 'single',
            confidence: 0,
            chapterCount: 0,
            reason: 'The document contains no readable content.',
          },
        }
      }

      const configured = findHeadings(
        blocks,
        (block) => block.level === options.chapterHeadingLevel,
      )
      if (configured.length > 0) {
        return build(
          blocks,
          configured,
          'heading',
          options,
          buildReason('heading', configured.length),
        )
      }

      // Fallback 1: the author used a *different* heading level throughout.
      // Common when a template makes the book title Heading 1 and chapters
      // Heading 2.
      const anyHeadingLevel = findMostCommonHeadingLevel(blocks)
      if (anyHeadingLevel !== undefined) {
        const fallback = findHeadings(blocks, (block) => block.level === anyHeadingLevel)
        if (fallback.length > 1) {
          return build(
            blocks,
            fallback,
            'headingFallback',
            options,
            `No Heading ${options.chapterHeadingLevel} styles were found, so Heading ${anyHeadingLevel} was used instead.`,
          )
        }
      }

      // Fallback 2: explicit page breaks. Authors who never touch styles still
      // press Ctrl+Enter between chapters.
      const pageBreaks = findPageBreakBoundaries(blocks)
      if (pageBreaks.length > 1) {
        return build(
          blocks,
          pageBreaks,
          'pageBreak',
          options,
          'No heading styles were found, so page breaks were used to split the book.',
        )
      }

      // Fallback 3: short standalone paragraphs that read like titles.
      const heuristic = findTitleLikeParagraphs(blocks)
      if (heuristic.length > 1) {
        return build(
          blocks,
          heuristic,
          'titleHeuristic',
          options,
          'No headings or page breaks were found, so short standalone lines that look like titles were used.',
        )
      }

      // Nothing found. One chapter is a truthful answer, not a failure.
      return build(
        blocks,
        [0],
        'single',
        options,
        'No chapter structure was found in this document.',
      )
    },
  }
}

/** Indices of headings matching a predicate. */
function findHeadings(
  blocks: readonly Block[],
  matches: (block: HeadingBlock) => boolean,
): readonly number[] {
  const indices: number[] = []

  blocks.forEach((block, index) => {
    if (block.type === 'heading' && matches(block)) indices.push(index)
  })

  return indices
}

/**
 * The shallowest heading level that appears more than once.
 *
 * Shallowest, because a book split at Heading 3 when Heading 2 exists would
 * produce sections rather than chapters.
 */
function findMostCommonHeadingLevel(blocks: readonly Block[]): HeadingLevel | undefined {
  const counts = new Map<HeadingLevel, number>()

  for (const block of blocks) {
    if (block.type !== 'heading') continue
    counts.set(block.level, (counts.get(block.level) ?? 0) + 1)
  }

  const levels = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([level]) => level)
    .sort((a, b) => a - b)

  return levels[0]
}

/** Block indices immediately following a page break. */
function findPageBreakBoundaries(blocks: readonly Block[]): readonly number[] {
  const boundaries: number[] = [0]

  blocks.forEach((block, index) => {
    if (block.type === 'pageBreak' && index + 1 < blocks.length) boundaries.push(index + 1)
  })

  return boundaries
}

/**
 * Short, standalone paragraphs that are probably chapter titles.
 *
 * Requires the paragraph to be short, to be followed by real prose, and either
 * to be centred, entirely emphasised, or to begin with a chapter word. Each
 * condition on its own produces far too many false positives — a line of
 * dialogue is short, and an emphasised line may be an epigraph.
 */
function findTitleLikeParagraphs(blocks: readonly Block[]): readonly number[] {
  const indices: number[] = []

  blocks.forEach((block, index) => {
    if (block.type !== 'paragraph') return

    const text = plainText(block.content).trim()
    if (text.length === 0) return

    const words = text.split(/\s+/)
    if (words.length > TITLE_MAX_WORDS) return

    // A title is followed by prose, not by another short line.
    const next = blocks[index + 1]
    if (!next || next.type !== 'paragraph') return
    if (plainText(next.content).trim().split(/\s+/).length < 12) return

    const isCentred = block.alignment === 'center'
    const isEmphasised =
      block.content.length > 0 &&
      block.content.every((run) => run.marks?.includes('strong') || run.marks?.includes('emphasis'))
    const startsWithChapterWord = /^(chapter|part|book|section|prologue|epilogue)\b/i.test(text)

    if (isCentred || isEmphasised || startsWithChapterWord) indices.push(index)
  })

  return indices
}

/** Assemble chapters from boundary indices and score the result. */
function build(
  blocks: readonly Block[],
  boundaries: readonly number[],
  strategy: ChapterStrategy,
  options: ChapterDetectorOptions,
  reason: string,
): DetectedChapters {
  const starts = boundaries[0] === 0 ? [...boundaries] : [0, ...boundaries]
  const chapters: Chapter[] = []
  const takenSlugs = new Set<string>()

  for (const [position, start] of starts.entries()) {
    const end = starts[position + 1] ?? blocks.length
    const slice = blocks.slice(start, end)
    if (slice.length === 0) continue

    const first = slice[0]
    const isHeading = first?.type === 'heading'

    // Content sitting before the first heading — a title page, an epigraph, a
    // copyright notice — is front matter by position. It must be kept (dropping
    // it would silently lose the author's opening pages) but it is not
    // chapter one, and reading systems that count chapters should skip it.
    const isPreamble = position === 0 && !isHeading && starts.length > 1

    const title =
      isHeading && plainText(first.content).trim().length > 0
        ? plainText(first.content).trim()
        : deriveTitle(slice, position, starts.length)

    // The heading that names the chapter stays in its blocks: an export engine
    // needs it to render a chapter title, and removing it here would force
    // every generator to re-synthesise one.
    const slug = uniqueSlug(slugify(title) || `chapter-${position + 1}`, takenSlugs)
    takenSlugs.add(slug)

    chapters.push({
      id: `cha_${String(position + 1).padStart(4, '0')}` as ChapterId,
      title,
      slug,
      kind: isPreamble ? 'frontMatter' : classify(title, position, starts.length),
      order: position,
      blocks: slice,
      wordCount: countWords(slice),
    })
  }

  return {
    chapters,
    detection: {
      strategy,
      confidence: score(strategy, chapters, options),
      chapterCount: chapters.length,
      reason,
    },
  }
}

/** A readable title for a chapter that does not start with a heading. */
function deriveTitle(blocks: readonly Block[], position: number, total: number): string {
  if (total === 1) return 'Manuscript'

  const firstText = blocks.find(
    (block) => block.type === 'paragraph' && plainText(block.content).trim().length > 0,
  )

  if (firstText?.type === 'paragraph') {
    const text = plainText(firstText.content).trim()
    const words = text.split(/\s+/)
    // A short opening line is very likely the title itself.
    if (words.length <= TITLE_MAX_WORDS) return text
  }

  return `Chapter ${position + 1}`
}

/**
 * Front matter, body or back matter.
 *
 * Matched on the title, because that is the only signal available. Position is
 * used as a tie-breaker: "Notes" at the front of a book is a preface, at the
 * back it is endnotes.
 */
function classify(title: string, position: number, total: number): ChapterKind {
  const normalised = title.toLowerCase().trim()
  const inFirstQuarter = position < Math.max(1, Math.floor(total * 0.25))
  const inLastQuarter = position >= Math.floor(total * 0.75)

  if (FRONT_MATTER.some((name) => normalised.startsWith(name)) && inFirstQuarter) {
    return 'frontMatter'
  }

  if (BACK_MATTER.some((name) => normalised.startsWith(name)) && inLastQuarter) {
    return 'backMatter'
  }

  return 'body'
}

/**
 * Score how much the split should be trusted, 0–1.
 *
 * Three factors, multiplied:
 *
 *   1. **The strategy's own reliability.** A real heading is worth far more
 *      than a guess about bold text.
 *   2. **Whether the chapter count is plausible.** One chapter, or four
 *      hundred, both suggest the split is wrong.
 *   3. **How evenly sized the chapters are.** Real books vary, but a split
 *      where one chapter holds 95% of the words has clearly found only one
 *      real boundary.
 */
function score(
  strategy: ChapterStrategy,
  chapters: readonly Chapter[],
  options: ChapterDetectorOptions,
): number {
  const base: Record<ChapterStrategy, number> = {
    heading: 1,
    headingFallback: 0.85,
    pageBreak: 0.6,
    titleHeuristic: 0.4,
    single: 0.2,
  }

  if (strategy === 'single' || chapters.length <= 1) return base.single

  const words = chapters.map((chapter) => chapter.wordCount)
  const total = words.reduce((sum, count) => sum + count, 0)
  if (total === 0) return 0

  // Plausibility of the count: books usually have between 5 and 60 chapters.
  const count = chapters.length
  const countFactor = count < 3 ? 0.7 : count > 120 ? 0.6 : 1

  // Distribution: the share held by the largest chapter, relative to an even
  // split. 1 means perfectly even, approaching 0 means one chapter dominates.
  const largest = Math.max(...words)
  const evenShare = total / count
  const balanceFactor = Math.min(1, evenShare / Math.max(largest, 1) + 0.35)

  // A configured level that produced results deserves no penalty.
  const levelFactor = options.chapterHeadingLevel === 1 ? 1 : 0.95

  return Math.round(base[strategy] * countFactor * balanceFactor * levelFactor * 100) / 100
}

function buildReason(strategy: ChapterStrategy, count: number): string {
  if (strategy === 'heading') {
    return `${count} Heading 1 ${count === 1 ? 'style' : 'styles'} were found and used as chapter starts.`
  }
  return 'Chapters were detected from the document structure.'
}

/** Word count for a slice of blocks. */
export function countWords(blocks: readonly Block[]): number {
  let words = 0

  const countRuns = (text: string): void => {
    const trimmed = text.trim()
    if (trimmed.length > 0) words += trimmed.split(/\s+/).length
  }

  const walk = (block: Block): void => {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        countRuns(plainText(block.content))
        return
      case 'list':
        for (const item of block.items) {
          countRuns(plainText(item.content))
          for (const child of item.children ?? []) walk(child)
        }
        return
      case 'quote':
      case 'note':
        for (const paragraph of block.content) countRuns(plainText(paragraph.content))
        return
      case 'table':
        for (const row of [...(block.header ?? []), ...block.rows]) {
          for (const cell of row.cells) countRuns(plainText(cell.content))
        }
        return
      case 'code':
        countRuns(block.code)
        return
      case 'image':
      case 'divider':
      case 'pageBreak':
    }
  }

  for (const block of blocks) walk(block)

  return words
}
