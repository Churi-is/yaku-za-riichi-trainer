# Bot logic audit

Audited at `76e17d5`, immediately after the trainer layer was stripped. Method:
measure first, read second. All numbers below come from real matches driven by
the real engine and the real `createAI` players; the harnesses live outside the
repo in `~/tools` (`bot-audit.ts`, `ippatsu2.ts`, `probe2.ts`, `params-check.ts`).

## Baseline: what the bots actually do

150 hands, Normal difficulty, three AI personalities rotating across four seats.
Reference figures are typical of human play at a mid-level online table.

| measurement | bots | reference |
| --- | --- | --- |
| exhaustive draws | **58.0%** | ~17% |
| seats tenpai at a draw | **0.95 of 4** | ~2.1 of 4 |
| hands won | 42.0% | ~83% |
| riichi declared | 0.37 / hand | ~0.8 |
| calls made | 2.33 / hand | ~1.6 |
| terminal/honor share of discards | 45.4% | ~35-40% |
| tsumogiri share | 19.2% | ~45-55% |
| mean shanten of all hands at hand end | 1.16 | — |

Three quarters of the way through a hand these bots are, collectively, nowhere
near a win. More than half of all hands expire with a single tenpai seat between
four players. That is not "readable opponents with personality"; it is four
players who cannot finish a hand.

## Findings, worst first

### 1. The discard policy is a lottery, and the value term is backwards

`src/ai/efficiency.ts`, `chooseDiscard`:

```ts
const weight = (e: DiscardEval): number => {
  const rel = reluctance.get(e.kind) ?? 0;
  const w = e.acceptance + 8 + rel * 6;
  return Math.max(0.1, w);
};
const idx = rng.weightedIndex(pool.map(weight));
```

Two defects in four lines.

**The sign is inverted.** `discardReluctance` returns *how much the bot does not
want to throw this tile* — `+1.4` for dora, `+2.0` for a live yakuhai triplet.
It is then added to the weight of picking that tile as the discard, multiplied
by six. The bot is systematically **more** likely to throw its dora and its
yakuhai than its junk.

**The choice is random among tiles that tie on shanten.** Even with the sign
fixed, `weightedIndex` makes efficiency a raffle: the `+8` floor means a
4-tile-acceptance discard still beats a 20-tile one about 30% of the time.
Shanten-optimal is necessary but nowhere near sufficient — which of the
equal-shanten discards you take *is* tile efficiency, and here it is noise.
This is separate from `efficiencyNoise`, the parameter that is supposed to make
weaker bots make mistakes; that mechanism already exists a few lines above and
is doing its job.

**Measured impact.** Replacing those lines with "subtract reluctance, take the
best candidate" — six lines, no other change — moves the whole table:

| | before | after |
| --- | --- | --- |
| exhaustive draws | 58.0% | **36.7%** |
| hands won | 42.0% | **63.3%** |
| seats tenpai at a draw | 0.95 | **1.25** |
| riichi / hand | 0.37 | **0.54** |
| turns to a win | 50.9 | **44.2** |

The experiment was reverted; nothing in this commit changes behaviour. The
remaining gap to ~17% draws is the rest of this list.

### 2. Ippatsu never expires (engine bug, not the bots')

`src/engine/index.ts` sets `p.ippatsu = true` on a riichi declaration and clears
it in exactly two places: a new hand, and when any call is made. Nothing clears
it when the declarer's own next turn comes around, which is when ippatsu is
supposed to die.

Measured over 12 matches: **399 of 399** observations of a riichi seat more than
one go-around past its declaration still had `ippatsu` set — 100%. One hand
scored ippatsu **40 global turns** (ten go-arounds) after the declaration.

Every riichi win in this engine is quietly worth an extra han unless somebody
happened to call a tile. It moves hands across the mangan boundary. The engine's
145-test suite does not notice, because no test plays a riichi hand past the
go-around and then wins it.

### 3. Archetype identity is inferred from a derived number, and it is wrong

