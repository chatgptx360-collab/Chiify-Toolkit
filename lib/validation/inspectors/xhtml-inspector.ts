import { contentDocuments, fragmentOf, isRemote, resolveHref } from '../subject'
import {
  finding,
  type InspectedDocument,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Markup inspection.
 *
 * WHAT THIS CATCHES THAT NOTHING ELSE DOES
 * ----------------------------------------
 * Broken references. A book whose chapters are all present and whose contents
 * list is correct can still contain a footnote link that goes nowhere, an image
 * whose `src` is off by one directory, or a stylesheet link that does not
 * resolve — and none of those stop the file from opening. They surface as a
 * tap that does nothing, a broken-image icon, or a book that renders in Times
 * New Roman on one device and correctly on another.
 *
 * Every reference in every document is therefore resolved: relative paths
 * against the manifest, fragments against the ids actually present in the
 * target document.
 *
 * REMOTE RESOURCES ARE A WARNING, NOT AN ERROR
 * --------------------------------------------
 * EPUB 3 permits linking to the network. Books are read on aeroplanes, on
 * e-readers that are offline for weeks, and by people who paid for a file
 * rather than a subscription. A remote image is a hole in the page for all of
 * them, so it is reported — but the book is valid, so it is not an error.
 */

/** Assertions made per content document, used to scale the score honestly. */
const PER_DOCUMENT_CHECKS = 6

const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

/** Presentational HTML that has no place in a reflowable book. */
const OBSOLETE_ELEMENTS = new Set(['font', 'center', 'marquee', 'blink', 'big', 'strike', 'tt'])

export function createXhtmlInspector(): Inspector {
  return {
    id: 'xhtml-inspector',
    category: 'markup',
    title: 'Markup and links',

    inspect(subject: InspectionSubject): InspectionResult {
      const findings: ValidationFinding[] = []
      const documents = contentDocuments(subject)

      // Every XML document in the package, not only content documents: a
      // malformed package document or NCX breaks the book just as thoroughly.
      for (const document of subject.documents) {
        for (const error of document.errors) {
          findings.push(
            finding(
              'markup.not-well-formed',
              'markup',
              'error',
              `${document.href} is not valid XML: ${error.message}`,
              {
                impact: 'blocking',
                location: `${document.href}:${error.line}`,
                remedy:
                  'EPUB content must be well-formed XML, not merely valid HTML. A reading system refuses the whole book, not just this page.',
              },
            ),
          )
        }
      }

      const idsByHref = new Map(documents.map((document) => [document.href, document.ids]))

      for (const document of documents) {
        findings.push(...inspectDocument(document, subject, idsByHref))
      }

      if (documents.length === 0) {
        findings.push(
          finding('markup.no-content-documents', 'markup', 'error', 'The book has no pages.', {
            impact: 'blocking',
            remedy: 'Nothing was generated to read. Convert the manuscript again.',
          }),
        )
      }

      return {
        findings,
        checks: Math.max(1, documents.length * PER_DOCUMENT_CHECKS + subject.documents.length),
      }
    },
  }
}

function inspectDocument(
  document: InspectedDocument,
  subject: InspectionSubject,
  idsByHref: ReadonlyMap<string, ReadonlySet<string>>,
): readonly ValidationFinding[] {
  const findings: ValidationFinding[] = []

  const html = document.elements.find((element) => element.localName === 'html')

  if (!html) {
    findings.push(
      finding('markup.missing-html-root', 'markup', 'error', `${document.href} has no html root.`, {
        impact: 'blocking',
        location: document.href,
        remedy: 'Convert the manuscript again.',
      }),
    )

    return findings
  }

  if (html.attributes.xmlns !== XHTML_NAMESPACE) {
    findings.push(
      finding(
        'markup.missing-namespace',
        'markup',
        'error',
        `${document.href} does not declare the XHTML namespace.`,
        {
          impact: 'blocking',
          location: document.href,
          remedy:
            'Without the namespace a reading system treats the file as unknown XML and shows the markup as text.',
        },
      ),
    )
  }

  const title = document.elements.find((element) => element.localName === 'title')

  if (!title || title.text.trim().length === 0) {
    findings.push(
      finding('markup.missing-title', 'markup', 'warning', `${document.href} has no page title.`, {
        impact: 'reach',
        location: document.href,
        remedy:
          'Some reading systems show this in the header or the position indicator, and validators require it.',
      }),
    )
  }

  const body = document.elements.find((element) => element.localName === 'body')

  // A page with no words is not necessarily empty. A cover is an image and
  // nothing else, and reporting the cover as a blank page — on every book that
  // has one — would train authors to ignore this check entirely.
  const hasVisual = document.elements.some(
    (element) => element.localName === 'img' || element.localName === 'svg',
  )

  if (body && body.text.trim().length === 0 && !hasVisual) {
    findings.push(
      finding('markup.empty-page', 'markup', 'warning', `${document.href} has no text.`, {
        impact: 'reading',
        location: document.href,
        remedy: 'It will appear as a blank page in the finished book.',
      }),
    )
  }

  const stylesheet = document.elements.find(
    (element) => element.localName === 'link' && element.attributes.rel === 'stylesheet',
  )

  if (!stylesheet) {
    findings.push(
      finding(
        'markup.no-stylesheet',
        'markup',
        'warning',
        `${document.href} does not link the book stylesheet.`,
        {
          impact: 'reading',
          location: document.href,
          remedy:
            'This page will use the reading system defaults, so it will look different from the rest of the book.',
        },
      ),
    )
  }

  for (const element of document.elements) {
    if (OBSOLETE_ELEMENTS.has(element.localName)) {
      findings.push(
        finding(
          'markup.obsolete-element',
          'markup',
          'info',
          `<${element.localName}> is obsolete.`,
          {
            impact: 'advisory',
            location: `${document.href}:${element.line}`,
            remedy:
              'Presentational elements are ignored by some reading systems and override the reader’s own settings on others.',
          },
        ),
      )
    }

    if (element.localName === 'script') {
      findings.push(
        finding('markup.scripted-content', 'markup', 'warning', 'The book contains a script.', {
          impact: 'reach',
          location: `${document.href}:${element.line}`,
          remedy:
            'Most e-readers refuse to run scripts, and a document containing one must declare the scripted property in the manifest.',
        }),
      )
    }

    const reference = referenceOf(element)
    if (!reference) continue

    if (isRemote(reference.value)) {
      // A mailto: or tel: link is a link, not a resource the book depends on.
      const isResource = reference.kind === 'resource'

      findings.push(
        finding(
          isResource ? 'markup.remote-resource' : 'markup.remote-link',
          'markup',
          isResource ? 'warning' : 'info',
          isResource
            ? 'The book loads a file from the internet.'
            : 'The book links to the internet.',
          {
            impact: isResource ? 'reading' : 'advisory',
            location: `${document.href}:${element.line}`,
            remedy: isResource
              ? 'Readers offline — on a plane, or on an e-reader — see a hole in the page. Embed the file instead.'
              : 'Fine in itself; just remember many e-readers have no browser to open it in.',
          },
        ),
      )

      continue
    }

    const target = resolveHref(document.href, reference.value)
    const fragment = fragmentOf(reference.value)

    if (reference.value.startsWith('#')) {
      if (fragment && !document.ids.has(fragment)) {
        findings.push(
          finding(
            'markup.broken-fragment',
            'markup',
            'error',
            `A link points at "#${fragment}", which is not on this page.`,
            {
              impact: 'reading',
              location: `${document.href}:${element.line}`,
              remedy:
                'This is usually a footnote or a cross-reference. Tapping it does nothing in most readers.',
            },
          ),
        )
      }

      continue
    }

    if (!subject.manifestHrefs.has(target)) {
      findings.push(
        finding(
          reference.kind === 'resource' ? 'markup.missing-resource' : 'markup.broken-link',
          'markup',
          'error',
          reference.kind === 'resource'
            ? `A file this page needs is missing: ${target}`
            : `A link points at a page that is not in the book: ${target}`,
          {
            impact: 'blocking',
            location: `${document.href}:${element.line}`,
            remedy:
              'Every reference must resolve to a file listed in the manifest, or the reading system reports a broken book.',
          },
        ),
      )

      continue
    }

    if (fragment) {
      const ids = idsByHref.get(target)
      if (ids && !ids.has(fragment)) {
        findings.push(
          finding(
            'markup.broken-fragment',
            'markup',
            'warning',
            `A link points at "#${fragment}" in ${target}, which does not exist there.`,
            {
              impact: 'reading',
              location: `${document.href}:${element.line}`,
              remedy: 'The reader will land at the top of that page instead of the intended place.',
            },
          ),
        )
      }
    }
  }

  return findings
}

interface Reference {
  readonly value: string
  /** A resource is loaded to render the page; a link is followed by choice. */
  readonly kind: 'resource' | 'link'
}

function referenceOf(element: {
  readonly localName: string
  readonly attributes: Readonly<Record<string, string>>
}): Reference | undefined {
  const { localName, attributes } = element

  if (localName === 'a' && attributes.href) return { value: attributes.href, kind: 'link' }
  if (localName === 'img' && attributes.src) return { value: attributes.src, kind: 'resource' }
  if (localName === 'link' && attributes.href) return { value: attributes.href, kind: 'resource' }
  if (localName === 'image' && attributes['xlink:href']) {
    return { value: attributes['xlink:href'], kind: 'resource' }
  }

  return undefined
}
