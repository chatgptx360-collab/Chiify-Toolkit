import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DOCX_ERROR } from '../lib/parser/docx'

import { allBlocks, allText, parseFixture, parseFixtureExpectingError } from './helpers'

/**
 * Parser integration tests.
 *
 * These run the whole pipeline against real `.docx` packages, because the
 * interesting failures live in the seams between services — a style map that
 * emits an element the block converter does not handle, a normaliser rule that
 * removes something the chapter detector needed. Unit tests of the individual
 * services would pass while the pipeline lost content.
 *
 * Each test asserts on *observable behaviour an author would notice*, not on
 * internal shapes, so refactoring a service does not rewrite the suite.
 */

describe('a simple novel', () => {
  it('splits chapters on Heading 1 with high confidence', async () => {
    const document = await parseFixture('simple-novel.docx')

    assert.equal(document.chapters.length, 3)
    assert.deepEqual(
      document.chapters.map((chapter) => chapter.title),
      ['Chapter One', 'Chapter Two', 'Chapter Three'],
    )
    assert.equal(document.detection.strategy, 'heading')
    assert.ok(
      document.detection.confidence >= 0.8,
      `expected high confidence, got ${document.detection.confidence}`,
    )
  })

  it('gives every chapter a unique slug', async () => {
    const document = await parseFixture('simple-novel.docx')
    const slugs = document.chapters.map((chapter) => chapter.slug)

    assert.deepEqual(slugs, ['chapter-one', 'chapter-two', 'chapter-three'])
    assert.equal(new Set(slugs).size, slugs.length)
  })

  it('removes the empty paragraphs Word uses as spacing', async () => {
    const document = await parseFixture('simple-novel.docx')

    const empty = allBlocks(document).filter(
      (block) =>
        block.type === 'paragraph' && block.content.every((run) => run.text.trim().length === 0),
    )

    assert.equal(empty.length, 0)
  })

  it('preserves italic emphasis', async () => {
    const document = await parseFixture('simple-novel.docx')

    const emphasised = allBlocks(document).some(
      (block) =>
        block.type === 'paragraph' && block.content.some((run) => run.marks?.includes('emphasis')),
    )

    assert.ok(emphasised, 'expected at least one emphasised run')
  })

  it('reads metadata from the document without applying it', async () => {
    const document = await parseFixture('simple-novel.docx')

    assert.equal(document.embeddedMetadata.title, 'The Long Winter')
    assert.deepEqual(document.embeddedMetadata.authors, ['Ada Lovelace'])
    assert.equal(document.embeddedMetadata.language, 'en-GB')
  })

  it('counts words and estimates reading time', async () => {
    const document = await parseFixture('simple-novel.docx')

    assert.ok(document.stats.wordCount > 100, 'expected a real word count')
    assert.ok(document.stats.paragraphCount > 0)
    assert.equal(document.stats.headingCount, 3)
    assert.ok(document.stats.estimatedReadingMinutes >= 1)
    assert.ok(document.stats.estimatedPageCount >= 1)
    assert.ok(document.stats.longestChapter)
    assert.ok(document.stats.shortestChapter)
  })
})

describe('a non-fiction book', () => {
  it('keeps nested headings inside their chapter', async () => {
    const document = await parseFixture('non-fiction.docx')

    // Two Heading 1 parts, plus the title page that precedes the first heading.
    assert.equal(document.chapters.length, 3)
    assert.deepEqual(
      document.chapters.slice(1).map((chapter) => chapter.title),
      ['Part One: Foundations', 'Part Two: The Digital Turn'],
    )

    const subheadings = allBlocks(document).filter(
      (block) => block.type === 'heading' && block.level === 2,
    )
    assert.ok(subheadings.length >= 3, 'expected Heading 2 sections to survive')
  })

  it('treats content before the first heading as front matter', async () => {
    const document = await parseFixture('non-fiction.docx')
    const first = document.chapters[0]

    assert.ok(first)
    assert.equal(first.kind, 'frontMatter')
    // The title page must be kept, not silently dropped.
    assert.match(allText(document), /On Publishing/)
  })

  it('converts a Quote style into a blockquote', async () => {
    const document = await parseFixture('non-fiction.docx')
    const quotes = allBlocks(document).filter((block) => block.type === 'quote')

    assert.equal(quotes.length, 1)
    assert.match(allText(document), /machine to think with/)
  })

  it('splits multiple authors', async () => {
    const document = await parseFixture('non-fiction.docx')

    assert.deepEqual(document.embeddedMetadata.authors, ['Charles Babbage', 'Ada Lovelace'])
    assert.deepEqual(document.embeddedMetadata.keywords, ['publishing', 'typesetting', 'ebooks'])
  })
})

