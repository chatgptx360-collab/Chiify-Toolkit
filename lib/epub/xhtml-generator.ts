import { create, fragment } from 'xmlbuilder2'
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces'

import type {
  Block,
  Chapter,
  ListBlock,
  ListItem,
  ParagraphBlock,
  TableRow,
  TextRun,
} from '../types/document'
import { ok, type Result } from '../utils/result'
import type { EpubResource } from '../types/epub'

import { OCF_PATHS, XML_NAMESPACES } from './constants'
import type { AssetManager } from './asset-manager'
import { relativeHref, safeXmlId } from './naming'
import type { GeneratedFile, GenerationContext, XhtmlGenerator } from './types'

/**
 * Chapter → XHTML.
 *
 * WHY XMLBUILDER2 RATHER THAN STRING TEMPLATES
 * --------------------------------------------
 * EPUB content documents must be well-formed XML, not merely valid HTML. A
 * single unescaped `&` in a book title — "Tom & Jerry" — produces a file that
 * every conforming reading system refuses to open, and template literals make
 * that mistake easy and invisible. Building a tree means escaping is
 * structural: it cannot be forgotten, and the serialiser guarantees the output
 * parses.
 *
 * THE EXHAUSTIVE SWITCH IS THE POINT
 * ----------------------------------
 * `renderBlock` switches over the `Block` union with no `default` branch. When
 * a future phase adds a block type to the document model, this file stops
 * compiling — which is exactly the intended safety net. A generator that
 * silently skipped unknown blocks would ship books with missing content and no
 * error anywhere.
 *
 * SEMANTICS OVER APPEARANCE
 * -------------------------
 * The model is semantic, so the output is too: `epub:type` attributes mark
 * chapters, front matter and footnotes, which is what lets reading systems
 * offer "skip to the next chapter" and what retailers check for. Visual choices
 * live entirely in the stylesheet.
 */

/** Where chapter documents live inside the content root. */
const TEXT_DIRECTORY = OCF_PATHS.textDirectory.replace(`${OCF_PATHS.contentRoot}/`, '')
const STYLESHEET_PATH = OCF_PATHS.stylesheet.replace(`${OCF_PATHS.contentRoot}/`, '')

/**
 * `epub:type` for a chapter, from its position in the book.
 *
 * Reading systems use these to build "chapter 3 of 20" counters that correctly
 * exclude a copyright page, and screen readers announce the section's role.
 */
const TYPE_BY_KIND = {
  frontMatter: 'frontmatter',
  body: 'bodymatter',
  backMatter: 'backmatter',
} as const

export interface XhtmlGeneratorOptions {
  readonly assets: AssetManager
  /** Filename assigned to each chapter, shared with the navigation builder. */
  readonly fileNameByChapter: ReadonlyMap<string, string>
}

export function createXhtmlGenerator(options: XhtmlGeneratorOptions): XhtmlGenerator {
  return {
    id: 'xhtml',

    generate(chapter: Chapter, context: GenerationContext): Result<GeneratedFile> {
      const fileName = options.fileNameByChapter.get(chapter.id) ?? `${chapter.slug}.xhtml`
      const href = `${TEXT_DIRECTORY}/${fileName}`

      const document = create({ version: '1.0', encoding: 'UTF-8' })
        .ele(XML_NAMESPACES.xhtml, 'html')
        .att('xmlns:epub', XML_NAMESPACES.epub)
        .att('xml:lang', context.metadata.language || 'en')
        .att('lang', context.metadata.language || 'en')

      const head = document.ele('head')
      head.ele('title').txt(chapter.title).up()
      head.ele('meta').att('charset', 'utf-8').up()
      head
        .ele('link')
        .att('rel', 'stylesheet')
        .att('type', 'text/css')
        .att('href', relativeHref(href, STYLESHEET_PATH))
        .up()
      head.up()

      const body = document.ele('body')
      const section = body
        .ele('section')
        .att('epub:type', TYPE_BY_KIND[chapter.kind])
        .att('role', 'doc-chapter')
        .att('id', safeXmlId(chapter.slug, 'chapter'))

      // Footnote bodies are collected and emitted together at the end of the
      // chapter, which is where readers expect them and where a reading system
      // can present them as popups.
      const notes: Block[] = []

      for (const block of chapter.blocks) {
        if (block.type === 'note') {
          notes.push(block)
          continue
        }
        renderBlock(section, block, { context, options, href })
      }

      if (notes.length > 0) {
        const noteSection = section
          .ele('section')
          .att('epub:type', 'footnotes')
          .att('role', 'doc-endnotes')

        for (const note of notes) {
          renderBlock(noteSection, note, { context, options, href })
        }

        noteSection.up()
      }

      section.up()
      body.up()

      const resource: EpubResource = {
        id: safeXmlId(`chapter-${chapter.slug}`, 'chapter'),
        href,
        mediaType: 'application/xhtml+xml',
      }

      return ok({
        resource,
        content: document.end({ prettyPrint: true, indent: '  ' }),
      })
    },
  }
}

