# Architecture

This document explains **why** the codebase is shaped the way it is. The README
covers structure and conventions; this covers the reasoning, so that a future
engineer can tell the difference between a decision and an accident.

---

## 1. Guiding principle

> Chiify Toolkit will become an all-in-one publishing workspace. Every decision
> in Phase 1 assumes the roadmap happens.

The roadmap includes four additional export formats, an AI assistant, a plugin
system, themes, cloud sync and retailer-specific optimisation. An architecture
that merely converts DOCX to EPUB efficiently would be the wrong architecture,
because each of those additions would require unpicking it.

So the question asked of every decision here was not "does this work for
version 1?" but "what does this cost in version 6?"

---

## 2. The internal document model

### The problem

A publishing tool has N input formats and M output formats. Converting each
input directly to each output is N × M code paths. At the planned scale
(4 inputs, 5 outputs) that is twenty conversion paths, each needing its own
tests, each a place for behaviour to diverge.

### The decision

One semantic model in the middle (`lib/types/document.ts`). Parsers produce it;
generators consume it. Nothing converts format-to-format.

```
                    ┌──────────────────────┐
 .docx ──parser──→  │                      │  ──generator──→  EPUB 3
 .md   ──parser──→  │  ParsedDocument      │  ──generator──→  PDF
 .html ──parser──→  │  (semantic, plain    │  ──generator──→  MOBI
 gdocs ──parser──→  │   data, no visuals)  │  ──generator──→  Markdown
                    └──────────────────────┘
```

Cost: N + M. A new export format cannot break an importer, because it cannot
see one.

### Constraints this places on the model

1. **Semantic, never visual.** `HeadingBlock` records a level, not a font. If a
   generator needs to know something about appearance, that is a `role` string
   the generator interprets — the model stays a description of _meaning_.
   Without this rule, DOCX's visual quirks leak into every output format.

2. **Plain, serialisable data.** No class instances, no functions, no
   `Date` objects (timestamps are ISO strings). This is what allows Phase 6 to
   move parsing into a Web Worker by changing where it runs, not what it does —
   the model survives `structuredClone` unchanged.

3. **A discriminated union on `type`.** Generators switch exhaustively on
   `Block['type']`. Adding a block type therefore produces a compile error in
   every generator that has not handled it. This is the single most valuable
   safety property in the codebase: it makes "we forgot to render tables in the
   PDF exporter" impossible to ship.

4. **Metadata lives on the project, not the document.** Re-uploading a corrected
   manuscript must not discard the author's ISBN. Coupling them would guarantee
   that bug.

---

## 3. The conversion pipeline

### Why it exists in Phase 1 with no stages to run

The pipeline is the seam between phases 3, 4 and 5. If it did not exist up
front, each phase would invent its own control flow — one using callbacks, one
using async generators, one using an event emitter — and Phase 6 would spend its
budget unifying them.

Defining it now costs ~150 lines and makes every later phase additive.

### What the runner guarantees

Stages are small and single-purpose because the runner handles the rest:

| Concern            | Handled by the runner                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Cancellation       | Checked at every stage boundary; surfaces as `cancelled`, not an error |
| Progress           | Weighted by declared stage cost, monotonic, always ends at exactly 1   |
| Non-fatal issues   | Accumulated across stages and returned even on success                 |
| Thrown exceptions  | Converted to a structured `AppError`                                   |
| Type compatibility | `createPipeline().add()` rejects mismatched stages at compile time     |

The weighted progress detail matters more than it looks: a progress bar that
advances in equal steps for unequal work is the most common complaint about
conversion UI, and it is unfixable later if stages do not declare a cost.

### Why a builder rather than an array

```ts
createPipeline<ParseInput>()
  .add(parseStage) // ParseInput → ParsedDocument
  .add(generateStage) // ParsedDocument → EpubPackage
  .build()
```

Each `.add()` narrows the generic, so a stage that does not accept the previous
stage's output fails to compile. An array of stages could only be checked at
runtime, which means finding the error after a user uploaded a manuscript.

---

## 4. Errors as values

`lib/utils/result.ts` defines `Result<T, AppError>`.

Conversion failures are mostly **expected**: a password-protected file, an
unsupported image format, a missing alt attribute. These are content the UI must
render — a list of problems the author can fix — not crashes.

Modelling them as values means:

- Failure modes appear in type signatures and cannot be forgotten.
- A stage can report many diagnostics without unwinding the stack.
- The UI layer never wraps domain logic in `try`/`catch`.

`AppError` carries a stable machine-readable `code`, a `message` written for an
author (not a developer), a `severity`, and a `hint` describing the fix. That
shape is shared by the parser, the converter, the validator and the toast
system — one vocabulary for "something went wrong" across the product.

Exceptions are still the right tool for programmer errors. They are not used for
domain outcomes.

---

## 5. Module boundaries

```
lib/types      ← the vocabulary. Imported by everything, imports nothing.
lib/utils      ← pure helpers. May import lib/types.
lib/projects   ← workspace domain. May import types + utils. Never parser/epub.
lib/documents  ← session store for parsed models. May import types only.
lib/parser     ← input → model.   May import types + utils. Never epub/converter.
lib/epub       ← model → EPUB 3.  May import types + utils. Never parser.
lib/converter  ← orchestration.   May import types + utils. Knows about neither.
hooks/*        ← React bindings.  May import lib/*. Nothing in lib/ imports a hook.
components/*   ← presentation.    May import lib/types, lib/utils and hooks.
app/*          ← routes.          May import anything.
```

These are stated in the doc comment of each barrel file, which is where a
developer will actually read them.

**Why `converter` knows about neither `parser` nor `epub`:** stages are injected.
That is what allows the same runner to drive PDF export later without
modification, and it is why the converter has no dependency to update when a
parser changes.

**Why components may not import `lib/parser` or `lib/epub`:** a component that
knows what an EPUB is cannot be reused, and the design system stops being a
design system the moment its primitives carry product vocabulary.

---

## 6. Registries, not switch statements

Two registries exist:

- `lib/parser/registry.ts` — resolves a file to a parser.
- `lib/config/navigation.ts` — the single source of truth for routes.

Both replace a `switch` that would otherwise live in UI-adjacent code. The
practical consequences:

- Adding DOCX support in Phase 3 requires **no change** to the upload experience.
  Accepted extensions come from `acceptedExtensions()`.
- Adding a route in Phase 2 requires **one entry**. The sidebar, mobile drawer,
  breadcrumb trail and active-link highlighting all derive from it, so they
  cannot disagree.
- The plugin system on the roadmap becomes "a plugin calls `registerParser`"
  rather than a redesign.

`findNavItem` matches the longest registered prefix, so a future
`/projects/[id]` route highlights _Projects_ in the sidebar with no extra
configuration.

---

## 6b. Local-first storage

`lib/projects/store.ts` defines a `ProjectStore` interface with a `localStorage`
implementation behind it.

**Why an interface for one implementation.** A manuscript never has to leave the
author's machine — that is a privacy position and the reason the app works
offline. But "Cloud Sync" and "User Accounts" are on the roadmap, so the storage
mechanism must be replaceable. Components never import an implementation; they
use the hooks in `hooks/use-projects.ts`. Moving to IndexedDB or a server is a
change to the one line that constructs the singleton.

**Why `localStorage` rather than IndexedDB today.** Project records are small
JSON documents. IndexedDB's asynchronous, transactional API earns its complexity
when storing manuscript _bytes_ — a Phase 3 concern that will use a separate
blob store. Using the simpler API for the simpler data keeps this layer
readable.

**Why the store is an observable.** It notifies subscribers on every write, so
`useSyncExternalStore` drives the UI directly. A `ProjectsProvider` at the root
would re-render every consumer — including the shell — whenever any project
changed. Subscribing per component means a card re-renders only when the data it
reads actually changes, and there is no provider to forget to mount.

**Why `list()` returns a cached array.** A snapshot function that builds a fresh
array on every call makes `useSyncExternalStore` loop forever, because React
compares snapshots by identity. The cache is invalidated on write and on a
cross-tab `storage` event.

---

## 7. Rendering strategy

### Server Components by default

Every page is a Server Component. Interactivity is pushed into the smallest
possible client island — `'use client'` sits on the component that needs it, not
on the page that renders it.

`app/providers.tsx` isolates the client provider tree. Without it, adding a
theme provider would turn the root layout into a Client Component and take its
`metadata` export with it.

### The provider policy

