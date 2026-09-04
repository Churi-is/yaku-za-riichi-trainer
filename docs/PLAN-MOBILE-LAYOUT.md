# Mobile Layout Plan — Portrait & Landscape Match Table

Status: **implemented** (P0–P5) · Owner: Worker D (`src/ui/**`, `src/state/**`, styles, `index.html`)
Scope: match table first, then a responsive pass over menu / settings / replay / summary screens.
Engine, AI, and analysis code are **not** touched. `PublicView` and stores are unchanged.

**Implementation notes (2026-09-04):**

- Delivered in `src/ui/**` + `src/styles/global.css` + `index.html`:
  `Tile.orientation/marker` (box-swap sideways tiles), chunked side rivers (columns of 6),
  `SeatInfo compact` backs ladder, `MatchScreen` portrait/landscape skeletons via
  `useViewport`, call bar hides when idle, overlay pills (header row) + tabbed overlay sheet,
  `LayoutGuard` (DEV), safe-area/`100dvh` handling, `scripts/layout-audit.mjs`.
- Tests: `src/ui/__tests__/mobileLayout.test.tsx` (§12.2 unit coverage) — all suites green.
- P6 (real-browser matrix) is **not** runnable in this sandbox: browser binaries/CDNs
  (Playwright CDN, Debian mirrors, Chromium's NSS deps) are all blocked by network egress;
  the audit script is provided for CI/dev machines (`npm i -D playwright` + a running
  `npm run dev`). The dev-only `LayoutGuard` warns on violations instead.
- Deliberate refinements vs. the numbers below: overlay pills live in the **header row**
  (not a separate strip) and hand melds are a single scrollable line — both were needed to
  make the landscape budget (`40 header + 44 call + ~98 hand → 208px table`) hold exactly.
  Side strips degrade to scroll (`overflow-y: auto`, hidden scrollbar) rather than clip; the
  lateral rows use 9/10-per-row rivers + `xxs` compact-tier tiles to make the row budget.

---

## 1. Goals / non-goals / constraints

### Goals

1. **Two first-class layouts** — portrait and landscape — that look designed, not squashed,
   for every supported viewport from a 320×568 (iPhone SE 1st gen) up to tablets, including
   split-screen and foldable middle states.
2. **Side seats' tiles are sideways.** Left seat (seat 3) and right seat (seat 1) render their
   concealed-tile backs, melds, and discard rivers rotated 90°, matching a physical table seen
   from the south seat.
3. **Nothing clips and nothing overlaps unintentionally.** Every `seat-*` region, river, the
   hand dock, the dora display, and the call bar must fit inside the viewport. The only
   allowed overlaps are: modals / pause menu / match-end card / an **expanded** overlay sheet
   (user explicitly opened it) / tile fans (intentional overlap).
4. **Function first, looks second, both non-negotiable.** Readability of the player's own
   hand and the call buttons outranks everything; side-seat fidelity outranks header chrome.
5. All existing desktop behavior stays identical at ≥ ~960px width.

### Non-goals

- No 3D / perspective table, no zoom gestures, no drag-to-rearrange.
- No engine, store, or contract changes — this is purely `src/ui/**` + CSS + `index.html`.
- No new external dependencies. (Optional Playwright audit script is a dev-only add-on.)
- Backwards-compatible tile props: existing tests and screens keep working.

### Constraints already in the product docs

- Overlays must **never block discard rivers, dora, or call prompts** — on mobile this is
  solved by *auto-collapse* + an explicitly expanded sheet (see §10).
- Overlays are instant toggles; panel content is computed off the critical path (already true).
- Touch-only: no hover-only affordances, ≥44px tap targets for controls.

---

## 2. Current-state audit (why a new plan is needed)

Current mobile behavior is the desktop layout with two small patches
(`@media (max-width: 680px)` and `@media (hover: none)` in `src/styles/global.css`), plus
`overflow: hidden` on `.table-wrap`. Measured against the current CSS on a 390×844 portrait
viewport (tile `md` = 32×44 after the 680px patch):

| # | Problem | Cause | Consequence |
|---|---|---|---|
| 1 | Human hand wraps to 2–3 rows | 14 × 35px + gaps ≈ 500px > 370px content width; `flex-wrap: wrap` | `.hand-dock` grows to ~180px; no intrinsic sizing agreement |
| 2 | Table clips vertically | `.match` is `height:100%` flex; `.table-wrap { flex:1; overflow:hidden }` with fixed header (~60px) + call bar (52px) + swollen hand dock (~180px) | Table gets near-zero height; rivers/opponents cut off — the exact symptom to eliminate |
| 3 | Side columns overflow horizontally | Grid `1fr 2fr 1fr` gives outer tracks ≈ 84px but `.opp { min-width: 92px }` + padding | Left/right seat cards poke out of their tracks and get clipped by `overflow:hidden` |
| 4 | Side rivers too tall | 3-column grid of `xs` tiles: 18 discards → 6 rows ≈ 190px, plus SeatInfo ~90px | Left/right seats taller than the middle row → clipped |
| 5 | Side tiles aren't sideways | Rivers/melds/backs never use `rotated` except the riichi declaration tile | Fails the core visual requirement |
| 6 | `tile-rotated` doesn't swap layout box | `transform: rotate(90deg)` rotates in place; the box stays w×h | Rotating a whole river needs negative-margin hacks → fragile |
| 7 | Overlays cover everything on mobile | `.overlay-layer { width: min(88vw,340px) }` floats over the table; `max-height: calc(100% - 16px)` | Rivers, dora, and the hand are blocked — violates product constraint |
| 8 | Header wraps & outgrows | `.match-top` has 2 `row`s + `OverlayToggleBar`, `flex-wrap: wrap` at ≤680px | Header can reach ~110px on 360px-wide screens, starving the table |
| 9 | No safe-area / dynamic-viewport handling | viewport meta lacks `viewport-fit=cover`; no `env(safe-area-inset-*)`; `height:100%` not `100dvh` | Notch, home indicator, and mobile browser chrome clip content |
| 10 | No orientation-aware layout | Only `max-width` media queries | Landscape (shortest case, ~390px tall) is barely usable |

### What to keep

The 3×3 grid *idea* (top / left / right / bottom / center) reads correctly and is preserved in
both orientations. The tile face system (`tile-face`, `tile-red`, `tile-back`), the river
component's orientation prop, the auto-collapse concept for overlays, and the 6-per-row river
convention are all sound — the plan builds on them rather than replacing them.

---

## 3. Design principles

1. **Size the table from the container, not the viewport.** The match screen uses CSS
   *container queries* (`container-type: size` on `.table-wrap` and `inline-size` on
   `.hand-dock`), so split-screen, foldables, and orientation changes all reflow correctly with
   zero JavaScript.
2. **Fluid tile scale.** The human hand always fits exactly one (or a defined two) rows:
   tile size is derived from available width, never a hard pixel guess.
3. **Fixed chrome, flexible table.** Header, call bar, and hand dock are `flex: none` and
   sized exactly; the table gets the remainder and its *content* adapts via tiers
   (`generous / standard / compact`), never the other way around.
4. **Sideways is a layout property, not a transform hack.** Side tiles swap width/height so
   the grid never mis-counts space; only the glyph face is rotated.
5. **Correct reading order.** Rendered DOM order always equals discard order (accessibility +
   river-reading training purpose). Visual rotation is achieved with chunked columns and CSS
   ordering, not by reversing arrays in markup where avoidable.
6. **Explicit overlap policy.** Everything is either in-flow (never overlaps) or deliberately
   a modal/sheet/fan (documented in §10).

---

## 4. New shared design system

### 4.1 Viewport buckets (CSS-only)

Use media queries to pick the **layout skeleton**, container queries to pick **density
tiers** inside it.

```css
/* skeleton: desktop (unchanged) — default above */
@media (max-width: 600px) and (orientation: portrait) { /* Portrait skeleton */ }
@media (max-height: 500px) and (orientation: landscape) { /* Landscape skeleton */ }
@media (min-width: 601px) and (orientation: landscape) { /* Tablet-landscape: desktop skeleton, compact media tweaks */ }
```

Density tiers are set on `.table-wrap` (which gets `container-type: size; container-name: table;`):

| Tier | Container height | Trigger (typical) | Backs | Side rivers | Side melds | Hand |
|---|---|---|---|---|---|---|
| `generous` | ≥ 560px | portrait 390×844, tablets | 3-col `xxs` grid (118px) | `xs`, cols of 6 (3×94×142) | `xs` rows (4×94) | 2 wrapped rows @32px |
| `standard` | 380–560px | portrait SE 375×667 | count chip (0px) | `xxs`, cols of 6 (66×106) | `xxs` rows (4×72) | fluid 1 row @≥22px |
| `compact` | < 380px | landscape, tiny portrait | 3-back mini fan + count (34px) | `xxs`, cols of 6 (66×106) | `xxs`, 2 per line (34px) | fluid 1 row @`sm` cap |

> All numbers in the wireframes below are worked examples for the two canonical viewports:
> **portrait 390×844** and **landscape 844×390**, with 375×667 / 667×375 as the worst
> supported case. The CSS uses `clamp()` / container units so every intermediate size is
> covered; the worked examples prove the worst case fits.

### 4.2 Tile size scale (extended)

Add one size, `xxs`. All sizes remain in `--tw/--th` custom properties (existing pattern).

| Size | `--tw × --th` | Glyph | Used for |
|---|---|---|---|
| `xxs` *(new)* | 16 × 22 | 9px | compact-tier side rivers, side melds, mini back fans |
| `xs` | 22 × 30 | 12px | rivers (all orientations), side backs, desktop side melds |
| `sm` | 30 × 41 | 17px | dora, melds, compact-tier hand |
| `md` | 40 × 54 | 22px | human hand (desktop/generous) |
| `lg` | 52 × 70 | 28px | hand-end reveals |

**Fluid hand sizing** (`.hand-dock` gets `container-type: inline-size`):

```css
.hand-dock {
  --hand-gap: 3px;
  /* 14 tiles + 13 gaps + 10px drawn separator must always fit */
  --hand-tw: clamp(22px, calc((100cqw - (13 * var(--hand-gap)) - 10px) / 14), 40px);
  --hand-th: calc(var(--hand-tw) * 1.35); /* preserves 40:54 ratio */
}
.hand-row { display: flex; justify-content: center; align-items: flex-end; }
```

Policy: portrait width ≥ 360px keeps the hand on **two wrapped rows at up to 32×44 tiles**
(`--hand-tw: clamp(26px, calc((100cqw - 28px) / 7), 32px)` — fits 7 tiles + gap per row,
readability first while the portrait table still gets ~500px). Below 360px (or `standard`
tier where the table needs room) the hand uses the fluid one-row formula, clamped at 22px.
Landscape always uses the fluid one-row formula at `sm` size (`--hand-tw: clamp(24px, …, 32px)`),
which keeps the dock ~90px tall including the label line.

### 4.3 Dimensions, safe areas, viewport

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  /* header/call/hand heights are fixed so the overlay sheet can anchor to them */
  --header-h: 44px;
  --callbar-h: 44px;
  --handdock-h: 146px; /* portrait generic; overridden per skeleton */
}
.match { height: 100vh; height: 100dvh; } /* dvh tracks mobile chrome; vh fallback */
```

`index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

