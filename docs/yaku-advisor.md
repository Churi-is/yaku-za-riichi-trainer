# Yaku advisor — how the numbers are produced

Overlay A used to rank yaku with a table of hand-written constants
(`consider('toitoi', 90 + triplets)`), divide them by five and print the result
with a `%` sign. The number was not a probability of anything, the band added
no information beyond the number, and the tooltip claimed the estimate was
constrained by "remaining visible copies" — which the code never looked at.

It is now a measurement. `src/analysis/yakuSim.ts` simulates the rest of the
hand; `src/analysis/yakuAdvisor.ts` decides what to simulate and packages the
result. There is exactly one implementation — the duplicate heuristic that
lived in `src/state/fallbackAnalysis.ts` is gone.

## What the number means

> **If you commit to this yaku from right now and play every remaining draw for
> it, in this fraction of simulated continuations you complete a hand that the
> engine scores as containing it.**

Three consequences worth being explicit about:

- **It is not your chance of winning the hand.** No opponent is simulated:
  nobody wins first, nobody folds, nobody deals in. This is pure reachability.
- **It is conditional on commitment.** The simulated player declines off-plan
  wins. Stumbling into a cheap tanyao while chasing chinitsu counts as a
  chinitsu failure, which is the honest answer to "should I chase this?".
- **It is a sample, not an oracle.** 60 runs means a standard error of about
  ±6 points near 30%, so the panel shows the raw sample (`21/60 runs`) next to
  the percentage instead of implying three digits of precision.

## Method

1. **The unseen pool.** All 136 tiles minus everything the viewer can see: own
   hand and drawn tile, all four seats' melds, every discard (including tiles
   that were called away) and the flipped dora indicators. Opponents' concealed
   tiles and the dead wall stay *in* the pool — a public-information estimator
   cannot know where they are, and pretending otherwise would be cheating.
2. **The timeline.** Each run shuffles the pool. Tile `i` goes to seat `i mod
   4`, so one in four is yours and you get `ceil(tilesRemaining / 4)` draws —
   the real number of turns left.
3. **Your draws** are kept or discarded by a per-yaku plan: an allowed-kind
   filter (tanyao → simples, honitsu → one suit plus honors, …), a required-kind
   list (ittsu → 1-9 of a suit, yakuhai → three of that honor) and a shape
   preference (toitoi → triplets, chiitoitsu → distinct pairs). A cheap static
   score shortlists discards; only the shortlist gets a real shanten search.
4. **Other seats' tiles** can still reach you two ways: **ron** if the tile
   completes your hand and you are not furiten, and a **call** (pon/kan from
   anyone, chi from your left) that serves the plan. Both are taken with a
   probability — `ronRate` 0.5, `callRate` 0.6 — standing in for "the tile is
   actually discarded rather than kept by its drawer". These two rates are the
   only tuned constants left in the module, and they are named.
5. **Completion is judged by the engine**, never by this module:
   `enumerateWinShapes` + `detectYaku`, success iff the target yaku is in the
   result. Kuitan, closed-only yaku, chinitsu-suppresses-honitsu, yakuman
   suppression and every other rule interaction therefore come from the rules
   engine for free — and a yaku the rules would not award can never be
   reported as reachable.

Riichi is the one exception to step 5: it is a declaration, not a shape, so the
engine's detector can never see it. It is scored as "reached tenpai with the
hand still closed and a draw left to declare on".

## Choosing what to simulate

Simulating all forty yaku would be wasteful, and a hand-written priority list
is exactly the thing this rewrite deleted. So the budget is spent in stages:

1. **Discovery** (20 runs): play the hand for pure speed and note which yaku the
   finished hands actually contained. Data-driven, and it finds directions
   nothing in the module knows how to name — it reports nine gates without any
   code mentioning chuuren poutou.
2. **Structural candidates**: every direction the hand can physically chase,
   as a support filter (≥5 tiles in a suit for honitsu, a dragon held for
   yakuhai, …). No scores, only eligibility.
3. **Scout** (16 runs each): everything from 1 and 2. Hopeless directions abort
   almost immediately — a plan needing more useful tiles than there are chances
   left is provably dead — so this pass is cheap.
4. **Full** (60 runs): the six survivors. Those are the numbers shown.

## Depth, and the second mode

The pause menu exposes two knobs, both under **Simulation**.

**Depth — 60 / 120 / 200 runs.** More runs, tighter numbers: the standard error
near 30% goes from ±6 points at 60 runs to ±3 at 200. Each option shows its own
estimated wall-clock cost, and those estimates are not constants — every
completed run folds its real cost back into an exponential moving average
(`simCost` in the session store, 60/40 towards history), so after a run or two
the menu is quoting *this device's* numbers rather than the development
machine's. `SIM_COST_PRIOR` only seeds the very first render.

**Full game simulation (off by default).** The quick mode asks "could this hand
get there?". This one asks "what actually happens from here?" — and answers it
by playing complete hands out against the three AI opponents, from tables
determinized out of the unseen pool. It lives in `src/sim/fullGameSim.ts`.