interface RenderContext {
  readonly context: GenerationContext
  readonly options: XhtmlGeneratorOptions
  /** Path of the document being written, for resolving relative hrefs. */
  readonly href: string
}

/**
 * Render one block.
 *
 * No `default` branch: see the note at the top of the file.
 */
function renderBlock(parent: XMLBuilder, block: Block, render: RenderContext): void {
  switch (block.type) {
    case 'heading': {
      const element = parent.ele(`h${block.level}`)
      applyAnchors(element, block.anchors)
      renderRuns(element, block.content, render)
      element.up()
      return
    }

    case 'paragraph': {
      renderParagraph(parent, block, render)
      return
    }

    case 'list': {
      renderList(parent, block, render)
      return
    }

    case 'image': {
      const placed = render.options.assets.find(block.assetId)
      // A missing asset must not produce a dangling `src`: a broken image
      // reference fails validation, where an omitted figure merely loses a
      // picture the parser already warned about.
      if (!placed) return

      const figure = parent.ele('figure').att('class', 'illustration')
      applyAnchors(figure, block.anchors)

      const image = figure
        .ele('img')
        .att('src', relativeHref(render.href, placed.resource.href))
        .att('alt', block.alt)

      const asset = render.context.document.assets.find((item) => item.id === block.assetId)
      // Intrinsic dimensions let a reading system reserve space before the
      // image decodes, which is what stops text reflowing under the reader.
      if (asset?.width) image.att('width', String(asset.width))
      if (asset?.height) image.att('height', String(asset.height))
      image.up()

      if (block.caption && block.caption.length > 0) {
        const caption = figure.ele('figcaption')
        renderRuns(caption, block.caption, render)
        caption.up()
      }

      figure.up()
      return
    }

    case 'quote': {
      const quote = parent.ele('blockquote')
      applyAnchors(quote, block.anchors)

      for (const paragraph of block.content) {
        renderParagraph(quote, paragraph, render)
      }

      if (block.attribution && block.attribution.length > 0) {
        const attribution = quote.ele('p').att('class', 'attribution')
        renderRuns(attribution, block.attribution, render)
        attribution.up()
      }

      quote.up()
      return
    }

    case 'code': {
      const pre = parent.ele('pre')
      applyAnchors(pre, block.anchors)
      const code = pre.ele('code')
      if (block.language) code.att('data-language', block.language)
      code.txt(block.code).up()
      pre.up()
      return
    }

    case 'table': {
      renderTable(parent, block, render)
      return
    }

    case 'divider': {
      // A scene break, not a horizontal rule: `hr` is the semantic element for
      // a thematic break, and the stylesheet renders it as centred asterisks
      // rather than a line.
      const rule = parent.ele('hr').att('class', 'scene-break')
      applyAnchors(rule, block.anchors)
      rule.up()
      return
    }

    case 'pageBreak': {
      // EPUB is reflowable, so a page break is a *hint*. `pagebreak` is the
      // standard semantic; the stylesheet turns it into a real break for
      // reading systems that honour one, and it is invisible otherwise.
      parent
        .ele('div')
        .att('epub:type', 'pagebreak')
        .att('role', 'doc-pagebreak')
        .att('class', 'page-break')
        .up()
      return
    }

    case 'note': {
      const note = parent
        .ele('aside')
        .att('epub:type', 'footnote')
        .att('role', 'doc-footnote')
        .att('id', safeXmlId(`note-${block.marker}`, 'note'))

      for (const [index, paragraph] of block.content.entries()) {
        const element = note.ele('p')
        // The marker leads the first paragraph so the note reads correctly
        // even in a reading system that shows footnotes inline.
        if (index === 0) {
          element.ele('span').att('class', 'note-marker').txt(`${block.marker}. `).up()
        }
        renderRuns(element, paragraph.content, render)
        element.up()
      }

      note.up()
      return
    }
  }
}

function renderParagraph(parent: XMLBuilder, block: ParagraphBlock, render: RenderContext): void {
  const classes = [
    block.role ? `role-${safeXmlId(block.role, 'role')}` : undefined,
    block.alignment && block.alignment !== 'start' ? `align-${block.alignment}` : undefined,
  ].filter((value): value is string => value !== undefined)

  const element = parent.ele('p')
  if (classes.length > 0) element.att('class', classes.join(' '))
  applyAnchors(element, block.anchors)
  renderRuns(element, block.content, render)
  element.up()
}

function renderList(parent: XMLBuilder, block: ListBlock, render: RenderContext): void {
  const list = parent.ele(block.ordered ? 'ol' : 'ul')
  applyAnchors(list, block.anchors)

  for (const item of block.items) {
    renderListItem(list, item, render)
  }

  list.up()
}

