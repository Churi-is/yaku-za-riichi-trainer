# Architecture and rules

## Boundaries

- `src/engine` owns rules, legal actions, scoring, and tile math. It is pure
  TypeScript, without React or browser dependencies. `engine/index.ts` is the
  application-facing entry point; `engine/types.ts` defines the game data.
- `src/ai` receives only `PublicView` and the engine's legal actions. It must not
  import `GameState` or inspect opponents' concealed tiles. Decisions use seeded
  randomness; UI pacing is separate. Character policies are documented in [BOTS.md](BOTS.md).
- `src/shared` supplies low-level helpers without game-state or UI dependencies,
  including the random-number generator used by both the engine and AI.
- `src/state` owns in-memory settings, screen routing, fixed opponent seats, and
  the paced match loop. The loop calls the real engine directly, validates AI
  actions, and stops on unexpected engine errors. Pausing or showing the match
  introduction prevents the pump from advancing.
- `src/dojo` contains the course, scripted engine positions, and coach placement.
  Script validation tests check tile counts, legal actions, and drill answers.
- `src/ui` renders the six screens. `ui/table/layout.ts` computes board geometry;
  components render it without calculating game rules. `src/styles` contains
  the shared theme and screen/table/tile styling.

Everything is session-scoped: there is no backend, account, or persisted match history.

## Engine usage

1. `createMatch(settings, seed)` starts a match. Seat 0 is the human; seats
   1, 2, and 3 are right, across, and left.
2. During a call window, `pendingSeats(state)` gives seats owing a response.
   Otherwise `state.turn` identifies the seat to act.
3. Choose from `getLegalActions(state, seat)` and apply that exact action with
   `applyAction`. Illegal actions throw. `applyAction` does not mutate its input.
4. `toPublicView(state, seat)` exposes that seat's concealed hand and public
   table information only. Both `PlayerState.hand` and `PublicView.hand` exclude
   the separate `drawnTile`; visible counts include that draw.
5. At hand end, `nextHand(state)` either deals again or supplies `matchOver`
   with the authoritative ranking, final points, and hands played.

`scoreHand` accepts a completed concealed hand **including** the winning tile;
meld tiles are supplied separately. Its payments exclude honba and riichi sticks,
which the match engine settles. Dora alone cannot make a legal win.

## Tile encoding

- `TileKind` is 0–33: man 0–8, pin 9–17, sou 18–26, winds 27–30, dragons 31–33.
- `TileId = kind * 4 + copyIndex`, with four physical copies per kind.
- Copy 0 of each suited five is red: IDs 16, 52, and 88. The red-dora setting
  determines whether these copies contribute bonus han.
- `kindOf` and `isRed` take physical IDs. `suitOfKind`, `rankOfKind`, and the
  honor/terminal predicates take kinds. Do not interchange the two.
- Shared encoding and dora math live in `engine/tiles.ts`; English rendering
  labels and stable display sorting live in `ui/tiles.ts`.

## Rule choices

- Four-player riichi, 136 tiles, East-only or hanchan; 25,000 starting points.
- At least one yaku is required. Kuitan is configurable and atozuke is allowed.
  The optional two-han minimum excludes dora when checking eligibility.
- Call priority is ron, then pon/kan, then chi. Chi is from the left only;
  kuikae discards are excluded from legal actions. Ron uses head bump: one winner
  in turn order from the discarder. No meld calls after live-wall exhaustion.
- Riichi requires a closed tenpai hand, 1,000 points, and at least four live wall
  tiles. Concealed kans preserve closed status; after riichi they may not change
  the waits. Calls break ippatsu. Ura dora applies only to riichi winners.
- Chankan is allowed on added kan; robbing a concealed kan requires kokushi.
- Permanent, temporary, and riichi furiten block ron, not tsumo. Passing a legal
  ron still incurs furiten, including intentional refusals by Special bots.
- No abortive draws. Dealer wins or dealer tenpai continue the dealership.
  Exhaustive draws use a fixed 3,000-point tenpai/noten pool (no transfer when
  everyone or nobody is tenpai), independent of honba. Every exhaustive draw
  increases honba, even when the dealer rotates. Dealer wins increase honba;
  non-dealer wins reset it. Each counter adds 300 points to a win, and riichi
  sticks carry to the next winner.
- Standard fu rounding; chiitoitsu is 25 fu. A double-wind pair receives 4 fu.
  Renhou is mangan. True and counted yakuman are single limits, without stacking.
- Pao applies to daisangen and daisuushii: full liability on tsumo, split on ron.
- Final ranking uses points, then seat order for ties; no uma or oka.

## Determinism and regression coverage

`shared/random.ts` implements Mulberry32 once. The engine's seed mixer and the
AI's unsigned-seed / zero-to-one convention remain explicit in their wrappers;
compatibility vectors test both streams, including fractional, negative, wrapped,
and non-finite seeds. Rule changes can still affect later choices by changing
points or round conditions, even when random streams are unchanged.

The AI suites share `ai/__tests__/selfplay.ts`, a strict production-engine driver.
It passes only public views and legal actions to bots, records actual moves and
payments, and throws on illegal decisions, engine errors, stalls, or unfinished
hands/matches. There is no separate simplified rules simulator or recovery policy
that can conceal a failing bot. Independent-hand samples, full-match integration,
and benchmarks all use the same driver.

Reference scoring and legality tests still assert hand-verified outcomes;
public-information tests and policy fixtures remain independent of the driver.
Difficulty is measured with paired matches against fixed opponents, rather than
comparing win counts between all-Hard and all-Easy tables. Layout and course tests
cover presentation and scripted drills separately.
