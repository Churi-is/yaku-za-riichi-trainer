# Worker A — Rules Engine, Yaku Detection & Scoring

You own the pure rules core of **Yakuza-Style Mahjong Trainer**, a browser-only
single-player riichi trainer (no backend, no accounts, no multiplayer). You are
the foundation: three other workers build on your types in parallel branches
starting today, so **your first priority is locking and pushing the contract,
not finishing the logic.**

## Your scope

Everything under `src/engine/`. Nothing else. No React, no DOM, no AI, no
analysis. Pure TypeScript, fully unit-tested, framework-free.

Files scaffolded for you: `types.ts`, `index.ts` (contract + stubs), plus
`tiles.ts`, `wall.ts`, `rng.ts`, `draw.ts`, `shanten.ts`, `yaku.ts`,
`scoring.ts`, `fu.ts`, `calls.ts`, `furiten.ts`, `riichi.ts`, `kan.ts`, and
`__tests__/`. Reorganize internals freely; keep `index.ts`'s exported
signatures stable.

## Day-one obligation (do this before deep work)

Read `docs/CONTRACTS.md`. `src/engine/types.ts` and `src/engine/index.ts`
already compile with throwing stubs. Sanity-check the shapes against everything
below, make any corrections you need **immediately**, then commit and push so
B, C, and D can rebase onto a stable contract. After that first push, treat
exported shapes as frozen unless you announce a change in `docs/CONTRACTS.md`.

Then land, in this order, because peers are blocked on them:
1. `tiles.ts` — tile encoding helpers: `kindOf`, `suitOf`, `rankOf`, `isRed`,
   `isHonor`, `isTerminal`, `isSimple`, `countsFromIds`, tile display names.
   **Everyone** needs these; ship them first, standalone.
2. `shanten`, `waits`, `ukeire` — Worker B (AI) and Worker C (analysis) cannot
   do anything real without them. These are the highest-leverage functions in
   the codebase; make them fast (they get called in tight loops).
3. `createMatch` / `applyAction` / `getLegalActions` / `toPublicView` — unblocks
   Worker D's game loop.
4. Scoring and full yaku detection.

## Rules to implement (Yakuza-standard riichi, 4 players, 136 tiles)

**Winning**
- At least one yaku required; no-yaku hands cannot win, open or closed.
  Atozuke is allowed. Open tanyao only when `settings.kuitan`.
- `settings.twoHanMinimum` when on: a win needs 2+ han (dora do not count
  toward the minimum).

**Calls**
- Priority: ron > pon/kan > chi. Chi only from the left player.
- **No kuikae**: after a call you may not discard the called tile's kind, nor
  the mirror tile of a chi (e.g. chi 4-5 on 3 → cannot discard 6). Surface
  these via `LegalAction.forbiddenDiscards`.
- Kan: closed (ankan), added (kakan), open (minkan). Rinshan kaihou draw from
  the dead wall, chankan on kakan (and on ankan only for kokushi — your call,
  document it). Kan dora indicator flips per standard timing.
- **No calls at all once the live wall is empty**; ron on the final discard is
  still allowed.

**Riichi**
- Closed hands only, 1000-point stick, not after any call, must be tenpai.
- Double riichi, ippatsu (broken by any call), ura dora for riichi winners only.
- Unavailable when fewer than 4 tiles remain (no draw would follow) — i.e. not
  on the final tile.

**Dora**
- Standard indicator → dora mapping with wraparound (9→1, N→E, Chun→Haku).
- Kan dora on flip; ura indicators revealed only to riichi winners.
- Red fives only when `settings.redDora`: exactly one red 5 per suit, 3 total,
  each worth +1 han as dora.

**Furiten** — fully enforced, all three kinds: permanent (own discard matches
any of your waits), temporary (passed on a ron chance, clears on your next
draw), riichi furiten (locked for the hand). Furiten blocks ron; tsumo is still
allowed.

