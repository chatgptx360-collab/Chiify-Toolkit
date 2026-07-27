# Deploying Chiify Toolkit

Chiify runs entirely in the browser: manuscripts are parsed, books are generated
and validation runs on the reader's own machine. Nothing is uploaded, so there
is no database, no API and no server-side secret to configure.

That makes the deployment unusually simple — and it means the hosting platform
is a delivery mechanism rather than part of the product. The app builds to a
static export (`output: 'export'`), so anything that serves files can host it.

---

## GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main` or
`claude/chiify-toolkit-phase-5`, and can be re-run from the Actions tab. The
site lands at:

```
https://chatgptx360-collab.github.io/Chiify-Toolkit/
```

### One-time setup

**Settings → Pages → Source: GitHub Actions.** Once, by hand.

This cannot be automated, and the reason is worth knowing rather than working
around: creating a Pages site is an administrative action on the repository, and
the automatic `GITHUB_TOKEN` a workflow runs with deliberately cannot perform
one. The `pages: write` permission grants the right to publish to a site that
already exists, not to bring one into being. A workflow that could enable Pages
could also enable it on a repository whose owner did not intend to publish
anything.

`actions/configure-pages` accepts an `enablement: true` input that attempts it
anyway; against this token it fails with `Resource not accessible by
integration`. The workflow checks first and says exactly this instead.

After that one switch there is nothing further to configure, and no deployment
credential exists anywhere in the repository — `actions/deploy-pages`
authenticates with a short-lived OIDC token rather than a stored secret.

The workflow runs `npm run verify` — typecheck, lint, format and the full test
suite — before it builds. A deploy that publishes a broken site is worse than
one that fails. This is the only workflow in the repository and it does not run
on pull requests, so no checks appear there.

**The base path is not hard-coded.** A Pages project site is served from a
subdirectory, so the workflow passes `base_path` from `configure-pages` into the
build as `NEXT_PUBLIC_BASE_PATH`. Renaming the repository does not break the
deployment, and local development is unaffected because the variable is empty
there.

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

Vercel serves from the root, so leave `NEXT_PUBLIC_BASE_PATH` unset — the base
path exists only for GitHub Pages.

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

Every route is prerendered to a static file. There is no dynamic route: a single
project is a _view_ of `/projects` (`?id=…`) rather than a route beneath it,
because a project id is created in the visitor's browser and is meaningless to
anyone else. That is what makes the export possible, and it is the more honest
URL — `/projects/prj_a1b2` looks like a shareable address for a resource and
is not one.

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
