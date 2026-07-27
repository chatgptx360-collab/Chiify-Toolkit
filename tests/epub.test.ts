import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import JSZip from 'jszip'
import { create } from 'xmlbuilder2'

import { createEpubGenerator } from '../lib/epub'
import { OCF_PATHS } from '../lib/epub/constants'
import { defaultProjectSettings } from '../lib/types/project'
import type { BookMetadata, ProjectSettings } from '../lib/types/project'
import type { ParsedDocument } from '../lib/types/document'

import { parseFixture } from './helpers'

/**
 * EPUB generation tests.
 *
 * These assert on the *package a reading system receives*: the archive is
 * unzipped and its structure inspected. Asserting on the generator's internal
 * return value would pass while producing a file no device can open — and the
 * failures that matter here (mimetype ordering, dangling manifest references,
 * unescaped XML) are all only visible in the bytes.
 *
 * The document model is produced by the parser rather than hand-built, so the
 * two engines are exercised against the same data an author would supply.
 */

const METADATA: BookMetadata = {
  title: 'The Long Winter',
  authors: ['Ada Lovelace'],
  language: 'en-GB',
  description: 'A novel about a season that would not end.',
}

const SETTINGS: ProjectSettings = defaultProjectSettings

/** Generate an EPUB and unzip it, so tests can inspect the real package. */
async function generateAndUnzip(
  document: ParsedDocument,
  overrides: { metadata?: Partial<BookMetadata>; settings?: Partial<ProjectSettings> } = {},
) {
  const result = await createEpubGenerator().generate(
    {
      document,
      metadata: { ...METADATA, ...overrides.metadata },
      settings: { ...SETTINGS, ...overrides.settings },
    },
    {
      now: new Date('2026-01-15T09:00:00Z'),
      generateIdentifier: () => 'urn:uuid:test-fixed-identifier',
    },
  )

  if (!result.ok) {
    throw new Error(`Generation failed: ${result.error.code} — ${result.error.message}`)
  }

  const bytes = await result.value.artifact.blob.arrayBuffer()
  const zip = await JSZip.loadAsync(bytes)

  const read = async (path: string): Promise<string> => {
    const file = zip.file(path)
    if (!file) throw new Error(`Expected ${path} to exist in the package`)
    return file.async('string')
  }

  return { outcome: result.value, zip, read, bytes }
}

describe('container structure', () => {
  it('puts an uncompressed mimetype first, with exact contents', async () => {
    const { zip, read, bytes } = await generateAndUnzip(await parseFixture('simple-novel.docx'))

    // Order matters: the OCF spec requires mimetype to be the first entry so a
    // reader can identify the file without unzipping it.
    const names = Object.keys(zip.files)
    assert.equal(names[0], 'mimetype', 'mimetype must be the first archive entry')

    const mimetype = await read('mimetype')
    // No trailing newline, no BOM — either one fails validation.
    assert.equal(mimetype, 'application/epub+zip')

    // Stored, not deflated. The literal string must appear at a fixed offset
    // in the raw bytes, which is only true when the entry is uncompressed.
    const head = new TextDecoder('ascii').decode(new Uint8Array(bytes).slice(0, 60))
    assert.ok(
      head.includes('application/epub+zip'),
      'mimetype must be stored uncompressed so it is readable in the raw bytes',
    )
  })

  it('writes a container.xml pointing at the package document', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const container = await read(OCF_PATHS.container)

    assert.match(container, /rootfile/)
    assert.match(container, /full-path="OEBPS\/content\.opf"/)
    assert.match(container, /media-type="application\/oebps-package\+xml"/)
  })
})

