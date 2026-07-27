# `assets/` — design source files

Source artwork and brand material. **Nothing in this folder is served to the
browser.**

## Why this is separate from `public/`

|                        | `public/`                                             | `assets/`                          |
| ---------------------- | ----------------------------------------------------- | ---------------------------------- |
| Served at a URL        | Yes, verbatim                                         | No                                 |
| Processed by the build | No                                                    | Only if imported by code           |
| Contents               | Files that must exist at a fixed path (`/robots.txt`) | Masters, exports, brand references |

Mixing the two is how a 12&nbsp;MB layered export ends up publicly downloadable at
`/logo-final-v3-FINAL.png`. Keeping masters here makes "what ships" an explicit
decision rather than a side effect of where a file was dropped.

## Contents

- `brand/logo-mark.svg` — master artwork for the Chiify mark. The application
  renders this shape as inline JSX in `components/common/logo.tsx` so it can
  inherit `currentColor` and add no network request; this file is the reference
  for anything produced outside the app (favicons, press kits, print).

## Adding assets

- Optimise before committing. Run SVGs through an optimiser and keep raster
  masters out of the repository entirely if they exceed a few hundred kilobytes.
- Images that a component imports (`import cover from '@/assets/...'`) are
  processed and hashed by the build, so they belong here rather than in
  `public/`.
- Files that must be reachable at a stable, unhashed URL — `robots.txt`,
  verification files, anything a third party fetches by path — belong in
  `public/`.
