# Testing

```bash
npm run verify   # typecheck, lint, format, tests — the gate CI runs
npm run test     # 174 tests
npm run fixtures # regenerate the sample .docx files
```

---

## What is tested, and what deliberately is not

The suite concentrates on `lib/` — the parser, the EPUB engine, the validator,
the preview renderer, and the platform layer. Those are pure functions over
serialisable data, which means they are testable without a renderer, run in
milliseconds, and fail for one reason each.

Components are not unit-tested. Rendering them in isolation would test that
React renders React; the questions worth asking about a component — does the
form block a save, does the fix dialog change anything before it is confirmed,
does the frame reflow at 375 pixels — are only answerable in a browser, and are
covered there.

That is a deliberate allocation rather than a gap. The bugs this project has
actually shipped were all found either by an assertion against real output or by
driving the real UI, and none would have been caught by a mounted component
test.

---

## The principle: test the artifact, not the return value

Every EPUB test unzips the generated archive and inspects the real package.
Every validation test runs the whole pipeline — a fixture `.docx` is parsed,
generated into an EPUB, and that package is validated.

Asserting on a function's return value would pass while producing a file no
device can open. The failures that matter here — mimetype ordering, a dangling
manifest reference, an unescaped ampersand — are only visible in the bytes.

The same principle shapes the negative cases. A book with no ISBN is made by
setting no ISBN, not by editing a package by hand: the first is a situation an
author is really in, and the second tests the test author's idea of an EPUB.

---

## Fixtures

Generated from readable WordprocessingML by `fixtures/build-fixtures.mjs`, not
committed as binaries. A reviewer can see what each one contains, and adding a
case is a few lines rather than a round trip through Word.

| Fixture            | Exercises                                               |
| ------------------ | ------------------------------------------------------- |
| `simple-novel`     | Heading 1 chapters, emphasis, empty-paragraph removal   |
| `non-fiction`      | Nested headings, quotes, multiple authors, front matter |
| `with-images`      | Bytes, alt text, dimensions, missing-alt notices        |
| `with-tables`      | Header rows — and one table deliberately without one    |
| `nested-lists`     | Ordered and unordered nesting                           |
| `with-links`       | External hyperlinks                                     |
| `no-headings`      | Every fallback strategy, lowered confidence             |
| `large-manuscript` | 40 chapters, with a wall-clock bound                    |
| `malformed-*`      | Not-Word, truncated, legacy `.doc`, empty               |

The headerless table in `with-tables` is not an oversight. It is the case that
proves the accessibility inspector reports the table that lacks headers and not
the one that has them.

---

## Suites

| File                       | Covers                                                |
| -------------------------- | ----------------------------------------------------- |
| `tests/parser.test.ts`     | DOCX → document model, all fixtures, hostile input    |
| `tests/epub.test.ts`       | The generated package, unzipped and inspected         |
| `tests/validation.test.ts` | Inspectors, scoring, auto-fix, report export, preview |
| `tests/platform.test.ts`   | Logging, the worker boundary, filename and id safety  |

`tests/helpers.ts` holds the fixture loaders. `node:test` runs them through
`tsx`; there is no test framework dependency, because the built-in runner does
what this suite needs.

---

## Browser verification

Run before every phase is committed, against a production build served the way
it is deployed:

```bash
npm run build
cd out && python3 -m http.server 4400
```

Then drive it: create a project, upload a fixture, convert, validate, apply a
fix, read the result at two device sizes. Assert against the **DOM**, not
against a screenshot.

That distinction has earned its keep. Three bugs reached a phase's end with
green tests and a screenshot that looked correct:

- A metadata form that silently accepted a book with no author, because native
  constraint validation was intercepting submit. `aria-invalid` was `null`; the
  screenshot showed a normal form.
- An HTML parser that never set `type: 'element'`, so tables, lists and images
  were dropped from every document. The pages looked plausible.
- A cover page reported as "has no text" because it contains an image and no
  words.

None was visible without asking the DOM a direct question.

---

## Performance

Two numbers are worth re-measuring when the engines change:

**Main-thread responsiveness.** Poll the page from Playwright during a parse:

```js
const t = Date.now()
await page.evaluate(() => document.title) // a round trip through the main thread
ticks.push(Date.now() - t)
```

On a 40-chapter manuscript the maximum block is 9 ms. If that climbs into the
hundreds, work has moved back onto the main thread.

**Eager bundle size.** Sum the chunks each page's HTML references directly:

```bash
grep -o '/_next/static/chunks/[a-zA-Z0-9_.-]*\.js' out/dashboard/index.html |
  sort -u | sed 's|^/_next|out/_next|' | xargs du -cb | tail -1
```

The dashboard should be near 1 MB. If mammoth or JSZip appear in a chunk
referenced by page HTML, a barrel has pulled an engine back onto every page.

---

## Adding a test

Put it in the suite that owns the behaviour, name it as the sentence you would
say to a colleague — `reports a table with no header row, and only that table` —
and assert on what a user or a device would observe rather than on an
intermediate value.

If a rule is genuinely hard to trigger through the real pipeline, feed the
inspector directly (as the CSS tests do) and say why in a comment. The generated
stylesheet is deliberately correct, so the negative cases need a stylesheet the
generator would never produce.
