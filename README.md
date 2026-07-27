# Chiify Toolkit

**Everything you need to prepare and publish professional eBooks.**

Chiify Toolkit is a publishing workspace for authors. Version 1 turns Microsoft
Word (`.docx`) manuscripts into valid EPUB 3 books; later versions grow into a
complete publishing ecosystem.

> **This repository is at Phase 2 — Workspace.**
> There is no conversion engine yet, and that is deliberate. Phase 1 delivered
> the architecture, design system and application shell; Phase 2 adds project
> management, manuscript upload and validated metadata on top of it. What is
> here is production-quality; what is missing is stated plainly rather than
> stubbed out.

---

## Contents

- [What Phase 1 delivers](#what-phase-1-delivers)
- [Getting started](#getting-started)
- [Folder structure](#folder-structure)
- [Architecture](#architecture)
- [Component organisation](#component-organisation)
- [Design system](#design-system)
- [Naming conventions](#naming-conventions)
- [Coding standards](#coding-standards)
- [Accessibility](#accessibility)
- [How future phases integrate](#how-future-phases-integrate)
- [Further reading](#further-reading)

---

## What is built

| Area                                                                                                                            | Status         |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Next.js 16 App Router, React 19, TypeScript (strict)                                                                            | Configured     |
| Tailwind CSS v4, CSS-first design tokens, dark-first theming                                                                    | Complete       |
| Component library (buttons, cards, inputs, badges, dialogs, alerts, progress, empty states, skeletons, toasts, tooltips, menus) | Complete       |
| Responsive application shell (top bar, collapsible sidebar, mobile drawer, breadcrumbs, footer, theme toggle)                   | Complete       |
| Six placeholder routes with real content describing their purpose                                                               | Complete       |
| Domain model, conversion-pipeline contract, parser registry, EPUB generator ports                                               | Complete       |
| Motion vocabulary and animation utilities                                                                                       | Complete       |
| ESLint + Prettier + typecheck, all green                                                                                        | Complete       |
| Project management — create, search, delete, local-first storage                                                                | Complete       |
| Accessible manuscript upload with format and size validation                                                                    | Complete       |
| Book metadata forms with publishing-rule validation                                                                             | Complete       |
| Per-project conversion settings, dashboard driven by real data                                                                  | Complete       |
| DOCX parsing, EPUB generation, validation, preview                                                                              | **Phases 3–5** |

### Deliberate non-goals so far

No parsing, no generation, no authentication. Manuscript _contents_ are not
stored either — Phase 2 records a file's name, type and size, because nothing
reads the bytes until the parser exists in Phase 3 and holding tens of megabytes
per project before then would be a liability rather than a feature. The UI says
so where it matters.

Every screen that depends on a missing capability is present, honest about what
it will do, and built from the same components the real feature will use.

You will not find `TODO` comments or placeholder functions in this codebase.
Where a capability is not built, the _contract_ for it exists (typed interfaces,
registries, pipeline stages) and the UI says so in plain language.

---

## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

### Scripts

| Script                 | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Development server                                        |
| `npm run build`        | Production build                                          |
| `npm run start`        | Serve the production build                                |
| `npm run lint`         | ESLint                                                    |
| `npm run lint:fix`     | ESLint with autofix                                       |
| `npm run format`       | Prettier write                                            |
| `npm run format:check` | Prettier check                                            |
| `npm run typecheck`    | `tsc --noEmit`                                            |
| `npm run verify`       | typecheck + lint + format check — run before every commit |

---

## Folder structure

```
app/                        Routes only. Thin — pages compose, they do not implement.
├── layout.tsx              Root layout: fonts, metadata, providers
├── providers.tsx           Client provider tree (theme, tooltips, toasts)
├── page.tsx                / → redirects to the default route
├── error.tsx               Route error boundary
├── not-found.tsx           404, rendered outside the workspace shell
├── icon.svg                Favicon (Next.js file convention)
└── (workspace)/            Route group: everything wrapped in the app shell
    ├── layout.tsx          Applies <AppShell>
    ├── loading.tsx         Streaming fallback for every workspace route
    ├── dashboard/          Overview, statistics, delivery plan
    ├── projects/           Manuscript library
    ├── converter/          DOCX → EPUB pipeline
    ├── preview/            In-app reader
    ├── validation/         Specification and accessibility reports
    └── settings/           Preferences, defaults, live design-system reference
        └── _components/    Route-private components (underscore = not a route)

components/
├── ui/                     Design-system primitives. No domain knowledge.
├── common/                 Cross-cutting patterns (page header, empty state, logo, theme toggle)
├── layout/                 Application chrome (shell, sidebar, top bar, footer)
├── navigation/             Nav menu, sidebar item, breadcrumb
├── cards/                  Composed card patterns (feature card, roadmap card)
├── dashboard/              Dashboard-specific presentation (stat card)
├── projects/               Project library, cards, create/delete dialogs
├── upload/                 Manuscript dropzone
└── forms/                  Accessible form structure (field, section, metadata form)

lib/
├── types/                  Domain model — the vocabulary of the product
├── design/                 Design tokens in TypeScript + motion vocabulary
├── config/                 Site constants and the navigation registry
├── utils/                  Pure helpers (cn, formatting, slugs, Result)
├── projects/               Project storage, validation and status rules
├── parser/                 Input formats → internal document model  (Phase 3)
├── converter/              Pipeline orchestration                   (Phases 3–5)
└── epub/                   Internal document model → EPUB package   (Phase 4)

hooks/                      Generic, reusable React hooks
styles/                     globals.css — the single source of truth for tokens
public/                     Files served verbatim at a fixed URL
assets/                     Design source files, never served (see assets/README.md)
docs/                       Architecture and design-system references
```

### Why the folders are split this way

**`app/` stays thin.** A route file's job is to compose components and declare
metadata. Business logic in a page cannot be reused by a second page, cannot be
tested without rendering, and cannot move to a worker. Every page here is under
200 lines and imports everything it renders.

**`components/` is split by _role_, not by feature.** `ui/` primitives know
nothing about publishing; `common/` composes them into patterns; `layout/` owns
the chrome. The split enforces a dependency direction — a primitive can never
import a feature — which is what stops the library from slowly becoming
unusable outside the screen it was written for.

**`lib/` is split by _responsibility_, and the boundaries are enforced by
convention documented in each barrel file.** `parser/` never imports `epub/`.
`epub/` never imports `parser/`. `converter/` imports neither — it only knows
about stages. That is what allows Phase 4 to be written without touching Phase
3's code.

---

## Architecture

### The one decision everything else follows: an internal document model

Every input format is parsed **into** a single semantic model
(`lib/types/document.ts`), and every output format is generated **from** it.

```
 .docx ─┐                                        ┌─→ EPUB 3
 .md   ─┼─→  parsers  ─→  Internal Document  ─→  ├─→ PDF
 .html ─┘                      Model             ├─→ MOBI
                                                 └─→ Markdown
```

Without this, adding the fifth export format to the fourth input format is
twenty conversion paths. With it, a new input costs one parser and a new output
costs one generator — N + M instead of N × M. Given the roadmap (PDF, MOBI,
HTML and Markdown export are all planned), this is the decision that determines
whether those phases are additive or a rewrite.

The model is deliberately **semantic, not visual**: a node records "this is a
heading", never "this is 18pt bold". Visual decisions belong to the theme layer,
so the same manuscript can render differently per output format.

### The conversion pipeline

`lib/converter` provides a type-safe, cancellable pipeline. Stages are added by
later phases; the runner already exists.

```ts
const pipeline = createPipeline<ParseInput>()
  .add(readStage) // ParseInput      → RawDocument
  .add(parseStage) // RawDocument     → ParsedDocument
  .add(generateStage) // ParsedDocument  → EpubPackage
  .build()

const outcome = await pipeline.run(input, { signal, onProgress })
```

Adding a stage whose input does not match the previous stage's output is a
compile error. The runner guarantees cancellation, weighted progress,
accumulated non-fatal issues, and that a stage which throws becomes a structured
failure rather than an exception in a React render — so no stage has to
implement any of that.

### Errors are values, not exceptions

Conversion fails in ways that are _expected_: a malformed `.docx`, an image in
an unsupported format, a spec violation. Those are data the UI renders as a list
the author can act on. `lib/utils/result.ts` models them as
`Result<T, AppError>`, which makes failure modes visible in type signatures and
impossible to forget. Exceptions remain reserved for programmer errors.

### Registries instead of switch statements

`lib/parser` resolves a file to a parser through a registry, and
`lib/config/navigation.ts` is the single source of truth for routes. Both exist
so that adding a capability is an _addition_ rather than an edit to
UI-adjacent code — and so the plugin system on the roadmap is "call
`registerParser` from a plugin" rather than a redesign.

### Server and client boundaries

Pages are Server Components. Interactivity is pushed to the smallest possible
client island (`'use client'` on the component that needs it, not the page).
`app/providers.tsx` isolates the client provider tree so the root layout stays
a Server Component and keeps its metadata export.

One rule worth knowing before writing a form: `FormField` passes ARIA wiring to
its control through a render prop, and functions cannot cross the server/client
boundary — so forms live in Client Components. See
`app/(workspace)/settings/_components/conversion-defaults.tsx` for the pattern.

---

## Component organisation

Four layers, each allowed to import only from the layers above it:

```
lib/           domain + utilities        ← imports nothing from below
hooks/         React bindings for lib/   ← may import lib/*; lib/ never imports a hook
components/ui  primitives                ← may import lib/utils, lib/types
components/*   patterns and chrome       ← may import components/ui and hooks
app/           routes                    ← may import anything
```

**Rules that are not negotiable:**

1. A component in `components/ui` must never import from `lib/parser`,
   `lib/epub` or `lib/converter`. A button that knows what an EPUB is is not a
   button.
2. Business logic never lives in a component. If a function would still make
   sense without React, it belongs in `lib/`.
3. Every component accepts `className` and merges it through `cn()`, so callers
   can always override styling without `!important`.
4. Every component has exactly one responsibility. `Card` is a surface;
   `FeatureCard` is an arrangement of that surface; the page decides which
   to use.

### Where to put a new component

| Question                                              | Answer                                      |
| ----------------------------------------------------- | ------------------------------------------- |
| Is it a generic primitive with no product vocabulary? | `components/ui/`                            |
| Is it a pattern reused across several routes?         | `components/common/` or `components/cards/` |
| Is it part of the application chrome?                 | `components/layout/`                        |
| Is it used by exactly one route?                      | `app/<route>/_components/`                  |

Colocating single-use components under `_components` (the underscore keeps the
folder out of the router) prevents the shared library from silting up with
things only one screen ever uses.

---

## Design system

Tokens live in `styles/globals.css` and are mirrored for JavaScript consumers in
`lib/design/tokens.ts`. Full reference: [`docs/design-system.md`](docs/design-system.md).

Three rules:

1. **Never hardcode a colour in a component.** Use the semantic token
   (`bg-card`, `text-muted-foreground`, `border-border`). Primitive values
   (`--neutral-800`) are for the token layer only.
2. **Never hardcode a duration.** Use a motion utility (`motion-fast`) or a
   transition from `lib/design/motion.ts`. One vocabulary is what makes the
   whole product move with the same personality.
3. **Dark-first.** `:root` holds the dark palette; `.light` overrides it. The
   server-rendered HTML is therefore dark before any JavaScript runs.

---

## Naming conventions

| Thing                   | Convention                        | Example                               |
| ----------------------- | --------------------------------- | ------------------------------------- |
| Files and folders       | `kebab-case`                      | `stat-card.tsx`, `use-media-query.ts` |
| React components        | `PascalCase`                      | `StatCard`, `PageHeader`              |
| Props interface         | `<Component>Props`                | `StatCardProps`                       |
| Hooks                   | `use<Thing>`                      | `useDisclosure`                       |
| Types and interfaces    | `PascalCase`, no `I` prefix       | `ParsedDocument`                      |
| Constants               | `SCREAMING_SNAKE_CASE`            | `OCF_PATHS`                           |
| Booleans                | `is` / `has` / `can` prefix       | `isOpen`, `hasErrors`                 |
| Handler props           | `on<Event>`                       | `onNavigate`                          |
| Handler implementations | `handle<Event>`                   | `handleSubmit`                        |
| CSS custom properties   | `--kebab-case`, semantic name     | `--muted-foreground`                  |
| Route folders           | lowercase, plural for collections | `projects/`                           |

Barrel files (`index.ts`) exist at directory level only. `import { cn } from
'@/lib/utils'` is the one obvious path; barrels that re-export barrels are not
used, because they hide circular imports and defeat tree-shaking.

---

## Coding standards

### TypeScript

Strict mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noUnusedLocals`, `noUnusedParameters` and `verbatimModuleSyntax`. These are on
because each one catches a class of bug that is otherwise found at runtime.
`exactOptionalPropertyTypes` in particular means optional props are spread
conditionally rather than passed as `undefined`:

```tsx
// Correct
<NavMenu {...(onNavigate ? { onNavigate } : {})} />
```

`any` is not used anywhere in this codebase. Where a type must be widened, it is
`unknown` with a narrowing check.

### General

- One responsibility per module; if a file needs "and" to describe it, split it.
- No duplicated code — shared behaviour moves to `lib/` or a component.
- Comments explain **why**, never what. The code says what it does.
- Public functions, components and modules carry a doc comment stating their
  purpose and any decision a reader would otherwise have to reverse-engineer.
- Pure functions in `lib/` — no React, no DOM, no globals.

### Before committing

```bash
npm run verify
```

---

## Accessibility

Accessibility is built in rather than retrofitted in Phase 6:

- **Semantic HTML.** Real `<nav>`, `<main>`, `<header>`, `<footer>`, `<fieldset>`
  and `<ol>` elements, with landmarks labelled where more than one exists.
- **Keyboard.** Every interactive element is reachable and operable. A "Skip to
  content" link is the first focusable element. `[` toggles the sidebar.
- **Focus.** One global `:focus-visible` treatment, applied consistently, using
  `:focus-visible` so it never appears on mouse clicks.
- **Screen readers.** `aria-current="page"` on the active route, live regions for
  toasts and validation errors, `aria-busy` on loading surfaces, and skeletons
  hidden from the accessibility tree in favour of one announcement per group.
- **Colour.** Meaning is never carried by colour alone — every intent has an
  icon or text label. Token contrast was audited against WCAG 2.2 AA in both
  themes; several tokens differ between light and dark specifically to hold that
  ratio (see the comments in `styles/globals.css`).
- **Motion.** `prefers-reduced-motion` is honoured globally in CSS and via
  `useReducedMotion()` in every animated component.
- **Focus management in overlays** is delegated to Radix primitives, which
  supply focus trapping, restoration and background inerting.

---

## How future phases integrate

Each phase should be **additive**. If a phase needs to restructure what is here,
that is a signal to re-read this section first.

### Phase 2 — Dashboard, projects, upload, metadata _(complete)_

Delivered as:

- `lib/projects/` — a `ProjectStore` interface with a `localStorage`
  implementation, publishing-rule validation, and status presentation. Swapping
  in IndexedDB or an API is a change to one exported constant.
- `hooks/use-projects.ts` — `useSyncExternalStore` bindings, so no provider is
  needed and a component re-renders only when the store actually changes.
- `components/projects/`, `components/upload/` — library, create/delete dialogs,
  and the accessible dropzone.
- `lib/parser/formats.ts` — the catalogue of formats the _product_ knows about,
  separate from the registry of formats that have a working parser. That gap is
  exactly Phase 2 vs Phase 3.

### Phase 3 — DOCX parsing

- Add `lib/parser/docx/` implementing the `DocumentParser` interface.
- Call `registerParser(docxParser)` at module load. The upload UI's accepted
  file types come from `lib/parser/formats.ts` and need no change.
- Add a blob store alongside `lib/projects/` for manuscript bytes. `SourceFile`
  already carries everything needed to reference one; the dropzone hands over a
  real `File`, so nothing in the UI changes.
- Populate `ParsedDocument` from `lib/types/document.ts`. Do not add visual
  properties to the model — if a generator needs to know something, it is a
  semantic `role`, not a font size.
- Expose the parser to the pipeline as a `ConversionStage` with id `parse`.

### Phase 4 — EPUB generation

- Implement `XhtmlGenerator`, `CssGenerator`, `NavigationBuilder`,
  `MetadataGenerator` and `EpubPackager` from `lib/epub/types.ts`.
- Use the constants in `lib/epub/constants.ts` for container paths, namespaces
  and media types — do not re-declare them.
- Add `generate` and `package` stages to the pipeline.
- Generators must switch exhaustively on `Block['type']`. The discriminated
  union means a new block type becomes a compile error in every generator that
  has not handled it, which is the intended safety net.

### Phase 5 — Preview, validation, download

- Implement `EpubValidator`; return the `ValidationReport` shape already defined
  in `lib/types/validation.ts` so the existing UI renders it.
- Use `summariseIssues()` for the pass/fail rule rather than re-deriving it.
- Surface pipeline failures through the existing `AppError` shape — `message` is
  written for an author, `hint` says what to do about it.

### Phase 6 — Performance, testing, accessibility, refinement

- Parsing and generation are already pure, serialisable and React-free, so
  moving them into a Web Worker requires no changes to their code.
- `lib/` is where tests should concentrate: pure functions, no rendering
  required.

### Later versions

The seams for the roadmap already exist: **AI assistant** consumes the document
model; **PDF/MOBI/HTML/Markdown export** are new generators; **plugin system**
is the registry pattern generalised; **themes** are another token block;
**cloud sync** replaces the storage module behind the same interface.

---

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — module boundaries, data flow,
  and the reasoning behind each decision in more depth.
- [`docs/design-system.md`](docs/design-system.md) — full token reference,
  component catalogue and usage rules.
- The live design-system reference is at `/settings` in the running app, rendered
  from the real components so it cannot drift from reality.
