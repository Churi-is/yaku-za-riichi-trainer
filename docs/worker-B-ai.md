# Worker B — Opponent AI (3 difficulties × 3 archetypes)

You own the AI opponents for **Yakuza-Style Mahjong Trainer**, a browser-only
single-player riichi trainer. The player already knows how to play; the app
trains *judgment*. Your job is the part that makes reading opponents a
learnable skill: **AI whose habits are consistent enough to model, and
distinctive enough to tell apart.**

## Your scope

Everything under `src/ai/`. No React, no engine internals, no analysis module.
Scaffolded: `types.ts`, `index.ts` (contract + working stub), plus `player.ts`,
`efficiency.ts`, `defense.ts`, `callLogic.ts`, `riichiLogic.ts`,
`personalities.ts`, `params.ts`, `__tests__/`.

## The contract you implement

Read `docs/CONTRACTS.md` first. Your entire public surface is already defined:

```ts
PERSONALITIES: Personality[]          // 3, one per archetype
paramsFor(archetype, difficulty): AIParams
createAI(personality, difficulty, seed?): AIPlayer
AIPlayer.decide(view: PublicView, legal: LegalAction[]): AIDecision
```

Worker D calls `decide` and applies the returned action. That's the whole
integration — keep it stable and D is never blocked.

**Hard requirement: `PublicView` is your only input.** You may not import
`GameState` or peek at other seats' tiles. An AI that cheats invalidates the
entire training premise, because the player is being taught to read signals
that would then be fictional. Add a test that asserts `src/ai` never imports
hidden state.

## Dependency on Worker A

You need `shanten`, `ukeire`, `waits`, and the `tiles.ts` helpers from the
engine. Worker A ships those first, specifically to unblock you. Until they
land, code against the signatures in `src/engine/index.ts` (stubs throw) and
develop your decision layers against small hand-built fixtures. Pull A's branch
as it progresses: `git fetch origin && git merge origin/<worker-A-branch>`.

## One parameterized engine

Build a **single** decision engine driven by `AIParams`. Do not write three
separate bots — archetype and difficulty both resolve into the same knobs:

- `efficiencyNoise` — chance of a sub-optimal tile choice
- `callGreed` — eagerness to pon/chi
- `defenseThreshold` — threat level at which it starts folding
- `riichiPatience` — higher = more dama, later riichi
- `tellSubtlety` — lower = more legible habits
- `deviation` — chance of acting off-archetype (Hard only)

Add knobs if you need them; extend `AIParams` and note it in `CONTRACTS.md`.

## Archetypes (must stay legible at every difficulty)

**Aggressive — "koikoi caller."** Calls pon/chi early to build fast cheap
hands. Favors tanyao, pinfu, chiitoitsu, honitsu. Riichi the moment it's
tenpai. Almost never folds — it *will* deal in. High callGreed, low
defenseThreshold, low riichiPatience.

**Balanced.** Solid tile efficiency. Calls when it clearly improves speed or
value. Chooses riichi vs dama on hand value and position. Defends when clearly
threatened. Middle knobs across the board.

**Defensive.** Plays closed, holds strong shapes, delays riichi, folds early
against declared big hands, prefers suji-safe and genbutsu discards. Very hard
to deal into. Low callGreed, high defenseThreshold and riichiPatience.

## Difficulty tiers (scale execution, not identity)

**Easy** — real efficiency mistakes, greedy calls that hurt the hand, ignores
your riichi and threat signals, habits exaggerated and obvious to read.
**Normal** — competent play, small errors, readable but not cartoonish.
**Hard** — near-optimal efficiency, correct suji-based defense, good riichi
timing, subtle tells; may occasionally deviate so it isn't trivially
exploitable.

The critical design tension: **archetype behavior must remain consistent enough
to be learnable at all three tiers** (that's the training value), while Hard
avoids being a fixed exploitable pattern. Consistency of *tendency*, variation
in *execution*.

## Behavior you must implement

- **Discard selection**: shanten-first, ukeire tiebreak, value awareness
  (dora, yaku direction), safety weighting when folding. Perturb by
  `efficiencyNoise`.
- **Call decisions**: does pon/chi advance shanten and preserve a yaku? An open
  hand with no yaku path is worthless — respect the yaku requirement and the
  `kuitan` setting. Honor `forbiddenDiscards` (kuikae) from `LegalAction`.
- **Kan**: only when it doesn't wreck the hand or hand safety; suukantsu is not
  a plan.
- **Riichi**: gated by `riichiPatience`, hand value, wait quality, turn number,
  and score situation.
- **Push/fold**: estimate table threat from riichi declarations, meld shapes,
  and late-game danger, then compare against `defenseThreshold`. Folding means
  genbutsu → suji → one-chance, in that order.
- **Win**: always take ron/tsumo when legal and valuable. (Rare declines for
  hard-AI value judgments are optional and must be off by default.)

## Personalities

Three, one per archetype, seated at every table — each with a name and a
one-line style description shown at match start so the player can build a
mental model of each seat. The stub in `index.ts` has placeholders; write final
flavor text. Keep it Yakuza-flavored but generic (no copyrighted character
lore) — evoke the setting, don't reproduce it. The tagline must honestly
telegraph the archetype: it's a training aid, not marketing.

## Testing

- Determinism: same seed + same `PublicView` → same decision.
- No-cheat test: AI decisions are unchanged when hidden tiles are shuffled.
- Archetype separation: over many simulated hands, aggressive has a
  significantly higher call rate and deal-in rate than defensive; defensive has
  the lowest deal-in rate. Assert the ordering, not exact numbers.
- Difficulty separation: Hard beats Normal beats Easy in points over a large
  seeded batch of self-play matches.
- Legality: every returned action appears in the `legal` array passed in. Fuzz
  this hard — an illegal action crashes the game loop.
- Performance: `decide` must be fast enough to feel instant; the UI adds its
  own pacing delay, so avoid deep search. Budget a few milliseconds.

## Constraints

- Seeded RNG; no `Math.random()` in decision paths.
- No hidden information, ever.
- Pure module: no DOM, no timers, no React. Worker D handles think-time pacing.

## Definition of done

`npm run typecheck` and `npm test` pass; a seeded 4-AI self-play match runs to
completion with zero illegal actions; archetype and difficulty separation tests
green.