Apply insets: header `padding-top: var(--safe-top)`, hand dock & call bar
`padding-bottom: var(--safe-bottom)`, side strips `padding-left/right: var(--safe-left/right)`
in landscape (notch side). Add `touch-action: manipulation` to `body` (kills double-tap zoom
delay; pinch zoom already disabled).

### 4.4 Tap targets

- All `.btn` already enforce `min-height: 44px` — keep.
- Side river tiles are display-only; the *only* tappable tiles are the human hand (≥ 40px tall
  at the fluid minimum of 22px width → add 4px of padding-box hit area via
  `padding: 4px; background-clip: padding-box` on `tile-clickable` — cosmetic size unchanged).
- Overlay chips: 36px visual, 44px hit area (padding on the button).

---

## 5. Sideways tile mechanics (the crux)

### 5.1 Physical orientation

Viewer sits at the bottom (south) seat. A tile's *top* points at the player who owns it.

| Seat | Location | Face direction | Screen rotation |
|---|---|---|---|
| 0 (you) | bottom | up | none (`upright`) |
| 1 (opponent) | right | points left / west | **-90° (counter-clockwise)** → `rotate(-90deg)` |
| 2 (opponent) | top | points down | none (`upright`) |
| 3 (opponent) | left | points right / east | **+90° (clockwise)** → `rotate(90deg)` |

