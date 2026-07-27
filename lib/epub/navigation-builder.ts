import { create } from 'xmlbuilder2'

import type { Block, Chapter, HeadingLevel } from '../types/document'
import { ok, type Result } from '../utils/result'
import type { EpubNavItem, EpubResource } from '../types/epub'

import { OCF_PATHS, XML_NAMESPACES } from './constants'
import { relativeHref, safeXmlId } from './naming'
import { STYLESHEET_HREF } from './stylesheet-generator'
import type { GeneratedFile, GenerationContext, NavigationBuilder } from './types'

/**
 * Navigation.
 *
 * A book gets two navigation documents, and both are deliberate:
 *
 *   - **`nav.xhtml`** is the EPUB 3 navigation document. It is required, it is
 *     a real XHTML file the reader can display, and it is what modern reading
 *     systems use.
 *   - **`toc.ncx`** is the EPUB 2 table of contents. EPUB 3 does not require
 *     it, and it is *superseded* — but Apple Books historically fell back to
 *     it, older Kobo and Sony firmware need it, and Kindle conversion reads it.
 *     It costs a few kilobytes and buys a great deal of device compatibility,
 *     which is why both are generated.
 *
 * NESTING COMES FROM THE HEADINGS
 * -------------------------------
 * A chapter's own subheadings become nested navigation entries, so a
 * non-fiction book with sections gets a navigable outline rather than a flat
 * list of twenty chapter names. Depth is capped — see `MAX_DEPTH`.
 */

const TEXT_DIRECTORY = OCF_PATHS.textDirectory.replace(`${OCF_PATHS.contentRoot}/`, '')
const NAV_HREF = OCF_PATHS.navigationDocument.replace(`${OCF_PATHS.contentRoot}/`, '')
const NCX_HREF = 'toc.ncx'

/**
 * How deep the contents nest.
 *
 * Three levels — chapter, section, subsection — is as much as a reader can
 * navigate usefully on a phone, and several reading systems flatten anything
 * deeper anyway. Beyond this the outline stops being a navigation aid and
 * becomes an index.
 */
const MAX_DEPTH = 3

export interface NavigationBuilderOptions {
  readonly fileNameByChapter: ReadonlyMap<string, string>
}

export function createNavigationBuilder(options: NavigationBuilderOptions): NavigationBuilder & {
  buildNavDocument(context: GenerationContext, items: readonly EpubNavItem[]): GeneratedFile
  buildNcxDocument(
    context: GenerationContext,
    items: readonly EpubNavItem[],
    identifier: string,
  ): GeneratedFile
} {
  const hrefFor = (chapter: Chapter): string =>
    `${TEXT_DIRECTORY}/${options.fileNameByChapter.get(chapter.id) ?? `${chapter.slug}.xhtml`}`

  return {
    build(context: GenerationContext): Result<readonly EpubNavItem[]> {
      const items = context.document.chapters.map((chapter): EpubNavItem => {
        const href = hrefFor(chapter)
        const children = buildHeadingTree(chapter, href)

        return {
          label: chapter.title || 'Untitled chapter',
          href,
          ...(children.length > 0 ? { children } : {}),
        }
      })

      return ok(items)
    },

    buildNavDocument(context, items) {
      const language = context.metadata.language || 'en'

      const document = create({ version: '1.0', encoding: 'UTF-8' })
        .ele(XML_NAMESPACES.xhtml, 'html')
        .att('xmlns:epub', XML_NAMESPACES.epub)
        .att('xml:lang', language)
        .att('lang', language)

      const head = document.ele('head')
      head.ele('title').txt('Contents').up()
      head.ele('meta').att('charset', 'utf-8').up()
      head
        .ele('link')
        .att('rel', 'stylesheet')
        .att('type', 'text/css')
        .att('href', relativeHref(NAV_HREF, STYLESHEET_HREF))
        .up()
      head.up()

      const body = document.ele('body')

      const nav = body.ele('nav').att('epub:type', 'toc').att('id', 'toc').att('role', 'doc-toc')

      nav.ele('h1').txt('Contents').up()
      renderNavList(nav, items, NAV_HREF)
      nav.up()

      // A landmarks nav lets a reading system jump straight to where the book
      // "starts" — past the title and copyright pages. Retailers check for it,
      // and it is what makes the "Beginning" button in Apple Books work.
      const landmarks = body.ele('nav').att('epub:type', 'landmarks').att('hidden', 'hidden')
      landmarks.ele('h2').txt('Landmarks').up()
      const landmarkList = landmarks.ele('ol')

      const bodyStart = context.document.chapters.find((chapter) => chapter.kind === 'body')
      if (bodyStart) {
        landmarkList
          .ele('li')
          .ele('a')
          .att('epub:type', 'bodymatter')
          .att('href', relativeHref(NAV_HREF, hrefFor(bodyStart)))
          .txt('Beginning')
          .up()
          .up()
      }

      landmarkList
        .ele('li')
        .ele('a')
        .att('epub:type', 'toc')
        .att('href', '#toc')
        .txt('Contents')
        .up()
        .up()

      landmarkList.up()
      landmarks.up()
      body.up()

      const resource: EpubResource = {
        id: 'nav',
        href: NAV_HREF,
        mediaType: 'application/xhtml+xml',
        // The `nav` property is how the package identifies the navigation
        // document. Without it the book has no table of contents as far as a
        // reading system is concerned, whatever the file contains.
        properties: ['nav'],
      }

      return { resource, content: document.end({ prettyPrint: true, indent: '  ' }) }
    },

    buildNcxDocument(context, items, identifier) {
      const document = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('http://www.daisy.org/z3986/2005/ncx/', 'ncx')
        .att('version', '2005-1')
        .att('xml:lang', context.metadata.language || 'en')

      const head = document.ele('head')
      head.ele('meta').att('name', 'dtb:uid').att('content', identifier).up()
      // These three are required by the NCX schema and must be zero for a
      // reflowable book, which has no fixed pages to count.
      head
        .ele('meta')
        .att('name', 'dtb:depth')
        .att('content', String(depthOf(items)))
        .up()
      head.ele('meta').att('name', 'dtb:totalPageCount').att('content', '0').up()
      head.ele('meta').att('name', 'dtb:maxPageNumber').att('content', '0').up()
      head.up()

      document
        .ele('docTitle')
        .ele('text')
        .txt(context.metadata.title || 'Untitled')
        .up()
        .up()

      for (const creator of context.metadata.authors.filter(Boolean)) {
        document.ele('docAuthor').ele('text').txt(creator).up().up()
      }

      const navMap = document.ele('navMap')
      let playOrder = 0

      const renderPoints = (parent: typeof navMap, entries: readonly EpubNavItem[]): void => {
        for (const entry of entries) {
          playOrder += 1

          const point = parent
            .ele('navPoint')
            .att('id', safeXmlId(`navpoint-${playOrder}`, 'nav'))
            // `playOrder` must be a continuous sequence across the whole
            // document, including nested points — not per level.
            .att('playOrder', String(playOrder))

          point.ele('navLabel').ele('text').txt(entry.label).up().up()
          point.ele('content').att('src', entry.href).up()

          if (entry.children && entry.children.length > 0) {
            renderPoints(point, entry.children)
          }

          point.up()
        }
      }

      renderPoints(navMap, items)
      navMap.up()

      return {
        resource: {
          id: 'ncx',
          href: NCX_HREF,
          mediaType: 'application/x-dtbncx+xml',
        },
        content: document.end({ prettyPrint: true, indent: '  ' }),
      }
    },
  }
}

