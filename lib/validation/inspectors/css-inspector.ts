import {
  finding,
  type InspectionResult,
  type Inspector,
  type InspectionSubject,
  type ValidationFinding,
} from '../types'

/**
 * Stylesheet inspection.
 *
 * THE RULE BEHIND EVERY CHECK HERE
 * --------------------------------
 * A print stylesheet specifies. An EPUB stylesheet suggests. The reader owns
 * the font, the size, the margins, the background and the line spacing, and a
 * stylesheet that takes any of those away produces a book that is unreadable
 * for somebody — usually somebody who cannot explain why, and who leaves a
 * one-star review saying the text is too small.
 *
 * So the four checks that matter are: no fixed font sizes, no colours on body
 * text, no fixed widths, and no `!important`. Each of them is a specific,
 * well-documented way to break a reading system's accessibility settings.
 *
 * WHY IT SCANS TEXT RATHER THAN PARSING CSS
 * -----------------------------------------
 * The questions are all "does this declaration appear at all", not "what is the
 * computed value". A CSS parser would be a dependency and several hundred lines
 * carried for questions a scan answers exactly as well. The one thing a scan
 * must get right is not matching inside comments, so comments are stripped
 * first.
 */

const CHECKS_PER_STYLESHEET = 7

/** Units that ignore the reader's chosen text size. */
const ABSOLUTE_UNITS = /\b\d*\.?\d+(pt|px|cm|mm|in|pc)\b/

export function createCssInspector(): Inspector {
  return {
    id: 'css-inspector',
    category: 'markup',
    title: 'Stylesheet',

    inspect(subject: InspectionSubject): InspectionResult {
      const stylesheets = subject.documents.filter((document) => document.mediaType === 'text/css')

      if (stylesheets.length === 0) {
        return {
          checks: 1,
          findings: [
            finding('css.no-stylesheet', 'markup', 'warning', 'The book has no stylesheet.', {
              impact: 'reading',
              remedy:
                'Every page will fall back to the reading system defaults, so paragraphs, headings and quotations will look identical.',
            }),
          ],
        }
      }

      const findings: ValidationFinding[] = []

      for (const stylesheet of stylesheets) {
        const css = stripComments(stylesheet.source)
        const where = stylesheet.href

        for (const value of declarations(css, 'font-size')) {
          if (ABSOLUTE_UNITS.test(value)) {
            findings.push(
              finding(
                'css.fixed-font-size',
                'markup',
                'warning',
                `The stylesheet fixes a font size (${value.trim()}).`,
                {
                  impact: 'reading',
                  location: where,
                  remedy:
                    'A reader who needs larger text cannot get it. Use em or rem, which scale with their setting.',
                },
              ),
            )
            break
          }
        }

        for (const value of declarations(css, 'color')) {
          if (!/currentcolor|inherit|transparent/i.test(value)) {
            findings.push(
              finding(
                'css.text-colour',
                'markup',
                'warning',
                `The stylesheet sets a text colour (${value.trim()}).`,
                {
                  impact: 'reading',
                  location: where,
                  remedy:
                    'Night mode changes the background and not the text, so dark grey text becomes invisible. Leave colour to the reading system.',
                },
              ),
            )
            break
          }
        }

        for (const property of ['width', 'max-width', 'height'] as const) {
          const fixed = declarations(css, property).find((value) => ABSOLUTE_UNITS.test(value))

          if (fixed) {
            findings.push(
              finding(
                'css.fixed-size',
                'markup',
                'warning',
                `The stylesheet fixes ${property} at ${fixed.trim()}.`,
                {
                  impact: 'reading',
                  location: where,
                  remedy:
                    'The reading system owns the viewport. A fixed size overflows a phone and leaves a stripe of text on a tablet.',
                },
              ),
            )
            break
          }
        }

        if (/!\s*important/i.test(css)) {
          findings.push(
            finding('css.important', 'markup', 'info', 'The stylesheet uses !important.', {
              impact: 'reading',
              location: where,
              remedy:
                'It overrides the reader’s own accessibility settings, which is the one thing a book stylesheet must not do.',
            }),
          )
        }

        if (/@import|url\(\s*['"]?https?:/i.test(css)) {
          findings.push(
            finding(
              'css.remote-resource',
              'markup',
              'warning',
              'The stylesheet loads something from the internet.',
              {
                impact: 'reading',
                location: where,
                remedy:
                  'It will silently fail for anyone reading offline, and some retailers reject books that reach outside the file.',
              },
            ),
          )
        }

        if (/text-align\s*:\s*justify/i.test(css) && !/hyphens\s*:\s*auto/i.test(css)) {
          findings.push(
            finding(
              'css.justify-without-hyphens',
              'markup',
              'info',
              'Text is justified without hyphenation.',
              {
                impact: 'reading',
                location: where,
                remedy:
                  'On a narrow screen this produces rivers of white space between words. Add hyphens: auto, or leave text ragged-right.',
              },
            ),
          )
        }

        if (/@font-face/i.test(css)) {
          const hasFont = subject.epub.resources.some((resource) =>
            resource.mediaType.startsWith('font/'),
          )

          if (!hasFont) {
            findings.push(
              finding(
                'css.missing-font',
                'markup',
                'error',
                'The stylesheet declares a font the book does not contain.',
                {
                  impact: 'blocking',
                  location: where,
                  remedy:
                    'An @font-face rule pointing at a missing file makes the whole rule fail, and some validators reject the package.',
                },
              ),
            )
          }
        }

        if (/position\s*:\s*(absolute|fixed)/i.test(css)) {
          findings.push(
            finding(
              'css.absolute-position',
              'markup',
              'info',
              'The stylesheet positions content absolutely.',
              {
                impact: 'reach',
                location: where,
                remedy:
                  'Reflowable books repaginate constantly. Absolutely positioned content lands in the wrong place on any screen but the one it was designed for.',
              },
            ),
          )
        }
      }

      return { findings, checks: stylesheets.length * CHECKS_PER_STYLESHEET }
    },
  }
}

/** Remove CSS comments so a documented rule is not read as a live one. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/**
 * Values assigned to a property.
 *
 * The leading boundary matters: without it, `max-width` matches a search for
 * `width` and `background-color` matches a search for `color`, which would
 * report the stylesheet's most careful rules as its worst faults.
 */
function declarations(css: string, property: string): readonly string[] {
  const pattern = new RegExp(String.raw`(?:^|[;{\s])${property}\s*:\s*([^;}]+)`, 'gi')
  const values: string[] = []

  for (const match of css.matchAll(pattern)) {
    const value = match[1]
    if (value) values.push(value)
  }

  return values
}
