import { documentByHref, resolveHref } from '../subject'
import {
  finding,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'
import type { XmlElement } from '../xml-scan'

/**
 * Navigation inspection.
 *
 * WHY THIS IS THE MOST VALUABLE INSPECTOR
 * ---------------------------------------
 * A broken table of contents is the defect authors discover last and readers
 * notice first. It does not stop the book opening, so a quick check on a laptop
 * misses it; it surfaces as a contents list that jumps to the wrong chapter, or
 * a device that shows a book with no navigation at all.
 *
 * Every href in the navigation document is therefore resolved against the
 * manifest, and the navigation order is compared to the spine. Those two
 * checks between them catch the entire class.
 *
 * BOTH NAVIGATION DOCUMENTS ARE CHECKED
 * -------------------------------------
 * `nav.xhtml` is what EPUB 3 requires. `toc.ncx` is the superseded EPUB 2
 * table of contents, and it is still what Kindle conversion reads and what
 * older Kobo and Sony firmware falls back to. Its absence is not an error —
 * the book is valid without it — but it is a real loss of reach, and the two
 * documents disagreeing is worse than having only one.
 */

const NAV_HREF = 'nav.xhtml'
const NCX_HREF = 'toc.ncx'
const MAX_REASONABLE_DEPTH = 3
const CHECK_COUNT = 14

export function createNavigationInspector(): Inspector {
  return {
    id: 'navigation-inspector',
    category: 'structure',
    title: 'Navigation and reading order',

    inspect(subject: InspectionSubject): InspectionResult {
      const findings: ValidationFinding[] = []

      // ---- The spine ----------------------------------------------------

      const spine = subject.epub.spine

      if (spine.length === 0) {
        findings.push(
          finding('structure.empty-spine', 'structure', 'error', 'The book has no reading order.', {
            impact: 'blocking',
            remedy:
              'A book with an empty spine opens to a blank screen. Convert the manuscript again.',
          }),
        )
      }

      const manifestIds = new Set(subject.epub.resources.map((resource) => resource.id))

      for (const item of spine) {
        if (!manifestIds.has(item.idref)) {
          findings.push(
            finding(
              'structure.spine-not-in-manifest',
              'structure',
              'error',
              'The reading order points at a file that is not in the book.',
              {
                impact: 'blocking',
                location: item.idref,
                remedy:
                  'Every spine entry must name a manifest item. Convert the manuscript again.',
              },
            ),
          )
        }
      }

      if (spine.length > 0 && !spine.some((item) => item.linear)) {
        findings.push(
          finding(
            'structure.no-linear-content',
            'structure',
            'error',
            'No part of the book is in the reading flow.',
            {
              impact: 'blocking',
              remedy:
                'Every page is marked as supplementary, so a reader paging forward from the cover reaches the end immediately.',
            },
          ),
        )
      }

      // ---- The EPUB 3 navigation document -------------------------------

      const navResource = subject.epub.resources.find((resource) =>
        resource.properties?.includes('nav'),
      )

      if (!navResource) {
        findings.push(
          finding(
            'structure.missing-nav',
            'structure',
            'error',
            'The book has no table of contents.',
            {
              impact: 'blocking',
              remedy:
                'EPUB 3 requires a navigation document declared with the nav property. Without it the book is invalid.',
            },
          ),
        )

        return { findings, checks: CHECK_COUNT }
      }

      const nav = documentByHref(subject, navResource.href) ?? documentByHref(subject, NAV_HREF)

      if (!nav) {
        findings.push(
          finding(
            'structure.nav-not-generated',
            'structure',
            'error',
            'The table of contents is listed but was never written.',
            {
              impact: 'blocking',
              location: navResource.href,
              remedy: 'Convert the manuscript again.',
            },
          ),
        )

        return { findings, checks: CHECK_COUNT }
      }

      const tocNav = findNav(nav.elements, 'toc')
      const entries = tocNav ? navLinks(nav.elements, tocNav) : []

      if (entries.length === 0) {
        findings.push(
          finding(
            'structure.empty-toc',
            'structure',
            'error',
            'The table of contents has no entries.',
            {
              impact: 'blocking',
              location: nav.href,
              remedy:
                'Readers navigate a book through this list. An empty one means no chapter can be reached except by paging.',
            },
          ),
        )
      }

      const seen = new Set<string>()
      // Duplicates are compared including the fragment: two entries pointing at
      // different headings in one chapter are a nested contents list, not a
      // mistake. Reachability, below, deliberately ignores the fragment.
      const seenExact = new Set<string>()

      for (const entry of entries) {
        const href = entry.attributes.href ?? ''
        const label = entry.text.trim()

        if (label.length === 0) {
          findings.push(
            finding(
              'structure.nav-empty-label',
              'structure',
              'warning',
              'A contents entry has no text.',
              {
                impact: 'reading',
                location: `${nav.href}:${entry.line}`,
                remedy:
                  'It will appear as a blank row in the reader’s contents list. Give the chapter a heading.',
              },
            ),
          )
        }

        const target = resolveHref(nav.href, href)

        if (href.length === 0 || !subject.manifestHrefs.has(target)) {
          findings.push(
            finding(
              'structure.nav-broken-link',
              'structure',
              'error',
              `The contents entry "${label || 'untitled'}" points nowhere.`,
              {
                impact: 'blocking',
                location: `${nav.href}:${entry.line}`,
                remedy: 'Tapping it in a reader does nothing, or shows an error page.',
              },
            ),
          )
        }

        if (seenExact.has(href)) {
          findings.push(
            finding(
              'structure.duplicate-nav-entry',
              'structure',
              'info',
              'Two contents entries point at the same page.',
              {
                impact: 'advisory',
                location: target,
                remedy: 'Readers see the chapter listed twice.',
              },
            ),
          )
        }

        seen.add(target)
        seenExact.add(href)
      }

      // Every linear chapter should be reachable from the contents.
      const chapterHrefs = spine
        .filter((item) => item.linear && item.chapterId)
        .map((item) => subject.epub.resources.find((resource) => resource.id === item.idref)?.href)
        .filter((href): href is string => Boolean(href))

      const unreachable = chapterHrefs.filter((href) => !seen.has(href))

      if (unreachable.length > 0) {
        findings.push(
          finding(
            'structure.nav-missing-chapter',
            'structure',
            'warning',
            `${unreachable.length} ${unreachable.length === 1 ? 'chapter is' : 'chapters are'} missing from the table of contents.`,
            {
              impact: 'reading',
              location: unreachable.join(', '),
              remedy:
                'The text is in the book, but a reader can only reach it by paging through from the chapter before.',
            },
          ),
        )
      }

      // Contents order must match reading order, or the list misleads.
      //
      // Deduplicated, because a chapter with sub-headings contributes several
      // entries that all resolve to the same file. Comparing the raw sequence
      // would report every book with a nested table of contents as misordered.
      const navOrder = unique(
        entries
          .map((entry) => resolveHref(nav.href, entry.attributes.href ?? ''))
          .filter((href) => chapterHrefs.includes(href)),
      )

      const spineOrder = chapterHrefs.filter((href) => navOrder.includes(href))

      if (navOrder.join('|') !== spineOrder.join('|')) {
        findings.push(
          finding(
            'structure.nav-order',
            'structure',
            'warning',
            'The table of contents is in a different order from the book.',
            {
              impact: 'reading',
              location: nav.href,
              remedy:
                'Chapter three appearing above chapter two in the contents is how readers conclude a book is broken.',
            },
          ),
        )
      }

      if (!findNav(nav.elements, 'landmarks')) {
        findings.push(
          finding(
            'structure.missing-landmarks',
            'structure',
            'info',
            'The book has no landmarks list.',
            {
              impact: 'reach',
              location: nav.href,
              remedy:
                'Landmarks tell a reading system where the cover and the body text start, which is how "go to beginning" works.',
            },
          ),
        )
      }

      const depth = navDepth(nav.elements, tocNav)

      if (depth > MAX_REASONABLE_DEPTH) {
        findings.push(
          finding(
            'structure.deep-nesting',
            'structure',
            'info',
            `The table of contents is ${depth} levels deep.`,
            {
              impact: 'advisory',
              location: nav.href,
              remedy:
                'Many reading systems only display three levels, so anything deeper is invisible on the device.',
            },
          ),
        )
      }

      // ---- The EPUB 2 fallback ------------------------------------------

      const ncx = documentByHref(subject, NCX_HREF)

      if (!ncx) {
        findings.push(
          finding(
            'structure.missing-ncx',
            'structure',
            'info',
            'The book has no EPUB 2 contents file.',
            {
              impact: 'reach',
              remedy:
                'Kindle conversion and older Kobo and Sony firmware read toc.ncx. A few kilobytes buys a lot of device compatibility.',
              fixable: true,
            },
          ),
        )
      } else {
        const navPoints = ncx.elements.filter((element) => element.localName === 'navpoint')
        const playOrders = navPoints
          .map((point) => Number(point.attributes.playorder))
          .filter((value) => Number.isFinite(value))

        const continuous = playOrders.every((value, index) => value === index + 1)

        if (playOrders.length > 0 && !continuous) {
          findings.push(
            finding(
              'structure.ncx-playorder',
              'structure',
              'warning',
              'The EPUB 2 contents are numbered out of sequence.',
              {
                impact: 'reach',
                location: NCX_HREF,
                remedy:
                  'playOrder must count 1, 2, 3 straight through, including nested entries. Devices that use it will navigate to the wrong place.',
              },
            ),
          )
        }

        if (navPoints.length > 0 && entries.length > 0 && navPoints.length !== entries.length) {
          findings.push(
            finding(
              'structure.ncx-mismatch',
              'structure',
              'warning',
              'The two tables of contents do not match.',
              {
                impact: 'reach',
                location: `${nav.href} vs ${NCX_HREF}`,
                remedy: `The EPUB 3 contents list ${entries.length} entries and the EPUB 2 fallback lists ${navPoints.length}. A reader sees a different book depending on their device.`,
              },
            ),
          )
        }
      }

      return { findings, checks: CHECK_COUNT }
    },
  }
}

/** First occurrence wins, so nested entries collapse onto their chapter. */
function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

/** The `<nav>` carrying a given `epub:type`. */
function findNav(elements: readonly XmlElement[], type: string): XmlElement | undefined {
  return elements.find(
    (element) => element.localName === 'nav' && element.attributes['epub:type'] === type,
  )
}

/** Anchors inside a nav element, using document order and depth. */
function navLinks(elements: readonly XmlElement[], nav: XmlElement): readonly XmlElement[] {
  return descendants(elements, nav).filter((element) => element.localName === 'a')
}

function navDepth(elements: readonly XmlElement[], nav: XmlElement | undefined): number {
  if (!nav) return 0

  const lists = descendants(elements, nav).filter((element) => element.localName === 'ol')
  if (lists.length === 0) return 0

  const shallowest = Math.min(...lists.map((list) => list.depth))
  const deepest = Math.max(...lists.map((list) => list.depth))

  return deepest - shallowest + 1
}

/**
 * Elements contained by another, from a flat list.
 *
 * The scanner emits elements in document order with their nesting depth, so
 * everything after an element and deeper than it is inside it. This is cheaper
 * than building a tree for the two places that need containment.
 */
function descendants(elements: readonly XmlElement[], parent: XmlElement): readonly XmlElement[] {
  const start = elements.indexOf(parent)
  if (start === -1) return []

  const result: XmlElement[] = []

  for (let i = start + 1; i < elements.length; i += 1) {
    const element = elements[i]
    if (!element || element.depth <= parent.depth) break
    result.push(element)
  }

  return result
}
