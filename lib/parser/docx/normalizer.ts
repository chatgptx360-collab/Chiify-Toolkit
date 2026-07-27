import type {
  Block,
  ListBlock,
  ListItem,
  ParagraphBlock,
  ParseNotice,
  TextRun,
} from '../../types/document'

import { notice } from './errors'

/**
 * Content normalisation.
 *
 * THE GOVERNING RULE: PRESERVE AUTHOR INTENT
 * ------------------------------------------
 * Every rule here is a judgement about whether something is *noise from the
 * word processor* or *a decision the author made*. When the two are hard to
 * tell apart, the author wins and a notice is raised instead. Silently
 * "improving" a manuscript is how a tool loses an author's trust.
 *
 * So this normaliser will collapse a run of spaces produced by justified typing
 * (noise), but it will not merge two short paragraphs that look like one
 * (a decision). It removes a paragraph containing nothing at all (noise), but
 * keeps one containing a single em dash (a scene marker).
 *
 * Each rule is a pure function over blocks. They compose in a fixed order and
 * accumulate notices describing anything the author should look at.
 */

export interface NormalizationResult {
  readonly blocks: readonly Block[]
  readonly notices: readonly ParseNotice[]
}

export interface NormalizerOptions {
  /** Asset ids that actually exist, used to drop broken image references. */
  readonly knownAssetIds: ReadonlySet<string>
  /** Bookmark names available as link targets. */
  readonly knownAnchors: ReadonlySet<string>
}

export interface DocumentNormalizer {
  normalize(blocks: readonly Block[], options: NormalizerOptions): NormalizationResult
}

/**
 * Characters Word inserts that carry no meaning in a reflowable book.
 *
 * Zero-width and directional-formatting characters survive copy-paste from web
 * pages and PDFs, then show up as invisible corruption in an EPUB — reading
 * systems render them as boxes or break word wrapping around them.
 * The BOM is included because Word writes one mid-paragraph often enough.
 */
const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g

/** Control characters that are never legal in XML, and so never legal in EPUB. */
const ILLEGAL_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

/**
 * Non-breaking spaces, which Word inserts when the author presses Ctrl+Space
 * and also, unhelpfully, at the start of indented paragraphs.
 */
const NON_BREAKING_SPACE = /\u00A0/g

export function createDocumentNormalizer(): DocumentNormalizer {
  return {
    normalize(blocks, options) {
      const notices: ParseNotice[] = []

      let result: readonly Block[] = blocks.map((block) => cleanBlock(block))
      result = dropEmptyBlocks(result)
      result = dropBrokenImages(result, options.knownAssetIds, notices)
      result = collapsePageBreaks(result)
      result = dropDuplicateHeadings(result, notices)
      result = repairLinks(result, options.knownAnchors, notices)
      reportMissingAltText(result, notices)

      return { blocks: result, notices }
    },
  }
}

/** Clean the text of every run in a block. */
function cleanBlock(block: Block): Block {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return { ...block, content: cleanRuns(block.content) }

    case 'list':
      return { ...block, items: cleanListItems(block.items) }

    case 'quote':
      return {
        ...block,
        content: block.content.map((paragraph): ParagraphBlock => ({
          ...paragraph,
          content: cleanRuns(paragraph.content),
        })),
        ...(block.attribution ? { attribution: cleanRuns(block.attribution) } : {}),
      }

    case 'note':
      return {
        ...block,
        content: block.content.map((paragraph): ParagraphBlock => ({
          ...paragraph,
          content: cleanRuns(paragraph.content),
        })),
      }

    case 'table':
      return {
        ...block,
        ...(block.header
          ? {
              header: block.header.map((row) => ({
                ...row,
                cells: row.cells.map((cell) => ({ ...cell, content: cleanRuns(cell.content) })),
              })),
            }
          : {}),
        rows: block.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({ ...cell, content: cleanRuns(cell.content) })),
        })),
      }

    // Code keeps its whitespace exactly: indentation is the content.
    case 'code':
    case 'image':
    case 'divider':
    case 'pageBreak':
      return block
  }
}

