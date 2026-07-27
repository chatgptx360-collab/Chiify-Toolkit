import { contentDocuments } from '../subject'
import {
  finding,
  type CompatibilityAssessment,
  type CompatibilityTarget,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Device and store compatibility.
 *
 * WHY THIS IS SEPARATE FROM VALIDITY
 * ----------------------------------
 * A perfectly valid EPUB 3 can still be refused by Amazon, render without a
 * cover on an older Kobo, and lose its footnotes on a first-generation Nook.
 * "Valid" is a property of the file; "will this reach my readers" is a property
 * of the file *and* the place it is going, and authors care about the second
 * one. Reporting only specification conformance would tell them the book is
 * fine right up until the store rejects it.
 *
 * WHY THE RULES ARE STATED AS BEHAVIOUR, NOT VERSIONS
 * ---------------------------------------------------
 * Retailer requirements change without notice and firmware fleets are decades
 * wide. Each rule below is written as an observable consequence — "the library
 * tile is blank", "the contents list is empty" — so it stays true when a
 * specific requirement moves, and so the author can judge whether they care.
 *
 * Nothing here is a substitute for submitting the book. It is the set of
 * problems worth knowing about before you do.
 */

interface TargetRule {
  readonly id: string
  /** `rejected` means the store or device refuses; `degraded` means it works badly. */
  readonly status: 'rejected' | 'degraded'
  readonly note: string
  applies(subject: InspectionSubject, facts: BookFacts): boolean
}

interface TargetDefinition {
  readonly id: string
  readonly name: string
  readonly vendor: string
  readonly rules: readonly TargetRule[]
}

/** Facts derived once, because five targets ask the same questions. */
interface BookFacts {
  readonly hasCoverImage: boolean
  readonly hasNcx: boolean
  readonly isbn: string | undefined
  readonly hasDescription: boolean
  readonly hasPublisher: boolean
  readonly hasRemoteResource: boolean
  readonly hasScript: boolean
  readonly nonCoreImages: number
  readonly svgCover: boolean
  readonly nonAsciiPaths: number
  readonly hasAccessibilityMetadata: boolean
  readonly byteSize: number
}

/** Amazon charges delivery per megabyte; above this the author is paying for it. */
const DELIVERY_COST_THRESHOLD = 10 * 1024 * 1024

const TARGETS: readonly TargetDefinition[] = [
  {
    id: 'kindle',
    name: 'Kindle',
    vendor: 'Amazon',
    rules: [
      {
        id: 'cover',
        status: 'rejected',
        note: 'KDP requires a cover image. A book without one cannot complete submission.',
        applies: (_subject, facts) => !facts.hasCoverImage,
      },
      {
        id: 'ncx',
        status: 'degraded',
        note: 'Kindle conversion reads toc.ncx. Without it the converted book may have no contents list.',
        applies: (_subject, facts) => !facts.hasNcx,
      },
      {
        id: 'svg-cover',
        status: 'rejected',
        note: 'SVG covers are not accepted. The cover must be JPEG or PNG.',
        applies: (_subject, facts) => facts.svgCover,
      },
      {
        id: 'size',
        status: 'degraded',
        note: 'Delivery is charged by the megabyte, so a large book reduces the royalty on every sale.',
        applies: (_subject, facts) => facts.byteSize > DELIVERY_COST_THRESHOLD,
      },
      {
        id: 'script',
        status: 'rejected',
        note: 'Scripted content is stripped or rejected.',
        applies: (_subject, facts) => facts.hasScript,
      },
    ],
  },
  {
    id: 'apple-books',
    name: 'Apple Books',
    vendor: 'Apple',
    rules: [
      {
        id: 'isbn',
        status: 'rejected',
        note: 'Apple requires an ISBN for paid titles in most territories.',
        applies: (_subject, facts) => !facts.isbn,
      },
      {
        id: 'cover',
        status: 'degraded',
        note: 'Without a cover image the book shows as a blank tile in the library.',
        applies: (_subject, facts) => !facts.hasCoverImage,
      },
      {
        id: 'accessibility',
        status: 'rejected',
        note: 'Accessibility metadata is required for titles sold into the EU.',
        applies: (_subject, facts) => !facts.hasAccessibilityMetadata,
      },
      {
        id: 'remote',
        status: 'rejected',
        note: 'Content loaded from the internet is not permitted.',
        applies: (_subject, facts) => facts.hasRemoteResource,
      },
    ],
  },
  {
    id: 'kobo',
    name: 'Kobo',
    vendor: 'Rakuten',
    rules: [
      {
        id: 'ncx',
        status: 'degraded',
        note: 'Older firmware falls back to toc.ncx and shows no contents without it.',
        applies: (_subject, facts) => !facts.hasNcx,
      },
      {
        id: 'ascii',
        status: 'degraded',
        note: 'Older firmware fails to decode non-ASCII filenames, so those images do not load.',
        applies: (_subject, facts) => facts.nonAsciiPaths > 0,
      },
      {
        id: 'formats',
        status: 'degraded',
        note: 'Images outside JPEG, PNG and GIF may not render.',
        applies: (_subject, facts) => facts.nonCoreImages > 0,
      },
    ],
  },
  {
    id: 'google-play',
    name: 'Google Play Books',
    vendor: 'Google',
    rules: [
      {
        id: 'isbn',
        status: 'rejected',
        note: 'An ISBN is required to list a title.',
        applies: (_subject, facts) => !facts.isbn,
      },
      {
        id: 'description',
        status: 'rejected',
        note: 'A description is required at submission.',
        applies: (_subject, facts) => !facts.hasDescription,
      },
      {
        id: 'publisher',
        status: 'degraded',
        note: 'The publisher field is shown on the store page and looks unfinished when empty.',
        applies: (_subject, facts) => !facts.hasPublisher,
      },
    ],
  },
  {
    id: 'epub3-readers',
    name: 'Calibre, Thorium and other EPUB 3 readers',
    vendor: 'Open source',
    rules: [
      {
        id: 'remote',
        status: 'degraded',
        note: 'Remote content leaves gaps in the page when the reader is offline.',
        applies: (_subject, facts) => facts.hasRemoteResource,
      },
    ],
  },
]

export interface CompatibilityChecker extends Inspector {
  assess(subject: InspectionSubject): CompatibilityAssessment
}

export function createCompatibilityChecker(): CompatibilityChecker {
  const assess = (subject: InspectionSubject): CompatibilityAssessment => {
    const facts = deriveFacts(subject)

    const targets = TARGETS.map((target): CompatibilityTarget => {
      const failed = target.rules.filter((rule) => rule.applies(subject, facts))
      const rejected = failed.some((rule) => rule.status === 'rejected')

      return {
        id: target.id,
        name: target.name,
        vendor: target.vendor,
        status: rejected ? 'rejected' : failed.length > 0 ? 'degraded' : 'supported',
        // Worst first, so the note that costs a sale is not below the one that
        // costs a thumbnail.
        notes: [
          ...failed.filter((rule) => rule.status === 'rejected').map((rule) => rule.note),
          ...failed.filter((rule) => rule.status === 'degraded').map((rule) => rule.note),
        ],
      }
    })

    return {
      targets,
      supported: targets.filter((target) => target.status === 'supported').length,
      total: targets.length,
    }
  }

  return {
    id: 'compatibility-checker',
    category: 'compatibility',
    title: 'Devices and stores',
    assess,

    inspect(subject: InspectionSubject): InspectionResult {
      const assessment = assess(subject)
      const findings: ValidationFinding[] = []

      for (const target of assessment.targets) {
        if (target.status === 'supported') continue

        for (const note of target.notes) {
          findings.push(
            finding(
              target.status === 'rejected' ? 'compatibility.rejected' : 'compatibility.degraded',
              'compatibility',
              target.status === 'rejected' ? 'warning' : 'info',
              `${target.name}: ${note}`,
              {
                impact: 'reach',
                location: target.name,
                remedy:
                  target.status === 'rejected'
                    ? 'The book is valid, but this store will not accept it as it stands.'
                    : 'The book will work, but not as well as it could on this device.',
              },
            ),
          )
        }
      }

      return {
        findings,
        checks: TARGETS.reduce((total, target) => total + target.rules.length, 0),
      }
    },
  }
}

function deriveFacts(subject: InspectionSubject): BookFacts {
  const images = subject.epub.resources.filter((resource) =>
    resource.mediaType.startsWith('image/'),
  )

  const cover = images.find((image) => image.properties?.includes('cover-image'))

  const identifier = subject.epub.metadata.identifier
  const identifierValue = typeof identifier === 'string' ? identifier : ''
  const isbn = identifierValue.startsWith('urn:isbn:') ? identifierValue.slice(9) : undefined

  let hasRemoteResource = false
  let hasScript = false

  for (const document of contentDocuments(subject)) {
    for (const element of document.elements) {
      if (element.localName === 'script') hasScript = true

      const reference =
        element.localName === 'img'
          ? element.attributes.src
          : element.localName === 'link'
            ? element.attributes.href
            : undefined

      if (reference && /^(?:https?:)?\/\//i.test(reference)) hasRemoteResource = true
    }
  }

  return {
    hasCoverImage: Boolean(cover),
    hasNcx: subject.epub.resources.some(
      (resource) => resource.mediaType === 'application/x-dtbncx+xml',
    ),
    isbn,
    hasDescription: Boolean(subject.metadata.description?.trim()),
    hasPublisher: Boolean(subject.metadata.publisher?.trim()),
    hasRemoteResource,
    hasScript,
    nonCoreImages: images.filter(
      (image) =>
        !['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'].includes(image.mediaType),
    ).length,
    svgCover: cover?.mediaType === 'image/svg+xml',
    nonAsciiPaths: subject.epub.resources.filter((resource) => /[^ -~]/.test(resource.href)).length,
    hasAccessibilityMetadata: subject.epub.accessibility.accessModes.length > 0,
    byteSize: subject.byteSize,
  }
}