describe('a book with images', () => {
  it('extracts image bytes and links them to blocks', async () => {
    const document = await parseFixture('with-images.docx')

    assert.equal(document.assets.length, 2)
    assert.ok(document.assets.every((asset) => asset.bytes.byteLength > 0))
    assert.ok(document.assets.every((asset) => asset.mediaType === 'image/png'))

    const imageBlocks = allBlocks(document).filter((block) => block.type === 'image')
    assert.equal(imageBlocks.length, 2)

    const assetIds = new Set(document.assets.map((asset) => asset.id))
    for (const block of imageBlocks) {
      if (block.type !== 'image') continue
      assert.ok(assetIds.has(block.assetId), 'every image block resolves to an asset')
    }
  })

  it('reads pixel dimensions from the image header', async () => {
    const document = await parseFixture('with-images.docx')

    for (const asset of document.assets) {
      assert.equal(asset.width, 1)
      assert.equal(asset.height, 1)
    }
  })

  it('preserves alt text and reports images missing it', async () => {
    const document = await parseFixture('with-images.docx')

    const described = allBlocks(document).filter(
      (block) => block.type === 'image' && block.alt.length > 0,
    )
    assert.equal(described.length, 1)

    const altNotice = document.notices.find((item) => item.code === 'docx.missing-alt-text')
    assert.ok(altNotice, 'expected a notice about the undescribed image')
    assert.match(altNotice.message, /1 image has no description/)
  })

  it('counts images in the statistics', async () => {
    const document = await parseFixture('with-images.docx')
    assert.equal(document.stats.imageCount, 2)
  })
})

describe('a book with tables', () => {
  it('preserves rows, cells and the header row', async () => {
    const document = await parseFixture('with-tables.docx')
    const tables = allBlocks(document).filter((block) => block.type === 'table')

    assert.equal(tables.length, 2)

    const first = tables[0]
    assert.ok(first?.type === 'table')
    assert.equal(first.header?.length, 1)
    assert.equal(first.header?.[0]?.cells.length, 3)
    assert.equal(first.rows.length, 3)
    assert.equal(first.rows[0]?.cells[0]?.content[0]?.text, 'EPUB 3')
  })

  it('counts tables in the statistics', async () => {
    const document = await parseFixture('with-tables.docx')
    assert.equal(document.stats.tableCount, 2)
  })
})

describe('a book with nested lists', () => {
  it('nests child lists inside their parent item', async () => {
    const document = await parseFixture('nested-lists.docx')
    const lists = allBlocks(document).filter((block) => block.type === 'list')

    assert.ok(lists.length >= 2, 'expected both lists')

    const nested = lists.some(
      (list) => list.type === 'list' && list.items.some((item) => (item.children?.length ?? 0) > 0),
    )
    assert.ok(nested, 'expected at least one nested list')
  })

  it('distinguishes ordered from unordered lists', async () => {
    const document = await parseFixture('nested-lists.docx')
    const lists = allBlocks(document).filter((block) => block.type === 'list')

    assert.ok(lists.some((list) => list.type === 'list' && list.ordered))
    assert.ok(lists.some((list) => list.type === 'list' && !list.ordered))
  })
})

describe('a book with hyperlinks', () => {
  it('keeps external links on their runs', async () => {
    const document = await parseFixture('with-links.docx')

    const links = allBlocks(document)
      .filter((block) => block.type === 'paragraph')
      .flatMap((block) => (block.type === 'paragraph' ? block.content : []))
      .filter((run) => run.href)

    assert.equal(links.length, 2)
    assert.ok(links.some((run) => run.href?.includes('w3.org')))
    assert.equal(document.stats.linkCount, 2)
  })
})

