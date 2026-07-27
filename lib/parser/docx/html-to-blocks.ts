import type {
  Block,
  BlockAlignment,
  HeadingLevel,
  ListBlock,
  ListItem,
  ParagraphBlock,
  TableCell,
  TableRow,
  TextMark,
  TextRun,
} from '../../types/document'
import type { AssetId } from '../../types/common'

import { isElement, textContent, type HtmlElement, type HtmlNode } from './html-parser'
import { ASSET_URL_PREFIX } from './image-extractor'

/**
 * Convert Mammoth's HTML into internal document blocks.
 *
 * This is the one place where a *presentation* format is translated into the
 * semantic model, and it is deliberately the only place that knows what an
 * `<em>` is. Everything downstream — statistics, chapter detection, every
 * future export engine — sees only blocks.
 *
 * DESIGN NOTES
 * ------------
 * - **Inline state is threaded, not global.** Marks accumulate as the walker
 *   descends, so `<strong><em>x</em></strong>` produces one run with both
 *   marks rather than nested structures the model would have to flatten later.
 * - **Unknown elements are transparent, not dropped.** An unrecognised wrapper
 *   contributes its children. Losing an author's text because Word emitted an
 *   element we did not anticipate is the worst possible failure mode.
 * - **Ids are deterministic**, derived from a counter rather than random, so
 *   parsing the same file twice produces an identical model. That makes the
 *   output diffable and the tests stable.
 */

/** Generates stable, unique block ids for one parse run. */
export interface IdFactory {
  next(prefix: string): string
}

export function createIdFactory(): IdFactory {
  let counter = 0
  return {
    next(prefix) {
      counter += 1
      return `${prefix}-${counter}`
    },
  }
}

/** Inline formatting inherited from ancestor elements. */
interface InlineState {
  readonly marks: readonly TextMark[]
  readonly href?: string
  readonly script?: 'super' | 'sub'
}

const EMPTY_INLINE: InlineState = { marks: [] }

/** Tags that contribute an inline mark. */
const MARK_BY_TAG: Readonly<Record<string, TextMark>> = {
  strong: 'strong',
  b: 'strong',
  em: 'emphasis',
  i: 'emphasis',
  u: 'underline',
  ins: 'underline',
  s: 'strikethrough',
  strike: 'strikethrough',
  del: 'strikethrough',
  code: 'code',
  tt: 'code',
  kbd: 'code',
  samp: 'code',
}

const HEADING_LEVELS: Readonly<Record<string, HeadingLevel>> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

export interface ConversionResult {
  readonly blocks: readonly Block[]
  /** Bookmark names encountered but not yet attached to a block. */
  readonly usedAnchors: readonly string[]
}

