# Validation, quality and preview

How Chiify checks a generated book, scores it, proposes fixes and lets you read
it — and why each decision was made.

The governing constraint, as in every phase, runs one way:

- **`lib/validation` reads an EPUB package. `lib/epub` has never heard of it.**
  The generator can be used without the validator, and a change to a rule can
  never change the bytes of a book.
- **Nothing above `lib/validation` knows what an OPF is.** The UI receives
  findings, scores and proposals.

---

## Why not EPUBCheck

EPUBCheck is the reference implementation and the thing retailers actually run.
It is also a Java application.

Chiify is local-first: your manuscript never leaves your machine. Shipping a JVM
to a browser is not possible, and uploading every author's unpublished book to a
server to be checked is a worse trade than the problem it solves. So the checks
are native TypeScript, run against the package already in memory.

That is a real limitation and the UI says so, in the report and in every export:
this is Chiify's own check, not official certification.

What it does catch is the entire class of problems this generator can produce —
plus a category EPUBCheck does not check at all. A missing ISBN is not a
specification violation, and it is the most common reason a submission is
refused.

---

## The pipeline

```
GenerationOutcome
 ↓  prepare        markup scanned once, shared by every inspector
 ↓  inspect        eight inspectors, isolated, in parallel categories
 ↓  dedupe + sort  severity, then impact, then category
 ↓  score          per category, from findings ÷ checks actually run
 ↓  assess         five devices and stores
QualityReport
 ↓  auto-fix       proposals — nothing is applied
 ↓  report         JSON, printable HTML, plain text
```

---

## Decisions worth knowing

### Severity and impact are different questions

Severity answers "is the book broken". Impact answers "what happens to me if I
ignore this" — and that is the question an author is actually asking.

A missing ISBN is not an error: the file opens perfectly on every device. It
will also get the book refused by every retailer, which matters more to the
author than a warning about an image format one old device cannot display. So
every finding carries both, and the UI leads with impact.

Marking commercial requirements as errors would teach authors to ignore errors.

### Scores are calculated, never looked up

Each inspector reports how many assertions it made **about this book**. A
finding deducts a fraction of one check, weighted by severity:

```
score = 100 × (1 − deductions ÷ checks)
```

Two warnings out of eight metadata checks is a worse metadata score than two
warnings out of eighty markup checks — the first book has a quarter of its
metadata wrong, the second has two blemishes. A score that ignored the
denominator would call them equal.

The overall score is a weighted mean, not a flat one: structure and markup
decide whether the book works at all, compatibility describes stores rather than
the file.

### Readiness is not derived from the score

They answer different questions and are allowed to disagree. A book with one
error scores in the nineties and is still not publishable, so readiness comes
from errors and blocking impact and never from the number.

### The validator parses markup it generated itself

In principle everything `xmlbuilder2` produces is well-formed. Checking anyway
is not paranoia:

- A validator that trusts its own generator only proves the generator is
  self-consistent. It cannot catch a regression in the generator — which is
  exactly the failure a reader experiences as "the book will not open".
- Every structural check needs the elements anyway. Scanning once and sharing
  the result is cheaper than eight inspectors each doing their own matching.
- When a later phase imports an existing EPUB, the markup will be someone
  else's, and this is where it gets checked.

`DOMParser` is browser-only, and `xmlbuilder2` reports the first error by
throwing — an author wants every problem listed at once. So `xml-scan.ts` is a
strict scanner that collects errors and keeps going.

### Nothing is ever changed without being shown first

The auto-fix engine returns **proposals**: field, before, after, and why.
Applying one is a separate call the UI makes only after the author has seen the
change and pressed a button.

A tool that silently corrects an author's metadata is a tool that eventually
silently corrects something they meant. The moment a writer cannot trust that
the file contains what they wrote, the tool has cost them more than it saved.

Fixes are also applied to the **project**, not to the generated book — so the
change survives and takes effect on the next conversion rather than editing a
file that has already been built.

### What is deliberately not auto-fixable

Anything requiring authorship. There is no proposal to write a description,
invent subjects, or improve alt text, because the only honest version of those
is an empty field and a note explaining why it matters.

A wrong ISBN check digit is not corrected either. Removing punctuation from a
valid ISBN is a formatting fix; guessing at a transposed digit is inventing a
number that identifies somebody else's book.

Dates and publishers sit on the edge — derivable, but claims about the world.
They are offered with the source of the value stated, so the author is agreeing
to a fact rather than accepting a correction.

### Compatibility is stated as behaviour, not as versions

Retailer requirements change without notice and device fleets are decades wide.
Each rule is written as an observable consequence — "the library tile is blank",
"the contents list is empty" — so it stays true when a specific requirement
moves, and so the author can judge whether they care.