describe('a manuscript with no heading styles', () => {
  it('falls back to page breaks and lowers confidence', async () => {
    const document = await parseFixture('no-headings.docx')

    assert.ok(document.chapters.length > 1, 'expected a fallback split')
    assert.notEqual(document.detection.strategy, 'heading')
    assert.ok(
      document.detection.confidence < 0.8,
      `fallbacks should not claim high confidence, got ${document.detection.confidence}`,
    )
    assert.ok(document.detection.reason.length > 0)
  })

  it('warns the author when confidence is low', async () => {
    const document = await parseFixture('no-headings.docx')

    if (document.detection.confidence < 0.5) {
      assert.ok(
        document.notices.some((item) => item.code === 'docx.low-detection-confidence'),
        'expected a low-confidence notice',
      )
    }
  })
})

describe('a large manuscript', () => {
  it('parses 40 chapters and reports plausible statistics', async () => {
    const started = Date.now()
    const document = await parseFixture('large-manuscript.docx')
    const elapsed = Date.now() - started

    assert.equal(document.chapters.length, 40)
    assert.ok(document.stats.wordCount > 10_000)
    assert.ok(document.stats.estimatedPageCount > 20)
    assert.ok(['simple', 'moderate', 'complex'].includes(document.stats.readingComplexity))
    assert.ok(elapsed < 15_000, `parsing took ${elapsed}ms, which is far too slow`)
  })
})

describe('malformed documents', () => {
  it('rejects a zip that is not a Word document', async () => {
    assert.equal(
      await parseFixtureExpectingError('malformed-not-word.docx'),
      DOCX_ERROR.missingDocumentXml,
    )
  })

  it('rejects a truncated file as damaged', async () => {
    assert.equal(await parseFixtureExpectingError('malformed-truncated.docx'), DOCX_ERROR.corrupt)
  })

  it('recognises the legacy .doc format', async () => {
    assert.equal(await parseFixtureExpectingError('malformed-legacy.docx'), DOCX_ERROR.legacyFormat)
  })

  it('rejects an empty file', async () => {
    assert.equal(await parseFixtureExpectingError('malformed-empty.docx'), DOCX_ERROR.emptyFile)
  })

  it('never throws, whatever the input', async () => {
    const { createDocxParser } = await import('../lib/parser/docx')
    const parser = createDocxParser()

    // Random bytes, an HTML file renamed, and a valid name with no content.
    const inputs: ArrayBuffer[] = [
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
      new TextEncoder().encode('<html><body>not a docx</body></html>').buffer as ArrayBuffer,
      new ArrayBuffer(0),
    ]

    for (const bytes of inputs) {
      const result = await parser.parse(
        { fileName: 'hostile.docx', mediaType: 'application/octet-stream', bytes },
        { chapterHeadingLevel: 1 },
      )
      assert.equal(result.ok, false, 'hostile input should fail cleanly, not throw')
    }
  })
})

describe('parse options', () => {
  it('honours a different chapter heading level', async () => {
    const atLevelTwo = await parseFixture('non-fiction.docx', { chapterHeadingLevel: 2 })

    // The non-fiction fixture has more Heading 2s than Heading 1s, so asking
    // for level 2 must produce more chapters.
    assert.ok(atLevelTwo.chapters.length > 2)
    assert.equal(atLevelTwo.detection.strategy, 'heading')
  })

  it('reports progress from 0 to 1', async () => {
    const { createDocxParser } = await import('../lib/parser/docx')
    const { readFixture } = await import('./helpers')

    const seen: number[] = []
    const parser = createDocxParser()

    await parser.parse(
      {
        fileName: 'simple-novel.docx',
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytes: await readFixture('simple-novel.docx'),
      },
      { chapterHeadingLevel: 1, onProgress: (ratio) => seen.push(ratio) },
    )

    assert.ok(seen.length >= 3, 'expected several progress reports')
    assert.equal(seen[seen.length - 1], 1)
    // Progress must never go backwards.
    for (let index = 1; index < seen.length; index += 1) {
      assert.ok((seen[index] ?? 0) >= (seen[index - 1] ?? 0), 'progress went backwards')
    }
  })

  it('stops when the signal is aborted', async () => {
    const { createDocxParser } = await import('../lib/parser/docx')
    const { readFixture } = await import('./helpers')

    const controller = new AbortController()
    controller.abort()

    const result = await createDocxParser().parse(
      {
        fileName: 'simple-novel.docx',
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytes: await readFixture('simple-novel.docx'),
      },
      { chapterHeadingLevel: 1, signal: controller.signal },
    )

    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error.code, 'docx.cancelled')
  })
})