export function convertHtmlToBlocks(nodes: readonly HtmlNode[], ids: IdFactory): ConversionResult {
  const blocks: Block[] = []
  const usedAnchors: string[] = []
  // Anchors are declared by empty `<a id>` elements that sit *before* the
  // content they target, so they are held until the next block is emitted.
  let pendingAnchors: string[] = []

  const takeAnchors = (): readonly string[] | undefined => {
    if (pendingAnchors.length === 0) return undefined
    const anchors = pendingAnchors
    pendingAnchors = []
    usedAnchors.push(...anchors)
    return anchors
  }

  const emit = (block: Block): void => {
    const anchors = takeAnchors()
    blocks.push(anchors ? ({ ...block, anchors } as Block) : block)
  }

  const walk = (node: HtmlNode): void => {
    if (node.type === 'text') {
      // Loose text between blocks (rare, but Mammoth emits it around some
      // constructs). Wrapping it keeps it in the manuscript.
      const text = node.text.trim()
      if (text.length > 0) {
        emit({ id: ids.next('p'), type: 'paragraph', content: [{ text }] })
      }
      return
    }

    const { tag } = node

    // A bookmark: an anchor with an id and no text.
    if (tag === 'a' && node.attributes.id && textContent(node).trim().length === 0) {
      pendingAnchors.push(node.attributes.id)
      return
    }

    const headingLevel = HEADING_LEVELS[tag]
    if (headingLevel !== undefined) {
      const content = collectRuns(node.children, EMPTY_INLINE)
      if (hasText(content)) {
        emit({ id: ids.next('h'), type: 'heading', level: headingLevel, content })
      }
      return
    }

    switch (tag) {
      case 'p': {
        emitParagraph(node)
        return
      }

      case 'ul':
      case 'ol': {
        const list = buildList(node, ids)
        if (list.items.length > 0) emit(list)
        return
      }

      case 'blockquote': {
        const paragraphs = collectQuoteParagraphs(node, ids)
        if (paragraphs.length > 0) {
          emit({ id: ids.next('quote'), type: 'quote', content: paragraphs })
        }
        return
      }

      case 'pre': {
        const code = textContent(node).replace(/\s+$/, '')
        if (code.trim().length > 0) {
          emit({ id: ids.next('code'), type: 'code', code })
        }
        return
      }

      case 'table': {
        const table = buildTable(node, ids)
        if (table) emit(table)
        return
      }

      case 'img': {
        const image = buildImage(node, ids)
        if (image) emit(image)
        return
      }

      case 'hr': {
        emit({ id: ids.next('divider'), type: 'divider' })
        return
      }

      // Mammoth wraps footnote bodies in an ordered list inside this container.
      case 'section':
      case 'div':
      case 'article':
      case 'body': {
        if (node.attributes.class?.includes('footnote')) {
          emitFootnotes(node)
          return
        }
        for (const child of node.children) walk(child)
        return
      }

      default: {
        // Unknown wrapper: descend rather than discard.
        for (const child of node.children) walk(child)
      }
    }
  }

  const emitParagraph = (node: HtmlElement): void => {
    const className = node.attributes.class ?? ''

    // A paragraph whose only content is an image is an illustration, not a
    // paragraph that happens to contain one.
    const images = node.children.filter((child) => isElement(child) && child.tag === 'img')
    const runs = collectRuns(node.children, EMPTY_INLINE)

    if (images.length > 0 && !hasText(runs)) {
      for (const child of images) {
        if (!isElement(child)) continue
        const image = buildImage(child, ids)
        if (image) emit(image)
      }
      return
    }

    if (!hasText(runs)) {
      // An empty paragraph containing an explicit break is Word's page break.
      if (containsPageBreak(node)) {
        emit({ id: ids.next('pagebreak'), type: 'pageBreak' })
      }
      return
    }

    const alignment = readAlignment(node)
    const role = readRole(className)

    emit({
      id: ids.next('p'),
      type: 'paragraph',
      content: runs,
      ...(alignment ? { alignment } : {}),
      ...(role ? { role } : {}),
    })
  }

  const emitFootnotes = (node: HtmlElement): void => {
    for (const item of findAll(node, 'li')) {
      const paragraphs = collectQuoteParagraphs(item, ids)
      if (paragraphs.length === 0) continue

      // Mammoth ids footnote list items `footnote-1`; the trailing number is
      // the marker the reader sees.
      const marker = /(\d+)\s*$/.exec(item.attributes.id ?? '')?.[1] ?? String(blocks.length + 1)

      emit({ id: ids.next('note'), type: 'note', marker, content: paragraphs })
    }
  }

  for (const node of nodes) walk(node)

  // Anchors left over at the end belong to nothing; record them so the
  // normaliser can report unresolved links rather than silently dropping them.
  usedAnchors.push(...pendingAnchors)

  return { blocks, usedAnchors }
}

