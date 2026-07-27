# The DOCX parsing pipeline

How a Word manuscript becomes the internal document model, and why each step
works the way it does.

The governing constraint: **nothing in `lib/parser` may know what an EPUB is.**
The parser is the universal input layer. Every export format on the roadmap —
EPUB, PDF, MOBI, HTML, Markdown — consumes its output, so a single EPUB
assumption leaking in here would couple all of them together.

---

## The pipeline

```
File
 ↓  validator          extension, size, magic bytes, encryption, archive integrity
 ↓  metadata-extractor docProps/core.xml + app.xml  → suggestions
 ↓  mammoth            Word XML → semantic HTML (style map applied)
 ↓  image-extractor    bytes, alt text, format, dimensions, DPI
 ↓  html-parser        HTML → node tree, no DOM required
 ↓  html-to-blocks     node tree → Block[]
 ↓  normalizer         invisible characters, empty paragraphs, broken references
 ↓  chapter-detector   boundaries + confidence score
 ↓  statistics         counts, reading time, page estimate, readability
ParsedDocument
```

`parser.ts` runs these in order and does nothing else. Every real decision lives
in a service with one responsibility, injected with a working default — which is
what makes the hard parts testable without a `.docx` at all: the chapter
detector takes blocks, the statistics generator takes chapters.

---

## Decisions worth knowing

### Validation runs cheapest-first, on magic bytes

Browsers report `.docx` inconsistently — often `application/octet-stream` on
Linux, and whatever the OS guessed for a drag-and-drop. The media type is not
trustworthy, so the first four bytes are checked instead.

That also buys _specific_ errors rather than one vague one:

| Signature                          | Meaning                    | Message                                          |
| ---------------------------------- | -------------------------- | ------------------------------------------------ |
| `50 4B 03 04`                      | A ZIP — could be a `.docx` | continue                                         |
| `50 4B 05 06`                      | An empty ZIP               | "does not contain a Word document"               |
| `D0 CF 11 E0` + `EncryptedPackage` | Password protected         | "remove the password in Word"                    |
| `D0 CF 11 E0`                      | Word 97–2003 `.doc`        | "save as Word Document (.docx)"                  |
| anything else                      | Damaged                    | "try opening it in Word and saving a fresh copy" |

Every message names the file and says what to _do_. An author did not write the
XML and should not be told about it.

### Mammoth owns the Word XML; we own the semantics

Mammoth converts Word's markup to HTML. The custom style map in `style-map.ts`
makes that output _semantic_ rather than merely visual, with two decisions worth
recording:

- **Underline is preserved.** Mammoth discards it by default, on the sound
  general principle that underline means "link" on the web. In a manuscript it
  usually means emphasis a typesetter would set in italics, and silently
  deleting an author's formatting is not ours to do.
- **Word's "Title" style is not a heading.** It is the _book's_ title, so
  mapping it to `h1` would make the title page a chapter named after the book.
  It becomes a paragraph with a role; the title itself is already captured as
  embedded metadata.

### The HTML parser is deliberately tiny

`DOMParser` is browser-only. Using it would mean the parser cannot run in Node
(no unit tests without a DOM shim) and cannot run in a Web Worker without extra
plumbing — which is exactly where Phase 6 wants to move it.

The input is not arbitrary web HTML; it is Mammoth's own output, a small closed
set of well-formed elements. So `html-parser.ts` is about a hundred lines rather
than a several-hundred-kilobyte dependency. **It is not a sanitiser and must
never be pointed at untrusted HTML.**

### Images are collected during conversion, not afterwards

Scanning `word/media/` would give us the pixels and lose the alt text, which
lives on the drawing element in `document.xml` — the single most important
accessibility field a book has. Collecting during the walk keeps the two
together, and skips media the author deleted but Word retained.

The handler returns a `chiify-asset:` URL instead of Mammoth's default data URI.
For an illustrated book, inlining every image as base64 means holding the whole
manuscript's images — a third larger than the originals — in one string before
any of it is needed.

Dimensions are read straight from the image header. Decoding would mean an
async `Image` round trip per picture in the browser, and is unavailable in Node
without a canvas shim.

### Normalisation preserves author intent

Every rule is a judgement about whether something is _noise from the word
processor_ or _a decision the author made_. When the two are hard to tell apart,
the author wins and a notice is raised instead.

| Removed                                          | Kept                                     |
| ------------------------------------------------ | ---------------------------------------- |
| Zero-width and control characters                | A paragraph containing only an em dash   |
| Paragraphs with nothing in them                  | Two short paragraphs that look like one  |
| A heading immediately repeated                   | Two distant chapters with the same title |
| Consecutive page breaks                          | A single deliberate page break           |
| Links to bookmarks that do not exist (text kept) | External links                           |

