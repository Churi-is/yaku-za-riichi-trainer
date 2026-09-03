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
- 2026-09-03 — **Worker A, day-one contract corrections.** All additive (no
  exported name removed or retyped); pull and rebase freely.
  - `GameState` gains `seed`, `handNumber`, `callWindow`, `paoSeat`. Only the
    engine constructs a `GameState`, so readers are unaffected.
  - New exported interface `CallWindow` (`src/engine/types.ts`): the open call
    window on a discard (`tile`, `from`, `passed`, `ronSeats`, `chankan`).
  - `ScoreInput` gains optional `winnerSeat`, `loserSeat`, `paoSeat` so
    `scoreHand` can fill `ScoreResult.payments` (pao splits need the seats).
    Omit them and payments default to winner = seat 0.
  - `HandResult` gains optional `doraIndicators` / `uraIndicators` so the
    replay log can show the dora reveal without reading `GameState`.
  - Clarified, not changed: `ScoreInput.hand` is the winner's *concealed* tiles
    and **includes** `winningTile`; open melds go in `melds`.
  - Red-five convention fixed: the red five is **copy index 0** of m5/p5/s5,
    i.e. `TileId` 16, 52, 88. `isRed(id)` from `engine/tiles.ts`.
  - `isRed` takes a `TileId`; `isHonor` / `isTerminal` / `isSimple` take a
    `TileKind` (0..33). Don't mix them.
- 2026-09-04 — **Worker B (AI) implemented.** No exported *shape* changes —
  `PERSONALITIES`, `paramsFor`, `createAI`, `AIPlayer.decide(view, legal)` keep
  their frozen signatures; bodies filled. Notes for integrators:
  - Personality ids are `kenta` (aggressive), `sada` (balanced),
    `tsuru` (defensive). `aiPersonalityId` on a seat is one of these or null.
  - `decide` returns only actions present in the `legal` array passed in (fuzz-
    tested: zero illegal actions across seeded self-play). Win actions
    (`ron`/`tsumo`) are always taken.
  - The AI consumes `PublicView` exclusively (firewall test asserts no import
    of `GameState` or engine stateful modules). It reads the engine's pure
    `shanten` / `waits` / `ukeire` through `@engine/index`; Worker D should
    keep those re-exported.
  - `AIParams` uses the six frozen knobs; no additions were needed.
  - `scoreHand` is still an engine stub, so the AI uses an internal coarse
    `estimateHan` proxy for riichi/call value judgments; it will read real
    value naturally once `scoreHand` lands (no contract change required).