Optional one-line toggle (readability-first): render glyphs with the *top toward the player*
(swap the two directions); physical accuracy is the default.

### 5.2 Box-swap + face rotation (no layout hacks)

The current `tile-rotated { transform: rotate(90deg) }` rotates in place, leaving the layout
box w×h — this is why rotated rivers are fragile. Replace with **box swap + inner face
rotation**:

```css
/* Sideways tiles: swap the layout box so the grid sees the true footprint */
.tile-s-left, .tile-s-right { width: var(--th); height: var(--tw); }
/* Rotate only the face content around the new center */
.tile-s-left  .tile-face { transform: rotate(-90deg); }
.tile-s-right .tile-face { transform: rotate(90deg); }
/* Perpendicular marker (called tile / riichi declaration): cancel the side rotation */
.tile-s-left.tile-marker  .tile-face,
.tile-s-right.tile-marker .tile-face { transform: none; }
```

- `.tile-back` has no face — the back pattern (symmetric inset ring) needs no rotation; the
  swapped box is enough.
- The `inset 0 -3px 0` shadow lip and `border-radius` stay on the **box** → consistent
  table-lighting from every seat, no per-orientation shadow work.
- The old `tile-rotated` class is kept for the **top/bottom** seats' riichi declaration and
  called meld tiles (unchanged).

### 5.3 Perpendicular markers (one consistent rule)

A tile that is *relative* to its owner's orientation is perpendicular to the owner's axis —
which, for side seats, makes it **upright to the viewer**:

- Called tile inside a side-seat open meld → `tile-marker` (reads upright).
- Riichi declaration tile inside a side-seat river → `tile-marker` (reads upright).
- Same rule for the 4th tile of a *kan* called tile if desired.

This is physically authentic and doubles as a readability feature: the only readable side
tiles are exactly the ones the player should notice.

### 5.4 Side river geometry — columns of 6, reading order preserved

Take the standard river (rows of 6, row 1 nearest the player, newest row farther) and rotate
it ±90° to the side seat:

- **Right seat (CCW):** columns run **right→left** (oldest column at the outer/right edge,
  newest column nearest the table center); within a column, tiles stack **bottom→top**
  (discard 1 at the bottom).
- **Left seat (CW):** mirrored — oldest column at the outer/left edge, newest column nearest
  the center; within a column, tiles still stack **bottom→top**.

Implementation (per-chunk rendering — explicit, testable, keeps DOM order = discard order):

```tsx
// DiscardRiver.tsx
const COLS = 6;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) },
  (_, i) => arr.slice(i * n, (i + 1) * n));

// side render: each chunk = one vertical column, chunk 1 = oldest
<div className={`river river-side river-${orientation}`}>
  {chunks(river, COLS).map((chunk, i) => (
    <div className="river-col" key={i}>
      {chunk.map((d, j) => <Tile key={j} ... orientation={side} marker={d.riichiDeclaration} />)}
    </div>
  ))}
</div>
```

```css
.river-side { display: flex; gap: 2px; }
.river-left  { flex-direction: row; }          /* oldest column at outer-left  */
.river-right { flex-direction: row-reverse; }  /* oldest column at outer-right */
.river-col { display: flex; flex-direction: column-reverse; gap: 2px; }
/* discard 1 lands at the bottom of every column for both side seats */
```

Body copy: 18 discards = 3 columns × 6 = **3 × 30px wide** (xs, sideways box 30×22) ≈ 94px
wide × 142px tall.

### 5.5 Backs: three representations on a ladder

13 concealed backs are the tallest side-strip element; a ladder avoids a permanent oversized
reservation:

| Tier | Backs representation | Height | Width |
|---|---|---|---|
| `generous` | 3-col grid of `xxs` backs (5 rows) | ≈ 118px | ≈ 52px |
| `standard` | count chip only (`13`) inside seat chip | 0px (inline) | — |
| `compact` | 3-back mini fan + `· 13` count chip | ≈ 34px | ≈ 60px |

Ladder belongs to `SeatInfo` + CSS only; `concealedCount` is already public. The fan uses
intentional overlap (documented as such).

### 5.6 Side melds