### An inspector that throws must not take the report with it

Each one is isolated, and a failure becomes a finding of its own. An author
seeing "one check could not run" alongside their other eighty findings is far
better served than one seeing an error screen.

---

## What is checked

| Area              | Examples                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Structure**     | Manifest ↔ files in both directions, duplicate ids, case-colliding names, spine integrity, contents order, NCX parity |
| **Metadata**      | The four EPUB 3 requirements, ISBN check digits, language tags, and the commercial fields retailers demand            |
| **Markup**        | Well-formedness, namespaces, page titles, every internal reference resolved, remote resources, obsolete elements      |
| **Stylesheet**    | Fixed font sizes, colours on body text, fixed widths, `!important`, remote imports, justification without hyphens     |
| **Accessibility** | Declared language, alt text, heading hierarchy, table headers, schema.org metadata, opaque link text                  |
| **Resources**     | Image weight, formats, unreferenced files, the cover                                                                  |
| **Compatibility** | Kindle, Apple Books, Kobo, Google Play, and open-source EPUB 3 readers                                                |

The cross-check that runs **both ways** is worth calling out: a manifest entry
with no file makes the book invalid loudly, and a file with no manifest entry is
invisible to the reading system quietly. Checking one direction catches the loud
one and misses the quiet one.

---

## The preview

### It renders the real files

The exact XHTML and the exact CSS inside the download. Nothing is re-generated
from the document model and no separate "preview markup" exists to drift away
from the real thing. If a chapter looks wrong here, it is wrong in the book.

### A sandboxed iframe, for two reasons

**Fidelity.** The book carries its own stylesheet, and seeing what that
stylesheet does is the point. Injecting the markup into the application document
would let Tailwind's reset silently change every margin.

**Containment.** The markup came from a Word document, which is to say from
anywhere. `sandbox` with no allow flags means no scripts, no forms, no
navigation, no access to the page around it.

### Images become data URIs

A sandboxed frame has an opaque origin, and a `blob:` URL created by the parent
belongs to the parent's origin — so the image silently fails to load. Data URIs
have no origin to disagree about, and they mean the renderer works unchanged in
Node, where `URL.createObjectURL` does not exist.

### Links are defused

A relative link inside `srcdoc` resolves against `about:srcdoc` and replaces the
chapter with a browser error page — the reader would appear to have crashed.
Fragment links stay live, because footnotes are exactly what an author wants to
test.

### Reader settings win

The simulated settings are appended after the book's stylesheet and override it,
which is what a real reading system does. That is why a stylesheet that fixes a
font size is reported as a fault: the author cannot take that control away, and
the preview demonstrates it.

Device widths are rendered at their real size and scaled down visually. A
narrower frame would reflow the text and show a layout the device will never
produce.

---

## Where the report lives

Builds are held in memory per project (`lib/builds`), exactly as parsed
documents are, and the validation report is attached to the build:

- Four screens want the report; validation is deterministic, so computing it
  once gives all four the same answer.
- The cache cannot outlive the book it describes, because it is part of it.

Re-uploading a manuscript discards the build. Offering a preview of a book the
author can no longer download would be worse than offering nothing.

Reloading the page also clears it — the same trade the parsed document makes,
for the same reason: a generated book holds every image twice and is
reproducible in seconds.

---

## Error handling

Nothing here returns a `Result`, because nothing here fails. A book that cannot
be checked produces findings saying so. That is deliberate: an author whose book
is unusual should get a report, not an error screen.

---

## Testing

```bash
npm run test
```

156 tests in all — 86 for this phase, on top of the 70 covering parsing and
generation.

Every test runs the real pipeline — a fixture `.docx` is parsed, generated into
an EPUB, and the resulting package is validated. Hand-building a package to feed
the validator would test it against the test author's idea of an EPUB rather
than the one the application produces, and the bugs worth catching live in the
gap between those two.

Negative cases are made by breaking metadata or settings rather than by
corrupting packages, for the same reason: a book with no ISBN is a real
situation an author is in.

Coverage includes: the XML scanner against malformed input; a complete book
producing no errors; each metadata rule; ISBN check digits in both formats;
navigation integrity; accessibility metadata and alt text; the four stylesheet
constraints and their false-positive traps (`background-color` is not a text
colour, `max-width: 100%` is not a fixed size, a commented-out rule is not a
live one); image weight and formats; every compatibility target; scoring
monotonicity; an inspector that throws; that proposals mutate nothing; that a
wrong ISBN is never guessed at; report escaping of hostile metadata; and the
preview's body extraction, data URIs, defused links and base64 at every padding
length.