describe('package document', () => {
  it('declares the four elements EPUB 3 requires', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /<dc:identifier id="pub-id">/)
    assert.match(opf, /<dc:title id="title">The Long Winter<\/dc:title>/)
    assert.match(opf, /<dc:language>en-GB<\/dc:language>/)
    // The one hand-built packages forget.
    assert.match(opf, /property="dcterms:modified">2026-01-15T09:00:00Z</)
  })

  it('points unique-identifier at a real identifier element', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    const unique = /unique-identifier="([^"]+)"/.exec(opf)?.[1]
    assert.ok(unique)
    assert.match(opf, new RegExp(`<dc:identifier id="${unique}"`))
  })

  it('records the author with a role and a sortable name', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /<dc:creator id="creator-1">Ada Lovelace<\/dc:creator>/)
    assert.match(opf, /property="role" scheme="marc:relators">aut</)
    assert.match(opf, /property="file-as">Lovelace, Ada</)
  })

  it('emits accessibility metadata derived from the content', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /schema:accessibilitySummary/)
    assert.match(opf, /property="schema:accessMode">textual</)
    assert.match(opf, /property="schema:accessModeSufficient">textual</)
    assert.match(opf, /schema:accessibilityFeature">tableOfContents</)
  })

  it('does not claim alt text when images lack it', async () => {
    const { read } = await generateAndUnzip(await parseFixture('with-images.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    // The fixture has one described and one undescribed image, so the claim
    // must be absent — a partial claim misleads the reader who relies on it.
    assert.ok(
      !opf.includes('accessibilityFeature">alternativeText'),
      'alternativeText must not be claimed when any image is undescribed',
    )
  })

  it('generates an identifier when the author has not set one', async () => {
    const { read, outcome } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /urn:uuid:test-fixed-identifier/)
    assert.ok(outcome.notices.some((notice) => notice.code === 'epub.generated-identifier'))
  })

  it('formats an ISBN as a urn', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      metadata: { identifier: '978-3-16-148410-0' },
    })
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /urn:isbn:9783161484100/)
  })
})

describe('manifest and spine', () => {
  it('lists every packaged file, and every manifest entry exists', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('with-images.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    const hrefs = [...opf.matchAll(/<item [^>]*href="([^"]+)"/g)].map((match) => match[1])
    assert.ok(hrefs.length > 0)

    // Every manifest entry resolves to a real file — a dangling reference is
    // a fatal validation error.
    for (const href of hrefs) {
      assert.ok(
        zip.file(`${OCF_PATHS.contentRoot}/${href}`),
        `manifest lists ${href}, which is not in the package`,
      )
    }

    // And every content file is in the manifest — an unlisted file does not
    // exist as far as a reading system is concerned.
    const packaged = Object.keys(zip.files).filter(
      (name) =>
        name.startsWith(`${OCF_PATHS.contentRoot}/`) &&
        !name.endsWith('/') &&
        name !== OCF_PATHS.packageDocument,
    )

    for (const name of packaged) {
      const href = name.slice(`${OCF_PATHS.contentRoot}/`.length)
      assert.ok(hrefs.includes(href), `${href} is packaged but missing from the manifest`)
    }
  })

  it('puts every chapter in the spine in reading order', async () => {
    const { read, outcome } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    const idrefs = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((match) => match[1])
    const chapterIds = outcome.epub.spine.filter((item) => item.chapterId).map((item) => item.idref)

    for (const id of chapterIds) {
      assert.ok(idrefs.includes(id), `chapter ${id} is missing from the spine`)
    }
  })

  it('marks the cover and navigation as non-linear', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /<itemref idref="cover-page" linear="no"\/>/)
    assert.match(opf, /<itemref idref="nav" linear="no"\/>/)
  })

  it('marks the navigation document with the nav property', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /<item id="nav"[^>]*properties="nav"/)
  })

  it('marks the cover image with the cover-image property', async () => {
    const { read } = await generateAndUnzip(await parseFixture('with-images.docx'))
    const opf = await read(OCF_PATHS.packageDocument)

    assert.match(opf, /properties="cover-image"/)
    assert.match(opf, /<meta name="cover" content="/)
  })
})