`shouldFold` and `shouldRiichi` both ask "am I the aggressive archetype?" like
this:

```ts
if (params.defenseThreshold > 0.7) p = Math.max(p, 0.9);   // riichiLogic
const aggression = params.defenseThreshold > 0.7 ? 0.2 : 0; // player
```

But `defenseThreshold` is a *computed* value: `profile / difficultyRigor`.

| archetype | difficulty | defenseThreshold | "aggressive" branch |
| --- | --- | --- | --- |
| aggressive | easy | 1.000 | fires |
| aggressive | normal | 0.850 | fires |
| aggressive | **hard** | **0.567** | **dead** |
| balanced | **easy** | **0.818** | **fires** |
| balanced | normal | 0.450 | dead |
| defensive | any | ≤ 0.400 | dead |

So the aggressive bot loses its defining behaviour exactly at Hard, and the
balanced bot impersonates it at Easy. `decideAction` already receives the real
`archetype`; it simply is not passed down to these two functions.

### 4. It throws the red five

`evaluateDiscards` (`handEval.ts`) reduces the hand to one candidate per tile
*kind* and keeps the first id it sees:

```ts
for (const t of hand) { const k = kindOf(t); if (!tileOfKind.has(k)) tileOfKind.set(k, t); }
```

Hands are held sorted by id, and `RED_FIVE_IDS = kind * 4` — copy zero. The red
five is therefore always the nominated representative, so whenever the policy
decides to discard "a five" it throws the red one. Measured: 44 of 173
five-discards were the red copy. Each one is a han thrown away for nothing.

### 5. Riichi is re-rolled as a coin flip every turn

`shouldRiichi` builds a probability and calls `rng.chance(p)` on every discard
where riichi is legal. For the balanced archetype `p` starts at 0.5, so whether
a hand goes dama is decided by a fresh coin flip each turn rather than by a
property of the hand. The inputs (wait width, value, lateness, threat) are
reasonable; the output should be a decision, not a lottery ticket, or the same
hand will flip-flop between "worth riichi" and "not" from turn to turn.

### 6. What holds up

Worth saying, because an audit that only lists faults is not a survey:

- **The threat model is sound.** `tableThreat` cleanly separates the two states
  it is used to distinguish: mean 0.99 while an opponent is in riichi (100% of
  samples above the 0.85 cutoff the callers test against) versus mean 0.21 with
  nobody in riichi (max 0.83, never a false positive). The `>= 0.85` magic
  number is effectively "someone is in riichi", and it works.
- **The shanten and ukeire layer is engine-backed**, not a second
  implementation. `handEval.shanten` delegates to the engine's, which is the
  one cross-checked against a brute-force solver in the engine suite.
  `evaluateDiscards` computes post-discard shanten and acceptance correctly.
- **The public-information firewall is real.** `decide(view: PublicView, legal)`
  is the whole input surface; nothing in `src/ai` imports `GameState` or reaches
  for hidden tiles.
- **Call logic asks the right question** — does this call lower shanten *and*
  leave a plausible yaku path — and computes the follow-up discard properly
  before committing.

## Not covered

`callLogic.ts` (268 lines) was read for structure but its call/pass rates were
not measured against a reference, and the safety model in `defense.ts` (suji,
genbutsu, one-chance) was not checked for correctness tile by tile. Both deserve
the same measure-first treatment before the rework.

## If the bots are being kept for the guide

Order by return on effort:

1. Fix the discard policy (finding 1). Six lines, halves the draw rate.
2. Fix ippatsu (finding 2). It is a rules bug in the shared engine and will
   corrupt any scoring the guide teaches.
3. Pass the archetype down instead of sniffing a threshold (finding 3).
4. Prefer a non-red copy as the discard representative (finding 4).
5. Make riichi a decision, then add noise deliberately if the difficulty tier
   wants mistakes (finding 5).

1-4 are small and mechanical. After them, re-run `~/tools/bot-audit.ts` and
expect the draw rate to approach the ~17% reference; if it does not, the next
suspect is the call policy.
