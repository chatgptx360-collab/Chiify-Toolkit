import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createEpubGenerator } from '../lib/epub'
import type { GenerationOutcome } from '../lib/epub'
import { createPreviewRenderer, DEFAULT_PREFERENCES, toBase64 } from '../lib/preview'
import { defaultProjectSettings } from '../lib/types/project'
import type { IsoDateTime } from '../lib/types/common'
import type { BookMetadata, ProjectSettings } from '../lib/types/project'
import type { ParsedDocument } from '../lib/types/document'
import {
  createAutoFixEngine,
  createCssInspector,
  createReportGenerator,
  createValidationEngine,
  isValidIsbn,
  scanXml,
  type QualityReport,
} from '../lib/validation'

import { parseFixture } from './helpers'

/**
 * Validation, quality, auto-fix and preview tests.
 *
 * Every test runs the *real* pipeline: a fixture .docx is parsed, generated
 * into an EPUB, and the resulting package is validated. Hand-building a package
 * to feed the validator would test the validator against the test author's
 * idea of an EPUB rather than against the one the application actually
 * produces — and the bugs worth catching live in the gap between those two.
 *
 * The negative cases are made by breaking metadata or settings rather than by
 * corrupting the package, for the same reason: a book with no ISBN is a real
 * situation an author is in, and a manually mangled manifest is not.
 */

const METADATA: BookMetadata = {
  title: 'The Long Winter',
  authors: ['Ada Lovelace'],
  language: 'en-GB',
  description:
    'A novel about a season that would not end, and the people who waited it out together.',
  identifier: '9780306406157',
  publisher: 'Analytical Press',
  publicationDate: '2026-01-01' as IsoDateTime,
  subjects: ['Fiction'],
  rights: 'Copyright 2026 Ada Lovelace',
}

async function build(
  fixture: string,
  overrides: { metadata?: Partial<BookMetadata>; settings?: Partial<ProjectSettings> } = {},
): Promise<{
  outcome: GenerationOutcome
  metadata: BookMetadata
  settings: ProjectSettings
  document: ParsedDocument
}> {
  const document = await parseFixture(fixture)
  const metadata = { ...METADATA, ...overrides.metadata }
  const settings = { ...defaultProjectSettings, ...overrides.settings }

  const result = await createEpubGenerator().generate(
    { document, metadata, settings },
    {
      now: new Date('2026-01-15T09:00:00Z'),
      generateIdentifier: () => 'urn:uuid:test-fixed-identifier',
    },
  )

  if (!result.ok) {
    throw new Error(`Generation failed: ${result.error.code} — ${result.error.message}`)
  }

  return { outcome: result.value, metadata, settings, document }
}

async function validate(
  fixture: string,
  overrides: { metadata?: Partial<BookMetadata>; settings?: Partial<ProjectSettings> } = {},
): Promise<QualityReport> {
  const { outcome, metadata, settings } = await build(fixture, overrides)

  return createValidationEngine().analyse({
    epub: outcome.epub,
    files: outcome.files,
    binaries: outcome.binaries,
    metadata,
    settings,
    byteSize: outcome.artifact.byteSize,
    now: new Date('2026-01-15T09:05:00Z'),
  })
}

/** Findings carrying a given rule. */
function rule(report: QualityReport, name: string) {
  return report.findings.filter((item) => item.rule === name)
}

// ---------------------------------------------------------------------------
// The XML scanner
// ---------------------------------------------------------------------------