/** Flatten inline content into runs, merging adjacent runs with equal styling. */
function collectRuns(nodes: readonly HtmlNode[], state: InlineState): readonly TextRun[] {
  const runs: TextRun[] = []

  const push = (text: string, current: InlineState, breakAfter = false): void => {
    if (text.length === 0 && !breakAfter) return

    const previous = runs[runs.length - 1]
    if (previous && !previous.breakAfter && sameStyle(previous, current) && !breakAfter) {
      runs[runs.length - 1] = { ...previous, text: previous.text + text }
      return
    }

    runs.push({
      text,
      ...(current.marks.length > 0 ? { marks: current.marks } : {}),
      ...(current.href ? { href: current.href } : {}),
      ...(current.script ? { script: current.script } : {}),
      ...(breakAfter ? { breakAfter: true } : {}),
    })
  }

  const walk = (node: HtmlNode, current: InlineState): void => {
    if (node.type === 'text') {
      push(node.text, current)
      return
    }

    const { tag } = node

    if (tag === 'br') {
      // Attach the break to the preceding run, or start an empty one so a
      // leading break is not lost.
      const previous = runs[runs.length - 1]
      if (previous) runs[runs.length - 1] = { ...previous, breakAfter: true }
      else push('', current, true)
      return
    }

    // Images inside a run of text are handled at block level.
    if (tag === 'img') return

    const mark = MARK_BY_TAG[tag]
    let next = current

    if (mark && !current.marks.includes(mark)) {
      next = { ...next, marks: [...next.marks, mark] }
    }

    if (tag === 'a') {
      const href = node.attributes.href
      if (href) next = { ...next, href }
    }

    if (tag === 'sup') next = { ...next, script: 'super' }
    if (tag === 'sub') next = { ...next, script: 'sub' }

    for (const child of node.children) walk(child, next)
  }

  for (const node of nodes) walk(node, state)

  return runs
}

function sameStyle(run: TextRun, state: InlineState): boolean {
  const marks = run.marks ?? []
  return (
    marks.length === state.marks.length &&
    marks.every((mark) => state.marks.includes(mark)) &&
    run.href === state.href &&
    run.script === state.script
  )
}

function hasText(runs: readonly TextRun[]): boolean {
  return runs.some((run) => run.text.trim().length > 0)
}

/** Word marks a manual page break with a styled break element. */
function containsPageBreak(node: HtmlElement): boolean {
  return findAll(node, 'br').some(
    (element) =>
      element.attributes.class?.includes('page') ||
      element.attributes.style?.includes('page-break'),
  )
}

function readAlignment(node: HtmlElement): BlockAlignment | undefined {
  const style = node.attributes.style ?? ''
  if (style.includes('text-align:center') || node.attributes.class?.includes('center')) {
    return 'center'
  }
  if (style.includes('text-align:right')) return 'end'
  if (style.includes('text-align:justify')) return 'justify'
  return undefined
}

/**
 * Map a Mammoth class onto a semantic role.
 *
 * Roles are advisory: an export engine that does not recognise one renders a
 * normal paragraph. That is why unknown classes are passed through rather than
 * validated against a fixed list — a manuscript's own vocabulary survives.
 */
function readRole(className: string): string | undefined {
  return className.split(/\s+/).find((name) => name.length > 0)
}

function buildList(node: HtmlElement, ids: IdFactory): ListBlock {
  const items: ListItem[] = []

  for (const child of node.children) {
    if (!isElement(child) || child.tag !== 'li') continue

    const nested: ListBlock[] = []
    const inlineNodes: HtmlNode[] = []

    for (const grandchild of child.children) {
      if (isElement(grandchild) && (grandchild.tag === 'ul' || grandchild.tag === 'ol')) {
        nested.push(buildList(grandchild, ids))
      } else {
        inlineNodes.push(grandchild)
      }
    }

    const content = collectRuns(inlineNodes, EMPTY_INLINE)
    if (!hasText(content) && nested.length === 0) continue

    items.push({
      id: ids.next('li'),
      content,
      ...(nested.length > 0 ? { children: nested } : {}),
    })
  }

  return {
    id: ids.next('list'),
    type: 'list',
    ordered: node.tag === 'ol',
    items,
  }
}