/**
 * Build nested entries from a chapter's subheadings.
 *
 * The chapter's own title heading is skipped: it is already the parent entry,
 * and listing it again produces a contents page where every chapter contains a
 * single child with the same name.
 *
 * Only headings with an anchor can be linked, so an `id` is derived from the
 * heading text — the same derivation the XHTML generator uses, which is what
 * makes the link resolve.
 */
function buildHeadingTree(chapter: Chapter, chapterHref: string): readonly EpubNavItem[] {
  const headings = chapter.blocks.filter(
    (block): block is Extract<Block, { type: 'heading' }> => block.type === 'heading',
  )

  if (headings.length <= 1) return []

  // The shallowest level present is the chapter's own title level; sections
  // are everything below it.
  const topLevel = Math.min(...headings.map((heading) => heading.level)) as HeadingLevel
  const sections = headings.filter((heading) => heading.level > topLevel)
  if (sections.length === 0) return []

  const root: EpubNavItem[] = []
  const stack: { level: number; children: EpubNavItem[] }[] = [{ level: topLevel, children: root }]

  for (const heading of sections) {
    if (heading.level - topLevel >= MAX_DEPTH) continue

    const label = heading.content
      .map((run) => run.text)
      .join('')
      .trim()
    if (!label) continue

    const anchor = heading.anchors?.[0] ?? label
    const item: EpubNavItem = {
      label,
      href: `${chapterHref}#${safeXmlId(anchor, 'anchor')}`,
    }

    while (stack.length > 1 && (stack[stack.length - 1]?.level ?? 0) >= heading.level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (!parent) continue

    const children: EpubNavItem[] = []
    parent.children.push({ ...item, children })
    stack.push({ level: heading.level, children })
  }

  return prune(root)
}

/** Drop empty `children` arrays so the serialised tree stays clean. */
function prune(items: readonly EpubNavItem[]): readonly EpubNavItem[] {
  return items.map((item) => {
    const children = item.children ? prune(item.children) : []
    const { children: _dropped, ...rest } = item

    return children.length > 0 ? { ...rest, children } : rest
  })
}

function renderNavList(
  parent: ReturnType<typeof create>,
  items: readonly EpubNavItem[],
  fromPath: string,
): void {
  const list = parent.ele('ol')

  for (const item of items) {
    const entry = list.ele('li')
    entry.ele('a').att('href', relativeHref(fromPath, item.href)).txt(item.label).up()

    if (item.children && item.children.length > 0) {
      renderNavList(entry, item.children, fromPath)
    }

    entry.up()
  }

  list.up()
}

function depthOf(items: readonly EpubNavItem[]): number {
  if (items.length === 0) return 1

  return 1 + Math.max(0, ...items.map((item) => (item.children ? depthOf(item.children) : 0)))
}

export { NAV_HREF, NCX_HREF }