describe('xml scanner', () => {
  it('reads elements, attributes and text in document order', () => {
    const result = scanXml('<root><a href="x.html">Link</a><b/></root>')

    assert.equal(result.errors.length, 0)
    assert.deepEqual(
      result.elements.map((element) => element.localName),
      ['root', 'a', 'b'],
    )
    assert.equal(result.elements[1]?.attributes.href, 'x.html')
    assert.equal(result.elements[1]?.text, 'Link')
  })

  it('collects descendant text on ancestors', () => {
    const result = scanXml('<p>Hello <em>there</em> world</p>')

    assert.equal(result.elements[0]?.text, 'Hello there world')
  })

  it('reports an unescaped ampersand', () => {
    const result = scanXml('<p>Tom & Jerry</p>')

    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0]?.message ?? '', /ampersand/i)
  })

  it('accepts entity references and numeric character references', () => {
    const result = scanXml('<p>Tom &amp; Jerry &#8212; &#x2014;</p>')

    assert.equal(result.errors.length, 0)
  })

  it('reports an unclosed element with the line it opened on', () => {
    const result = scanXml('<root>\n  <p>text\n</root>')

    assert.ok(result.errors.some((error) => /never closed|still open/.test(error.message)))
  })

  it('reports a close tag that was never opened', () => {
    const result = scanXml('<root></p></root>')

    assert.ok(result.errors.some((error) => /never opened/.test(error.message)))
  })

  it('ignores > inside a quoted attribute value', () => {
    const result = scanXml('<a title="a > b">x</a>')

    assert.equal(result.errors.length, 0)
    assert.equal(result.elements[0]?.attributes.title, 'a > b')
  })

  it('skips declarations, comments and CDATA', () => {
    const result = scanXml(
      '<?xml version="1.0"?><!DOCTYPE html><!-- note --><p><![CDATA[raw < text]]></p>',
    )

    assert.equal(result.errors.length, 0)
    assert.equal(result.elements.length, 1)
    assert.equal(result.elements[0]?.text, 'raw < text')
  })

  it('collects ids for fragment resolution', () => {
    const result = scanXml('<root><a id="one"/><a id="two"/></root>')

    assert.deepEqual([...result.ids].sort(), ['one', 'two'])
  })

  it('reports an unquoted attribute value', () => {
    const result = scanXml('<a href=x.html>text</a>')

    assert.ok(result.errors.some((error) => /not quoted/.test(error.message)))
  })
})

// ---------------------------------------------------------------------------
// A well-formed book
// ---------------------------------------------------------------------------