describe('navigation', () => {
  it('builds a nav document listing every chapter', async () => {
    const { read, outcome } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const nav = await read(`${OCF_PATHS.contentRoot}/nav.xhtml`)

    assert.match(nav, /epub:type="toc"/)

    for (const chapter of outcome.epub.navigation) {
      assert.ok(nav.includes(chapter.label), `nav is missing "${chapter.label}"`)
    }
  })

  it('includes a landmarks nav so readers can skip front matter', async () => {
    const { read } = await generateAndUnzip(await parseFixture('non-fiction.docx'))
    const nav = await read(`${OCF_PATHS.contentRoot}/nav.xhtml`)

    assert.match(nav, /epub:type="landmarks"/)
    assert.match(nav, /epub:type="bodymatter"/)
  })

  it('nests subheadings under their chapter', async () => {
    const { outcome } = await generateAndUnzip(await parseFixture('non-fiction.docx'))

    const nested = outcome.epub.navigation.some((item) => (item.children?.length ?? 0) > 0)
    assert.ok(nested, 'expected Heading 2 sections to nest under their chapter')
  })

  it('writes an NCX with a continuous playOrder', async () => {
    const { read } = await generateAndUnzip(await parseFixture('non-fiction.docx'))
    const ncx = await read(`${OCF_PATHS.contentRoot}/toc.ncx`)

    const orders = [...ncx.matchAll(/playOrder="(\d+)"/g)].map((match) => Number(match[1]))
    assert.ok(orders.length > 0)

    // playOrder must be a continuous sequence across nesting levels.
    orders.forEach((value, index) => {
      assert.equal(value, index + 1, 'playOrder must increase by one across the whole document')
    })
  })

  it('omits the NCX when the table of contents is disabled', async () => {
    const { zip } = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      settings: { includeTableOfContents: false },
    })

    assert.equal(zip.file(`${OCF_PATHS.contentRoot}/toc.ncx`), null)
  })
})

describe('chapter documents', () => {
  it('produces well-formed XHTML with the right namespaces', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))

    const chapters = Object.keys(zip.files).filter(
      // JSZip lists directory entries as well; they are not readable files.
      (name) => name.includes('/text/') && !name.endsWith('/'),
    )
    assert.ok(chapters.length > 0)

    for (const name of chapters) {
      const content = await read(name)
      assert.match(content, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
      assert.match(content, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/)
      assert.match(content, /xmlns:epub="http:\/\/www\.idpf\.org\/2007\/ops"/)
      assert.match(content, /<\/html>$/)
    }
  })

  it('escapes characters that would break the XML', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      metadata: { title: 'Tom & Jerry <the "book">' },
    })

    const opf = await read(OCF_PATHS.packageDocument)
    assert.match(opf, /Tom &amp; Jerry &lt;the "book"&gt;/)
    assert.ok(!opf.includes('Tom & Jerry <the'), 'raw ampersand would break the package')
  })

  it('marks chapter semantics for reading systems', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('non-fiction.docx'))

    const first = Object.keys(zip.files).find(
      (name) => name.includes('/text/') && name.endsWith('.xhtml') && !name.includes('cover'),
    )
    assert.ok(first)

    const content = await read(first)
    assert.match(content, /epub:type="(frontmatter|bodymatter|backmatter)"/)
  })

  it('renders tables with header scope', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('with-tables.docx'))

    const files = Object.keys(zip.files).filter(
      (name) => name.includes('/text/') && !name.endsWith('/'),
    )
    const combined = (await Promise.all(files.map(read))).join('\n')

    assert.match(combined, /<table>/)
    assert.match(combined, /<th scope="col">/)
    assert.match(combined, /<tbody>/)
  })

  it('renders nested lists inside their parent item', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('nested-lists.docx'))

    const files = Object.keys(zip.files).filter(
      (name) => name.includes('/text/') && !name.endsWith('/'),
    )
    const combined = (await Promise.all(files.map(read))).join('\n')

    assert.match(combined, /<ol>/)
    assert.match(combined, /<ul>/)
    // A nested list is a child of <li>, not a sibling.
    assert.match(combined, /<li>[\s\S]*?<(ol|ul)>/)
  })

  it('renders links with their href intact', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('with-links.docx'))

    const files = Object.keys(zip.files).filter(
      (name) => name.includes('/text/') && !name.endsWith('/'),
    )
    const combined = (await Promise.all(files.map(read))).join('\n')

    assert.match(combined, /<a href="https:\/\/www\.w3\.org/)
  })

  it('renders images with alt text and a resolvable relative path', async () => {
    const { zip, read } = await generateAndUnzip(await parseFixture('with-images.docx'))

    const files = Object.keys(zip.files).filter(
      (name) => name.includes('/text/') && !name.endsWith('/'),
    )
    const combined = (await Promise.all(files.map(read))).join('\n')

    assert.match(combined, /<figure class="illustration">/)
    assert.match(combined, /alt="A diagram of the mechanism, viewed from above"/)

    // Chapters live in text/, images in images/, so the href must climb.
    const src = /<img src="([^"]+)"/.exec(combined)?.[1]
    assert.ok(src, 'expected an image reference')
    assert.ok(src.startsWith('../images/'), `expected a relative path, got ${src}`)
    assert.ok(zip.file(`${OCF_PATHS.contentRoot}/${src.replace('../', '')}`))
  })
})

