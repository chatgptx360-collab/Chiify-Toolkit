# Changelog

All notable changes to Chiify Toolkit are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions before 1.0.0 were development phases rather than releases; they are
listed for the record, since the reasoning behind each one is still the
reasoning the code follows.

---

## [1.0.0] — 2026-07-27

The first release. Chiify Toolkit converts a Microsoft Word manuscript into a
valid, retailer-ready EPUB 3 book, entirely in the browser.

### Added

- **Background processing.** Parsing and generation run in Web Workers. The
  interface stays responsive while a 40-chapter manuscript is read — measured
  at a 9 ms maximum main-thread block, against work that previously ran inline.
- **Structured logging** (`lib/logging`) with four levels, namespaced child
  loggers and operation timing. Production emits warnings and errors only;
  manuscript content is never logged.
- **Distinct storage failures.** A full quota and a browser blocking site data
  are different problems with different remedies, and are now reported as such
  rather than as one "could not save" message.

### Changed

- **Roughly half the JavaScript.** The engines were reachable from a barrel the
  provider tree imported, so mammoth and JSZip — over 700 KB — shipped on every
  page. They are now fetched when work begins and never on the main thread.

  | Page       | Before  | After   |
  | ---------- | ------- | ------- |
  | Landing    | 1455 KB | 847 KB  |
  | Dashboard  | 1951 KB | 1015 KB |
  | Converter  | 1970 KB | 1035 KB |
  | Validation | 1964 KB | 1029 KB |

- **Cancelling stops immediately.** Terminating a worker ends the work now
  rather than at the engine's next checkpoint.
- The upload control reads the format catalogue directly rather than through the
  parser barrel, and the parser registry is populated by the worker that uses it.

### Fixed

- A crash inside a worker, an uncloneable result, and a worker killed by the
  browser each resolve to a written explanation instead of a progress bar that
  never finishes.

---

## [0.6.0] — Phase 6: production readiness

Performance, reliability, logging, security review, expanded tests, and the
documentation set. Released as 1.0.0.

## [0.5.0] — Phase 5: validation, preview and quality

- Eight inspectors over one shared markup scan: package and manifest,
  navigation, metadata, XHTML references, stylesheet, images, accessibility and
  device compatibility.
- Quality scoring calculated from findings divided by the checks actually run on
  that book, never looked up.
- An auto-fix engine that returns proposals and applies nothing until confirmed.
- Report export as printable HTML, JSON and plain text.
- A reading preview that renders the exact XHTML and CSS inside the download, in
  a sandboxed frame, at four device widths under simulated reader settings.
- The whole application became a static export; a single project is now a view
  of `/projects` rather than a route beneath it.
- Published to GitHub Pages by a workflow.

## [0.4.0] — Phase 4: EPUB generation

- The internal document model becomes a standards-compliant EPUB 3 package:
  XHTML content documents, a themed stylesheet, `nav.xhtml` and `toc.ncx`,
  Dublin Core and accessibility metadata, manifest, spine and guide.
- `mimetype` first in the archive and stored uncompressed, as OCF requires.
- Reproducible output: the same book generates byte-identical bytes.

## [0.3.0] — Phase 3: DOCX parsing

- A complete `.docx` pipeline into the internal document model: validation by
  magic bytes, style mapping, block conversion, normalisation, chapter detection
  with a confidence score, image extraction with alt text, embedded metadata and
  statistics.
- Twelve generated fixtures, readable in version control rather than committed
  as opaque binaries.

## [0.2.0] — Phase 2: the workspace

- Project management with local-first storage, manuscript upload, and book
  metadata validated against publishing rules rather than shape checks.

## [0.1.0] — Phase 1: foundation

- Architecture, the design token system, the component library, the application
  shell, and the domain model every later phase was built on.

---

## Versioning

- **Patch** — a fix that changes no interface and no generated output.
- **Minor** — new capability, or a change to generated EPUBs that existing
  readers accept.
- **Major** — a change to the internal document model, to the storage schema, or
  to generated output that could invalidate a book already published from it.

The storage key is versioned separately (`chiify:projects:v1`). A breaking
change to the stored shape bumps that key and old data is not read, which is the
honest behaviour for a local cache.