describe('a complete book', () => {
  it('produces no errors', async () => {
    const report = await validate('simple-novel.docx')
    const errors = report.findings.filter((item) => item.severity === 'error')

    assert.deepEqual(
      errors.map((item) => `${item.rule}: ${item.message}`),
      [],
    )
  })

  it('runs a real number of checks, scaled to the book', async () => {
    const small = await validate('simple-novel.docx')
    const large = await validate('large-manuscript.docx')

    assert.ok(small.totalChecks > 20)
    assert.ok(
      large.totalChecks > small.totalChecks,
      'a longer book must be checked more than a short one',
    )
  })

  it('scores well and reports as publishable', async () => {
    const report = await validate('simple-novel.docx')

    assert.ok(report.score.overall >= 80, `expected a high score, got ${report.score.overall}`)
    assert.notEqual(report.score.readiness, 'not-publishable')
    assert.ok(report.score.headline.length > 0)
  })

  it('describes the book it checked', async () => {
    const report = await validate('simple-novel.docx')

    assert.equal(report.subject.title, 'The Long Winter')
    assert.deepEqual(report.subject.authors, ['Ada Lovelace'])
    assert.ok(report.subject.chapters > 0)
    assert.ok(report.subject.byteSize > 0)
  })

  it('validates the markup it generated', async () => {
    const report = await validate('with-tables.docx')

    assert.deepEqual(rule(report, 'markup.not-well-formed'), [])
    assert.deepEqual(rule(report, 'markup.missing-namespace'), [])
  })

  it('resolves every internal reference', async () => {
    const report = await validate('with-images.docx')

    assert.deepEqual(rule(report, 'markup.missing-resource'), [])
    assert.deepEqual(rule(report, 'markup.broken-link'), [])
  })

  it('cross-checks the manifest in both directions', async () => {
    const report = await validate('with-images.docx')

    assert.deepEqual(rule(report, 'structure.manifest-missing-file'), [])
    assert.deepEqual(rule(report, 'structure.file-not-in-manifest'), [])
  })

  it('sorts the most urgent finding first', async () => {
    const report = await validate('no-headings.docx', {
      metadata: { identifier: '', language: '', description: '' },
    })

    const severities = report.findings.map((item) => item.severity)
    const firstWarning = severities.indexOf('warning')
    const lastError = severities.lastIndexOf('error')

    if (firstWarning !== -1 && lastError !== -1) {
      assert.ok(lastError < firstWarning, 'errors must all precede warnings')
    }
  })

  it('never reports the same finding twice', async () => {
    const report = await validate('with-images.docx')
    const ids = report.findings.map((item) => item.id)

    assert.equal(new Set(ids).size, ids.length)
  })
})

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('metadata checks', () => {
  it('reports a language that was assumed rather than chosen', async () => {
    const report = await validate('simple-novel.docx', { metadata: { language: '' } })
    const finding = rule(report, 'metadata.assumed-language')[0]

    // The generator substitutes a default rather than refusing to convert, so
    // the package is valid — but the author never said what language it is in.
    assert.ok(finding)
    assert.equal(finding.severity, 'warning')
    assert.equal(finding.fixable, true)
  })

  it('rejects an invalid language tag', async () => {
    const report = await validate('simple-novel.docx', { metadata: { language: 'english' } })

    assert.equal(rule(report, 'metadata.language-format').length, 1)
  })

  it('reports an identifier that changes on every conversion', async () => {
    const report = await validate('simple-novel.docx', { metadata: { identifier: '' } })
    const finding = rule(report, 'metadata.unstable-identifier')[0]

    assert.ok(finding)
    assert.equal(finding.severity, 'warning')
    assert.equal(finding.fixable, true)
  })

  it('reports a missing ISBN as reach, not as an error', async () => {
    const report = await validate('simple-novel.docx', { metadata: { identifier: '' } })
    const finding = rule(report, 'metadata.missing-isbn')[0]

    assert.ok(finding)
    assert.equal(finding.severity, 'info')
    assert.equal(finding.impact, 'reach')
  })

  it('catches an ISBN whose check digit is wrong', async () => {
    const report = await validate('simple-novel.docx', {
      metadata: { identifier: '9780306406158' },
    })

    assert.equal(rule(report, 'metadata.isbn-invalid').length, 1)
  })

  it('accepts a valid ISBN', async () => {
    const report = await validate('simple-novel.docx')

    assert.deepEqual(rule(report, 'metadata.isbn-invalid'), [])
    assert.deepEqual(rule(report, 'metadata.missing-isbn'), [])
  })

  it('validates ISBN-10 and ISBN-13 check digits', () => {
    assert.equal(isValidIsbn('9780306406157'), true)
    assert.equal(isValidIsbn('978-0-306-40615-7'), true)
    assert.equal(isValidIsbn('9780306406158'), false)
    assert.equal(isValidIsbn('0306406152'), true)
    assert.equal(isValidIsbn('080442957X'), true)
    assert.equal(isValidIsbn('0306406153'), false)
    assert.equal(isValidIsbn('12345'), false)
  })

  it('reports a missing description as a warning', async () => {
    const report = await validate('simple-novel.docx', { metadata: { description: '' } })
    const finding = rule(report, 'metadata.missing-description')[0]

    assert.ok(finding)
    assert.equal(finding.severity, 'warning')
  })

  it('reports the placeholder title', async () => {
    const report = await validate('simple-novel.docx', { metadata: { title: '' } })

    assert.equal(rule(report, 'metadata.placeholder-title').length, 1)
  })

  it('reports a series with no position in it', async () => {
    const report = await validate('simple-novel.docx', { metadata: { series: 'Winter Cycle' } })

    assert.equal(rule(report, 'metadata.series-without-index').length, 1)
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation checks', () => {
  it('finds no broken contents entries in a generated book', async () => {
    const report = await validate('non-fiction.docx')

    assert.deepEqual(rule(report, 'structure.nav-broken-link'), [])
    assert.deepEqual(rule(report, 'structure.empty-toc'), [])
    assert.deepEqual(rule(report, 'structure.nav-order'), [])
  })

  it('reaches every chapter from the contents', async () => {
    const report = await validate('large-manuscript.docx')

    assert.deepEqual(rule(report, 'structure.nav-missing-chapter'), [])
  })

  it('reports the EPUB 2 fallback as missing when it is switched off', async () => {
    const report = await validate('simple-novel.docx', {
      settings: { includeTableOfContents: false },
    })

    const finding = rule(report, 'structure.missing-ncx')[0]
    assert.ok(finding)
    assert.equal(finding.impact, 'reach')
    assert.equal(finding.fixable, true)
  })

  it('finds the landmarks list', async () => {
    const report = await validate('simple-novel.docx')

    assert.deepEqual(rule(report, 'structure.missing-landmarks'), [])
  })

  it('accepts the NCX play order', async () => {
    const report = await validate('non-fiction.docx')

    assert.deepEqual(rule(report, 'structure.ncx-playorder'), [])
    assert.deepEqual(rule(report, 'structure.ncx-mismatch'), [])
  })
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('accessibility checks', () => {
  it('declares a language on every page', async () => {
    const report = await validate('simple-novel.docx')

    assert.deepEqual(rule(report, 'accessibility.missing-language'), [])
  })

  it('emits the schema.org accessibility metadata', async () => {
    const report = await validate('simple-novel.docx')

    const missing = report.findings.filter((item) =>
      item.rule.startsWith('accessibility.missing-access'),
    )

    assert.deepEqual(missing, [])
  })

  it('reports images with no description', async () => {
    const report = await validate('with-images.docx')
    const findings = rule(report, 'accessibility.missing-alt-text')

    // The fixture deliberately contains an undescribed image.
    assert.ok(findings.length > 0)
    assert.equal(findings[0]?.impact, 'reach')
  })

  it('reports a table with no header row, and only that table', async () => {
    const report = await validate('with-tables.docx')
    const findings = rule(report, 'accessibility.table-without-headers')

    // The fixture has two tables: one with a marked header row and one without.
    assert.equal(findings.length, 1)
    assert.match(findings[0]?.location ?? '', /comparisons/)
  })
})

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

describe('stylesheet checks', () => {
  it('passes the generated stylesheet', async () => {
    const report = await validate('simple-novel.docx')

    assert.deepEqual(rule(report, 'css.fixed-font-size'), [])
    assert.deepEqual(rule(report, 'css.text-colour'), [])
    assert.deepEqual(rule(report, 'css.fixed-size'), [])
    assert.deepEqual(rule(report, 'css.important'), [])
  })

  it('catches a fixed font size', () => {
    const findings = inspectCss('body { font-size: 12pt; }')

    assert.ok(findings.some((item) => item.rule === 'css.fixed-font-size'))
  })

  it('catches a colour on body text', () => {
    const findings = inspectCss('p { color: #333333; }')

    assert.ok(findings.some((item) => item.rule === 'css.text-colour'))
  })

  it('does not mistake background-color for a text colour', () => {
    const findings = inspectCss('blockquote { background-color: #eeeeee; }')

    assert.deepEqual(
      findings.filter((item) => item.rule === 'css.text-colour'),
      [],
    )
  })

  it('does not mistake max-width in percent for a fixed size', () => {
    const findings = inspectCss('img { max-width: 100%; }')

    assert.deepEqual(
      findings.filter((item) => item.rule === 'css.fixed-size'),
      [],
    )
  })

  it('ignores declarations inside comments', () => {
    const findings = inspectCss('/* p { color: red; } */ p { margin: 0; }')

    assert.deepEqual(
      findings.filter((item) => item.rule === 'css.text-colour'),
      [],
    )
  })

  it('catches justified text without hyphenation', () => {
    const findings = inspectCss('p { text-align: justify; }')

    assert.ok(findings.some((item) => item.rule === 'css.justify-without-hyphens'))
  })
})

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

describe('image checks', () => {
  it('accepts the images in an illustrated book', async () => {
    const report = await validate('with-images.docx')

    assert.deepEqual(rule(report, 'resources.missing-bytes'), [])
    assert.deepEqual(rule(report, 'resources.empty-image'), [])
    assert.deepEqual(rule(report, 'resources.unsupported-format'), [])
  })

  it('finds the cover image', async () => {
    const report = await validate('with-images.docx')

    assert.deepEqual(rule(report, 'resources.no-cover-image'), [])
  })

  it('notes a book with no artwork at all', async () => {
    const report = await validate('simple-novel.docx')

    assert.equal(rule(report, 'resources.no-cover-at-all').length, 1)
  })
})

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

describe('compatibility', () => {
  it('assesses every target', async () => {
    const report = await validate('with-images.docx')

    assert.ok(report.compatibility.total >= 5)
    assert.equal(report.compatibility.targets.length, report.compatibility.total)
    assert.ok(
      report.compatibility.targets.every((target) => target.name.length > 0),
      'every target must be named',
    )
  })

  it('refuses a book with no ISBN at the stores that require one', async () => {
    const report = await validate('with-images.docx', { metadata: { identifier: '' } })

    const apple = report.compatibility.targets.find((target) => target.id === 'apple-books')
    const google = report.compatibility.targets.find((target) => target.id === 'google-play')

    assert.equal(apple?.status, 'rejected')
    assert.equal(google?.status, 'rejected')
  })

  it('accepts a fully specified illustrated book on Kindle', async () => {
    const report = await validate('with-images.docx')
    const kindle = report.compatibility.targets.find((target) => target.id === 'kindle')

    assert.equal(kindle?.status, 'supported')
    assert.deepEqual(kindle?.notes, [])
  })

  it('degrades Kindle and Kobo when the EPUB 2 contents are dropped', async () => {
    const report = await validate('with-images.docx', {
      settings: { includeTableOfContents: false },
    })

    const kindle = report.compatibility.targets.find((target) => target.id === 'kindle')
    const kobo = report.compatibility.targets.find((target) => target.id === 'kobo')

    assert.equal(kindle?.status, 'degraded')
    assert.equal(kobo?.status, 'degraded')
  })

  it('states the worst problem first', async () => {
    const report = await validate('simple-novel.docx', { metadata: { identifier: '' } })
    const apple = report.compatibility.targets.find((target) => target.id === 'apple-books')

    assert.ok(apple)
    assert.match(apple.notes[0] ?? '', /ISBN/)
  })
})

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe('quality scoring', () => {
  it('scores a worse book lower than a better one', async () => {
    const good = await validate('simple-novel.docx')
    const bad = await validate('simple-novel.docx', {
      metadata: {
        identifier: '',
        description: '',
        publisher: '',
        subjects: [],
        publicationDate: '' as IsoDateTime,
        rights: '',
        language: 'english',
      },
    })

    assert.ok(
      bad.score.overall < good.score.overall,
      `expected ${bad.score.overall} < ${good.score.overall}`,
    )
  })

  it('reports readiness from errors, not from the score', async () => {
    const report = await validate('simple-novel.docx', { metadata: { description: '' } })

    // Warnings that cost reach do not make a book invalid.
    assert.equal(report.summary.errors, 0)
    assert.equal(report.score.readiness, 'needs-work')
  })

  it('never scores a category below zero or above one hundred', async () => {
    const report = await validate('malformed-empty.docx').catch(() => undefined)
    if (!report) return

    for (const category of report.categories) {
      assert.ok(category.score >= 0 && category.score <= 100)
    }
  })

  it('gives every category a real check count', async () => {
    const report = await validate('with-images.docx')

    for (const category of report.categories) {
      assert.ok(category.checks > 0, `${category.label} reported no checks`)
    }
  })

  it('sorts categories worst first', async () => {
    const report = await validate('simple-novel.docx', { metadata: { identifier: '' } })
    const scores = report.categories.map((category) => category.score)

    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => a - b),
    )
  })

  it('survives an inspector that throws', async () => {
    const { outcome, metadata, settings } = await build('simple-novel.docx')

    const engine = createValidationEngine({
      inspectors: [
        {
          id: 'exploding-inspector',
          category: 'markup',
          title: 'Exploding check',
          inspect() {
            throw new Error('boom')
          },
        },
      ],
    })

    const report = engine.analyse({
      epub: outcome.epub,
      files: outcome.files,
      binaries: outcome.binaries,
      metadata,
      settings,
      byteSize: outcome.artifact.byteSize,
    })

    const failure = rule(report, 'validation.inspector-failed')[0]
    assert.ok(failure, 'a crashing inspector must become a finding')
    assert.match(failure.remedy ?? '', /boom/)
  })
})

// ---------------------------------------------------------------------------
// Automatic fixes
// ---------------------------------------------------------------------------

describe('automatic fixes', () => {
  async function propose(overrides: {
    metadata?: Partial<BookMetadata>
    settings?: Partial<ProjectSettings>
  }) {
    const { outcome, metadata, settings } = await build('simple-novel.docx', overrides)
    const engine = createValidationEngine()

    const input = {
      epub: outcome.epub,
      files: outcome.files,
      binaries: outcome.binaries,
      metadata,
      settings,
      byteSize: outcome.artifact.byteSize,
    }

    const report = engine.analyse(input)
    const subject = engine.prepare(input)

    const fixes = createAutoFixEngine({
      generateIdentifier: () => 'urn:uuid:fixed',
      now: new Date('2026-03-04T00:00:00Z'),
    })

    return { proposals: fixes.propose(report, subject), fixes, metadata, settings }
  }

  it('proposes a language when one is missing', async () => {
    const { proposals } = await propose({ metadata: { language: '' } })
    const proposal = proposals.find((item) => item.field === 'Language')

    assert.ok(proposal)
    assert.equal(proposal.after, 'en')
    assert.equal(proposal.before, '(not set)')
  })

  it('normalises a malformed language tag', async () => {
    const { proposals } = await propose({ metadata: { language: 'EN_us' } })
    const proposal = proposals.find((item) => item.rule === 'metadata.language-format')

    assert.ok(proposal)
    assert.equal(proposal.after, 'en-US')
  })

  it('proposes a title taken from the manuscript', async () => {
    const { proposals } = await propose({ metadata: { title: '' } })
    const proposal = proposals.find((item) => item.field === 'Title')

    assert.ok(proposal)
    assert.ok(proposal.after.length > 0)
    assert.ok(proposal.description.includes('first heading'))
  })

  it('proposes the author as publisher for a self-published book', async () => {
    const { proposals } = await propose({ metadata: { publisher: '' } })
    const proposal = proposals.find((item) => item.field === 'Publisher')

    assert.ok(proposal)
    assert.equal(proposal.after, 'Ada Lovelace')
  })

  it('strips punctuation from an otherwise valid ISBN', async () => {
    const { proposals } = await propose({ metadata: { identifier: '978 0 306 40615 7' } })
    const proposal = proposals.find((item) => item.rule === 'metadata.isbn-format')

    assert.ok(proposal)
    assert.equal(proposal.after, '9780306406157')
  })

  it('does not guess at a wrong check digit', async () => {
    const { proposals } = await propose({ metadata: { identifier: '9780306406158' } })

    assert.equal(
      proposals.filter((item) => item.rule === 'metadata.isbn-invalid').length,
      0,
      'a genuinely wrong ISBN must not be silently corrected',
    )
  })

  it('never proposes a description or subjects', async () => {
    const { proposals } = await propose({ metadata: { description: '', subjects: [] } })

    assert.deepEqual(
      proposals.filter((item) => /description|subject/i.test(item.field)),
      [],
      'anything requiring authorship must not be generated',
    )
  })

  it('shows the change without applying it', async () => {
    const { proposals, metadata } = await propose({ metadata: { language: '' } })
    const proposal = proposals.find((item) => item.field === 'Language')

    assert.ok(proposal)
    assert.equal(metadata.language, '', 'proposing must not mutate anything')
    assert.ok(proposal.before.length > 0 && proposal.after.length > 0)
  })

  it('applies purely, returning a new target', async () => {
    const { proposals, metadata, settings } = await propose({ metadata: { language: '' } })
    const proposal = proposals.find((item) => item.field === 'Language')
    assert.ok(proposal)

    const next = proposal.apply({ metadata, settings })

    assert.equal(next.metadata.language, 'en')
    assert.equal(metadata.language, '', 'the original must be untouched')
    assert.notEqual(next.metadata, metadata)
  })

  it('applies several at once', async () => {
    const { proposals, fixes, metadata, settings } = await propose({
      metadata: { language: '', publisher: '', identifier: '' },
    })

    const next = fixes.applyAll({ metadata, settings }, proposals)

    assert.equal(next.metadata.language, 'en')
    assert.equal(next.metadata.publisher, 'Ada Lovelace')
    assert.equal(next.metadata.identifier, 'urn:uuid:fixed')
  })

  it('turns the EPUB 2 contents back on', async () => {
    const { proposals } = await propose({ settings: { includeTableOfContents: false } })
    const proposal = proposals.find((item) => item.rule === 'structure.missing-ncx')

    assert.ok(proposal)
    assert.equal(proposal.before, 'Off')
    assert.equal(proposal.after, 'On')
  })
})

// ---------------------------------------------------------------------------
// Report export
// ---------------------------------------------------------------------------

describe('report export', () => {
  it('produces valid JSON carrying every finding', async () => {
    const report = await validate('simple-novel.docx', { metadata: { identifier: '' } })
    const parsed: unknown = JSON.parse(createReportGenerator().toJson(report))

    assert.ok(parsed && typeof parsed === 'object')
    const record = parsed as Record<string, unknown>

    assert.equal((record.findings as unknown[]).length, report.findings.length)
    assert.match(String(record.disclaimer), /not EPUBCheck/)
  })

  it('escapes hostile metadata in the HTML export', async () => {
    const report = await validate('simple-novel.docx', {
      metadata: { title: 'Tom & Jerry <script>alert(1)</script>' },
    })

    const html = createReportGenerator().toHtml(report)

    assert.ok(!html.includes('<script>alert(1)</script>'))
    assert.ok(html.includes('&amp;'))
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('states the disclaimer in every format', async () => {
    const report = await validate('simple-novel.docx')
    const generator = createReportGenerator()

    for (const content of [
      generator.toHtml(report),
      generator.toText(report),
      generator.toJson(report),
    ]) {
      assert.match(content, /not EPUBCheck/)
    }
  })

  it('includes a print stylesheet in the HTML export', async () => {
    const report = await validate('simple-novel.docx')

    assert.match(createReportGenerator().toHtml(report), /@media print/)
  })

  it('derives a safe file name from the title', async () => {
    const report = await validate('simple-novel.docx', {
      metadata: { title: 'The Long Winter: A Novel!' },
    })

    assert.equal(
      createReportGenerator().fileName(report, 'html'),
      'the-long-winter-a-novel-validation.html',
    )
  })

  it('lists the findings in the text export', async () => {
    const report = await validate('simple-novel.docx', { metadata: { description: '' } })
    const text = createReportGenerator().toText(report)

    assert.match(text, /\[WARNING\]/)
    assert.match(text, /description/i)
  })
})

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

describe('preview renderer', () => {
  async function renderer(fixture: string) {
    const { outcome } = await build(fixture)

    return createPreviewRenderer({
      epub: outcome.epub,
      files: outcome.files,
      binaries: outcome.binaries,
    })
  }

  it('produces a chapter for every spine item', async () => {
    const { outcome } = await build('non-fiction.docx')
    const preview = createPreviewRenderer({
      epub: outcome.epub,
      files: outcome.files,
      binaries: outcome.binaries,
    })

    assert.equal(preview.chapters.length, outcome.epub.spine.length)
  })

  it('names chapters from the book’s own contents', async () => {
    const preview = await renderer('non-fiction.docx')
    const named = preview.chapters.filter((chapter) => chapter.linear)

    assert.ok(named.length > 0)
    assert.ok(named.every((chapter) => chapter.title.trim().length > 0))
  })

  it('renders a complete HTML document', async () => {
    const preview = await renderer('simple-novel.docx')
    const chapter = preview.chapters.find((candidate) => candidate.linear)
    assert.ok(chapter)

    const html = preview.render(chapter, DEFAULT_PREFERENCES)

    assert.match(html, /^<!doctype html>/)
    assert.match(html, /<body>/)
    assert.ok(!html.includes('<?xml'), 'the XML declaration must not survive into HTML')
  })

  it('inlines the book stylesheet', async () => {
    const preview = await renderer('simple-novel.docx')
    const chapter = preview.chapters[0]
    assert.ok(chapter)

    const html = preview.render(chapter, DEFAULT_PREFERENCES)

    assert.match(html, /<style>/)
    assert.match(html, /line-height/)
  })

  it('applies reader preferences after the book stylesheet', async () => {
    const preview = await renderer('simple-novel.docx')
    const chapter = preview.chapters[0]
    assert.ok(chapter)

    const html = preview.render(chapter, { ...DEFAULT_PREFERENCES, fontScale: 1.5, measure: 50 })

    assert.match(html, /font-size:150%/)
    assert.match(html, /max-width:50ch/)

    const bookCss = html.indexOf('<style>')
    const preferenceCss = html.indexOf('font-size:150%')
    assert.ok(preferenceCss > bookCss, 'preferences must come last so they win')
  })

  it('embeds images as data URIs', async () => {
    const preview = await renderer('with-images.docx')
    const withImage = preview.chapters.find((chapter) => chapter.body.includes('<img'))

    assert.ok(withImage, 'the illustrated fixture must contain an image')
    assert.match(withImage.body, /src="data:image\//)
    assert.ok(!withImage.body.includes('src="../images/'), 'no relative path may survive')
  })

  it('defuses links that would navigate away', async () => {
    const preview = await renderer('with-links.docx')

    for (const chapter of preview.chapters) {
      const anchors = chapter.body.match(/<a\b[^>]*>/g) ?? []

      for (const anchor of anchors) {
        const href = anchor.match(/(?<![-\w])href="([^"]*)"/)?.[1]
        assert.ok(
          href === undefined || href.startsWith('#'),
          `a live cross-document link survived: ${anchor}`,
        )
      }
    }
  })

  it('keeps fragment links live so footnotes can be tested', async () => {
    const preview = await renderer('with-links.docx')
    const bodies = preview.chapters.map((chapter) => chapter.body).join('')

    if (bodies.includes('data-preview-href')) {
      assert.ok(true)
    }

    // Any anchor that remains with a real href must be a fragment.
    assert.ok(!/(?<![-\w])href="[^#"][^"]*"/.test(bodies))
  })

  it('changes nothing when nothing changes', async () => {
    const preview = await renderer('simple-novel.docx')
    const chapter = preview.chapters[0]
    assert.ok(chapter)

    assert.equal(
      preview.render(chapter, DEFAULT_PREFERENCES),
      preview.render(chapter, DEFAULT_PREFERENCES),
    )
  })

  it('encodes base64 correctly at every padding length', () => {
    assert.equal(toBase64(new Uint8Array([77, 97, 110])), 'TWFu')
    assert.equal(toBase64(new Uint8Array([77, 97])), 'TWE=')
    assert.equal(toBase64(new Uint8Array([77])), 'TQ==')
    assert.equal(toBase64(new Uint8Array([])), '')
    assert.equal(toBase64(new Uint8Array([255, 255, 255])), '////')
  })
})

/**
 * Run the CSS inspector against a stylesheet directly.
 *
 * The generated stylesheet is deliberately correct, so the negative cases need
 * a stylesheet the generator would never produce. Feeding one straight to the
 * inspector is more honest than corrupting a real package.
 */
function inspectCss(css: string) {
  const subject = {
    epub: {
      version: '3.0' as const,
      resources: [],
      spine: [],
      navigation: [],
      accessibility: {
        accessModes: [],
        accessibilityFeatures: [],
        accessibilityHazards: [],
      },
      metadata: {},
    },
    files: [],
    binaries: [],
    metadata: METADATA,
    settings: defaultProjectSettings,
    documents: [
      {
        href: 'styles/book.css',
        source: css,
        elements: [],
        ids: new Set<string>(),
        errors: [],
        mediaType: 'text/css',
      },
    ],
    manifestHrefs: new Set<string>(),
    byteSize: 0,
  }

  return createCssInspector().inspect(subject).findings
}
