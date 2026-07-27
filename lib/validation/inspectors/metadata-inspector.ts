import {
  finding,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'
import { documentByHref } from '../subject'
import type { XmlElement } from '../xml-scan'

/**
 * Metadata inspection.
 *
 * TWO DIFFERENT QUESTIONS, DELIBERATELY NOT CONFLATED
 * ---------------------------------------------------
 * "Is this a valid EPUB?" and "will a retailer accept this book?" have
 * different answers, and an author needs both. EPUB 3 requires exactly four
 * things — identifier, title, language and a `dcterms:modified` meta — and a
 * package missing any of them is invalid. Everything else here is graded on
 * reach: a book with no ISBN, no publisher and no description opens perfectly
 * on every device and will be refused by every store.
 *
 * So the required four are errors, and the commercial fields are warnings and
 * notes carrying `impact: 'reach'`. Marking a missing ISBN as an error would
 * teach authors to ignore errors.
 *
 * IT READS THE PACKAGE DOCUMENT, NOT THE FORM
 * -------------------------------------------
 * Checks run against the generated `content.opf` rather than against the
 * project's metadata object. Those two can disagree — that is exactly the class
 * of bug a validator exists to catch — and only one of them is what ships
 * inside the book.
 */

const PACKAGE_DOCUMENT = 'content.opf'

/** Language tags are matched loosely: `en`, `en-GB`, `zh-Hans-CN`. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

/** EPUB 3 requires second precision and a literal `Z`. */
const MODIFIED_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

const DESCRIPTION_MINIMUM = 100

export function createMetadataInspector(): Inspector {
  return {
    id: 'metadata-inspector',
    category: 'metadata',
    title: 'Metadata',

    inspect(subject: InspectionSubject): InspectionResult {
      const opf = documentByHref(subject, PACKAGE_DOCUMENT)

      if (!opf) {
        return {
          checks: 1,
          findings: [
            finding(
              'metadata.no-package-document',
              'metadata',
              'error',
              'The book has no package document.',
              {
                impact: 'blocking',
                remedy:
                  'Every EPUB needs a content.opf file. Convert the manuscript again — if this persists, the build did not finish.',
              },
            ),
          ],
        }
      }

      const findings: ValidationFinding[] = []
      const elements = opf.elements
      const dc = (name: string): readonly XmlElement[] =>
        elements.filter((element) => element.localName === name && element.depth <= 3)

      // ---- The four EPUB 3 requirements ---------------------------------

      const identifiers = dc('identifier')
      const identifier = identifiers[0]?.text.trim() ?? ''

      if (identifier.length === 0) {
        findings.push(
          finding(
            'metadata.missing-identifier',
            'metadata',
            'error',
            'The book has no unique identifier.',
            {
              impact: 'blocking',
              location: PACKAGE_DOCUMENT,
              remedy: 'Add an ISBN in the book metadata, or let Chiify generate a UUID for you.',
              fixable: true,
            },
          ),
        )
      }

      const packageElement = elements.find((element) => element.localName === 'package')
      const uniqueId = packageElement?.attributes['unique-identifier']

      if (uniqueId && !identifiers.some((element) => element.attributes.id === uniqueId)) {
        findings.push(
          finding(
            'metadata.identifier-not-referenced',
            'metadata',
            'error',
            'The package points at an identifier that does not exist.',
            {
              impact: 'blocking',
              location: PACKAGE_DOCUMENT,
              remedy:
                'The unique-identifier attribute must name an identifier in the metadata. Convert the manuscript again.',
            },
          ),
        )
      }

      const title = dc('title')[0]?.text.trim() ?? ''

      if (title.length === 0) {
        findings.push(
          finding('metadata.missing-title', 'metadata', 'error', 'The book has no title.', {
            impact: 'blocking',
            location: PACKAGE_DOCUMENT,
            remedy: 'Add a title in the book metadata.',
            fixable: true,
          }),
        )
      } else if (title.toLowerCase() === 'untitled') {
        findings.push(
          finding(
            'metadata.placeholder-title',
            'metadata',
            'warning',
            'The book is titled "Untitled".',
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy:
                'This is the placeholder Chiify uses when no title was given. Every store will reject it.',
              fixable: true,
            },
          ),
        )
      } else if (title !== subject.metadata.title) {
        // The trimmed title reached the package but the project still holds
        // the untrimmed one, which will resurface on the next build.
        findings.push(
          finding(
            'metadata.title-whitespace',
            'metadata',
            'info',
            'The title has stray spaces around it.',
            {
              impact: 'advisory',
              remedy: 'Some stores display the title exactly as given, spaces included.',
              fixable: true,
            },
          ),
        )
      }

      const language = dc('language')[0]?.text.trim() ?? ''

      if (language.length === 0) {
        findings.push(
          finding(
            'metadata.missing-language',
            'metadata',
            'error',
            'The book does not declare a language.',
            {
              impact: 'blocking',
              location: PACKAGE_DOCUMENT,
              remedy:
                'Set the language in the book metadata. Screen readers use it to choose a voice, and reading systems use it to hyphenate.',
              fixable: true,
            },
          ),
        )
      } else if (subject.metadata.language.trim().length === 0) {
        // The generator substitutes a default rather than refusing to convert,
        // so the *package* is valid. The author still never said what language
        // their book is in, and a French novel declared as English is read
        // aloud in the wrong accent and hyphenated in the wrong places.
        findings.push(
          finding(
            'metadata.assumed-language',
            'metadata',
            'warning',
            `No language was set, so the book claims to be in ${language}.`,
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy:
                'Set the language in the book metadata. Screen readers choose a voice from it and reading systems use it to hyphenate.',
              fixable: true,
            },
          ),
        )
      } else if (!LANGUAGE_TAG.test(language)) {
        findings.push(
          finding(
            'metadata.language-format',
            'metadata',
            'warning',
            `"${language}" is not a valid language tag.`,
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy: 'Use a BCP-47 tag such as en, en-GB or pt-BR.',
              fixable: true,
            },
          ),
        )
      }

      const modified = elements.find(
        (element) =>
          element.localName === 'meta' && element.attributes.property === 'dcterms:modified',
      )

      if (!modified) {
        findings.push(
          finding(
            'metadata.missing-modified',
            'metadata',
            'error',
            'The book has no modification date.',
            {
              impact: 'blocking',
              location: PACKAGE_DOCUMENT,
              remedy:
                'EPUB 3 requires a dcterms:modified value. This is generated automatically — convert the manuscript again.',
            },
          ),
        )
      } else if (!MODIFIED_FORMAT.test(modified.text.trim())) {
        findings.push(
          finding(
            'metadata.modified-format',
            'metadata',
            'error',
            'The modification date is not in the required format.',
            {
              impact: 'blocking',
              location: PACKAGE_DOCUMENT,
              remedy: 'It must look like 2026-01-31T09:15:00Z — UTC, to the second.',
            },
          ),
        )
      }

      // ---- Commercial readiness -----------------------------------------

      const creators = dc('creator').filter((element) => element.text.trim().length > 0)

      if (creators.length === 0) {
        findings.push(
          finding('metadata.missing-author', 'metadata', 'warning', 'The book has no author.', {
            impact: 'reach',
            location: PACKAGE_DOCUMENT,
            remedy: 'Add at least one author. No retailer accepts a book without one.',
          }),
        )
      }

      const isbn = identifier.startsWith('urn:isbn:') ? identifier.slice(9) : undefined

      // What the author typed, which is not always what reached the package:
      // an ISBN written with spaces is not recognised as one, so the book ships
      // with the number as an opaque identifier and no retailer can match it.
      const typed = subject.metadata.identifier?.trim() ?? ''
      const stripped = typed.replace(/[\s-]/g, '')
      const looksLikeIsbn = /^\d{9}[\dX]$|^\d{13}$/i.test(stripped)

      if (isbn && !isValidIsbn(isbn)) {
        findings.push(
          finding(
            'metadata.isbn-invalid',
            'metadata',
            'warning',
            `"${isbn}" is not a valid ISBN.`,
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy:
                'The check digit does not match. Retailers verify this and will reject the submission.',
            },
          ),
        )
      } else if (!isbn && looksLikeIsbn && isValidIsbn(stripped)) {
        findings.push(
          finding(
            'metadata.isbn-format',
            'metadata',
            'warning',
            'The ISBN is not being recognised as one.',
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy:
                'The number is valid, but the spaces and hyphens around it mean the book records it as a plain identifier rather than an ISBN. Retailers match on the ISBN.',
              fixable: true,
            },
          ),
        )
      } else if (!isbn && looksLikeIsbn) {
        findings.push(
          finding(
            'metadata.isbn-invalid',
            'metadata',
            'warning',
            `"${typed}" looks like an ISBN but is not a valid one.`,
            {
              impact: 'reach',
              location: PACKAGE_DOCUMENT,
              remedy:
                'The check digit does not match. Retailers verify this and will reject the submission.',
            },
          ),
        )
      } else if (!isbn) {
        findings.push(
          finding('metadata.missing-isbn', 'metadata', 'info', 'The book has no ISBN.', {
            impact: 'reach',
            remedy:
              'A generated UUID is enough to read the book on your own device, but every retailer requires an ISBN.',
          }),
        )

        if (typed.length === 0) {
          // A fresh UUID is minted on every conversion when the author has set
          // no identifier. That is valid, and it means a reader's library files
          // each rebuild as a *different book* rather than replacing the old
          // one — the confusing failure behind "why do I have four copies".
          findings.push(
            finding(
              'metadata.unstable-identifier',
              'metadata',
              'warning',
              'The book gets a new identifier every time it is converted.',
              {
                impact: 'reach',
                location: PACKAGE_DOCUMENT,
                remedy:
                  'Reading systems identify a book by this value. Fix one now and every rebuild replaces the previous copy instead of sitting beside it.',
                fixable: true,
              },
            ),
          )
        }
      }

      const publisher = dc('publisher')[0]?.text.trim() ?? ''
      if (publisher.length === 0) {
        findings.push(
          finding('metadata.missing-publisher', 'metadata', 'info', 'No publisher is named.', {
            impact: 'reach',
            remedy:
              'Self-published books normally name the author here. Some stores show a blank field without it.',
            fixable: true,
          }),
        )
      }

      const description = dc('description')[0]?.text.trim() ?? ''

      if (description.length === 0) {
        findings.push(
          finding(
            'metadata.missing-description',
            'metadata',
            'warning',
            'The book has no description.',
            {
              impact: 'reach',
              remedy:
                'This is the blurb shown on the store page. It is the main thing that sells a book, and stores require it.',
            },
          ),
        )
      } else if (description.length < DESCRIPTION_MINIMUM) {
        findings.push(
          finding(
            'metadata.short-description',
            'metadata',
            'info',
            `The description is only ${description.length} characters.`,
            {
              impact: 'reach',
              remedy: `Stores truncate long blurbs but penalise thin ones. Aim for at least ${DESCRIPTION_MINIMUM}.`,
            },
          ),
        )
      }

      const subjects = dc('subject').filter((element) => element.text.trim().length > 0)
      if (subjects.length === 0) {
        findings.push(
          finding(
            'metadata.missing-subjects',
            'metadata',
            'info',
            'No subjects or genres are set.',
            {
              impact: 'reach',
              remedy:
                'Subjects drive category placement and search. Without them a book is hard to find.',
            },
          ),
        )
      }

      const date = dc('date')[0]?.text.trim() ?? ''
      if (date.length === 0) {
        findings.push(
          finding(
            'metadata.missing-publication-date',
            'metadata',
            'info',
            'No publication date is set.',
            {
              impact: 'reach',
              remedy: 'Stores sort new releases by this date and some require it at submission.',
              fixable: true,
            },
          ),
        )
      }

      const rights = dc('rights')[0]?.text.trim() ?? ''
      if (rights.length === 0) {
        findings.push(
          finding('metadata.missing-rights', 'metadata', 'info', 'No copyright statement is set.', {
            impact: 'advisory',
            remedy:
              'A copyright line is not required to publish, but it is what a reader looks for on the imprint page.',
          }),
        )
      }

      if (subject.metadata.series && subject.metadata.seriesIndex === undefined) {
        findings.push(
          finding(
            'metadata.series-without-index',
            'metadata',
            'warning',
            'The book names a series but no position in it.',
            {
              impact: 'reach',
              remedy:
                'Without a number, stores cannot order the series and readers see the books shuffled.',
            },
          ),
        )
      }

      return { findings, checks: CHECK_COUNT }
    },
  }
}

/**
 * How many assertions this inspector makes.
 *
 * Fixed, because every rule above runs on every book — unlike the markup
 * inspector, whose count scales with the number of chapters. The score divides
 * findings by this, so it has to be the real number rather than a guess.
 */
const CHECK_COUNT = 18

/**
 * ISBN-10 and ISBN-13 check digits.
 *
 * Worth doing properly: a transposed pair of digits is the most common error in
 * a hand-typed ISBN, it is invisible to the eye, and the retailer's ingestion
 * system is otherwise the first thing to notice.
 */
export function isValidIsbn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '').toUpperCase()

  if (digits.length === 13) {
    if (!/^\d{13}$/.test(digits)) return false

    let sum = 0
    for (let i = 0; i < 12; i += 1) {
      sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3)
    }

    return (10 - (sum % 10)) % 10 === Number(digits[12])
  }

  if (digits.length === 10) {
    if (!/^\d{9}[\dX]$/.test(digits)) return false

    let sum = 0
    for (let i = 0; i < 9; i += 1) {
      sum += Number(digits[i]) * (10 - i)
    }

    const last = digits[9]
    sum += last === 'X' ? 10 : Number(last)

    return sum % 11 === 0
  }

  return false
}
