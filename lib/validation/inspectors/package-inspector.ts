import { documentByHref } from '../subject'
import {
  finding,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Package and manifest inspection.
 *
 * THE CROSS-CHECK THAT RUNS BOTH WAYS
 * -----------------------------------
 * A manifest entry with no file behind it produces a book that fails to open on
 * strict reading systems and shows a broken page on lenient ones. A file with
 * no manifest entry is worse in a subtler way: it is invisible to the reading
 * system, so the chapter is inside the archive, takes up space in the download,
 * and can never be reached.
 *
 * Checking one direction only is the classic mistake — it is the direction that
 * catches the loud failure and misses the quiet one.
 */

const PACKAGE_DOCUMENT = 'content.opf'
const CHECK_COUNT = 6

export function createPackageInspector(): Inspector {
  return {
    id: 'package-inspector',
    category: 'structure',
    title: 'Package and manifest',

    inspect(subject: InspectionSubject): InspectionResult {
      const findings: ValidationFinding[] = []

      // ---- Manifest → files ---------------------------------------------

      const written = new Set<string>([
        ...subject.files.map((file) => file.resource.href),
        ...subject.binaries.map((binary) => binary.resource.href),
      ])

      for (const resource of subject.epub.resources) {
        if (!written.has(resource.href)) {
          findings.push(
            finding(
              'structure.manifest-missing-file',
              'structure',
              'error',
              `The book lists ${resource.href}, but that file is not in it.`,
              {
                impact: 'blocking',
                location: resource.href,
                remedy:
                  'A manifest entry with no file behind it makes the package invalid. Convert the manuscript again.',
              },
            ),
          )
        }
      }

      // ---- Files → manifest ---------------------------------------------

      for (const href of written) {
        // The package document cannot list itself.
        if (href === PACKAGE_DOCUMENT) continue

        if (!subject.manifestHrefs.has(href)) {
          findings.push(
            finding(
              'structure.file-not-in-manifest',
              'structure',
              'error',
              `${href} is inside the book but is not listed.`,
              {
                impact: 'blocking',
                location: href,
                remedy:
                  'Unlisted files are invisible to a reading system: the content is downloaded and can never be read.',
              },
            ),
          )
        }
      }

      // ---- Identity ------------------------------------------------------

      const ids = new Map<string, number>()

      for (const resource of subject.epub.resources) {
        ids.set(resource.id, (ids.get(resource.id) ?? 0) + 1)
      }

      for (const [id, count] of ids) {
        if (count > 1) {
          findings.push(
            finding(
              'structure.duplicate-id',
              'structure',
              'error',
              `Two files share the identifier "${id}".`,
              {
                impact: 'blocking',
                location: id,
                remedy:
                  'Manifest ids must be unique. The spine cannot tell which file it means, so one of them is unreachable.',
              },
            ),
          )
        }
      }

      const hrefs = new Map<string, number>()

      for (const resource of subject.epub.resources) {
        const key = resource.href.toLowerCase()
        hrefs.set(key, (hrefs.get(key) ?? 0) + 1)
      }

      for (const [href, count] of hrefs) {
        if (count > 1) {
          findings.push(
            finding(
              'structure.colliding-filenames',
              'structure',
              'error',
              `Two files are named "${href}".`,
              {
                impact: 'blocking',
                location: href,
                remedy:
                  'Some reading systems unpack to a case-insensitive filesystem, where names differing only in case overwrite each other.',
              },
            ),
          )
        }
      }

      // ---- Version --------------------------------------------------------

      const opf = documentByHref(subject, PACKAGE_DOCUMENT)
      const version = opf?.elements.find((element) => element.localName === 'package')?.attributes
        .version

      if (opf && version !== '3.0') {
        findings.push(
          finding(
            'structure.unexpected-version',
            'structure',
            'warning',
            `The package declares EPUB ${version ?? 'an unknown version'}.`,
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy: 'Chiify generates EPUB 3. A different version here means the two disagree.',
            },
          ),
        )
      }

      return { findings, checks: CHECK_COUNT + subject.epub.resources.length }
    },
  }
}
