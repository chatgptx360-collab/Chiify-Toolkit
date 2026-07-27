import { contentDocuments, documentByHref } from '../subject'
import {
  finding,
  type InspectedDocument,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Accessibility inspection.
 *
 * WHY THIS IS NOT OPTIONAL ANY MORE
 * ---------------------------------
 * The EPUB specification treats accessibility metadata as optional. The
 * European Accessibility Act, in force since June 2025, does not: an eBook sold
 * into the EU has to carry it, and the major retailers now enforce that at
 * ingestion. So a book that fails this section is not merely less considerate,
 * it is unsellable in a large market.
 *
 * The underlying reason is older than the regulation. A blind reader's screen
 * reader announces images by their alt text, follows heading levels to build a
 * navigable outline, and picks a pronunciation from the declared language. Each
 * check below corresponds to one of those mechanisms failing.
 *
 * WHAT IS DELIBERATELY NOT CHECKED
 * --------------------------------
 * Whether alt text is *good*. "image1.png" satisfies every automated check and
 * helps nobody. Automated accessibility checking establishes the floor; it
 * cannot certify a book as accessible, and this tool says so where the author
 * will see it.
 */

const PACKAGE_DOCUMENT = 'content.opf'
const CHECKS_PER_DOCUMENT = 4
const FIXED_CHECKS = 5

/** Link text that tells a screen-reader user nothing out of context. */
const OPAQUE_LINK_TEXT = new Set(['click here', 'here', 'read more', 'more', 'link', 'this'])

export function createAccessibilityChecker(): Inspector {
  return {
    id: 'accessibility-checker',
    category: 'accessibility',
    title: 'Accessibility',

    inspect(subject: InspectionSubject): InspectionResult {
      const findings: ValidationFinding[] = []
      const documents = contentDocuments(subject)

      for (const document of documents) {
        findings.push(...inspectDocument(document))
      }

      findings.push(...inspectMetadata(subject))

      return {
        findings,
        checks: documents.length * CHECKS_PER_DOCUMENT + FIXED_CHECKS,
      }
    },
  }
}

function inspectDocument(document: InspectedDocument): readonly ValidationFinding[] {
  const findings: ValidationFinding[] = []

  // ---- Language --------------------------------------------------------

  const html = document.elements.find((element) => element.localName === 'html')
  const language = html?.attributes['xml:lang'] ?? html?.attributes.lang

  if (!language || language.trim().length === 0) {
    findings.push(
      finding(
        'accessibility.missing-language',
        'accessibility',
        'error',
        `${document.href} does not declare its language.`,
        {
          impact: 'reach',
          location: document.href,
          remedy:
            'A screen reader guesses the voice, so an English book can be read aloud with French pronunciation. It is also required by EPUB 3.',
          fixable: true,
        },
      ),
    )
  }

  // ---- Images ----------------------------------------------------------

  const images = document.elements.filter((element) => element.localName === 'img')
  const undescribed = images.filter((image) => (image.attributes.alt ?? '').trim().length === 0)

  if (undescribed.length > 0) {
    const decorative = images.filter((image) => image.attributes.alt === '')

    findings.push(
      finding(
        'accessibility.missing-alt-text',
        'accessibility',
        'warning',
        `${undescribed.length} ${undescribed.length === 1 ? 'image has' : 'images have'} no description in ${document.href}.`,
        {
          impact: 'reach',
          location: document.href,
          remedy:
            decorative.length === undescribed.length
              ? 'An empty alt attribute marks an image as decorative, which is correct only if it carries no meaning.'
              : 'Add alternative text in Word (right-click the image, Edit Alt Text). A screen reader announces nothing at all for an image without it.',
        },
      ),
    )
  }

  // ---- Heading structure ------------------------------------------------

  const headings = document.elements.filter((element) => /^h[1-6]$/.test(element.localName))

  let previous = 0

  for (const heading of headings) {
    const level = Number(heading.localName.slice(1))

    if (heading.text.trim().length === 0) {
      findings.push(
        finding(
          'accessibility.empty-heading',
          'accessibility',
          'warning',
          'A heading has no text.',
          {
            impact: 'reach',
            location: `${document.href}:${heading.line}`,
            remedy:
              'Screen readers list headings as a navigation menu. An empty one appears as a blank entry.',
          },
        ),
      )
    }

    if (previous > 0 && level > previous + 1) {
      findings.push(
        finding(
          'accessibility.skipped-heading-level',
          'accessibility',
          'warning',
          `A heading jumps from level ${previous} to level ${level}.`,
          {
            impact: 'reach',
            location: `${document.href}:${heading.line}`,
            remedy:
              'Heading levels are an outline, not a font size. Skipping one tells a screen reader a section is missing.',
          },
        ),
      )
    }

    previous = level
  }

  // ---- Tables ----------------------------------------------------------

  const tables = document.elements.filter((element) => element.localName === 'table')

  if (tables.length > 0) {
    const headerCells = document.elements.filter((element) => element.localName === 'th')

    if (headerCells.length === 0) {
      findings.push(
        finding(
          'accessibility.table-without-headers',
          'accessibility',
          'warning',
          `A table in ${document.href} has no header cells.`,
          {
            impact: 'reach',
            location: document.href,
            remedy:
              'Without headers a screen reader reads the cells as a flat run of numbers, with no way to know which column each belongs to. Mark the first row as a header row in Word.',
          },
        ),
      )
    } else if (headerCells.some((cell) => !cell.attributes.scope)) {
      findings.push(
        finding(
          'accessibility.header-without-scope',
          'accessibility',
          'info',
          'A table header does not say which cells it governs.',
          {
            impact: 'advisory',
            location: document.href,
            remedy:
              'A scope attribute tells assistive technology whether it heads a row or a column.',
          },
        ),
      )
    }
  }

  // ---- Link text --------------------------------------------------------

  for (const link of document.elements.filter((element) => element.localName === 'a')) {
    const text = link.text.trim().toLowerCase()

    if (text.length > 0 && OPAQUE_LINK_TEXT.has(text)) {
      findings.push(
        finding(
          'accessibility.opaque-link-text',
          'accessibility',
          'info',
          `A link reads only "${link.text.trim()}".`,
          {
            impact: 'advisory',
            location: `${document.href}:${link.line}`,
            remedy:
              'Screen reader users often navigate by listing every link. Out of context, "click here" identifies nothing.',
          },
        ),
      )
    }
  }

  return findings
}

/**
 * Accessibility metadata in the package document.
 *
 * These fields are what a retailer's ingestion pipeline reads. They are also
 * the fields most likely to be *wrong* rather than missing, because a generator
 * can assert anything — which is why the engine computes them from the content
 * and why claiming coverage that does not exist is treated as worse than
 * claiming nothing.
 */
function inspectMetadata(subject: InspectionSubject): readonly ValidationFinding[] {
  const findings: ValidationFinding[] = []
  const opf = documentByHref(subject, PACKAGE_DOCUMENT)

  if (!opf) return findings

  const properties = new Set(
    opf.elements
      .filter((element) => element.localName === 'meta')
      .map((element) => element.attributes.property)
      .filter((property): property is string => Boolean(property)),
  )

  const required: readonly { property: string; label: string; why: string }[] = [
    {
      property: 'schema:accessMode',
      label: 'access modes',
      why: 'States whether the book can be read by sight alone, by hearing, or both.',
    },
    {
      property: 'schema:accessModeSufficient',
      label: 'sufficient access modes',
      why: 'States that one mode on its own is enough — the field that tells a reader the book works for them.',
    },
    {
      property: 'schema:accessibilityFeature',
      label: 'accessibility features',
      why: 'Lists what the book provides: a table of contents, described images, structural navigation.',
    },
    {
      property: 'schema:accessibilityHazard',
      label: 'hazards',
      why: 'Declares flashing or motion. "none" is a valid and useful answer.',
    },
    {
      property: 'schema:accessibilitySummary',
      label: 'accessibility summary',
      why: 'A sentence in plain language. It is the only one of these a reader ever sees.',
    },
  ]

  for (const entry of required) {
    if (!properties.has(entry.property)) {
      findings.push(
        finding(
          `accessibility.missing-${entry.property.replace('schema:', '')}`,
          'accessibility',
          'warning',
          `The book does not declare its ${entry.label}.`,
          {
            impact: 'reach',
            location: PACKAGE_DOCUMENT,
            remedy: `${entry.why} Retailers selling into the EU now require this field.`,
          },
        ),
      )
    }
  }

  const features = subject.epub.accessibility.accessibilityFeatures

  if (!features.includes('alternativeText') && subject.binaries.length > 0) {
    findings.push(
      finding(
        'accessibility.no-alt-text-claim',
        'accessibility',
        'info',
        'The book does not claim that its images are described.',
        {
          impact: 'reach',
          remedy:
            'Chiify only makes that claim when every image has alternative text. Describe the remaining images and it will be added automatically.',
        },
      ),
    )
  }

  return findings
}
