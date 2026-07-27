import { contentDocuments, resolveHref } from '../subject'
import {
  finding,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Image and resource inspection.
 *
 * WHY BYTES MATTER MORE THAN PIXELS
 * ---------------------------------
 * A 6-megapixel photograph dropped into a Word document arrives in the EPUB at
 * full size. On a laptop that is invisible. On an e-reader with 256 MB of RAM
 * it is the difference between a page that turns and a device that freezes for
 * four seconds, and on a metered connection it is a download the reader pays
 * for. Retailers also cap total file size — Amazon charges delivery by the
 * megabyte — so this is one of the few checks with a direct financial cost
 * attached.
 *
 * ALT TEXT IS NOT CHECKED HERE
 * ----------------------------
 * It belongs to accessibility, and lives in that inspector, so an author
 * reading the accessibility section sees every reason their book fails it
 * rather than half of them.
 */

/** Above this, a single image is worth flagging on its own. */
const LARGE_IMAGE_BYTES = 2 * 1024 * 1024

/** Formats every EPUB 3 reading system is required to support. */
const CORE_FORMATS = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'])

const CHECKS_PER_IMAGE = 3

export function createImageInspector(): Inspector {
  return {
    id: 'image-inspector',
    category: 'resources',
    title: 'Images',

    inspect(subject: InspectionSubject): InspectionResult {
      const findings: ValidationFinding[] = []

      const images = subject.epub.resources.filter((resource) =>
        resource.mediaType.startsWith('image/'),
      )

      const bytesByHref = new Map(
        subject.binaries.map((binary) => [binary.resource.href, binary.bytes.byteLength]),
      )

      // Which images the text actually points at.
      const referenced = new Set<string>()

      for (const document of contentDocuments(subject)) {
        for (const element of document.elements) {
          const source =
            element.localName === 'img'
              ? element.attributes.src
              : element.localName === 'image'
                ? element.attributes['xlink:href']
                : undefined

          if (source) referenced.add(resolveHref(document.href, source))
        }
      }

      for (const image of images) {
        const size = bytesByHref.get(image.href)

        if (size === undefined) {
          findings.push(
            finding(
              'resources.missing-bytes',
              'resources',
              'error',
              `${image.href} is listed in the book but contains no data.`,
              {
                impact: 'blocking',
                location: image.href,
                remedy: 'The page will show a broken-image icon. Convert the manuscript again.',
              },
            ),
          )

          continue
        }

        if (size === 0) {
          findings.push(
            finding('resources.empty-image', 'resources', 'error', `${image.href} is empty.`, {
              impact: 'blocking',
              location: image.href,
              remedy:
                'A zero-byte image renders as a broken icon. Check the picture opens correctly in Word.',
            }),
          )
        } else if (size > LARGE_IMAGE_BYTES) {
          findings.push(
            finding(
              'resources.large-image',
              'resources',
              'warning',
              `${image.href} is ${formatSize(size)}.`,
              {
                impact: 'reach',
                location: image.href,
                remedy:
                  'Resize it to about 1600 pixels on the long edge before inserting it. E-readers stall on images this large, and retailers charge delivery by the megabyte.',
              },
            ),
          )
        }

        if (!CORE_FORMATS.has(image.mediaType)) {
          findings.push(
            finding(
              'resources.unsupported-format',
              'resources',
              'warning',
              `${image.href} uses ${image.mediaType}, which not every e-reader can display.`,
              {
                impact: 'reach',
                location: image.href,
                remedy: 'Re-save it as JPEG or PNG. Those two work everywhere.',
              },
            ),
          )
        }

        const isCover = image.properties?.includes('cover-image') ?? false

        if (!referenced.has(image.href) && !isCover) {
          findings.push(
            finding(
              'resources.unreferenced-image',
              'resources',
              'info',
              `${image.href} is in the book but never shown.`,
              {
                impact: 'advisory',
                location: image.href,
                remedy: `It adds ${formatSize(size)} to every download without appearing on any page.`,
              },
            ),
          )
        }
      }

      // ---- The cover ----------------------------------------------------

      const cover = images.find((image) => image.properties?.includes('cover-image'))

      if (images.length > 0 && !cover) {
        findings.push(
          finding(
            'resources.no-cover-image',
            'resources',
            'warning',
            'No image is marked as the cover.',
            {
              impact: 'reach',
              remedy:
                'A reader’s library shows a blank tile, and retailers use this image for the store listing.',
            },
          ),
        )
      } else if (!cover && images.length === 0) {
        findings.push(
          finding(
            'resources.no-cover-at-all',
            'resources',
            'info',
            'The book has no cover image.',
            {
              impact: 'reach',
              remedy:
                'Chiify generates a typographic cover from the title, which is valid — but every store expects artwork.',
              fixable: true,
            },
          ),
        )
      }

      if (cover?.mediaType === 'image/svg+xml') {
        findings.push(
          finding('resources.svg-cover', 'resources', 'warning', 'The cover is an SVG.', {
            impact: 'reach',
            location: cover.href,
            remedy:
              'Several retailers reject SVG covers outright and build thumbnails only from JPEG or PNG.',
          }),
        )
      }

      return { findings, checks: Math.max(2, images.length * CHECKS_PER_IMAGE + 2) }
    },
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}
