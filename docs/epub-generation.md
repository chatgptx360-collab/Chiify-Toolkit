# The EPUB generation engine

How the internal document model becomes a standards-compliant EPUB 3 book, and
why each decision was made.

The governing constraint, and it runs both ways:

- **The engine reads the internal document model and nothing else.** It never
  sees a `.docx`, never calls the parser, and does not know one exists. A
  Markdown importer added later produces the same model and this code generates
  the same EPUB from it, unchanged.
- **Nothing outside `lib/epub` knows what an OPF is.** The UI asks for an
  artifact and receives a `Blob`.

---

## The pipeline

```
ParsedDocument
 ↓  asset-manager        images → container paths, ids, media types, cover
 ↓  xhtml-generator      blocks → XHTML, one document per chapter
 ↓  stylesheet-generator theme → book.css
 ↓  navigation-builder   chapters + headings → nav.xhtml and toc.ncx
 ↓  metadata-builder     BookMetadata → Dublin Core + accessibility
 ↓  package-document     manifest, spine, guide → content.opf
 ↓  packager             JSZip, mimetype first and uncompressed
EpubArtifact (Blob)
```

`generator.ts` orchestrates and does nothing else — the same shape as the DOCX
parser. Every real decision lives in a service with one responsibility.

---

## Decisions worth knowing

### `xmlbuilder2` rather than string templates

EPUB content documents must be well-formed **XML**, not merely valid HTML. A
single unescaped `&` in a book title — "Tom & Jerry" — produces a file every
conforming reading system refuses to open, and template literals make that
mistake easy and invisible.

Building a tree makes escaping structural: it cannot be forgotten. A test
re-parses every XML document in every generated package to prove it held,
including one that feeds deliberately hostile metadata through the whole engine.

### The exhaustive switch is the safety net

`renderBlock` switches over the `Block` union with **no `default` branch**. When
a future phase adds a block type to the document model, this file stops
compiling. A generator that silently skipped unknown blocks would ship books
with missing content and no error anywhere.

### The mimetype rule that breaks everything if ignored

The `mimetype` entry must be **first in the archive** and **stored
uncompressed**, containing exactly `application/epub+zip` with no trailing
newline and no BOM.

This is not style. The OCF specification defines it so a reading system can
identify an EPUB by reading the first thirty bytes. Get it wrong and the failure
is confusing rather than obvious: the archive is a valid zip, every other file
is correct, and some readers open it happily while Apple Books and EPUBCheck
reject it outright.

A test asserts the entry order _and_ greps the raw bytes for the literal string,
which is only present at that offset when the entry is genuinely uncompressed.

### Images are stored, not deflated

XHTML and CSS compress to roughly a fifth of their size. JPEG and PNG are
already compressed, so re-compressing them costs time and saves nothing — they
are stored instead, which measurably speeds up packaging an illustrated book.

### Filenames are more conservative than the spec requires

Lowercase, ASCII, no spaces. The OCF spec permits more, but reading systems
disagree about it:

| Rule                      | Reason                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ASCII only                | Non-ASCII names need percent-encoding, and older Kobo firmware fails to decode it — images silently do not load |
| Lowercase                 | Some readers unpack to a case-insensitive filesystem, where `Chapter1.xhtml` and `chapter1.xhtml` collide       |
| No spaces                 | Legal, but must be encoded as `%20` in hrefs — another thing two code paths can disagree about                  |
| No Windows reserved stems | `con.xhtml` cannot be unpacked on Windows at all                                                                |

Names are assigned by one registry shared between chapters _and_ images, so a
chapter and an illustration can never claim the same name. Uniqueness is tracked
case-insensitively.

### Every href is relative to the referencing document

A chapter in `text/` linking to an image in `images/` must write
`../images/plate.png`. Writing the package-root path is the second most common
broken-reference bug after inconsistent naming, so resolution goes through one
function.

### Two navigation documents, deliberately

`nav.xhtml` is required by EPUB 3 and is what modern reading systems use.
`toc.ncx` is the superseded EPUB 2 table of contents — and Apple Books
historically fell back to it, older Kobo and Sony firmware need it, and Kindle
conversion reads it. A few kilobytes for a great deal of device compatibility.