Word fragments a sentence into many runs whenever anything changes — a spell
check pass, a tracked edit, a language tag. Merging identically-styled runs is
not cosmetic: it makes word counts correct across run edges and stops the
exported XHTML being a mass of pointless `<span>` boundaries.

### Chapter detection returns a confidence score, not a boolean

A Word file is a flat stream of paragraphs; "chapter" is not a concept it has.
Authors who use heading styles give us the structure directly. Most do not —
they centre a bold line and press Ctrl+Enter.

So detection is a ladder, tried in order of trustworthiness:

| Strategy          | When                                             | Base score |
| ----------------- | ------------------------------------------------ | ---------- |
| `heading`         | The configured heading level exists              | 1.0        |
| `headingFallback` | A different level is used consistently           | 0.85       |
| `pageBreak`       | No headings, but explicit page breaks            | 0.6        |
| `titleHeuristic`  | Short, centred or emphasised standalone lines    | 0.4        |
| `single`          | Nothing found — one chapter is a truthful answer | 0.2        |

The base score is then multiplied by how _plausible_ the result is: whether the
chapter count is believable, and how evenly the words are distributed. Two
`Heading 1`s in a 400-page manuscript scores low even though the strategy is the
reliable one — because that is almost certainly a styled title page, not a
two-chapter book.

Content before the first heading becomes a front-matter chapter. It must be kept
(dropping an author's opening pages would be silent data loss) but it is not
chapter one.

### Statistics are estimates, and say which assumptions they encode

Reading time and page count are conversions, not measurements. The constants are
named and documented — 240 words per minute, 275 words per printed page — so a
maintainer can change them deliberately rather than guessing why a number looks
wrong.

Readability is a coarse band (`simple` / `moderate` / `complex`) rather than a
decimal index. Readability formulas need a syllable dictionary that does not
exist here, and "Flesch 62.4" would imply a precision the input does not
support. Authors want to know whether their prose reads long.

### Embedded metadata is suggested, never applied

`docProps/core.xml` is filled in by Word from the operating system. Its
`dc:creator` is frequently the machine's account name; its `dc:title` is often a
filename or an early working title. Applying those silently would corrupt
metadata the author had already got right, and they might not notice until a
retailer rejected the book.

So `EmbeddedMetadata` is a separate type from `BookMetadata`, a field is only
offered when the project's own value is empty, and applying is always a click.
Known placeholder names ("Windows User", "Administrator") are filtered out
entirely — suggesting one is worse than suggesting nothing.

---

## Errors and notices

Two categories, deliberately distinct:

- **Errors** (`Result.err`) stop the parse. The file cannot be read at all.
- **Notices** (`document.notices`) are data on a _successful_ parse. A
  manuscript with three undescribed images converted fine and has three things
  to fix.

The parser never throws. Hostile input — random bytes, an HTML file renamed,
an empty file — returns a structured failure, and a test asserts exactly that.

---

## Storage

Parsed documents live in memory for the session (`lib/documents`), and are
deliberately **not** persisted:

|                     | Projects             | Documents                     |
| ------------------- | -------------------- | ----------------------------- |
| Authored or derived | Authored by the user | Derived from a file           |
| Size                | A few kilobytes      | Tens of megabytes with images |
| Persisted           | Yes, `localStorage`  | No                            |
| Recoverable         | Only from backup     | Re-upload the file            |

Persisting a parsed document would trade a large, fragile cache for the ability
to skip a parse that takes under a second. The UI says so plainly when a project
is reopened. When Phase 6 adds an IndexedDB blob store, `DocumentStore` is the
interface it implements — no component changes.

---

## Testing

```bash
npm run fixtures   # regenerate the sample manuscripts
npm run test       # run the suite
```

The fixtures are **generated from readable WordprocessingML** rather than
committed as opaque binaries. A reviewer can see what each one contains and why
a test expects a particular result, and adding a case is a few lines rather than
a round trip through Word.

| Fixture            | Exercises                                                           |
| ------------------ | ------------------------------------------------------------------- |
| `simple-novel`     | Heading 1 chapters, emphasis, scene breaks, empty-paragraph removal |
| `non-fiction`      | Nested headings, blockquotes, multiple authors, front matter        |
| `with-images`      | Image bytes, alt text, dimension probing, missing-alt notices       |
| `with-tables`      | Header rows, cells, table counts                                    |
| `nested-lists`     | Ordered and unordered nesting                                       |
| `with-links`       | External hyperlinks                                                 |
| `no-headings`      | Every fallback strategy and a lowered confidence score              |
| `large-manuscript` | 40 chapters; asserts a wall-clock bound                             |
| `malformed-*`      | Not-a-Word-file, truncated, legacy `.doc`, empty                    |

Tests assert on _behaviour an author would notice_, not on internal shapes, so
refactoring a service does not rewrite the suite.