A provider belongs in `app/providers.tsx` only if its state is genuinely global.
Project data, conversion progress and editor state are route-scoped and belong
in their own layouts. A monolithic root context re-renders the entire tree on
every change, and is the usual reason a workspace app becomes sluggish at
version 3.

### The form boundary

`FormField` passes generated ids and ARIA attributes to its control through a
render prop. Functions cannot cross the server/client boundary, so **forms live
in Client Components**. This is not a limitation to work around — forms are
interactive by definition, and the rule keeps data fetching and metadata on the
server while only the interactive parts ship JavaScript.

Forms set `noValidate` and keep `required` on each control. The attribute still
tells assistive technology the field is required; `noValidate` stops the
browser's native error bubble from intercepting submit, which would prevent the
application's own validation from ever running and replace considered messages
with an unstyled tooltip.

### When a change saves

Two rules, applied consistently rather than case by case:

- **Independent and reversible → save immediately.** Project settings, the
  theme. A toggle cannot leave the record half-valid, so a Save button is
  ceremony.
- **Interdependent or validated → commit on submit.** Book metadata. The fields
  are only coherent together, and auto-saving a half-typed ISBN would make the
  validation report flicker as someone types.

### Hydration-sensitive state

Three things cannot be known during server rendering: the resolved theme, the
viewport, and stored preferences. Each is handled with `useSyncExternalStore`
rather than `useState` + `useEffect`:

- It defines an explicit server snapshot instead of an accidental one.
- It avoids a cascading render (React 19's lint rules now flag the effect-based
  pattern for exactly this reason).
- Every consumer of the same source stays in sync — including across tabs, for
  `localStorage`.

---

## 8. Styling strategy

Tokens are defined in CSS (`styles/globals.css`) using Tailwind v4's `@theme
inline`, not in a JavaScript config.

**Why:** `@theme inline` makes generated utilities reference `var(--token)`
rather than baking in a literal. That is what allows a class on `<html>` to swap
the entire palette at runtime with no rebuild — which turns the "Themes" roadmap
item into "ship another token block".

**Dark-first:** `:root` holds the dark palette and `.light` overrides it. The
server-rendered HTML therefore paints dark before any JavaScript runs, which is
the product's default and avoids a white flash for most users.

`lib/design/tokens.ts` mirrors the _non-colour_ scales for JavaScript consumers
(Framer Motion needs numeric seconds and cubic-bezier arrays) and exposes colours
as `var()` references rather than literals — a hardcoded hex in JavaScript would
freeze a component in one theme, which is the exact bug the indirection prevents.

---

## 9. Third-party dependencies

The dependency list is short and each entry earns its place:

| Package                    | Why it is here                                        | Why not hand-rolled                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@radix-ui/*`              | Dialog, dropdown, tooltip, progress, label, separator | Focus trapping, restoration, background inerting, roving focus and type-ahead are large and easy to get subtly wrong — and getting them wrong locks keyboard users out |
| `framer-motion`            | Page transitions, toast list animation                | Layout and presence animations require coordinating unmount, which React does not do                                                                                   |
| `class-variance-authority` | Component variants                                    | Variants are data; a table gives type-safe props and one place to change a treatment                                                                                   |
| `tailwind-merge` + `clsx`  | `cn()`                                                | Lets every component accept `className` overrides without specificity fights                                                                                           |
| `next-themes`              | Theme persistence                                     | SSR-safe, no-flash theme switching is fiddly; this is the canonical solution and is tiny                                                                               |
| `lucide-react`             | Icons                                                 | Consistent 24×24 grid matching the design language                                                                                                                     |

The toast system is **not** a dependency. The behaviour needed — a queue, timers,
an animated list — is about 150 lines, and a notification library's theming would
have to be fought into line with the design tokens anyway.

---

## 10. What would indicate this architecture is failing

Worth stating explicitly, so it is noticed early:

- A phase needs to change `lib/types/document.ts` to add a _visual_ property.
  → The model is leaking presentation; the property belongs to the theme layer.
- A generator needs to know which format the document came from.
  → A parser is not fully normalising its input.
- A component in `components/ui` needs a publishing concept.
  → The abstraction is in the wrong layer; move it to `components/common` or
  above.
- `app/providers.tsx` accumulates providers.
  → State that is route-scoped has been hoisted to global; push it back down.
- The conversion pipeline needs a stage to know about another stage.
  → Data that should be in the context is being passed out of band.
