# Contributing

Thanks for looking. This document is short because most of what you need is in
the code: every non-obvious decision carries a comment saying _why_, and each
`lib/` module has a header explaining what it may and may not import.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run verify       # typecheck, lint, format, tests — run before pushing
```

Node 20.9 or later. There is nothing else to configure: no environment
variables, no services, no accounts.

## The rules that matter

**Boundaries run one way.** `lib/parser` does not know what an EPUB is.
`lib/epub` has never seen a `.docx`. `lib/validation` reads a package and
`lib/epub` has not heard of it. Nothing in `lib/` imports React, and nothing
outside `lib/epub` knows what an OPF is. These are what let each phase be built
without disturbing the last, and a pull request that crosses one needs to say
why in the description.

**Errors are values.** Domain failures return `Result<T, AppError>`; exceptions
are for programmer errors. An `AppError` message is written for an author, and
`hint` says what to do about it. Never surface an internal message — see
`crashError` for the shape.

**Nothing is changed without being shown.** The auto-fix engine returns
proposals. If you add one, it must state the field, the before, the after and
where the value came from. Anything requiring authorship — a description,
subjects, alt text — is not auto-fixable, and that is not a limitation to route
around.

**Nothing goes on the main thread.** Parsing and generation run in workers. A
barrel that re-exports an engine will silently pull 700 KB onto every page; if
you add an export, check what a production build ships.

**Comments explain why.** What the code does is visible. A comment earns its
place by recording a decision, a constraint, or a failure that is not obvious
from the line below it.

## Making a change

1. Branch from `main`.
2. Write the change and a test that would have failed before it.
3. `npm run verify`.
4. For anything a user touches, drive it in a browser against a production
   build and assert against the DOM. See [`docs/testing.md`](docs/testing.md) —
   the reasoning there is not optional advice.
5. Open a pull request describing _why_, not only what. If you made a trade-off,
   name the thing you traded away.

## Style

Prettier and ESLint decide formatting; do not argue with them in review.
Beyond that: British English in prose and user-facing copy, `camelCase` for
values, `PascalCase` for types and components, `kebab-case` for files. Prefer a
named function to a clever expression, and a longer name to a comment
explaining a short one.

## What to work on

[`docs/architecture.md`](docs/architecture.md) has the roadmap. The seams for it
already exist: another export format is a new generator, another input format is
a new parser in the registry, cloud sync replaces the storage module behind the
same interface.