/** Paragraph children of a container, used by blockquotes and footnotes. */
function collectQuoteParagraphs(node: HtmlElement, ids: IdFactory): readonly ParagraphBlock[] {
  const paragraphs: ParagraphBlock[] = []
  const loose: HtmlNode[] = []

  for (const child of node.children) {
    if (isElement(child) && child.tag === 'p') {
      const content = collectRuns(child.children, EMPTY_INLINE)
      if (hasText(content)) {
        paragraphs.push({ id: ids.next('p'), type: 'paragraph', content })
      }
    } else {
      loose.push(child)
    }
  }

  const looseRuns = collectRuns(loose, EMPTY_INLINE)
  if (hasText(looseRuns)) {
    paragraphs.push({ id: ids.next('p'), type: 'paragraph', content: looseRuns })
  }

  return paragraphs
}

function buildTable(node: HtmlElement, ids: IdFactory): Block | undefined {
  const header: TableRow[] = []
  const rows: TableRow[] = []

  const readRow = (rowElement: HtmlElement): TableRow => ({
    id: ids.next('tr'),
    cells: rowElement.children.filter(isElement).flatMap((cell): TableCell[] => {
      if (cell.tag !== 'td' && cell.tag !== 'th') return []

      const colSpan = Number.parseInt(cell.attributes.colspan ?? '', 10)
      const rowSpan = Number.parseInt(cell.attributes.rowspan ?? '', 10)

      return [
        {
          id: ids.next('td'),
          content: collectRuns(cell.children, EMPTY_INLINE),
          ...(Number.isFinite(colSpan) && colSpan > 1 ? { colSpan } : {}),
          ...(Number.isFinite(rowSpan) && rowSpan > 1 ? { rowSpan } : {}),
        },
      ]
    }),
  })

  const visit = (element: HtmlElement, inHeader: boolean): void => {
    for (const child of element.children) {
      if (!isElement(child)) continue

      if (child.tag === 'thead') visit(child, true)
      else if (child.tag === 'tbody' || child.tag === 'tfoot') visit(child, false)
      else if (child.tag === 'tr') {
        const row = readRow(child)
        if (row.cells.length === 0) continue
        // A first row made entirely of <th> is a header even without <thead>,
        // which is how Word usually emits one.
        const isHeaderRow =
          inHeader ||
          (header.length === 0 &&
            rows.length === 0 &&
            child.children.filter(isElement).every((cell) => cell.tag === 'th'))

        if (isHeaderRow) header.push(row)
        else rows.push(row)
      }
    }
  }

  visit(node, false)

  if (header.length === 0 && rows.length === 0) return undefined

  return {
    id: ids.next('table'),
    type: 'table',
    ...(header.length > 0 ? { header } : {}),
    rows,
  }
}

function buildImage(node: HtmlElement, ids: IdFactory): Block | undefined {
  const source = node.attributes.src ?? ''
  if (!source.startsWith(ASSET_URL_PREFIX)) return undefined

  const assetId = source.slice(ASSET_URL_PREFIX.length)
  if (!assetId) return undefined

  return {
    id: ids.next('img'),
    type: 'image',
    assetId: assetId as AssetId,
    // An absent alt attribute is not the same as an empty one: empty means
    // "decorative", absent means "nobody has written it yet". Both become an
    // empty string here, and the normaliser raises a notice for the second.
    alt: node.attributes.alt ?? '',
  }
}

/** Depth-first search for every descendant with a given tag. */
function findAll(node: HtmlElement, tag: string): readonly HtmlElement[] {
  const found: HtmlElement[] = []

  const walk = (current: HtmlNode): void => {
    if (!isElement(current)) return
    if (current.tag === tag) found.push(current)
    for (const child of current.children) walk(child)
  }

  for (const child of node.children) walk(child)

  return found
}
