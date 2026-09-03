# Worker C — Analysis Engine: Overlay Logic + Replay Grading

You own the brain behind all three training overlays **and** the post-match
turn grading in **Yakuza-Style Mahjong Trainer**. This is the actual product:
the mahjong game is the vehicle, your analysis is what trains the player.

The target user already knows how to play riichi. The app trains three judgment
skills, and you implement the reasoning for all of them:
1. which yaku to realistically pursue, 2. how to read opponents' moves,
3. how to guess opponents' waits.

## Your scope

Everything under `src/analysis/`, plus the `src/replay/types.ts` log schema
(you own the schema; Worker D writes to it). Scaffolded: `types.ts`, `index.ts`
(contract + empty-returning stubs), `publicInfo.ts`, `yakuAdvisor.ts`,
`opponentRead.ts`, `waitGuess.ts`, `grading.ts`, `tileSafety.ts`,
`handEstimate.ts`, `__tests__/`.

## The single most important architectural rule

**One shared analysis module serves both the live overlays and the replay
grader.** In-game hints and post-game grades must never contradict each other —
the grade explains a decision using the same reasoning the overlay would have
shown, which is why grading works even when the player played with all overlays
off. Never fork the logic into "live version" and "replay version."

Second rule, equally hard: **public information only.** Every function takes a
`PublicView` and nothing else. You may use the player's own hand (that's
public to them), all rivers, all melds, riichi states, dora indicators, and
visible tile counts. You may never touch opponents' concealed tiles. Add a test
asserting `src/analysis` never imports `GameState`.

**Every probability you emit must be labelled an estimate.**

## Dependency on Worker A

You need `shanten`, `ukeire`, `waits`, `scoreHand`, and `tiles.ts` helpers.
Worker A ships those first to unblock you. Until then, build your structural
logic (river parsing, suji/kabe/genbutsu, band mapping) against fixtures — most
of your work doesn't actually need shanten. Pull A's branch as it lands.

---

## Overlay A — Yaku advisor (`suggestYaku`)

Ranks plausible yaku for the player's current hand by realistic feasibility.
**Top 5 maximum**, fewer when fewer are meaningfully viable.

Each entry shows **exactly four things**: yaku name, han value (closed/open),
a plain-language **description of the yaku itself — its standard definition,
nothing more**, and an estimated **probability band** (Very low / Low / Medium
/ High / Very high, optionally with an approximate % and a tooltip explaining
the estimate method).

### The hard constraint — read this twice

**Never show any concrete advice.** No tiles to keep, discard, or look for. No
waits. No "you already have X, so go for Y." No references to which of the
player's tiles fit which yaku. The description field is the yaku's textbook
definition and nothing else — identical text regardless of what's in hand.

The probability is the only hand-dependent output. That's the design: the
player must infer *why* honitsu reads High, which is precisely the skill being
trained. If an entry would leak hand contents, it's a bug.

### Estimation must respect

- Closed-only yaku (pinfu, riichi, chiitoitsu, ryanpeikou, menzen tsumo) →
  correctly flagged impossible once the hand is open.
- Seat/round wind availability for yakuhai.
- Remaining visible tiles (a yaku needing 4 dead tiles is not viable).
- Current meld state and shanten.
- `twoHanMinimum` when on: single-han-only paths must be devalued.
- Open tanyao only counts when `kuitan` is on.

Store yaku definitions as static text in one table — they never vary.

---

## Overlay B — Opponent reading (`readOpponents`)

Per-opponent mini-analysis, refreshed on the player's turns and after any call.
Per seat:

- **Hand direction** from melds and discards — named yaku possibilities, e.g.
  "Likely honitsu in bamboo", "Possibly chasing a dragon triplet."
- **River cues** — suit preferences, early honor discards (suggests a fast
  numbered hand), late honor discards (suggests defense or a shift), tightening
  discards, dangerous tile classes via suji/genbutsu logic.
- **Threat state** — riichi declared, or judged likely tenpai (call patterns,
  discard tempo, turn count).
- **Deal-in risk estimate** — Low / Medium / High.

Phrase everything probabilistically: "possibly", "likely", "watch for". Never
state a certainty. **Every signal carries a tooltip explaining the method**,
e.g. *"Why this looks dangerous: after they discarded 4-pin, 1-pin and 7-pin
are suji-safe, but 5-pin is not."* The tooltip teaches the inference — it's the
pedagogical payload, not decoration.

This must mirror what a strong human reader would infer from the table, and
must never reveal AI hands.

---

## Overlay C — Wait guessing (`guessWaits`)

When an opponent is tenpai (riichi declared, or judged likely), show ranked
probabilistic guesses of their likely winning tile classes — **up to ~3
guesses**, each with a confidence level and a one-line reason drawn from suji,
kabe (wall reading), kawa (river) patterns, and call shapes.

Note the deliberate asymmetry: wait guessing targets **opponents'** waits, never
the player's own hand — own-hand advice is banned everywhere in live play.

**Practice mode** (a sub-toggle): when an opponent declares riichi, the player
is prompted to submit a guess before that opponent's next discard. Answers are
recorded into `WaitGuessRecord`, resolved at round end against the revealed
hand via `resolveWaitGuesses`, and scored in the replay and session summary.

---

## Replay grading (`gradeMatch`)

Grades **every one of the player's turns** — draws, discards, calls, riichi
declarations, folds — from the recorded `ActionLogEntry[]`. Each entry carries
the `PublicView` from the human seat immediately before the action, so you can
rerun exactly the analysis the overlays would have displayed.

Grades: **Excellent / Good / Fair / Poor / Blunder**, each with a concise
plain-English explanation.

Grade on:
- **Tile efficiency** — shanten and ukeire before vs after.
- **Value vs speed** — cheap-and-fast against slow-and-big, given the score
  situation.
- **Call judgment** — did the call help, and did it preserve a yaku?
- **Riichi timing** — hand value, wait quality, turn number, table threat.
- **Push/fold** against opponent threats, using the *same* deal-in risk
  estimates Overlay B produces.
- **Missed opportunities** — a declinable win, a viable riichi passed up, a
  strong call not taken.

Each graded turn gets an expandable **"what were the better options"** detail
listing the strongest legal actions with reasoning (`AlternativeAction[]`).

**This is replay-only. Concrete tile advice must never reach live play.** Same
engine, different disclosure policy — that separation is the whole design.

Grade against what was *knowable at the time* from the public view. Don't
punish the player for losing to information they couldn't have had; a correct
push that deals in is not a Blunder. Reserve Blunder for clear errors
(dropping multiple shanten for nothing, pushing a genbutsu-available hopeless
hand into a declared riichi).

## Session summary support

Provide the aggregation feeding `SessionSummary` in `src/replay/types.ts`:
grade distribution, wait-guess accuracy, and most common mistake categories.
Nothing persists between sessions.

## Testing

- Fixture hands → expected yaku rankings and bands.
- **No-advice test**: assert no `YakuSuggestion.description` mentions a tile,
  and that descriptions are constant for a given yaku across different hands.
- **No-cheat test**: analysis output is unchanged when opponents' hidden tiles
  are shuffled.
- Suji/genbutsu/kabe unit tests against hand-built rivers.
- Grading regression fixtures: a known-bad discard grades Poor or worse; a
  clean efficiency discard grades Good or better.
- Consistency test: for the same `PublicView`, live overlay output and the
  replay grader's reasoning agree.

## Definition of done

`npm run typecheck` and `npm test` pass; all three overlay functions return
meaningful results for fixture views; `gradeMatch` produces a graded turn for
every human action in a sample log.
