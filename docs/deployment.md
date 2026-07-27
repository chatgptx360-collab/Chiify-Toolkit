# Deploying Chiify Toolkit

Chiify runs entirely in the browser: manuscripts are parsed, books are generated
and validation runs on the reader's own machine. Nothing is uploaded, so there
is no database, no API and no server-side secret to configure.

That makes the deployment unusually simple — and it means the hosting platform
is a delivery mechanism rather than part of the product.

---

## Vercel, from the dashboard

The shortest path, and the one that keeps deploying itself afterwards.

1. Go to [vercel.com/new](https://vercel.com/new) and import
   `chatgptx360-collab/Chiify-Toolkit`.
2. Accept every default. Vercel detects Next.js and needs no configuration:
   - **Framework preset** — Next.js
   - **Build command** — `next build`
   - **Output directory** — `.next`
   - **Install command** — `npm install`
   - **Environment variables** — none
3. Choose the branch to treat as production. Until the phase branches are merged
   into `main`, that is `claude/chiify-toolkit-phase-5`.

Every push to that branch then redeploys, and every pull request gets its own
preview URL — which is a genuinely useful way to review a phase, since the whole
application is exercisable from a preview link.

## Vercel, from the command line

Run from a machine that can reach `vercel.com`:

```bash
npm i -g vercel
vercel login
vercel --prod
```

Accept the detected settings. The first run links the directory to a project and
writes `.vercel/` locally; it is already covered by `.gitignore`.

---

## Requirements

| Requirement | Value                                         |
| ----------- | --------------------------------------------- |
| Node        | ≥ 20.9 (declared in `package.json` `engines`) |
| Build       | `npm run build`                               |
| Start       | `npm run start`                               |
| Env vars    | None                                          |
| Services    | None                                          |

## Anywhere else

Nothing in the application depends on Vercel. `npm run build && npm run start`
produces a standard Next.js server that runs on Netlify, Render, Fly, a
container, or a laptop.

The routes are statically prerendered except `/projects/[id]`, which is rendered
on demand — and even that renders an empty shell, because the project it
displays lives in the visitor's own browser storage.

---

## What a visitor gets

A working copy of the tool, with their own data. Projects persist in
`localStorage`; parsed manuscripts and generated books live in memory for the
session and are deliberately not persisted (see
[`docs/architecture.md`](architecture.md)).

Two consequences worth stating plainly before sharing a link:

- **Reloading the page clears the generated book**, so the preview and
  validation screens ask for a fresh conversion. The project and its metadata
  survive.
- **Nothing is shared between visitors or between devices.** Two people opening
  the same URL each get an empty workspace. That is the point of local-first,
  and it is also why there is nothing to secure.
