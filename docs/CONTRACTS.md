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
    of `GameState` from any non-test `src/ai` module). It reads the engine's
    pure `shanten` / `waits` / `ukeire` through `@engine/index`; Worker D
    should keep those re-exported.
  - `AIParams` uses the six frozen knobs; no additions were needed.
  - Rebased onto the finished engine (2026-09-04): the AI now models the real
    `PublicView` shape — `hand` is the 13-tile concealed hand and the draw is
    separate in `drawnTile`; riichi is the engine's separate `riichi: true`
    discard action (the AI never synthesizes the flag). An integration test
    drives `createMatch`/`applyAction`/`getLegalActions`/`toPublicView` with
    four AIs through whole matches with zero illegal actions. `scoreHand`
    scores only completed hands, so in-progress riichi/call value still uses
    the internal coarse `estimateHan` proxy.
- 2026-09-03 — **Worker A, engine implementation landed.** Two more additive
  fields; nothing renamed or retyped.
  - `PlayerState` gains `forbiddenDiscards: TileKind[]` — the kuikae kinds this
    seat may not discard right now. Set by a call, cleared by its next discard.
  - `ScoreInput` gains optional `dealerSeat` so a tsumo can charge the dealer
    double. Defaults to the winner's seat when omitted.
  - Clarified, not changed: `PublicView.hand` is the viewer's concealed hand and
    EXCLUDES `drawnTile`, exactly like `PlayerState.hand`.
  - `scoreHand` returns zero points and zero payments for a yakuless hand, so a
    caller that forgets `isLegalWin` cannot pay out on an illegal win.

- 2026-09-04 — **Worker A, game loop landed.** No exported shape changed; these
  are behavioural guarantees Workers B/C/D can now rely on.
  - `applyAction` is pure (safe on a deep-frozen state) and **throws** on an
    illegal action. Always pick from `getLegalActions(state, seat)` first.
  - Drive a hand with `pendingSeats(state)`: when it is non-empty the state is
    `awaitingCalls` and those are the seats to ask, in turn order from the
    discarder. Otherwise it is `state.turn`'s move.
  - Priority is enforced inside `getLegalActions`, not by the caller: ron beats
    pon/kan beats chi, and a seat that cannot ron does not head-bump a later
    seat that can (a furiten seat is excluded from `CallWindow.ronSeats`).
  - Kuikae is reported per action as `LegalAction.forbiddenDiscards` and kept on
    `PlayerState.forbiddenDiscards`; the banned kinds are simply absent from the
    discard options.
  - Riichi needs a closed hand, 1000 points, a discard that leaves tenpai, and
    at least 4 live wall tiles. Afterwards the drawn tile is the only legal
    discard. Any call cancels everybody's ippatsu.
  - `nextHand(state)` advances the hand (renchan keeps the dealer and bumps
    honba); it returns a state whose `phase` is `matchOver` once the hanchan is
    done, with `matchOver.ranking` / `finalPoints` filled in.
  - Point deltas are always zero-sum across the four seats, honba and riichi
    sticks included.
  - Internal (not contract): `rinshanDraw` no longer takes a kan ordinal, and it
    now splices the replacement tile out of the dead wall so a tile is never in
    two places at once.
+- 2026-09-04 — **Worker C: replay schema addition — `ActionLogEntry.handReveal`**
+  (optional). Additive only: log entries may carry
+  `handReveal: { revealedHands, winningTile }` on the FINAL entry of a hand so
+  `resolveWaitGuesses` can score practice guesses against the revealed hands.
+  Absent by default; the game loop writes it at hand end. Other entries
+  unchanged. Everything else in Worker C's scope consumes the existing
+  `PublicView` contract as frozen.
+- 2026-09-04 — **Worker C (analysis) + Worker D (UI/game loop) integration.**
+  No exported shape changes. `src/analysis` implements the three overlays and
+  replay grading against the engine's public surface
+  (`shanten`/`waits`/`ukeire`/`toPublicView`) as frozen; Worker D's adapters
+  probe the real modules and yield to them automatically.

- 2026-09-06 — **Expanded character roster and fixed-seat setup.**
  - `Personality` adds `shortName`, `title`, `difficulty`, and `tell`. The 18
    character ids and imagined styles are listed in `docs/BOTS.md`; old generic
    ids are replaced (sessions are not persisted).
  - `AIParams` adds value, flush, pair, kan, safety, and placement preferences.
    Personality tuning is applied before execution scaling. `paramsFor` accepts
    optional tuning; `createAI` defaults its difficulty to the character level.
    Explicit difficulty arguments remain supported.
  - `TableSettings.opponentDifficulty` is an optional `'character' | 'uniform'`
    field. Omitted/default means native character levels; `'uniform'` uses the
    existing `difficulty` field. `Difficulty` still uses `normal` internally,
    displayed as Medium. Rules and scoring ignore opponent execution settings.
  - Session opponents are a fixed `[string | null, string | null, string | null]`
    tuple in right/across/left order. Assignment swaps an existing occupant;
    clearing leaves a hole. `start` accepts nullable slots and repairs only
    invalid/empty slots, without compacting valid manual placements.
  - `SeatPersonality` carries the resolved difficulty, title, and tell for the
    match introduction. `AIPlayer.decide(PublicView, LegalAction[])` is unchanged;
    the public-information firewall remains in force.

- 2026-09-06 — **Four opt-in Special personalities.**
  - `Personality.special` optionally carries a `SpecialStyle`, rule name, and
    estimated native difficulty. `RosterDifficulty` adds the display/filter
    category `special`; `rosterDifficulty()` keeps it distinct from execution.
    The engine's three-value `Difficulty` enum and table rules are unchanged.
  - `createAI` dispatches these characters through `decideSpecial`; the regular
    player is unchanged. Specials may deliberately decline offered wins by
    choosing another legal action. The old always-take-wins guarantee applies
    to regular opponents (and Fighter), not Nugget, Shakedown, or Komaki.
    Forced legal actions, legality, and the public-information firewall still
    apply to all opponents. The engine continues to own all furiten effects.
  - `SeatPersonality.special` preserves the category/estimate in the match
    introduction. Racing phases depend only on public river length and reset
    naturally each hand. No private hand inference is exposed as a status.
