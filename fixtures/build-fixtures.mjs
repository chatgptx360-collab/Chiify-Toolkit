/**
 * Generate sample DOCX manuscripts for testing the parser.
 *
 * WHY GENERATE RATHER THAN COMMIT BINARIES
 * ----------------------------------------
 * A `.docx` is an opaque ZIP. Committing seven of them gives a reviewer no way
 * to see what a fixture contains or why a test expects a particular result, and
 * no way to adjust one without opening Word. Generating them from readable
 * WordprocessingML means the *intent* of each fixture is in version control and
 * a new case is a few lines rather than a round trip through an office suite.
 *
 * The output is real WordprocessingML — the same parts Word writes — so the
 * parser is exercised against genuine input, not a simplified stand-in.
 *
 * Run with: node fixtures/build-fixtures.mjs
 */
/* eslint-disable no-console -- this is a CLI script; its output is the interface. */
import JSZip from 'jszip'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'docx')

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Escape text for XML content. */
const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** A run, optionally bold/italic/underlined. */
const run = (text, { bold, italic, underline } = {}) => {
  const properties =
    bold || italic || underline
      ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${underline ? '<w:u w:val="single"/>' : ''}</w:rPr>`
      : ''
  return `<w:r>${properties}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

/** A paragraph with an optional named style. */
const para = (content, { style, alignment } = {}) => {
  const properties =
    style || alignment
      ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${alignment ? `<w:jc w:val="${alignment}"/>` : ''}</w:pPr>`
      : ''
  return `<w:p>${properties}${content}</w:p>`
}

const heading = (text, level = 1) => para(run(text), { style: `Heading${level}` })
const text = (value, options) => para(run(value, options))
const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
const emptyParagraph = () => '<w:p/>'

const listItem = (value, { ordered = false, level = 0 } = {}) =>
  `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${ordered ? 2 : 1}"/></w:numPr></w:pPr>${run(value)}</w:p>`

const tableRow = (cells, header = false) =>
  // `w:tblHeader` is how Word marks a repeating header row, and it is the
  // signal Mammoth uses to emit <th> rather than <td>.
  `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells
    .map(
      (cell) =>
        `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${para(run(cell, { bold: header }))}</w:tc>`,
    )
    .join('')}</w:tr>`

const table = (rows) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>${rows.join('')}</w:tbl>`

const hyperlink = (label, id) =>
  `<w:hyperlink r:id="${id}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>${esc(label)}</w:t></w:r></w:hyperlink>`

/** An inline image referencing a relationship id. */
const image = (relationshipId, altText, widthPx = 400, heightPx = 300) => {
  const cx = widthPx * 9525
  const cy = heightPx * 9525
  return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Picture 1" descr="${esc(altText)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Picture 1" descr="${esc(altText)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

/** A 1×1 PNG, with a valid IHDR so dimension probing has something to read. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/></w:style>
</w:styles>`

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/></w:lvl>
    <w:lvl w:ilvl="2"><w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`

const coreXml = ({
  title,
  creator,
  description,
  keywords,
  language,
}) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  ${title ? `<dc:title>${esc(title)}</dc:title>` : ''}
  ${creator ? `<dc:creator>${esc(creator)}</dc:creator>` : ''}
  ${description ? `<dc:description>${esc(description)}</dc:description>` : ''}
  ${keywords ? `<cp:keywords>${esc(keywords)}</cp:keywords>` : ''}
  ${language ? `<dc:language>${esc(language)}</dc:language>` : ''}
  <dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">2026-01-15T09:00:00Z</dcterms:created>
</cp:coreProperties>`

/**
 * Assemble a .docx.
 *
 * `images` and `links` become relationships; everything else is fixed
 * boilerplate that every Word package contains.
 */
async function buildDocx({ body, metadata = {}, images: mediaFiles = [], links = [] }) {
  const zip = new JSZip()

  // The mimetype-equivalent for OPC: [Content_Types].xml must list every part.
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
  )

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
  )

  const relationships = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    ...mediaFiles.map(
      (media) =>
        `<Relationship Id="${media.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${media.name}"/>`,
    ),
    ...links.map(
      (link) =>
        `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(link.target)}" TargetMode="External"/>`,
    ),
  ]

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`,
  )

  zip.file('word/styles.xml', STYLES_XML)
  zip.file('word/numbering.xml', NUMBERING_XML)
  zip.file('docProps/core.xml', coreXml(metadata))

  for (const media of mediaFiles) {
    zip.file(`word/media/${media.name}`, media.data)
  }

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}<w:sectPr/></w:body></w:document>`,
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** Filler prose, so word counts and reading estimates are meaningful. */
const prose = (seed, sentences = 4) =>
  Array.from(
    { length: sentences },
    (_, index) =>
      `The wind moved across the ${seed} and everything beneath it went still for a moment longer than seemed reasonable. Nobody spoke of it afterwards, which was itself the clearest possible confirmation that something had happened in section ${index + 1}.`,
  ).join(' ')

const FIXTURES = {
  /** A conventional novel: Heading 1 chapters, plain prose, a scene break. */
  'simple-novel.docx': () =>
    buildDocx({
      metadata: {
        title: 'The Long Winter',
        creator: 'Ada Lovelace',
        description: 'A novel about a season that would not end.',
        language: 'en-GB',
      },
      body: [
        heading('Chapter One'),
        text(prose('valley')),
        text(prose('river')),
        text('* * *', {}),
        text(prose('orchard')),
        pageBreak(),
        heading('Chapter Two'),
        text(prose('city')),
        emptyParagraph(),
        emptyParagraph(),
        text(prose('harbour')),
        pageBreak(),
        heading('Chapter Three'),
        text(prose('mountain')),
        text('She said it was ' + 'over', { italic: true }),
      ].join(''),
    }),

  /** Non-fiction: nested headings, a quote, a footnote-like aside. */
  'non-fiction.docx': () =>
    buildDocx({
      metadata: {
        title: 'On Publishing',
        creator: 'Charles Babbage; Ada Lovelace',
        keywords: 'publishing; typesetting; ebooks',
        language: 'en-US',
      },
      body: [
        para(run('On Publishing'), { style: 'Title' }),
        heading('Part One: Foundations'),
        text(prose('printing press', 3)),
        heading('The Economics of Print', 2),
        text(prose('warehouse', 3)),
        para(run('A book is a machine to think with.'), { style: 'Quote' }),
        heading('Distribution', 2),
        text(prose('depot', 3)),
        heading('Part Two: The Digital Turn'),
        text(prose('server room', 3)),
        heading('Formats', 2),
        text('Reflowable text ', {}),
        text(prose('reader', 2)),
      ].join(''),
    }),

  /** Illustrated: images with and without alt text. */
  'with-images.docx': () =>
    buildDocx({
      metadata: { title: 'Illustrated Guide', creator: 'Grace Hopper' },
      images: [
        { id: 'rIdImg1', name: 'plate1.png', data: PNG_1X1 },
        { id: 'rIdImg2', name: 'plate2.png', data: PNG_1X1 },
      ],
      body: [
        heading('Plates'),
        text(prose('gallery', 2)),
        image('rIdImg1', 'A diagram of the mechanism, viewed from above'),
        text(prose('workshop', 2)),
        // Deliberately undescribed, to exercise the missing-alt-text notice.
        image('rIdImg2', ''),
        text(prose('bench', 2)),
      ].join(''),
    }),

  /** Tables, including a header row. */
  'with-tables.docx': () =>
    buildDocx({
      metadata: { title: 'Reference Tables', creator: 'Katherine Johnson' },
      body: [
        heading('Measurements'),
        text(prose('laboratory', 2)),
        table([
          tableRow(['Format', 'Extension', 'Reflowable'], true),
          tableRow(['EPUB 3', '.epub', 'Yes']),
          tableRow(['PDF', '.pdf', 'No']),
          tableRow(['Markdown', '.md', 'Yes']),
        ]),
        text(prose('annex', 2)),
        heading('Comparisons'),
        table([tableRow(['A', 'B']), tableRow(['1', '2'])]),
      ].join(''),
    }),

  /** Nested ordered and bullet lists. */
  'nested-lists.docx': () =>
    buildDocx({
      metadata: { title: 'A Manual of Procedure', creator: 'Margaret Hamilton' },
      body: [
        heading('Preparing a Manuscript'),
        text(prose('desk', 2)),
        listItem('Apply heading styles', { ordered: true }),
        listItem('Use Heading 1 for chapters', { ordered: true, level: 1 }),
        listItem('Use Heading 2 for sections', { ordered: true, level: 1 }),
        listItem('Add alt text to every image', { ordered: true }),
        heading('Checklist'),
        listItem('Front matter'),
        listItem('Title page', { level: 1 }),
        listItem('Copyright page', { level: 1 }),
        listItem('Body matter'),
        listItem('Back matter'),
      ].join(''),
    }),

  /** Hyperlinks and bookmarks. */
  'with-links.docx': () =>
    buildDocx({
      metadata: { title: 'Linked Text', creator: 'Barbara Liskov' },
      links: [
        { id: 'rIdLink1', target: 'https://www.w3.org/TR/epub-33/' },
        { id: 'rIdLink2', target: 'https://example.org/style-guide' },
      ],
      body: [
        heading('References'),
        para(
          `${run('The specification is published by the ')}${hyperlink('W3C', 'rIdLink1')}${run(' and is worth reading.')}`,
        ),
        para(`${run('See also the ')}${hyperlink('house style guide', 'rIdLink2')}${run('.')}`),
        text(prose('archive', 2)),
      ].join(''),
    }),

  /** No heading styles at all — forces the fallback strategies. */
  'no-headings.docx': () =>
    buildDocx({
      metadata: { title: 'Unstyled Manuscript' },
      body: [
        text('Chapter One', { bold: true }),
        text(prose('field')),
        pageBreak(),
        text('Chapter Two', { bold: true }),
        text(prose('road')),
        pageBreak(),
        text('Chapter Three', { bold: true }),
        text(prose('coast')),
      ].join(''),
    }),

  /** Large manuscript, for performance and statistics. */
  'large-manuscript.docx': () => {
    const chapters = []
    for (let index = 1; index <= 40; index += 1) {
      chapters.push(heading(`Chapter ${index}`))
      for (let paragraph = 0; paragraph < 12; paragraph += 1) {
        chapters.push(text(prose(`region ${index}-${paragraph}`, 5)))
      }
      chapters.push(pageBreak())
    }
    return buildDocx({
      metadata: { title: 'A Very Long Book', creator: 'Anonymous' },
      body: chapters.join(''),
    })
  },
}

/**
 * Deliberately broken files.
 *
 * Each targets a different failure path, because "handles bad input" is
 * meaningless unless the *right* message comes back for each kind of bad.
 */
const MALFORMED = {
  /** Valid ZIP, no Word parts. */
  'malformed-not-word.docx': async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'This is a zip, but it is not a Word document.')
    return zip.generateAsync({ type: 'nodebuffer' })
  },
  /** Truncated: a ZIP header with nothing behind it. */
  'malformed-truncated.docx': async () => Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00]),
  /** An OLE2 compound file — a real .doc, or an encrypted package. */
  'malformed-legacy.docx': async () =>
    Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(512),
    ]),
  /** Empty. */
  'malformed-empty.docx': async () => Buffer.alloc(0),
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  for (const [name, build] of Object.entries({ ...FIXTURES, ...MALFORMED })) {
    const data = await build()
    await writeFile(join(OUTPUT_DIR, name), data)
    console.log(`${name.padEnd(28)} ${String(data.length).padStart(8)} bytes`)
  }
}

await main()
