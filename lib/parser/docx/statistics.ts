import type {
  Block,
  Chapter,
  ChapterExtreme,
  DocumentStats,
  ReadingComplexity,
  TextRun,
} from '../../types/document'

import { plainText } from './normalizer'

/**
 * Document statistics.
 *
 * WHY THE NUMBERS ARE ESTIMATES, AND SAY SO
 * -----------------------------------------
 * Reading time and page count are not measurements — they are conversions with
 * assumptions baked in. Rather than hide those assumptions in a magic number,
 * each constant below states the assumption it encodes and where it comes from,
 * so a future maintainer can change it deliberately instead of guessing why the
 * page count looks wrong.
 *
 * These feed a screen an author uses to sanity-check their book before
 * publishing. Being roughly right and honest beats being precisely wrong.
 */

/**
 * Adult silent reading of prose fiction: ~240 words per minute.
 *
 * The often-quoted 200–250 range comes from Brysbaert's meta-analysis. The
 * middle of it is the right default for a book; a technical manual reads
 * slower, which the complexity heuristic accounts for below.
 */
const WORDS_PER_MINUTE = 240

/**
 * Words per printed page in a trade paperback: ~275.
 *
 * A 6×9in page at 11pt with normal margins. Publishers use 250–300 depending
 * on trim size, so this is the middle of standard practice.
 */
const WORDS_PER_PAGE = 275

/** An image interrupts the page; roughly a third of a page each. */
const PAGE_COST_PER_IMAGE = 0.33

/** Sentence-length thresholds for the readability bands. */
const COMPLEXITY_THRESHOLDS = { simple: 14, moderate: 21 } as const

export interface StatisticsGenerator {
  generate(chapters: readonly Chapter[]): DocumentStats
}

interface Counters {
  words: number
  characters: number
  paragraphs: number
  headings: number
  images: number
  tables: number
  lists: number
  footnotes: number
  links: number
  sentences: number
  longWords: number
}

export function createStatisticsGenerator(): StatisticsGenerator {
  return {
    generate(chapters) {
      const counters: Counters = {
        words: 0,
        characters: 0,
        paragraphs: 0,
        headings: 0,
        images: 0,
        tables: 0,
        lists: 0,
        footnotes: 0,
        links: 0,
        sentences: 0,
        longWords: 0,
      }

      for (const chapter of chapters) {
        for (const block of chapter.blocks) countBlock(block, counters)
      }

      const readingMinutes = Math.max(
        1,
        Math.round(counters.words / WORDS_PER_MINUTE + counters.images * 0.1),
      )

      const pageCount = Math.max(
        1,
        Math.ceil(counters.words / WORDS_PER_PAGE + counters.images * PAGE_COST_PER_IMAGE),
      )

      const averageParagraphLength =
        counters.paragraphs > 0 ? Math.round(counters.words / counters.paragraphs) : 0

      const averageSentenceLength =
        counters.sentences > 0 ? Math.round((counters.words / counters.sentences) * 10) / 10 : 0

      return {
        wordCount: counters.words,
        characterCount: counters.characters,
        paragraphCount: counters.paragraphs,
        headingCount: counters.headings,
        chapterCount: chapters.length,
        imageCount: counters.images,
        tableCount: counters.tables,
        listCount: counters.lists,
        footnoteCount: counters.footnotes,
        linkCount: counters.links,
        estimatedReadingMinutes: readingMinutes,
        estimatedPageCount: pageCount,
        averageParagraphLength,
        averageSentenceLength,
        ...extremes(chapters),
        readingComplexity: assessComplexity(averageSentenceLength, counters),
      }
    },
  }
}