**Hand endings**
- **No abortive draws.** No kyuushu kyuuhai, no suufon renda, no suukaikan
  abort, no sanchahou abort. A hand ends only by win or exhaustive draw.
- Exhaustive draw: standard 3000-point tenpai/noten split. Renchan when the
  dealer wins or is tenpai. Honba +300 per counter (tsumo: +100 each). Riichi
  sticks carry to the next winner.
- Ron by discard resolves in turn order from the discarder; **exactly one
  winner** (head bump — no double/triple ron).

**Scoring**
- Full fu: base 20; +10 concealed ron; +2 tsumo (not on pinfu); +2 closed wait
  (kanchan/penchan/tanki); open triplet simples +2, terminals/honors +4;
  concealed +4/+8; open kan +8/+16, closed kan +16/+32; yakuhai pair +2
  (double wind pair: pick +2 or +4 and document); chiitoitsu = flat 25 fu;
  open pinfu-shape hand floors at 30 fu; round up to the next 10.
- Han/fu table with mangan 5 han, haneman 6-7, baiman 8-10, sanbaiman 11-12,
  **13+ han = counted yakuman**. Kazoe and true yakuman both score as a
  **single yakuman — no stacking, no double yakuman.**
- **Renhou = mangan.**
- **Pao liability** for daisangen and daisuushii: the player who fed the third
  dragon/fourth wind pays the full amount on tsumo, and splits on ron.
- Match end: rank by final points, **plain ranking, no uma/oka**.

**Full yaku set** — 1 han: menzen tsumo, riichi, ippatsu, pinfu, tanyao,
yakuhai (each dragon + round wind + seat wind, counted separately), chankan,
haitei raoyue, houtei raoyui, rinshan kaihou. 2 han: double riichi, chiitoitsu,
toitoi, sanshoku doujun (1 open), ittsu (1 open), chanta (1 open), honroutou,
shousangen, sanankou, sankantsu, sanshoku doukou. 3 han: honitsu (2 open),
junchan (2 open), ryanpeikou (closed only). 6 han: chinitsu (5 open).
Yakuman: kokushi musou, suuankou, daisangen, shousuushi, daisuushii, tsuuiisou,
chinroutou, ryuuiisou, chuuren poutou, suukantsu, tenhou, chiihou.
Handle standard exclusions (e.g. ryanpeikou supersedes iipeiko/chiitoitsu
counting, honroutou + chanta interaction, chinitsu excludes honitsu).

## Testing — this is the part that matters

`npm test` (vitest). Validate against **known reference hands**: hand-verified
fu/han/point totals for a broad spread — pinfu tsumo 20fu, chiitoitsu 25fu,
open honitsu, kan-heavy fu stacks, dealer vs non-dealer payments, every
yakuman, kazoe yakuman, pao payouts, honba and riichi-stick arithmetic. Also
property-test shanten (never negative below -1, monotone under tile addition)
and confirm a full random self-play match always terminates with balanced
points (the four deltas must always sum to zero).

Aim high on coverage here: every other worker's correctness rests on yours, and
the replay grader (Worker C) reuses `scoreHand`, `shanten`, and `ukeire`
directly.

## Constraints

- `applyAction` must be **pure** — return a new state, never mutate the input.
  Worker D's replay depends on it.
- Seeded RNG in `rng.ts` so matches are reproducible for tests and bug reports.
- `toPublicView` is a **security boundary**: it must strip every hidden tile.
  Other seats expose `concealedCount`, never tile identities. `visibleCounts`
  counts only what the viewer can legitimately see (own hand, all rivers, all
  melds, face-up dora indicators). Add a test asserting no hidden tile id can
  leak through a `PublicView`.
- No dependencies beyond TypeScript. No UI concerns, no strings meant for
  display beyond tile/yaku names.

## Definition of done

`npm run typecheck` and `npm test` pass; a seeded full hanchan can be played to
completion through `applyAction` alone by a script with no UI; all reference
scoring tests green.