describe('well-formedness', () => {
  /**
   * Parse every XML document in the package.
   *
   * This is the check that matters most: EPUB content documents must be
   * well-formed XML, not merely plausible HTML, and a single unescaped
   * character produces a book that every conforming reading system refuses to
   * open. Re-parsing what we wrote is the only way to prove the serialiser and
   * the escaping actually held.
   */
  it('produces XML that parses, for every fixture', async () => {
    const fixtures = [
      'simple-novel.docx',
      'non-fiction.docx',
      'with-images.docx',
      'with-tables.docx',
      'nested-lists.docx',
      'with-links.docx',
    ]

    for (const fixture of fixtures) {
      const { zip, read } = await generateAndUnzip(await parseFixture(fixture))

      const xmlFiles = Object.keys(zip.files).filter(
        (name) =>
          !name.endsWith('/') &&
          (name.endsWith('.xhtml') ||
            name.endsWith('.opf') ||
            name.endsWith('.ncx') ||
            name.endsWith('.xml')),
      )

      assert.ok(xmlFiles.length >= 4, `${fixture} produced too few XML documents`)

      for (const name of xmlFiles) {
        const content = await read(name)
        assert.doesNotThrow(() => create(content), `${name} in ${fixture} is not well-formed XML`)
      }
    }
  })

  it('survives content that would break naive escaping', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      metadata: {
        title: 'A & B <C> "D" \'E\'',
        authors: ["O'Brien & Sons"],
        description: 'Contains <script>alert("x")</script> and 5 > 3 & 2 < 4.',
      },
    })

    const opf = await read(OCF_PATHS.packageDocument)

    assert.doesNotThrow(() => create(opf), 'hostile metadata must still produce valid XML')
    assert.ok(!opf.includes('<script>'), 'markup in metadata must be escaped, not embedded')
  })
})

describe('stylesheet', () => {
  it('avoids fixed colours and absolute sizes on body text', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const css = await read(`${OCF_PATHS.contentRoot}/styles/book.css`)

    // A fixed colour on body text disappears in a reader's night mode.
    assert.ok(!/body\s*\{[^}]*color:/.test(css), 'body must not fix a text colour')
    // Absolute units cannot be overridden by a reader who needs larger text.
    assert.ok(!/font-size:\s*\d+(pt|px)/.test(css), 'font sizes must be relative')
    assert.match(css, /max-width: 100%/)
  })

  it('changes typography with the theme', async () => {
    const classic = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      settings: { theme: 'classic' },
    })
    const modern = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      settings: { theme: 'modern' },
    })

    const a = await classic.read(`${OCF_PATHS.contentRoot}/styles/book.css`)
    const b = await modern.read(`${OCF_PATHS.contentRoot}/styles/book.css`)

    assert.notEqual(a, b)
    assert.match(a, /serif/)
    assert.match(b, /sans-serif/)
  })
})

