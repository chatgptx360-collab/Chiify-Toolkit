# Design system

The live reference is at **`/settings`** in the running app — it renders the real
components, so it cannot drift from what ships. This document covers the tokens
and the rules.

Design influences: Notion, Linear, Vercel, Raycast, Arc. The shared
characteristics worth naming are _restraint_ (few colours, lots of whitespace),
_speed_ (short, decelerated motion) and _depth without decoration_ (hairline
borders and soft shadows rather than gradients and glows).

---

## Token layers

`styles/globals.css` defines tokens in three layers. Components consume layers
2 and 3 only.

```
1. Primitive palette   --neutral-800, --brand-blue-500      never used in JSX
2. Semantic tokens     --background, --border, --danger     what a colour MEANS
3. Tailwind bridge     bg-background, border-border         what you write
```

**The rule:** never write a hex value in a component. If no semantic token fits
what you need, the token set is missing something — add it to layer 2 rather
than reaching into layer 1.

---

## Colour

Dark is the default theme. `:root` holds dark values; `.light` overrides them.

### Surfaces

| Token        | Dark                | Light               | Use                    |
| ------------ | ------------------- | ------------------- | ---------------------- |
| `background` | `#09090B`           | `#FFFFFF`           | Page                   |
| `surface`    | `#18181B`           | `#FAFAFA`           | Sidebar, inset panels  |
| `card`       | `#18181B`           | `#FFFFFF`           | Cards                  |
| `popover`    | `#1C1C20`           | `#FFFFFF`           | Menus, dialogs, toasts |
| `muted`      | `#27272A`           | `#F4F4F5`           | Wells, disabled fills  |
| `overlay`    | `rgb(9 9 11 / .72)` | `rgb(9 9 11 / .45)` | Modal scrim            |

### Content

| Token               | Use                            |
| ------------------- | ------------------------------ |
| `foreground`        | Primary text                   |
| `muted-foreground`  | Secondary text, descriptions   |
| `subtle-foreground` | Tertiary text, hints, metadata |

### Lines

`border` for default rules, `border-strong` for hover and emphasis, `input` for
field outlines, `ring` for focus.

### Intents

| Intent    | Dark      | Light     | Meaning                    |
| --------- | --------- | --------- | -------------------------- |
| `primary` | `#3B82F6` | `#2563EB` | The one action on a screen |
| `success` | `#22C55E` | `#15803D` | Completed, valid           |
| `warning` | `#F59E0B` | `#B45309` | Advisory, needs review     |
| `danger`  | `#EF4444` | `#DC2626` | Failed, destructive        |
| `info`    | `#3B82F6` | `#2563EB` | Neutral information        |

Each intent also has a `-foreground` (text on the solid fill) and a `-subtle`
(low-alpha tint for badges and alert backgrounds).

**Why the light values differ:** `#3B82F6` reaches only 3.7:1 against white,
below WCAG AA for a button label; `#22C55E` reaches 3.2:1. The darker steps clear
4.5:1 while staying visually the same hue. The dark-theme values are the palette
as specified — they clear AA against `#09090B` unchanged.

**Meaning is never carried by colour alone.** Every intent pairs with an icon or
a text label. This is a WCAG 1.4.1 requirement and a real help to the ~8% of men
with a colour vision deficiency.

---

## Typography

`Inter` for UI, `JetBrains Mono` for code and keyboard hints, both self-hosted
via `next/font` — no third-party request on first paint and no layout shift.

| Step   | Size | Line height | Tracking | Typical use             |
| ------ | ---- | ----------- | -------- | ----------------------- |
| `2xs`  | 11px | 16px        | +0.02em  | Uppercase eyebrows, kbd |
| `xs`   | 12px | 18px        | —        | Metadata, hints         |
| `sm`   | 14px | 22px        | —        | Body, controls          |
| `base` | 16px | 26px        | —        | Long-form reading       |
| `lg`   | 18px | 28px        | —        | Card titles in dialogs  |
| `xl`   | 22px | 30px        | −0.01em  | Section headings        |
| `2xl`  | 28px | 34px        | −0.018em | Page titles             |
| `3xl`  | 36px | 42px        | −0.022em | Hero                    |
| `4xl`  | 48px | 52px        | −0.028em | Display                 |

Negative tracking increases with size — large text set at neutral tracking looks
loose, which is what separates a considered interface from a default one.

`text-wrap: balance` is applied to headings and `text-wrap: pretty` to
paragraphs, so headings do not leave one word on a line.

---

## Spacing, radius, elevation

**Spacing** follows Tailwind's 4px scale. Named steps in `lib/design/tokens.ts`
label the ones the design language actually uses. Section rhythm is `space-y-10`
between page sections and `space-y-4` within them.

**Radius** derives from a single `--radius: 0.75rem`. Changing that one value
re-rounds the entire product.

| Token        | Value | Use                         |
| ------------ | ----- | --------------------------- |
| `rounded-sm` | 8px   | Badges, small controls      |
| `rounded-md` | 10px  | Buttons, inputs, menu items |
| `rounded-lg` | 12px  | Panels, alerts              |
| `rounded-xl` | 16px  | Cards, dialogs              |

