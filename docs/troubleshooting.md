# Troubleshooting

Every error Chiify shows is written for an author and says what to do next. This
is the longer version, for when the short one was not enough — and, at the end,
for developers working on the code.

---

## Importing a manuscript

### "This file is not a Word document"

The check reads the first four bytes rather than trusting the file's name or the
type the browser reports, because browsers report `.docx` inconsistently —
usually `application/octet-stream` on Linux. So the message means the _contents_
are not a `.docx`, whatever the name says.

Usually one of: a `.doc` renamed to `.docx`, a partially downloaded file, or a
different format entirely.

### "This uses the old Word format"

A genuine `.doc` — the pre-2007 binary format, which is a completely different
thing from `.docx` and would need a separate parser. Open it in Word and use
**Save As → Word Document (.docx)**.

### "This document is protected"

Word encrypted it with a password. Remove the protection in Word
(**File → Info → Protect Document**) and save a copy.

### The chapter split is wrong

Chiify detects chapters by looking for heading styles, then falls back to page
breaks and then to a title heuristic — and it tells you which strategy it used
and how confident it is.

Low confidence almost always means the manuscript uses _visual_ headings:
bold 18pt text rather than the `Heading 1` style. Applying real heading styles
in Word fixes the split and, incidentally, is what makes a book navigable for a
screen reader.

You can also change which heading level starts a chapter in the project's
conversion settings.

### "This book is too large for your browser to hold in memory"

Chiify holds the manuscript, the parsed model and the generated book at once.
Very large illustrated manuscripts can exceed what a browser tab is allowed.

Close other tabs and try again. If it recurs, the reliable fix is splitting the
manuscript into two files and converting each — the images are usually the cause
rather than the word count.

---

## Generating a book

### Some images are missing

Images are collected during conversion, from the drawing elements Word records
them in. A picture that was linked rather than embedded has no bytes in the file
at all. In Word, **Insert → Picture → This Device** embeds; inserting by link
does not.

### "There is nothing to convert"

The manuscript parsed, but no chapter contains readable content. This usually
means the text lives in text boxes or frames, which Word stores outside the
document body and which no converter reads. Paste the text into the document
proper.

---

## Storage and persistence

### My projects vanished

Projects live in your browser's local storage, tied to one browser on one
device. They disappear if you clear site data, use a different browser, or open
the site in private browsing.

They are not on a server. That is the point of the tool — your unpublished
manuscript never leaves your machine — and it is also why there is nothing to
recover from. Download the EPUBs you care about.

### "Your browser is not letting Chiify save anything"

Private browsing, or a setting that blocks site data. Work is kept for the
visit and lost when the tab closes, so download anything you need first.

### "There is no room left to save your projects"

The storage quota for the site is full. Deleting finished projects frees space;
EPUBs you have already downloaded are unaffected, since they are files on your
computer rather than anything Chiify holds.

### Reloading cleared the preview and the report

Deliberate. Parsed manuscripts and generated books are derived data — tens of
megabytes with images, reproducible in seconds — so they live in memory for the
session rather than being written to storage. The project and its metadata
survive; the manuscript needs re-uploading.

---

## Preview

### Links do nothing

Cross-document links are inert in the preview by design. A relative link inside
a sandboxed frame resolves against `about:srcdoc` and would replace the chapter
with a browser error page — the reader would appear to have crashed.

Footnote links _within_ a chapter work, because those are what an author
actually needs to test.

### The book looks different from the preview on my device

It should, a little. A reading system may override anything, which is the whole
reason the preview lets you move text size, line spacing, measure and theme. If
the book only looks right at the defaults, that is a finding rather than a
preview bug — the validation report will name it.

---

## Validation

### The score is high but the book is "not publishable"

They answer different questions. The score measures how much of the book is in
good order; readiness reflects errors and anything that blocks a retailer. One
error in an otherwise excellent book scores in the nineties and still cannot be
published.

### A store says my book is fine and Chiify does not, or the reverse

Chiify is not EPUBCheck, and it says so in the report and in every export.
It runs its own checks against the package in memory, because EPUBCheck is a
Java application and this tool has no server to run one on.

It also checks things EPUBCheck does not — a missing ISBN is not a specification
violation and is the most common reason a submission is refused. Treat the
report as preparation, and the retailer's own validation as the authority.

---

## Development

### The build fails with "missing generateStaticParams"

A route was added that cannot be prerendered. Chiify builds to a static export,
so every route must be knowable at build time. If the new route genuinely needs
a server, that is a decision to make deliberately — see `next.config.ts`.

### Workers do not start locally

`lib/workers` falls back to running in-thread when a worker cannot be
constructed, and logs a warning saying so. Check the console: a strict
Content-Security-Policy is the usual cause. Everything still works, more slowly.

### Tests pass locally and the deployment fails

The deploy workflow runs `npm run verify` — the same four checks — so a
difference is almost always the Pages configuration rather than the code. The
workflow names the fix in its own error message.

### The bundle grew

Run a production build and check which chunks the page HTML references directly.
Anything eagerly loaded on every page is worth questioning; the engines in
particular must stay behind the worker boundary. A barrel file that re-exports
an engine will silently pull it back onto every page — that is exactly how
700 KB ended up on the dashboard before Phase 6.