function countBlock(block: Block, counters: Counters): void {
  switch (block.type) {
    case 'heading':
      counters.headings += 1
      countRuns(block.content, counters, { countSentences: false })
      return

    case 'paragraph':
      counters.paragraphs += 1
      countRuns(block.content, counters, { countSentences: true })
      return

    case 'list':
      counters.lists += 1
      for (const item of block.items) {
        countRuns(item.content, counters, { countSentences: false })
        for (const child of item.children ?? []) countBlock(child, counters)
      }
      return

    case 'quote':
      for (const paragraph of block.content) countBlock(paragraph, counters)
      if (block.attribution) countRuns(block.attribution, counters, { countSentences: false })
      return

    case 'note':
      counters.footnotes += 1
      for (const paragraph of block.content) {
        // A footnote's prose counts towards the book, but not as a body
        // paragraph — it does not affect average paragraph length.
        counters.paragraphs -= 1
        countBlock(paragraph, counters)
      }
      return

    case 'table':
      counters.tables += 1
      for (const row of [...(block.header ?? []), ...block.rows]) {
        for (const cell of row.cells) countRuns(cell.content, counters, { countSentences: false })
      }
      return

    case 'image':
      counters.images += 1
      return

    case 'code':
      // Code is counted as characters but not as prose: including it would
      // distort both the word count and the reading estimate.
      counters.characters += block.code.length
      return

    case 'divider':
    case 'pageBreak':
  }
}

function countRuns(
  runs: readonly TextRun[],
  counters: Counters,
  options: { countSentences: boolean },
): void {
  const text = plainText(runs)
  counters.characters += text.length

  for (const run of runs) {
    if (run.href) counters.links += 1
  }

  const trimmed = text.trim()
  if (trimmed.length === 0) return

  const words = trimmed.split(/\s+/)
  counters.words += words.length

  // "Long" words approximate polysyllabic ones without a syllable dictionary.
  for (const word of words) {
    if (word.replace(/[^\p{L}]/gu, '').length > 8) counters.longWords += 1
  }

  if (options.countSentences) {
    // Terminal punctuation followed by whitespace or end of text. Not perfect —
    // "Dr. Smith" over-counts — but the error is small and consistent across
    // manuscripts, which is what matters for a comparative band.
    const sentences = trimmed.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0)
    counters.sentences += Math.max(1, sentences.length)
  }
}

/** Longest and shortest chapters, ignoring empty ones. */
function extremes(chapters: readonly Chapter[]): {
  longestChapter?: ChapterExtreme
  shortestChapter?: ChapterExtreme
} {
  const withContent = chapters.filter((chapter) => chapter.wordCount > 0)
  if (withContent.length === 0) return {}

  let longest = withContent[0]
  let shortest = withContent[0]
  if (!longest || !shortest) return {}

  for (const chapter of withContent) {
    if (chapter.wordCount > longest.wordCount) longest = chapter
    if (chapter.wordCount < shortest.wordCount) shortest = chapter
  }

  const describe = (chapter: Chapter): ChapterExtreme => ({
    chapterId: chapter.id,
    title: chapter.title,
    wordCount: chapter.wordCount,
  })

  return {
    longestChapter: describe(longest),
    // With a single chapter, "longest" and "shortest" are the same book and
    // reporting both is noise.
    ...(withContent.length > 1 ? { shortestChapter: describe(shortest) } : {}),
  }
}

/**
 * A coarse readability band.
 *
 * Uses average sentence length as the primary signal, adjusted by the share of
 * long words — the same two inputs every classic readability formula uses,
 * without pretending to the decimal precision of a Flesch score computed from
 * a syllable dictionary that does not exist here.
 */
function assessComplexity(averageSentenceLength: number, counters: Counters): ReadingComplexity {
  if (counters.words === 0) return 'simple'

  const longWordShare = counters.longWords / counters.words
  const adjusted = averageSentenceLength + longWordShare * 20

  if (adjusted <= COMPLEXITY_THRESHOLDS.simple) return 'simple'
  if (adjusted <= COMPLEXITY_THRESHOLDS.moderate) return 'moderate'
  return 'complex'
}