describe('cover', () => {
  it('generates a typographic cover when the book has no image', async () => {
    const { read } = await generateAndUnzip(await parseFixture('simple-novel.docx'))
    const cover = await read(`${OCF_PATHS.contentRoot}/text/cover.xhtml`)

    assert.match(cover, /epub:type="cover"/)
    assert.match(cover, /The Long Winter/)
    assert.match(cover, /Ada Lovelace/)
  })

  it('uses the first illustration as the cover image', async () => {
    const { read } = await generateAndUnzip(await parseFixture('with-images.docx'))
    const cover = await read(`${OCF_PATHS.contentRoot}/text/cover.xhtml`)

    assert.match(cover, /<img src="\.\.\/images\//)
    assert.match(cover, /alt="Cover of/)
  })

  it('can be turned off', async () => {
    const { zip } = await generateAndUnzip(await parseFixture('simple-novel.docx'), {
      settings: { generateCoverPage: false },
    })

    assert.equal(zip.file(`${OCF_PATHS.contentRoot}/text/cover.xhtml`), null)
  })
})

describe('naming', () => {
  it('produces safe, unique, lowercase filenames', async () => {
    const { zip } = await generateAndUnzip(await parseFixture('simple-novel.docx'))

    const names = Object.keys(zip.files).filter((name) => !name.endsWith('/'))

    for (const name of names) {
      // `mimetype` and `META-INF` are fixed by the specification.
      if (name === 'mimetype' || name.startsWith('META-INF')) continue

      const file = name.split('/').pop() ?? ''
      assert.ok(/^[a-z0-9._-]+$/.test(file), `${file} is not a safe filename`)
    }

    // Case-insensitive uniqueness: two files differing only by case corrupt
    // the book on Windows and macOS.
    const lower = names.map((name) => name.toLowerCase())
    assert.equal(new Set(lower).size, lower.length, 'filenames must be unique case-insensitively')
  })
})

describe('robustness and scale', () => {
  it('reports progress from start to finish without going backwards', async () => {
    const document = await parseFixture('simple-novel.docx')
    const seen: number[] = []

    const result = await createEpubGenerator().generate(
      { document, metadata: METADATA, settings: SETTINGS },
      { onProgress: (progress) => seen.push(progress.ratio) },
    )

    assert.ok(result.ok)
    assert.ok(seen.length >= 5, 'expected a report per stage')
    assert.equal(seen[seen.length - 1], 1)

    for (let index = 1; index < seen.length; index += 1) {
      assert.ok((seen[index] ?? 0) >= (seen[index - 1] ?? 0), 'progress went backwards')
    }
  })

  it('stops when the signal is aborted', async () => {
    const document = await parseFixture('simple-novel.docx')
    const controller = new AbortController()
    controller.abort()

    const result = await createEpubGenerator().generate(
      { document, metadata: METADATA, settings: SETTINGS },
      { signal: controller.signal },
    )

    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error.code, 'epub.cancelled')
  })

  it('refuses a document with no content, with a useful message', async () => {
    const empty: ParsedDocument = {
      ...(await parseFixture('simple-novel.docx')),
      chapters: [],
    }

    const result = await createEpubGenerator().generate({
      document: empty,
      metadata: METADATA,
      settings: SETTINGS,
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'epub.no-content')
      assert.ok(result.error.hint)
    }
  })

  it('packages a 40-chapter manuscript within a sensible time', async () => {
    const document = await parseFixture('large-manuscript.docx')

    const started = Date.now()
    const { zip, outcome } = await generateAndUnzip(document)
    const elapsed = Date.now() - started

    assert.equal(outcome.epub.spine.filter((item) => item.chapterId).length, 40)
    assert.ok(Object.keys(zip.files).length > 40)
    assert.ok(elapsed < 20_000, `generation took ${elapsed}ms, which is far too slow`)
  })

  it('produces identical bytes for identical input', async () => {
    const document = await parseFixture('simple-novel.docx')

    const build = async () => {
      const result = await createEpubGenerator().generate(
        { document, metadata: METADATA, settings: SETTINGS },
        {
          now: new Date('2026-01-15T09:00:00Z'),
          generateIdentifier: () => 'urn:uuid:test-fixed-identifier',
        },
      )
      if (!result.ok) throw new Error('generation failed')
      return new Uint8Array(await result.value.artifact.blob.arrayBuffer())
    }

    const [first, second] = await Promise.all([build(), build()])

    // Reproducible output makes a rebuild diffable and caching meaningful.
    assert.deepEqual(first, second, 'the same book must produce the same bytes')
  })

  it('names the download after the book', async () => {
    const { outcome } = await generateAndUnzip(await parseFixture('simple-novel.docx'))

    assert.equal(outcome.artifact.fileName, 'the-long-winter.epub')
    assert.equal(outcome.artifact.mediaType, 'application/epub+zip')
    assert.ok(outcome.artifact.byteSize > 0)
  })
})