The NCX's `playOrder` must be a continuous sequence **across nesting levels**,
not per level; a test asserts exactly that.

### The stylesheet suggests, it does not specify

A print stylesheet specifies. An EPUB stylesheet suggests — readers change the
font, size, margins, background and line spacing, and a reading system may
override anything.

| Never                | Why                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fixed font sizes     | A book specifying `12pt` is unreadable for someone who needs 24pt, and they cannot fix it                                       |
| Colours on body text | `color: #333` looks refined on white and is invisible in night mode, because the reader changes the background and not the text |
| Fixed widths         | The reading system owns the viewport                                                                                            |
| Justified text       | Without reliable hyphenation it produces rivers of whitespace on a narrow screen                                                |

Tests assert the absence of the first two directly, because they are the
failures an author would only discover from a one-star review.

Themes change family, leading and indentation — the choices a typesetter makes.
None touches colour or absolute size, so switching theme cannot make a book less
accessible.

### Accessibility metadata is computed, not asserted

The spec treats it as optional; the European Accessibility Act and the major
retailers do not. It is emitted for every book and derived from what the content
actually contains.

`accessibilityFeature: alternativeText` is claimed **only when every image has
alt text**. Partial coverage is worse than none: a reader who trusts the claim
is misled at the first undescribed figure. A test asserts the claim is absent
for a fixture with one described and one undescribed image.

### Missing metadata is filled, not rejected

An author without an ISBN should still be able to read their own book on a
device. So required fields get sensible defaults — a generated UUID, "Untitled",
the project language — and a notice explains what was substituted. Refusing to
convert would cost them the file to gain a warning they could have been given
anyway.

### Output is reproducible

Every zip entry carries a fixed timestamp, and the identifier and modification
time are injectable. The same book generates byte-identical output, which makes
a rebuild diffable and caching meaningful. A test builds the same book twice and
compares the bytes.

---

## What the package looks like

```
mimetype                      first, stored uncompressed
META-INF/
  container.xml               points at the package document
OEBPS/
  content.opf                 metadata, manifest, spine, guide
  nav.xhtml                   EPUB 3 navigation + landmarks
  toc.ncx                     EPUB 2 fallback (optional)
  styles/
    book.css                  one stylesheet, themed
  text/
    cover.xhtml               image or typographic
    chapter-one.xhtml         one document per chapter
    …
  images/
    plate-one.png             safe names, referenced relatively
```

---

## Error handling

Errors are values, never exceptions. The generator returns:

| Code                    | Meaning                                                   |
| ----------------------- | --------------------------------------------------------- |
| `epub.no-content`       | The document has no readable chapters                     |
| `epub.packaging-failed` | The archive could not be assembled, usually out of memory |
| `epub.cancelled`        | The author cancelled; `severity: info`, not a failure     |

Non-fatal observations are returned as `notices` on a **successful** generation —
a generated identifier, skipped empty chapters, an image in a format some
readers cannot display. A book that converted with three things worth checking
is a success with three notices, not a failure.

---

## Testing

```bash
npm run test
```

40 tests, which **unzip the generated archive and inspect the real package**.
Asserting on the generator's return value would pass while producing a file no
device can open, and the failures that matter here — mimetype ordering, dangling
manifest references, unescaped XML — are only visible in the bytes.

Coverage includes: container structure and mimetype storage; the four required
EPUB 3 metadata elements; manifest/package cross-checking in both directions
(every manifest entry exists, every packaged file is listed); spine order and
non-linear items; nav and NCX; XHTML namespaces and semantics; tables with
header scope; nested lists; relative image paths; stylesheet constraints; cover
generation with and without an image; filename safety and case-insensitive
uniqueness; progress monotonicity; cancellation; reproducibility; and a
40-chapter manuscript with a wall-clock bound.

---

## What Phase 5 will build on

`GenerationOutcome` deliberately returns more than the file:

- `artifact` — the downloadable `Blob`.
- `epub` — the described package: resources, spine, navigation, accessibility.
- `files` — the generated text resources.

Validation and preview can therefore work from the structure **without
unzipping anything**, and the preview renders the exact same XHTML the download
contains. The `EpubValidator` interface in `lib/epub/types.ts` is the port a
native TypeScript validator implements.