Each meld renders as **one horizontal row of 3 sideways tiles** (line perpendicular to the
strip axis — same rule as the backs strip: individual tiles are sideways; the meld "line" lies
along the seat's edge). Sizes per tier:

| Tier | Meld row | 4-meld stack height | Notes |
|---|---|---|---|
| `generous` | 3×`xs` sideways = 90×22 | 4×22 + 6 = 94px | fits the 96px portrait strip |
| `standard` | 3×`xxs` = 66×16 | 4×16 + 6 = 72px | fits the 96px strip |
| `compact` | 3×`xxs` = 66×16, **2 melds per line** | 2 lines = 34px | 2×66 = 132 ≤ 140px landscape strip |

Multiple melds stack as rows (`flex-direction: column`). Calls do not reorder tiles;
`calledTile` renders the marker (§5.3).

---

## 6. Portrait layout specification

### 6.1 Wireframe (390×844)

```
┌───────────────────────────────────────────────────┐
│ header 44px  [☰ 44] [E1·0] [25,800]  [Yaku][R][W] │ ── 1 row, chips scroll-x if tight
├───────────────────────────────────────────────────┤
│ table-wrap  ~610px  (container-type: size)         │
│ ┌──────────────── top seat ───────────────────┐    │
│ │ (seat 2) name · E 13,000 · Dealer           │ 80 │  backs: horizontal 13×xxs fan
│ │ backs ▯▯▯▯▯▯▯▯▯▯▯▯▯  melds ▯▯▯ ▯▯▯             │    │  melds: horizontal, wrap 1-2 lines
│ ├──────────┬───────────────────┬──────────────┤    │
│ │ left 96  │     center 246    │ right 96     │    │
│ │ seat     │  E1 · honba · 2   │ seat         │    │
│ │ chip 32  │  dora ▯▯▯▯▯ (sm)   │ chip 32      │    │
│ │ backs    │  tiles left · 87  │ backs        │ 426│  side strips: backs ladder,
│ │ melds    │                   │ melds        │    │  meld rows, river cols of 6
│ │ river    │                   │ river        │    │  (3×94×142 worst)
│ ├──────────┴───────────────────┴──────────────┤    │
│ │ (you) river: 6/row xs, up to 3 rows         │ 96 │
│ └─────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────┤
│ call bar 0–44px (renders ONLY when actions exist;  │
│ overlay pills strip (auto-collapsed panels) 32px  │
├───────────────────────────────────────────────────┤
│ hand dock ~146px  melds (sm, wrap) + 14 md(32×44) │
│                   2 wrapped rows + status line    │
└───────────────────────────────────────────────────┘
```

Budget check (portrait 390×844, generous tier, worst case: 4 melds + full 18-discard rivers):
`44 header + 44 call + 146 hand = 234` → table gets **610px**. Inside the table the
middle row gets `610 − 80 − 96 − 8(gaps) = 426px`; side-stack worst case =
`32 chip + 118 backs + 94 melds (4×22 + gaps) + 142 river = 386 ≤ 426` ✓ (40px slack).
For 375×667 portrait (`standard` tier, fluid one-row hand ≈ 100px): table = `667 − 44 − 44 −
100 = 479`; middle row = `479 − 80 − 96 − 8 = 295px`; stack = `32 chip + 0 backs (count chip)
+ 72 melds (xxs) + 106 river (xxs) = 210 ≤ 295` ✓ (85px slack) — heads-room absorbed by the
`cqh`-clamped segment sizing.

### 6.2 Grid definition

```css
.table {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px;
  grid-template-rows: 80px minmax(0, 1fr) 96px;
  grid-template-areas:
    "top  top  top"
    "left center right"
    "bot  bot  bot";
}
```

- `minmax(0, 1fr)` everywhere — the single most important fix for grid overflow clipping.
- `.seat-top` → horizontal row: `SeatInfo` variant `orientation="top" compact` (same
  component, `compact` prop switching the chip layout) + `DiscardRiver orientation="top"`.
- `.seat-left/right` → `.side-strip` (96px): seat chip → backs block → meld rows → river
  (columns-of-6); `flex: 1; min-height: 0` with each block sized by `cqh` clamps:
  `backs: clamp(0px, 24cqh, 118px)`, `river: clamp(106px, 34cqh, 142px)`, melds take the rest.
- `.seat-bottom` → your river `orientation="bottom"`, 6 per row, xs.

### 6.3 Portrait specifics

- Header: single 44px row; overlay chips scroll horizontally (`overflow-x: auto;
  scrollbar-width: none`) when width < 400px; points move into the hand-dock seat line
  (already there) so the header stays short.
- Call bar: **returns `null` when there are no actions** (replaces the 52px empty bar);
  when present it is `flex-wrap: nowrap; overflow-x: auto` so 4+ chi options never grow the
  bar vertically.
- Hand dock: `--hand-tw` fluid one-row formula when `@container (max-width: 380px)`, else two
  wrapped rows at 32×44. Riichi/call-window dimming behavior unchanged.
- The overlay auto-collapsed pill strip sits between table and call bar (in-flow, 32px).

---

## 7. Landscape layout specification

### 7.1 Wireframe (844×390)

```
┌──────────────────────────────────────────────────────┐
│ header 40px  [☰][E1·0][25,800] [Yaku][Reads][Waits]  │ 1 row
├──────────┬───────────────────────────────┬───────────┤
│ left 140 │  top seat (seat 2) 64px       │ right 140 │
│ seat     ├───────────────────────────────┤ seat      │
│ chip 32  │  center 88px                  │ chip 32   │
│ fan 34   │  E1 · honba · 2               │ fan 34    │
│ melds 34 │  dora ▯▯▯▯▯ (sm) · 87 left    │ melds 34  │
│ river    ├───────────────────────────────┤ river     │
│ 3×xxs    │  your river: 9/row, 2 rows 64 │ 3×xxs     │
│ cols106  │                               │ cols106   │
├──────────┴───────────────────────────────┴───────────┤
│ call bar 0–44px / overlay pills 32px                  │
│ hand dock ~90px: melds inline + 14×sm one row + line  │
└──────────────────────────────────────────────────────┘
```

Budget (844×390): `40 header + 44 call + 90 hand = 174` → table = **216px**. Center column:
`64 top + 88 middle + 64 bottom = 216` ✓. Side strips span the full table height; worst-case
content = `32 chip + 34 mini-fan + 34 melds (4 melds, 2 per line) + 106 river (3 cols of 6
xxs sideways: 66×106) = 206 ≤ 216` ✓ — **no scrolling required even at the worst
4-meld + 18-discard corner**; 667×375 (table = 201px) uses cqh clamps to shrink the same
stack to ≤ 195px (§7.3).

### 7.2 Grid definition

```css
.table {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) 140px;
  grid-template-rows: 64px minmax(0, 1fr) 64px;
  grid-template-areas:
    "left top   right"
    "left center right"
    "left bot   right";
}
.side-strip { grid-area: left / right; display: flex; flex-direction: column; min-height: 0; }
```

- Center column carries the top seat (horizontal compact), center info (round · dora ·
  tiles-left laid horizontally), and your river at **9 per row** (2 rows for 18 discards:
  `2×30+2 = 62px` ≤ 64 ✓). 9/row keeps river tiles at `xs` — readable, at the cost of one
  extra row instead of the desktop 6.
- Top seat in landscape: name/pts one line, backs as a **horizontal** 13×`xxs` fan
  (≈ 200px wide, fits the center column), melds horizontal, all at ~64px.
- In landscape the call bar is optionally docked center-bottom above the hand (same slot,
  no separate logic).
- Compact-tier strip sizing is height-driven via `cqh` clamps so 667×375 (table ≈ 201px)
  automatically shrinks: chip `clamp(28px, 16cqh, 32px)`, backs `clamp(0px, 18cqh, 34px)`,
  melds `clamp(30px, 18cqh, 34px)`, river `clamp(96px, 52cqh, 106px)`.

### 7.3 Landscape specifics

- Reduce header to `--header-h: 40px;` and overlay chips to 36px so a single row fits at
  667px width.
- Hand dock: melds render **inline to the left of the hand row** when space allows
  (`@container hand (min-width: 700px)`), else above. Height stays 90px.
- `--safe-left/right` paddings on the two `.side-strip`s (landscape notch).

---

## 8. Header, call bar, hand dock — shared mobile rules

| Region | Portrait | Landscape |
|---|---|---|
| Header | 44px, 1 row, chips scroll-x | 40px, 1 row |
| Call bar | visible only when legal actions exist; `nowrap` + scroll-x; 44px | same |
| Overlay pill strip | 32px, in-flow, between table and call bar | same |
| Hand dock | melds above; 2 wrapped rows @32px (wide) or fluid 1 row @≥22px (narrow); status line | melds inline (wide) or above; 1 row @ `sm`; status line |
| Hand sizing hook | `@container (max-width: 380px)` switches mode | fluid formula always |

New component (Worker D): `ActionBar.tsx` is not needed — `CallButtons` only changes its
empty-return and adds the `nowrap/scroll` class. If it feels like too much scroll for 4 chi
options on 320px, wrap to a second 44px row instead (bounded, never clipped).

---

## 9. Component & file changes

### 9.1 API additions (all optional, backwards-compatible)

```tsx
// Tile.tsx
export type TileOrientation = 'upright' | 'left' | 'right';
export interface TileProps {
  // ...existing
  orientation?: TileOrientation;   // 'left' | 'right' ⇒ sideways (§5.2)
  marker?: boolean;                // perpendicular tile inside a sideways group (§5.3)
}
// classes: tile-s-left / tile-s-right / tile-marker
```

```tsx
// DiscardRiver.tsx
// orientation already exists; 'left' | 'right' now render side columns (§5.4)
// internal change: chunk(river, 6) → .river-col (column-reverse)
```

```tsx
// SeatInfo.tsx
export interface SeatInfoProps {
  // ...existing
  orientation?: 'top' | 'bottom' | 'left' | 'right';
  compact?: boolean;              // chip frame for mobile densities
}
```

```tsx
// MeldArea.tsx
export interface MeldAreaProps {
  // ...existing
  orientation?: 'upright' | 'left' | 'right'; // passes through; called tile gets marker
}
```

```tsx
// HandView.tsx — no API change (sizing is CSS); optionally accept density from parent.
// CallButtons.tsx — return null when no actions; add className="call-bar nowrap".
// ScoreBoard.tsx / DoraDisplay.tsx — no API change; CSS handles layout orientation.
```

### 9.2 Files touched

| File | Change |
|---|---|
| `src/ui/components/Tile.tsx` | add `orientation`, `marker` props + classes |
| `src/ui/components/DiscardRiver.tsx` | side columns chunking, marker for riichi declarations |
| `src/ui/components/SeatInfo.tsx` | `orientation` + `compact`; backs ladder (§5.5) |
| `src/ui/components/MeldArea.tsx` | `orientation` pass-through + marker rule |
| `src/ui/components/CallButtons.tsx` | empty → `null`; nowrap scroll |
| `src/ui/screens/MatchScreen.tsx` | skeleton chosen purely by CSS media queries; `.match` additionally gets `match-portrait` / `match-landscape` classes from a tiny `useOrientation()` (matchMedia) hook — used by the overlay sheet and testable in jsdom; pass orientation props |
| `src/ui/overlays/OverlayToggleBar.tsx` | chips: 36px + `aria-expanded`, auto-collapse state |
| `src/ui/overlays/*.tsx` | no logic change; panel content renders inside the sheet/tabs |
| `src/styles/global.css` | §4–§8 rules; tiers; safe areas; remove obsolete `@media (max-width:680px)` patches |
| `index.html` | `viewport-fit=cover` |
| `src/ui/__tests__/*` | new unit tests (§12) |

New dev-only helper: `src/ui/dev/LayoutGuard.tsx` (§12.3) with `import.meta.env.DEV` guard.

---

## 10. Overlay & modal overlap policy (intended overlaps only)

Product constraint: overlays never block rivers, dora, or call prompts.

**Default state (no overlap):** each active overlay renders as an **auto-collapsed pill**
(name + primary signal, ≤ 2 lines, 32px strip in-flow between table and call bar). Multiple
active overlays = stacked pills; strip scrolls horizontally if needed. Tapping a pill
toggles `aria-expanded`; chips keep their "on" state.

**Expanded state (intentional overlap):** the panel opens as a **modal sheet**, positioned
between header and hand dock (`inset: calc(var(--header-h) + var(--safe-top) + 8px) 8px
calc(var(--callbar-h) + var(--handdock-h) + var(--safe-bottom) + 8px)`), scrollable, with
a dimmed scrim, grab-handle, and focus trap (`role="dialog"`, `aria-modal`, Esc / ✕ to close).
On mobile, multiple active overlays become **tabs inside one sheet** (state unchanged — all
panels still computed simultaneously; only one is displayed, saving space). Desktop keeps the
current stacked `.overlay-layer` (≥960px, unchanged).

**Menus / modals** (pause, match end, swap-seat confirmation if added) keep `modal-backdrop`
behavior — already intended overlaps.

---

## 11. Other screens (responsive pass)

Lower priority but part of "the app works on mobile":

- **Menu:** already column-flex and ≤ 700px wide; add `min-height: 100dvh`,
  `padding-top/bottom: var(--safe-*)`, `max-width: min(340px, calc(100vw - 32px))` on
  `.menu-actions`.
- **Settings:** `settings-grid` is already 1-col below 720px; wrap setting rows (`.setting-row
  { flex-wrap: wrap }`), seg buttons keep 44px.
- **Replay / Summary:** cards already stack; add safe-area padding and ensure
  `.turn-card`/`.stat-grid` never exceed `100vw` (`min-width: 0` on flex children; tables →
  divs only, already true).
- All screens: `overflow-x: clip` on `body` as a hard backstop (never hides content, only
  horizontal bleed; each screen owns its scroll).

---

## 12. Testing & layout invariants

### 12.1 Invariants (the "nothing clipped / no overlap" contract)

1. `.match` never has horizontal overflow (`scrollWidth <= clientWidth`) in either orientation.
2. `[.match-top, .table-wrap, .call-bar, .hand-dock]` pairwise rects never intersect
   (empty margins / 0px allowed) — except the intended sheet/scrim/modal.
3. Every `.river`, `.hand-row`, `.dora-tiles`, `.opp-melds` lies fully inside its
   `.seat-*` / `.hand-dock` parent rect (or is a sanctioned scroll region: below-minimum
   devices only, i.e. width < 600px *and* height < 400px, e.g. 568×320 — see §13).
4. Side rivers keep column width ≤ strip width in all tiers; no tile ever overlaps a
   neighboring river column.
5. Header chips never wrap below the header row height (scroll instead).

### 12.2 Automated tests

**Vitest (jsdom, existing setup):**
- `Tile`: `orientation="left|right"` adds `tile-s-left/right`; `marker` adds `tile-marker`
  (class assertions only — jsdom has no layout).
- `DiscardRiver`: side orientation renders exactly one `.river-col` per 6 tiles, DOM order
  equals discard order, `marker` set on riichi declarations, called-away tiles dimmed.
- `SeatInfo`: compact + orientation classes; backs count chip in compact mode.
- `CallButtons`: empty legal list renders nothing (not an empty 52px bar).
- `MatchScreen`: mobile class on `.match` for both orientation classes (mock
  `window.matchMedia`), overlay sheet opens with `role="dialog"`.

**Layout audit (dev + CI-optional):** `scripts/layout-audit.mjs` with Playwright:
open the match at each matrix cell, force `handEnd`-free deterministic state, then assert
invariants from §12.1 via `getBoundingClientRect()` and screenshot each cell
(`artifacts/mobile-layout/*.png`). Optional devDependency; not shipped to production.

### 12.3 Dev-mode safety net

`LayoutGuard` (printed to console + thin red outlines in DEV only):
`ResizeObserver` on `.match` re-checks §12.1 and `console.warn('[layout] …violation…')`.
Tree-shaken in production. This is the enforce-the-plan mechanism while iterating.

### 12.4 Device matrix

| Viewport | Portrait | Landscape | Notes |
|---|---|---|---|
| 320×568 / 568×320 (SE 1st gen) | standard tier | compact tier | worst supported; verify scroll fallback |
| 375×667 / 667×375 (SE 2nd/3rd) | standard | compact | reference E2E cells |
| 390×844 / 844×390 (iPhone 14/15/16) | generous | compact | reference E2E cells |
| 412×915 / 915×412 (Pixel 7) | generous | compact | |
| 673×841 / 841×673 (Fold inner) | generous | standard | split-screen test at ~350px too |
| 744×1133 / 1133×744 (iPad mini) | desktop skeleton | desktop skeleton | tablet = desktop, no regression |

Manual checks per cell: start match → let AI discard 6+ tiles (river wrap) → force a call
window (pon/chi with many options) → riichi mode → open every overlay (pill + sheet) →
pause menu → hand end reveal → rotate device mid-hand.

---

## 13. Edge cases & decisions

| Case | Decision |
|---|---|
| 18-discard side river (exhaustive) | 3 columns of 6; fits all tiers at ≥600×400 — no scroll needed |
| Minimum supported size | **375×667 / 667×375.** Below that (e.g. 568×320) the app degrades gracefully: side strips become the sanctioned scroll region (`overflow-y: auto`, fades), hand stays pinned |
| 4 melds on a side seat | generous/standard: stacked rows; compact: 2 per line (fits 140px strip); total ≤ 206px at worst |
| 13 backs | ladder: grid (≥560px) → count chip (380–560) → mini fan + count (<380) |
| Riichi + ippatsu states | chips remain; marker tiles unchanged |
| Kan (4th tile) | meld width 4 tiles within same row rules; side kan tile upright (marker) |
| Orientation change mid-hand | pure CSS re-skeleton; `ResizeObserver` in LayoutGuard only |
| Mobile browser URL bar | `100dvh` + `entry` insets; safe-area bottom on hand dock |
| Split-screen/foldable ~350px | `standard`/`compact` tier; hand fluid 1-row formula |
| RTL / zoom disabled | no directional CSS on text; rivers use explicit flex direction, not `direction:` |
| `prefers-reduced-motion` | disable sheet slide/fade; keep instant toggle |
| Desktop ≥960px | byte-for-byte current layout (no regression) |

---

## 14. Rollout roadmap (each phase shippable)

| Phase | Work | DoD |
|---|---|---|
| **P0 Foundation** | index.html viewport-fit; `--safe-*`, `100dvh`, container query setup; add `xxs`; fluid hand formula; CallButtons null-return | Desktop unchanged; no clipping at 375×667 yet; tests green |
| **P1 Sideways tiles** | Tile `orientation`/`marker` CSS+props; DiscardRiver chunked side columns; SeatInfo/MeldArea orientation; backs ladder | Side seats fully sideways in every tier; river order tests pass |
| **P2 Portrait skeleton** | Grid, side strips, top seat row, bottom river, compact header, hand modes, call bar scroll | 390×844 and 375×667 pass §12.1 audit |
| **P3 Landscape skeleton** | 3-column grid, side strips full height, 9/row river, inline melds, compact tier | 844×390 and 667×375 pass §12.1 audit |
| **P4 Overlays** | Auto-collapse pills + modal sheet + tabbed multi-panel; desktop unchanged | Rivers/dora/call never blocked by default; sheet is the only overlay overlap |
| **P5 Rest of app** | menu/settings/replay/summary responsive pass | No horizontal scroll anywhere; safe areas applied |
| **P6 Hardening** | LayoutGuard, layout-audit script, device matrix run, README/docs note | Matrix screenshots reviewed; INV checks clean |

Estimate: P0–P3 are the bulk (≈70%); P4–P6 are polish + verification.

---

## 15. Risks & mitigations

1. **Container query support** — baseline since 2023 browsers; fallback = existing
   `@media` buckets with `clamp()` so oldest mobile browsers still get correct, if slightly
   less fluid, sizes.
2. **Fixed budgets vs. unusual aspect ratios** (Fold covers, car screens) — tiers + the
   single sanctioned scroll region + LayoutGuard warnings make the failure mode visible
   instead of silent clipping.
3. **Sideways glyph legibility** — physical orientation can feel like reading sideways; the
   marker tiles (called/riichi) are upright, and the readability-first flip is a two-line
   CSS change if player feedback pushes that way.
4. **Hand tap vs. scroll conflict** — hand dock scrolls only below 360px width; otherwise
   fluid sizing guarantees one/two rows with no scrolling.
5. **Overlay sheet covering table** — only after explicit user expansion; collapsed pills
   keep the product constraint satisfied by default.
6. **Runtime cost** — no per-frame JS; container queries + ResizeObserver (dev only) are
   cheap; overlay computation already off the critical path.

---

## 16. Acceptance criteria (definition of done)

- [ ] Portrait (390×844 and 375×667) and landscape (844×390 and 667×375) both render the
      full match: header, all 3 opponents, center info, your river, call bar (when active),
      and your 14-tile hand — zero clipping, zero unintended overlap.
- [ ] Left seat (3) tiles are sideways `rotate(90deg)`, right seat (1) `rotate(-90deg)`:
      backs, melds, and rivers; called tiles + riichi declarations read upright.
- [ ] Side rivers show 18 discards as 3 columns of 6, reading order oldest→newest correct
      for river-reading training.
- [ ] Human hand: all 14 tiles + drawn tile visible simultaneously, tappable, ≥22px wide
      (visual) / ≥40px tall hit area; no wrap below 360px width by design, fluid otherwise.
- [ ] Call bar never causes vertical growth (scrolls horizontally), never renders when idle.
- [ ] Overlays: default = non-blocking pills; expanded = modal sheet that never covers the
      call bar or hand dock; multi-overlay = tabs; desktop layout unchanged.
- [ ] Safe areas respected in both orientations (notch + home indicator + browser chrome).
- [ ] `npm test`, `npm run typecheck`, `npm run build` all green.
- [ ] LayoutGuard reports zero violations across the §12.4 matrix; screenshots reviewed.
- [ ] Desktop ≥960px pixel-identical to current (manual spot check).

---

*Companion docs: `docs/PLAN.md` (build split), `docs/worker-D-ui.md` (UI brief —
this plan is an extension of it), `docs/CONTRACTS.md` (unchanged — no contract edits).*