function cleanListItems(items: readonly ListItem[]): readonly ListItem[] {
  return items.map((item) => ({
    ...item,
    content: cleanRuns(item.content),
    ...(item.children
      ? {
          children: item.children.map((child): ListBlock => ({
            ...child,
            items: cleanListItems(child.items),
          })),
        }
      : {}),
  }))
}

/**
 * Clean and merge runs.
 *
 * Word fragments a sentence into many runs whenever anything changes — a spell
 * check pass, a tracked edit, a language tag — so a single sentence can arrive
 * as a dozen identically-styled runs. Merging them is not cosmetic: it is what
 * stops the exported XHTML being a mass of pointless `<span>` boundaries, and
 * it makes word counting correct across run edges.
 */
function cleanRuns(runs: readonly TextRun[]): readonly TextRun[] {
  const cleaned: TextRun[] = []

  for (const run of runs) {
    const text = run.text
      .replace(ILLEGAL_CONTROL_CHARACTERS, '')
      .replace(INVISIBLE_CHARACTERS, '')
      .replace(NON_BREAKING_SPACE, ' ')
      // Collapse runs of whitespace, but keep single spaces at run edges: they
      // are the word boundaries between adjacent runs.
      .replace(/[ \t]{2,}/g, ' ')

    if (text.length === 0 && !run.breakAfter) continue

    const previous = cleaned[cleaned.length - 1]
    if (previous && !previous.breakAfter && isSameStyle(previous, run)) {
      cleaned[cleaned.length - 1] = { ...previous, text: previous.text + text }
      continue
    }

    cleaned.push({ ...run, text })
  }

  // Trim the outer edges only — interior spacing belongs to the author.
  const first = cleaned[0]
  if (first) cleaned[0] = { ...first, text: first.text.replace(/^\s+/, '') }

  const last = cleaned[cleaned.length - 1]
  if (last) cleaned[cleaned.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') }

  return cleaned.filter((run) => run.text.length > 0 || run.breakAfter)
}

function isSameStyle(a: TextRun, b: TextRun): boolean {
  const marksA = a.marks ?? []
  const marksB = b.marks ?? []

  return (
    marksA.length === marksB.length &&
    marksA.every((mark) => marksB.includes(mark)) &&
    a.href === b.href &&
    a.script === b.script
  )
}

/**
 * Remove blocks with no content.
 *
 * Word manuscripts are full of empty paragraphs used as vertical spacing. They
 * carry no meaning in a reflowable book — where the reader controls spacing —
 * and each one becomes a stray `<p></p>` that some reading systems render as a
 * blank line and others ignore, so the same book looks different per device.
 */
function dropEmptyBlocks(blocks: readonly Block[]): readonly Block[] {
  return blocks.filter((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return block.content.some((run) => run.text.trim().length > 0)
      case 'list':
        return block.items.length > 0
      case 'quote':
      case 'note':
        return block.content.length > 0
      case 'table':
        return block.rows.length > 0 || (block.header?.length ?? 0) > 0
      case 'code':
        return block.code.trim().length > 0
      case 'image':
      case 'divider':
      case 'pageBreak':
        return true
    }
  })
}

/** Drop images whose asset failed to extract, and say which ones. */
function dropBrokenImages(
  blocks: readonly Block[],
  knownAssetIds: ReadonlySet<string>,
  notices: ParseNotice[],
): readonly Block[] {
  return blocks.filter((block) => {
    if (block.type !== 'image') return true
    if (knownAssetIds.has(block.assetId)) return true

    notices.push(
      notice('docx.broken-image', 'An image could not be read and has been left out.', {
        source: block.assetId,
        hint: 'Re-insert the image in Word and upload the manuscript again.',
      }),
    )
    return false
  })
}

/**
 * Collapse consecutive page breaks, and drop leading and trailing ones.
 *
 * Authors press Ctrl+Enter repeatedly to push a chapter onto a fresh page. In a
 * reflowable book each break is a forced page, so three in a row means two
 * blank pages the reader has to swipe past.
 */