**Elevation** is a five-step shadow scale, softer and wider on dark surfaces
than on light ones — a shadow tuned for white backgrounds reads as a dirty smear
on near-black.

Cards additionally use `surface-highlight`, a one-pixel gradient along the top
edge that simulates a lit surface. It is the detail that gives Linear and Raycast
surfaces their depth.

---

## Motion

House style: short (140–320ms), decelerated, small travel. Motion explains where
something came from; it never makes the user wait.

| Token            | Duration | Use                            |
| ---------------- | -------- | ------------------------------ |
| `motion-instant` | 80ms     | Hover, press, colour changes   |
| `motion-fast`    | 140ms    | Default UI state changes       |
| `motion-normal`  | 220ms    | Panels, popovers, page content |
| `motion-slow`    | 320ms    | Drawers, dialogs               |

Easings: `standard` (the workhorse), `entrance` (more decelerated, for things
appearing), `exit` (accelerating away).

**In CSS**, use the `motion-*` utilities. **In Framer Motion**, use
`transitions` and the variants from `lib/design/motion.ts` — `fadeUpVariants`
is the app's default entrance, `staggerContainerVariants` cascades a grid at
40ms intervals.

**Radix overlays use CSS keyframes, not Framer Motion**, because Radix keeps a
closing element mounted until `animationend` fires — a transition would be
skipped on exit and the dialog would vanish instantly.

`prefers-reduced-motion` is honoured twice: globally in CSS, and per-component
via `useReducedMotion()`.

---

## Component catalogue

### Primitives — `components/ui`

| Component                    | Notes                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                     | `primary` / `secondary` / `danger` / `outline` / `ghost` / `link`; `asChild` renders a link with button styling while keeping `<a>` semantics; `loading` keeps the label mounted so the button never resizes |
| `Card`                       | Composed of `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`; `interactive` adds hover elevation — non-clickable cards must not use it                                              |
| `Badge`                      | Six intents × three tones (`subtle` default, `solid`, `outline`)                                                                                                                                             |
| `Input`, `Textarea`          | `invalid` drives both appearance and `aria-invalid`                                                                                                                                                          |
| `Label`                      | Radix-based; `required` renders a marker that is announced, not just drawn                                                                                                                                   |
| `Alert`                      | Inline, persistent state message; each intent carries a default icon                                                                                                                                         |
| `Dialog`                     | Radix; focus trap, restoration, scroll lock, background inerting                                                                                                                                             |
| `DropdownMenu`               | Radix; roving focus and type-ahead                                                                                                                                                                           |
| `Progress`                   | Determinate and indeterminate; four intents                                                                                                                                                                  |
| `Skeleton`                   | `aria-hidden`; `SkeletonGroup` provides the single announcement                                                                                                                                              |
| `Tooltip`                    | Supplementary only — never the sole location of information                                                                                                                                                  |
| `Separator`                  | Decorative by default (`role="none"`)                                                                                                                                                                        |
| `ToastProvider` / `useToast` | Queue capped at 4; timers pause on hover and focus                                                                                                                                                           |

**Alert vs toast:** an alert describes a _state the user is looking at_; a toast
reports the _result of something the user just did_. Mixing them produces
interfaces that shout transient popups about permanent problems.

### Patterns — `components/common`, `cards`, `dashboard`, `forms`

| Component     | Notes                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| `PageHeader`  | One per route; guarantees exactly one `<h1>`                                         |
| `Section`     | Titled band; explicit heading level keeps the outline correct                        |
| `EmptyState`  | Enforces icon + title + explanation + next action                                    |
| `ThemeToggle` | Three-way (light / dark / system) — a two-state switch cannot express "follow my OS" |
| `Logo`        | Inline SVG inheriting `currentColor`; `markOnly` for the collapsed rail              |
| `FeatureCard` | A capability with a status badge                                                     |
| `RoadmapCard` | A delivery phase and its contents                                                    |
| `StatCard`    | One headline number; takes a pre-formatted string, not a number                      |
| `FormField`   | Generates ids and wires `aria-describedby` / `aria-invalid`                          |
| `FormSection` | Real `<fieldset>` + `<legend>` grouping                                              |

---

## Usage rules

1. **Semantic tokens only.** `bg-card`, never `bg-[#18181b]`.
2. **Motion tokens only.** `motion-fast`, never `duration-150`.
3. **Every component accepts `className`** and merges it through `cn()`, so a
   caller can override without `!important`.
4. **One `<h1>` per page**, supplied by `PageHeader`. Sections use `h2`, cards
   inside them use `h3`.
5. **Icon-only buttons need `aria-label`.** Decorative icons need
   `aria-hidden="true"`.
6. **Do not add a variant for a one-off.** Pass `className`. Add a variant when
   the third call site appears.
7. **New primitives go in `components/ui` only if they carry no product
   vocabulary.** Otherwise they belong a layer up.