Each run deals the opponents' concealed hands, the wall and the dead wall from
the unseen pool, so every run faces a different plausible table consistent with
everything on display: melds, discards, dora, riichi, seat winds, points and
each seat's tile count. Then all four seats — including yours — are played by
the real AI until the hand ends. What comes back is not reachability but
outcomes: how often you won, dealt in or drew, and which yaku were in the hands
you won. The panel labels the mode `full games`, leads with the win/deal-in/draw
summary, and drops the band word entirely (a band that called 10% "High" in one
mode and "Low" in the other would be worse than no band at all).

The determinizer is held to a hard invariant, tested: the table it builds
contains all 136 tiles exactly once, matches every public fact in the view, and
never places a tile the viewer has already seen into a hidden hand. Its outcome
distribution is also checked against replaying the *true* position with only
the wall reshuffled — if the invented tables did not behave like the real one,
the mode would be measuring a different game.

Full-game runs are restarted whenever the position changes, and since a worker
cannot be interrupted mid-loop, a superseded job has its worker terminated
outright rather than being allowed to finish work nobody wants. Progress is
streamed, so the panel fills in as hands complete rather than freezing.

## Cost

Quick mode is roughly 100-350 ms per position at depth 60, dominated by ~30,000
shanten evaluations at about 10 µs each. Full-game mode costs one complete hand
per run — 70 ms in desktop Chromium, ~230 ms under Node — so depth 200 is tens
of seconds. Both are far too slow for the render path, so the whole job runs in
a Web Worker (`src/ui/workers/yakuAdvisor.worker.ts`); the panel keeps showing
the previous position's answer, with a pulse in the header, until the new one
lands. Only the newest request counts. Where `Worker` is unavailable (tests) the
hook computes quick mode synchronously.

Replay grading calls the advisor too, on riichi and call turns. It passes
`FAST_BUDGET` (6/6/3/12), about a tenth of the cost, because it only needs the
coarse shape of the answer.

## Validation

Unit tests can only assert properties — determinism, pool correctness, "an
impossible yaku is never reported", direction of change, cost. Whether the
advisor is *useful* is a question about many games, so it is answered by an
out-of-repo harness (`~/tools/yaku-validate.ts`, not shipped):

1. play real matches with the real engine and the real AIs;
2. at sampled human turns, record what the advisor predicts from the public
   view;
3. replay the rest of that hand many times from the same snapshot, **reshuffling
   the live wall but touching nobody's hand** — the opponents keep the tiles
   they really hold, so continuations differ only in what is still to come;
4. compare the prediction with what seat 0's hand actually finished with.

This cannot measure calibration, and is not meant to: the advisor answers "if
you commit", while in the replays seat 0 is an AI playing for speed against
three opponents who can end the hand first. Observed rates are therefore much
lower than predicted rates by construction. What it measures is usefulness,
which is ordinal — and it compares the new advisor against the old heuristic
restored from git.

**57 positions × 16 continuations (912 playouts), seat 0 won 8.2% of them:**

| | new (simulation) | old (score table) |
| --- | --- | --- |
| achieved yaku that the advisor listed | **88%** | 67% |
| achieved yaku that was the advisor's #1 | **65%** | 47% |
| achieved yaku in the advisor's top 3 | **82%** | 67% |
| mean prediction when the yaku *did* happen | 34.9% | 73.0% |
| mean prediction when it *never* happened | 13.9% | 51.5% |

The last two rows are the important ones. The old advisor predicted **higher**
for yaku that never happened than the new one does for yaku that do — it was
not separating anything. Observed frequency by predicted bucket:

| predicted | new: observed | old: observed |
| --- | --- | --- |
| 0-19% | 1.2% (n=92) | — |
| 20-39% | 2.6% (n=34) | 0.0% (n=22) |
| 40-59% | 14.1% (n=19) | 1.5% (n=62) |
| 60-79% | 14.6% (n=3) | 2.5% (n=28) |
| 80-99% | 31.3% (n=1) | 14.9% (n=18) |

Monotonic, and spread across the whole range instead of piling 62 of 130
predictions into a 40-59% bucket that comes true 1.5% of the time.

## Known limitations

- **The simulated player is mediocre.** It shortlists discards with a static
  score and searches only the top few, so absolute rates are pessimistic
  compared to what a strong player would achieve from the same hand.
- **No opponent model**, by design (see above). A direction that is reachable
  but suicidal against a riichi looks the same as a safe one; that judgement
  belongs to the opponent-reading overlay.
- **`ronRate` and `callRate` are guesses**, currently 0.5 and 0.6. They could be
  measured from real games with the same harness.
- **Full-game mode inherits the AI's strength.** These opponents draw a lot of
  hands (roughly two thirds of simulated hands run to exhaustion), so its
  numbers describe this table, not professional play.
- **Yakuman suppression is honest but surprising**: a hand that completes as
  nine gates does not count as chinitsu, because the engine would not award
  chinitsu. The yakuman shows up as its own candidate instead.