function collapsePageBreaks(blocks: readonly Block[]): readonly Block[] {
  const result: Block[] = []

  for (const block of blocks) {
    if (block.type === 'pageBreak') {
      if (result.length === 0) continue
      if (result[result.length - 1]?.type === 'pageBreak') continue
    }
    result.push(block)
  }

  while (result[result.length - 1]?.type === 'pageBreak') result.pop()

  return result
}

/**
 * Remove a heading immediately repeated at the same level.
 *
 * This is the signature of a copy-paste error or a template that prints the
 * chapter title twice. Only *adjacent identical* headings are removed: two
 * chapters legitimately called "Interlude" are far apart, and dropping the
 * second would silently delete a chapter.
 */
function dropDuplicateHeadings(blocks: readonly Block[], notices: ParseNotice[]): readonly Block[] {
  const result: Block[] = []

  for (const block of blocks) {
    const previous = result[result.length - 1]

    if (
      block.type === 'heading' &&
      previous?.type === 'heading' &&
      previous.level === block.level &&
      plainText(previous.content).toLowerCase() === plainText(block.content).toLowerCase()
    ) {
      notices.push(
        notice('docx.duplicate-heading', `“${plainText(block.content)}” appeared twice in a row.`, {
          severity: 'info',
          source: plainText(block.content),
          hint: 'The repeat has been removed.',
        }),
      )
      continue
    }

    result.push(block)
  }

  return result
}

/**
 * Drop internal links whose target does not exist, keeping the link text.
 *
 * A dead internal link is worse than plain text: reading systems handle them
 * inconsistently, and some show an error. External links are left alone — we
 * cannot know whether a URL resolves, and guessing would strip working links.
 */
function repairLinks(
  blocks: readonly Block[],
  knownAnchors: ReadonlySet<string>,
  notices: ParseNotice[],
): readonly Block[] {
  let broken = 0

  const fixRuns = (runs: readonly TextRun[]): readonly TextRun[] =>
    runs.map((run) => {
      if (!run.href?.startsWith('#')) return run
      if (knownAnchors.has(run.href.slice(1))) return run

      broken += 1
      const { href: _dropped, ...rest } = run
      return rest
    })

  const result = blocks.map((block): Block => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return { ...block, content: fixRuns(block.content) }
      case 'list':
        return { ...block, items: fixListItems(block.items, fixRuns) }
      case 'quote':
      case 'note':
        return {
          ...block,
          content: block.content.map((paragraph) => ({
            ...paragraph,
            content: fixRuns(paragraph.content),
          })),
        }
      default:
        return block
    }
  })

  if (broken > 0) {
    notices.push(
      notice(
        'docx.broken-links',
        `${broken} internal ${broken === 1 ? 'link points' : 'links point'} at a missing bookmark.`,
        {
          hint: 'The text has been kept; only the link was removed.',
        },
      ),
    )
  }

  return result
}

function fixListItems(
  items: readonly ListItem[],
  fixRuns: (runs: readonly TextRun[]) => readonly TextRun[],
): readonly ListItem[] {
  return items.map((item) => ({
    ...item,
    content: fixRuns(item.content),
    ...(item.children
      ? {
          children: item.children.map((child): ListBlock => ({
            ...child,
            items: fixListItems(child.items, fixRuns),
          })),
        }
      : {}),
  }))
}

/**
 * Report images with no alt text.
 *
 * Not an error — a decorative image legitimately has none — but retailers
 * increasingly reject books whose images are undescribed, and a reader using a
 * screen reader simply loses that content. The author is told which and how
 * many; nothing is changed.
 */
function reportMissingAltText(blocks: readonly Block[], notices: ParseNotice[]): void {
  const missing = blocks.filter((block) => block.type === 'image' && block.alt.trim().length === 0)
  if (missing.length === 0) return

  notices.push(
    notice(
      'docx.missing-alt-text',
      `${missing.length} ${missing.length === 1 ? 'image has' : 'images have'} no description.`,
      {
        hint: 'Add alt text in Word (right-click the image → Edit Alt Text). Readers using assistive technology cannot see undescribed images, and some retailers reject books without descriptions.',
      },
    ),
  )
}

/** Plain text of a run sequence, used for comparisons and statistics. */
export function plainText(runs: readonly TextRun[]): string {
  return runs.map((run) => run.text).join('')
}
