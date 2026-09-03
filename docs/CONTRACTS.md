# Cross-worker contracts

Four workers build in parallel on separate branches. These files are the seams
between them. **They are already scaffolded and compiling on `main`** — start
from them, don't invent parallel shapes.

| File | Owner | Consumed by |
|---|---|---|
| `src/engine/types.ts` | A | B, C, D |
| `src/engine/index.ts` | A | B, C, D |
| `src/ai/types.ts`, `src/ai/index.ts` | B | D |
| `src/analysis/types.ts`, `src/analysis/index.ts` | C | D |
| `src/replay/types.ts` | C (schema) | D (writes), C (reads) |
| `src/state/session.ts` | D | — |

## Rules of engagement

1. **Signatures are frozen by default.** Anything exported from the table above
   is a contract. You may fill in bodies freely; changing an exported *shape*
   requires (a) editing this file with a dated note, (b) pushing that change to
   your branch immediately, (c) telling the other workers.
2. **Stubs compile and run.** Every contract function has a working stub, so all
   four branches build from commit one. Analysis stubs return empty arrays; the
   AI stub passes; engine stubs throw a clear "not implemented" error.
3. **Integration direction.** A → B/C → D. Worker D codes against stubs and
   swaps in real behaviour by pulling other branches as they land.
4. **Pulling from a peer branch** is expected and encouraged:
   `git fetch origin && git merge origin/<their-branch>`. Merge conflicts in
   files you don't own: take theirs.
5. **The public-information firewall.** `PublicView` is the *only* input to the
   AI and to every analysis function. Nothing in `src/ai` or `src/analysis` may
   import `GameState` or otherwise touch hidden tiles. This is a correctness
   requirement, not a style preference.

## Tile encoding (memorize this)

- `TileKind` 0..33: m1-m9 = 0-8, p1-p9 = 9-17, s1-s9 = 18-26,
  E/S/W/N = 27-30, Haku/Hatsu/Chun = 31-33.
- `TileId` 0..135, `id = kind * 4 + copyIndex`.
- Red fives (when enabled) are a fixed copy index of m5/p5/s5 — Worker A picks
  the convention and exposes `isRed(id)` from `engine/tiles.ts`.
- Seat 0 is always the human player. Seats go 0→1→2→3 in turn order.

## Change log

- 2026-09-03 — Initial contracts scaffolded (skeleton commit).