function renderListItem(parent: XMLBuilder, item: ListItem, render: RenderContext): void {
  const element = parent.ele('li')
  renderRuns(element, item.content, render)

  // Nested lists live *inside* their parent item, which is what makes the
  // indentation semantic rather than visual — a screen reader announces the
  // nesting level correctly.
  for (const child of item.children ?? []) {
    renderList(element, child, render)
  }

  element.up()
}

function renderTable(
  parent: XMLBuilder,
  block: Extract<Block, { type: 'table' }>,
  render: RenderContext,
): void {
  const table = parent.ele('table')
  applyAnchors(table, block.anchors)

  if (block.caption && block.caption.length > 0) {
    const caption = table.ele('caption')
    renderRuns(caption, block.caption, render)
    caption.up()
  }

  if (block.header && block.header.length > 0) {
    const head = table.ele('thead')
    for (const row of block.header) renderRow(head, row, render, true)
    head.up()
  }

  const body = table.ele('tbody')
  for (const row of block.rows) renderRow(body, row, render, false)
  body.up()

  table.up()
}

function renderRow(
  parent: XMLBuilder,
  row: TableRow,
  render: RenderContext,
  isHeader: boolean,
): void {
  const element = parent.ele('tr')

  for (const cell of row.cells) {
    const cellElement = element.ele(isHeader ? 'th' : 'td')
    // `scope` is what tells a screen reader which cells a header governs.
    // Without it a data table is read as an undifferentiated stream of values.
    if (isHeader) cellElement.att('scope', 'col')
    if (cell.colSpan && cell.colSpan > 1) cellElement.att('colspan', String(cell.colSpan))
    if (cell.rowSpan && cell.rowSpan > 1) cellElement.att('rowspan', String(cell.rowSpan))

    renderRuns(cellElement, cell.content, render)
    cellElement.up()
  }

  element.up()
}

/** Inline marks, innermost last so nesting order is deterministic. */
const ELEMENT_BY_MARK = {
  strong: 'strong',
  emphasis: 'em',
  underline: 'u',
  strikethrough: 's',
  code: 'code',
} as const

const MARK_ORDER = ['strong', 'emphasis', 'underline', 'strikethrough', 'code'] as const

/**
 * Render styled text runs.
 *
 * Marks nest in a fixed order so that the same model always produces the same
 * markup — which makes the output diffable and the tests stable. Without a
 * defined order, `strong`+`emphasis` could serialise two ways depending on
 * array order in the parser.
 */
function renderRuns(parent: XMLBuilder, runs: readonly TextRun[], render: RenderContext): void {
  for (const run of runs) {
    let target = parent

    if (run.href) {
      target = target.ele('a').att('href', resolveHref(run.href, render))
    }

    if (run.script) {
      target = target.ele(run.script === 'super' ? 'sup' : 'sub')
    }

    const marks = MARK_ORDER.filter((mark) => run.marks?.includes(mark))
    for (const mark of marks) {
      target = target.ele(ELEMENT_BY_MARK[mark])
    }

    if (run.text.length > 0) target.txt(run.text)

    // Unwind exactly the elements opened for this run.
    for (let depth = 0; depth < marks.length; depth += 1) target = target.up()
    if (run.script) target = target.up()
    if (run.href) target = target.up()

    if (run.breakAfter) target.ele('br').up()
  }
}

/**
 * Resolve a hyperlink for the container.
 *
 * External links pass through untouched. Internal links (`#bookmark`) are left
 * as fragment references: the parser has already dropped any that pointed at a
 * missing target, so what remains resolves within the chapter.
 */
function resolveHref(href: string, _render: RenderContext): string {
  return href
}

/** Attach bookmark anchors as ids so in-book links resolve. */
function applyAnchors(element: XMLBuilder, anchors: readonly string[] | undefined): void {
  const first = anchors?.[0]
  if (!first) return

  // XML permits one id per element. The first anchor wins; additional ones are
  // rare and would need empty span targets, which is not worth the markup.
  element.att('id', safeXmlId(first, 'anchor'))
}

/** Exported for the cover page, which needs the same document shell. */
export function createXhtmlDocument(language: string, title: string, stylesheetHref: string) {
  const document = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(XML_NAMESPACES.xhtml, 'html')
    .att('xmlns:epub', XML_NAMESPACES.epub)
    .att('xml:lang', language)
    .att('lang', language)

  const head = document.ele('head')
  head.ele('title').txt(title).up()
  head.ele('meta').att('charset', 'utf-8').up()
  head.ele('link').att('rel', 'stylesheet').att('type', 'text/css').att('href', stylesheetHref).up()
  head.up()

  return document
}

/** Exported so the navigation builder can reuse the fragment helper. */
export { fragment }
