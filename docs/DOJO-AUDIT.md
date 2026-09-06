# Dojo content audit — and a plan to strengthen it

Scope: an audit of the Dojo **as teaching material** — coverage, sequencing,
clarity, drill quality, and factual accuracy of the content itself — not a
review of the code that renders it. Every factual claim below was checked
against the engine's own rules (`src/engine/`), and every figure that depicts
a complete 14-tile hand was scored by the real `scoreHand` to verify what the
caption says it scores.

**Materials audited:**

| Track | File | Lessons | Drills | Tile-choice drills | Label-only options |
|---|---|---|---|---|---|
| Basics | `src/dojo/basics.ts` | 11 | 33 | 20 tile options | 84 |
| Strategy | `src/dojo/strategy.ts` | 14 | 39 | 76 tile options | 60 |
| Yaku Codex | `src/dojo/yakucodex.ts` | 31 | 93 | **0** | 279 |

The Yaku Codex is the largest track (21.6k words, 56% of all course words) and
contains **zero tile drills and zero table positions**. Every drill in it is
static text. That is the single biggest structural problem in the course.

---

## 1. Verdict

The skeleton of the course is genuinely good: scripted positions built through
the real engine, a strict teach-then-drill rhythm, sensible track ordering, a
140-word-per-screen discipline, and a test suite that re-verifies every
"efficiency" drill against the engine. The opening third (basics through
five-blocks) is the strongest teaching in the app.

But as educational material the course has five systemic problems:

1. **The Yaku Codex is a quiz, not a course.** 93 multiple-choice questions,
   no hands to touch, no tables to read, no tile ever selected. And in the
   questions themselves, 165 of 279 option labels are written
   `"Yaku name — definition of it"`, so when the answer isn't obvious, the
   answer is in the option text. The actual teaching lives in the `why`
   strings, which the student only sees *after* answering — the course's
   educational load is inverted: the question tests reading, the explanation
   teaches, and the explanation arrives too late to be a question.
2. **Vocabulary is used before it is taught.** `ippatsu`, `ura dora`, `mangan`,
   `haneman`, `menzen tsumo` (by name), `fu`, `kuitan`, and "leading in the
   last hand" all appear as *decision criteria* before any lesson defines
   them. One term — `ryankan` — appears in a strategy lesson, is never defined
   anywhere, and is not even a yaku in this game.
3. **Scoring is the missing subject.** The course's judgement calls — riichi
   exceptions, push/fold, "the hand is already big" — all depend on knowing
   what a hand is worth (fu, the han ladder, mangan). The course explicitly
   does not teach this ("the one chapter this course does not drill"), then
   asks students to make the judgements that require it.
4. **Complex mechanics get one sentence.** Kan (what happens after the call,
   ura, kan dora), call priority, round/dealer structure, and the noten
   economy are each one sentence, in a course whose selling point is teaching
   decisions on real positions.
5. **A small number of factual errors in the teaching figures**, verified
   against the engine (section 3.1). They are few, but they sit in example
   hands the student is told to trust.

---

## 2. What is good — do not lose this in the rewrite

- **Engine-built positions.** `scriptedState` makes every basics/strategy
  position a real `GameState`; the test suite replays every efficiency drill
  through the engine and fails the build if a "best discard" claim is wrong.
  That is a higher bar than most published courses meet. Keep it, and extend
  it to the codex (section 5, phase 3).
- **The five-blocks and building-blocks lessons** (strategy ch. 3–4): the
  135p "two closed shapes that are really eight tiles" lesson, the pond-counting
  drill in `waits`, and the floaters ordering are well-built, well-seenced
  teaching with correct arithmetic.
- **`safe-tiles` (defense ch. 2):** genbutsu → suji → dead-tile counting, in
  that order of certainty, with the "suji is a probability, not a promise"
  note. Best sequence in the course.
- **The codex's safety framing.** Each flush/limit-hand lesson ends with what
  is safe to throw against it. That is real table value, and it is unique to
  this course. Keep the framing; put it on a real pond.
- **Honesty about sources** (the credits lesson) and about ruleset deviations
  (renhou = 5 han; iipeiko absent). Keep.

---

## 3. Findings

### 3.1 Factual errors in the teaching content (verified against the engine)

Each figure below is a 14-tile hand shown to the student with a caption
asserting what it is. I scored every one of them with the engine's own
`scoreHand`/`detectYaku`.

| # | Location | What it says | What the engine says |
|---|---|---|---|
| E1 | `yaku-luck/menzen-tsumo`, first figure: `123m 456m 234p 234s 55s` | "scores pinfu, **tanyao** and menzen tsumo" | **Pinfu + menzen tsumo only.** The hand contains 1m, a terminal — tanyao is impossible in every reading. This is the first example hand of the Yaku track. |
| E2 | `building-blocks/complex` (strategy), step 2: "but look at the three ponds before the next turn, because that **ryankan** is about to matter" | Implies a yaku is coming | **Ryankan is not in this game's yaku set** (`YAKU_NAMES` has no ryankan), is never defined anywhere in the course, and is irrelevant to the sentence that follows (counting the three 4p in the ponds). The sentence is incoherent as written. |
| E3 | `yaku-twohan/shousangen`, figure: `PPP FFF CC 123m 456m` | "Shousangen, two han, plus two yakuhai" (i.e. four han) | The engine also awards **Honitsu (3 han closed)** — the 4th and 5th sets are man tiles, so the figure is a seven-han hand. A student applying the course's own "count the yaku" rule gets a different total than the caption. |
| E4 | `building-blocks/waits` (strategy), figure caption: "Shanpon or tanki — **two or four tiles**" | Compresses two different waits into one muddled count | A shanpon (two pairs) accepts **four** — two copies of each pair's mate. A tanki accepts **three** from a lone tile, or **two** when the wait is a third copy of a pair you already hold. "Two or four" drops the three and invites a wrong size comparison in the one lesson whose point is that waits differ in size. |
| E5 | `yaku/kan-draws`: "rinshan draws are dead-wall tiles, so they are never also ippatsu draws in the ordinary sense" | A rule interaction | **Incoherent.** ippatsu is a win condition, not a property of the tile source. The actual (engine-verified) rule is that ippatsu pays only on a discard, and a rinshan win is a self-draw — that is why the two never combine, and it is not what the sentence says. |
| E6 | `yaku-flushes/honitsu-codex` figure: `222m 789m 345m EEE FF` | "plus the **East** and dragon yakuhai triplets" (also in `basics/hands-worth-knowing`) | The EEE triplet is yakuhai **only in an East round.** The figure has no round context, so as shown the caption is true in exactly one of four rounds. |
| E7 | `yaku-yakuman/riichi-family` figure: `123m 456m 234p 234s 88p` | "A hand that is **tenpai on the opening deal** can be declared double riichi" | The figure is a **complete 14-tile hand**; a deal is 13 tiles. The example cannot depict its own caption. It should be a 13-tile tenpai hand. |
| E8 | `yaku-flushes/chinitsu-codex` drill 1, correct answer: "the 123-789 within it **may also make ittsu**" | Suggests the figure is ittsu-adjacent | `222m 345m 789m 123m 11m` decomposes only as `123m 222m 345m 789m + 11m` — there is no 456m, so it is not ittsu in any reading. The ittsu lesson (two lessons earlier) uses this same hand's neighborhood for *its* figure; a student comparing them will be confused. |
| E9 | `yaku-yakuman/tsuuiisou` figure: `PPP FFF CCC EEE SS` | "Tsuuiisou yakuman (and it also contains daisangen)" | Fine as a description, but the engine scores this hand as **Daisangen** (first matching yakuman wins). A student who checks with the engine sees a different name. Either fix the figure or say which name the table will show. |
| E10 | `basics/graduation`: "Every lesson is **three** guided screens and three drills" | — | Lessons have **two to four** teach screens (the codex has exactly two). Minor, but a promise made to the student at the track boundary. |
| E11 | `yaku/riichi-family` (lesson, step 2, note, and drills 1–2): "win on your **very next draw**, or on a discard before your next draw … and ippatsu is added"; "A double riichi that wins on its very first draw is double riichi plus ippatsu"; "Furiten riichi can still ippatsu on a self-draw" | ippatsu includes a tsumo on the next draw | **Wrong in this engine, verified against its own expiry test** (`yaku.test.ts`: "is live the moment riichi is declared and dies on the declarer's next draw" — the flag clears *at* the draw). Ippatsu here pays only on a **ron** on a discard between the declaration and the declarant's next draw, with no intervening claim. Drill 1's correct answer ("Ippatsu, plus menzen tsumo") describes exactly the self-draw case the engine does not award. The basics track makes the same error unnamed ("an extra bonus draw chance on the very next turn"). |

Also noted (not errors, but misleading as written):

- **`yaku-everyday/pinfu-codex`** explains the pinfu pair rule in fu language:
  "a valued pair — it earns fu", "no-fu, which is what pinfu requires",
  "the chi introduced fu". **Fu is never taught in this course** (the basics
  track explicitly defers it), so the reason a dragon pair breaks pinfu is
  explained with a concept the student does not have.
- **`basics/dora-and-scoring`**: "A red five in your hand counts as a dora
  too." The engine counts red fives as *aka* — a separate line from dora in
  every score display. For the lesson titled "Dora and what a hand is worth",
  merging them is sloppy.
- **`yaku-luck/menzen-tsumo`**: "Tsumo wins are paid **a little** by each of
  the three opponents" — the total is the same as a ron; "a little" invites
  the wrong mental model.

### 3.2 Vocabulary used before it is taught

First appearance of each term in teaching order (basics → strategy → codex),
and where it is actually defined:

| Term | First used as a *decision criterion* | Defined |
|---|---|---|
| `ippatsu` | strategy `riichi/insta-riichi` ("plus the ippatsu you will sometimes catch") — 5+ uses across riichi, no-riichi, melding | Codex `riichi-family` — **after** strategy. Basics describes it unnamed ("bonus draw chance on the very next turn"). |
| `ura dora` | strategy `riichi/insta-riichi` ("the ura dora only riichi hands see") | **Never defined anywhere in the course.** How you get it, what it counts, when it appears — one sentence's worth of "hidden bonus dora" in basics is the whole treatment. |
| `mangan` | basics `dora-and-scoring` ("big hands hit named plateaus such as mangan"), then strategy `no-riichi` ("hands that are already at the **mangan ceiling**"), `defense/push-fold` ("a coin flip against a mangan"), `riichi/no-riichi` drill ("pushes it well past mangan") | **Never defined.** The student is asked to judge "is my hand at the mangan ceiling?" without knowing what mangan is (5+ han, capped payout) or how to get there. This is the load-bearing undefined concept of the whole strategy track. |
| `haneman` | strategy `yaku/big-hands` drill ("potentially a haneman") | Never defined. |
| `menzen tsumo` (by name) | strategy `melding/to-meld` ("Opening your hand costs riichi, **menzen tsumo**, pinfu…") | Codex `menzen-tsumo` — after strategy. Basics only says "self-draw (tsumo)". |
| `fu` | codex `pinfu-codex` (4×, as the *reason* for the pair rule) | Explicitly **not taught** ("the one chapter this course does not drill"). |
| `kuitan` | codex `tanyao-codex` ("when kuitan is on") | Half-explained in the same breath ("which this app uses by default") — acceptable, but the term is dropped as if the reader knows house rules exist. |
| `ryankan` | strategy `building-blocks/complex` | **Not a yaku in this game; never defined.** (See E2.) |
| "leading in the last hand" | strategy `no-riichi` (exception 4: "you are leading in the last hand and want it to end quietly") | Never defined — **no lesson teaches dealer/round structure at all** (basics gets one sentence: "The dealer and the deal rotate around the table from hand to hand"). |
| `kan` mechanics | basics `calling-tiles` — one sentence: "Kan takes the fourth copy of a tile you already have three of." | Replacement draw, ura indicators, kan dora, effect on ippatsu — **never taught.** The codex's `kan-draws` and `suukantsu` lessons assume it. |

**The pattern:** the strategy track (which claims to "assume everything" from
basics) is where the undefined terms enter as *reasons for decisions*, and the
codex — a reference track students may never read — is where some of them
finally get definitions. A student following the intended path meets ippatsu,
ura, mangan and haneman as black boxes in lessons whose whole job is
judgement.

### 3.3 "One sentence" treatments of complex mechanics

Things the course touches with a single sentence and then uses again:

1. **Kan** — one sentence in basics (above). No replacement draw, no ura, no
   kan dora, no chankan preview, no "a kan helps your opponents see dora".
   Yet kan appears in the codex (`kan-draws`, `sankantsu`, `suukantsu`,
   `chankan`) and in the engine's scoring.
2. **Call priority** — "Pon beats chi in priority" (basics). Missing: a win
   beats every call, kan beats pon, and the full order
   tsumo > ron > kan > pon > chi. No drill ever practices it.
3. **Round and dealer structure** — one sentence (basics). No honba, no
   East→South round progression, no "last hand", no why-the-dealer-pays-double.
   The `no-riichi` exception "leading in the last hand" is a decision the
   student is handed with zero of the concepts behind it.
4. **Noten / endgame economy** — "noten… means sharing a small penalty, which
   is why even a cheap tenpai at the end is worth holding" (basics). The
   penalty is never quantified, the wall-count logic is never shown, and
   `defense/push-fold` drill 3 (turn 17, five tiles left) asks the student to
   weigh exactly this trade with no arithmetic taught.
5. **Scoring** — the deferred chapter (see 3.5).
6. **Reading an opponent's hand** — exists only as scattered tells (flush
   river, pon-heavy toitoi, two dragon pons, terminal collector). No lesson
   assembles them into "here is how you read a river" and no drill practices
   it from a full table state.

### 3.4 Yaku Codex design problems

Verified: 93 drills, **0 tile options, 0 scripted tables, 0 hands, 0 rivers,
0 turn numbers** anywhere in the track. (The 31 lessons use only `text`,
`note` and static `figures` tile strips.)

1. **No tile work at all.** In a track about recognising hands, the student is
   never once asked to select a tile: not "which tile completes this
   kokushi", not "which of these four tiles keeps tanyao alive", not "discard
   one tile and tell me the hand still scores sanshoku". The basics and
   strategy tracks prove the `Step` schema and the board UI support tile
   drills on scripted positions — the codex simply never uses it.
2. **The answer is written in the answer.** 165 of 279 option labels are
   `"Name — definition"`. When the prompt paraphrases the definition, the
   question is solvable by matching words, with no mahjong knowledge.
   Concrete examples, all from the codex:
   - `kan-draws` drill: prompt *"You declare a kan, draw the replacement
     tile from the dead wall, and it completes your hand. Which yaku?"* —
     correct option: **"Rinshan kaihou — winning on the kan replacement"**.
     The label restates the prompt.
   - `last-tile` drill: prompt *"You draw the final tile left in the live
     wall…"* — correct: **"Haitei raoyue — the last-tile self-draw"**.
   - `menzen-tsumo` drill: prompt *"…you draw the very tile you are waiting
     on"* — correct: **"Menzen tsumo — one han for drawing it yourself"**.
   - `tenhou-chiihou` drill: prompt *"What do tenhou and chiihou require that
     ordinary yaku do not?"* — correct: **"Nothing about the tiles — only the
     round/seat and the perfect first-draw timing"**. The answer is the label.
   The 13 "Which complete hand scores X?" questions are better (bare tile
   strings), but even there the distractors' `why` text teaches the
   identification rule, so the real lesson happens after the answer.
3. **No table, so no practice of the thing the track claims to install.** The
   codex's best feature — "against honitsu your pin/sou are safe" — is stated
   in the abstract, never shown on a pond. The student reads "your man tiles
   are dangerous" and is never pointed at a real river and asked to find the
   safe tile in their own hand.
4. **No han-counting practice.** The one skill a yaku codex should drill
   hardest — take a completed hand, list its yaku, apply suppression, total
   the han — never appears as a question. Totals show up in `why` strings
   (toitoi "five han before dora", shousangen "around four han") but the
   student never has to produce one.
5. **The codex is where some of the strategy track's terms get their only
   definitions** (ippatsu, furiten-riichi nuance, kan yaku) — so it is both a
   reference and, accidentally, a required text, and its "reference" framing
   ("recognition, not judgement") is contradicted by its own drill design.

### 3.5 The missing subject: scoring

The course's stated structure follows Riichi Book I "chapters 3 onward", and
the credits lesson admits chapters 6 (scoring) and 10 (endgame) are skipped,
adding: "knowing what your hand is worth is what makes every judgement in
this course concrete."

But the judgements *are* in the course, and they are built on scoring:

- `riichi/no-riichi` exception 1 — "the hand is already big" — is
  operationalised in the drills as "at the mangan ceiling on a narrow wait"
  (undefined) vs "pushes it well past mangan" (undefined).
- `defense/push-fold` — "whether what you stand to win beats what you stand
  to lose" — with "a coin flip against a mangan" as the worked loss.
- `yaku/big-hands` — "potentially a haneman" as the commitment argument.
- `melding/to-meld` — "call it two han of expectation, gone the moment you
  call" — a value judgement with no value taught.

The student who finishes the course can name mangan and haneman but cannot
produce one. **A short scoring lesson is the single highest-value addition to
the course** — it converts four black-box judgements into reproducible rules
(see phase 2).

### 3.6 Judgement lessons that hand over the rule without the method

- **`defense/push-fold`** asks "How close are you? How much is the hand worth?
  How dangerous is the tile you would have to throw? And how late is it?" —
  then gives a four-line "short version" and drills. There is no method for
  estimating danger (genbutsu/suji/dead-tiles come in the *next* lesson), no
  way to estimate how close you are (acceptance tiles are never counted out
  loud in a drill), and no comparison format. The drills are well-built, but
  the student is expected to feel the answer.
- **`yaku/big-hands`** gives commit thresholds ("seven or eight tiles of one
  suit by the middle of the hand", "three pairs by turn six", "five pairs
  early") with no reasoning, and the drills are single correct answers that
  just apply the stated threshold. There is no boundary case (7 tiles on
  turn 8? five pairs on turn 9?) so the student learns the sentence, not the
  judgement.
- **`riichi/no-riichi`** "Four situations, and nothing else" is a good shape,
  but situation 1 depends on the untaught mangan (3.5) and situation 4 on the
  untaught round structure (3.2).

### 3.7 Coverage gaps (what is not taught at all)

1. **Scoring** (fu at the level the judgements need, the han ladder, limits) — 3.5.
2. **Kan mechanics** — 3.2/3.3.
3. **Call priority** — 3.3.
4. **Round/dealer/honba structure** — 3.2.
5. **Endgame / wall-count play** — Riichi Book ch. 10 territory; the course
   makes one turn-17 decision (`push-fold` drill 3) with no framework.
6. **Pao** — the engine implements pao (daisangen/daisuushii liability,
   `checkPao`, payment splitting) and **no lesson mentions it**. The
   daisangen lesson's "opponents stop discarding dragons once two are
   ponned" is exactly the situation where pao changes *who* pays, and the
   course never says.
7. **Waiting-improvement / furiten-aware play** — furiten is taught, but
   "changing your wait to escape it" and "furiten tenpai, should I riichi?"
   get one drill each (`insta-riichi` drill 3); the follow-up decisions are
   left to instinct.
8. **Ippatsu/ura as *things that happen at the table*** — ura never appears
   in any scripted position (the `Step` schema has no ura field;
   `scriptedState` hides `uraIndicators`), so a student finishes the course
   having never seen an ura indicator on a board they are playing on.

---

## 4. Per-track notes (quick reference)

**Basics (11 lessons)** — the on-ramp flow, tile vocabulary and the
furiten/riichi pair are strong. Fixes: mangan defined here (it first appears
here); kan mechanics expanded; call priority step; red-fives-vs-dora
distinction; round-structure step; graduation promise corrected (E10).

**Strategy (14 lessons)** — building-blocks through five-blocks and
safe-tiles are the course's best teaching. Fixes: E2 (ryankan), E4 (wait
counts), ippatsu/ura defined on first use, mangan defined before
`no-riichi` (or the scoring chapter comes first), push/fold given a method,
big-hands given reasoning + boundary drills, melding given a second lesson
(kan calls, open-hand yaku choice).

**Yaku Codex (31 lessons)** — complete engine coverage (test-enforced), good
safety framing, consistent rhythm. Fixes: E1, E3, E5, E6, E7, E8, E9;
rebuild drills so the question carries the test (bare yaku-name options,
real hands, at least one tile drill and one "count the han" drill per
lesson, tables for the safety questions).

---

## 5. The strengthening plan

Ordered so each phase unblocks the next. Effort is rough, for one person.

### Phase 0 — Fix the errors (≈1 day) — **DONE**

Cheap, unambiguous, and each item is a content error a student meets. All 12
items are in; the figure-verification test (item 12) lives at
`src/dojo/__tests__/figures.test.ts` and re-checks every figure in the course
against the engine on every run. While verifying, two further latent errors
were found and fixed: the no-riichi drill claimed "three dora" on a hand with
two (its "well past mangan" line was then made accurate — the hand is four
han, and riichi crosses it into mangan), and the chinitsu lessons called a
six-han closed hand "a guaranteed mangan" (it is haneman; open is the mangan
case). E5's "any kan breaks ippatsu" was re-verified against the engine and
retracted: only a chi/pon/kan **on a discard** closes the window; the
declarant's own ankan/kakan do not, and the window dies at the declarant's
next draw, so ippatsu is a discard-win (ron) only — never a self-draw.

1. E1 — `menzen-tsumo` figure: either swap in a hand that really has tanyao
   (the drill figure `234m 345m 345p 234s 88p` is verified pinfu+tanyao) or
   fix the caption to "pinfu and menzen tsumo".
2. E2 — delete the "ryankan" clause from `building-blocks/complex`; the
   sentence works without it.
3. E4 — `waits` figure: "Shanpon — two pairs, waiting on a third copy of
   either: four tiles. Tanki — a lone tile waiting on its mate: three (two
   when the wait is a third copy of a pair you hold)."
4. E3 — `shousangen` figure: change the two run sets to sou
   (`PPP FFF CC 123s 456s`) so the hand is exactly shousangen + 2 yakuhai, or
   add honitsu to the caption and drill.
5. E5 — rewrite the `kan-draws` ippatsu sentence: "ippatsu pays only on a
   discard, and a rinshan win is a self-draw — so the two never combine in
   this game."
5b. E11 — rewrite the `riichi-family` lesson and its first two drills to the
   engine's actual rule: ippatsu = ron on a discard between the declaration
   and your next draw, no intervening claim; a self-draw (including on the
   next draw) scores menzen tsumo, not ippatsu. Also fix the unnamed version
   in basics `declaring-riichi` ("an extra bonus draw chance on the very next
   turn").
6. E6 — `honitsu` (and basics) figure captions: state "in an East round…"
   explicitly, or use dragon-only triplets so no round is assumed.
7. E7 — `riichi-family` figure: make it a 13-tile tenpai deal.
8. E8 — `chinitsu` drill: remove the ittsu aside, or use a figure that
   actually reads 123-456-789 (e.g. `123m 456m 789m 111m 22m`).
9. E9 — `tsuuiisou` figure: note that the table will score it as daisangen
   (first matching yakuman), or pick a figure without a daisangen inside.
10. E10 — graduation: "two to four guided screens and three drills".
11. Red fives: "counts as a bonus like dora — the table lists red fives (aka)
    and dora on separate lines" (basics `dora-and-scoring`).
12. **Add a permanent figure-verification test.** Method used for this audit:
    for every 14-tile `figure`, assert `isAgari` holds, and for figures whose
    caption names yaku, assert the engine's detected yaku includes them.
    This catches the whole E-class of regression automatically.

### Phase 1 — Close the vocabulary holes (≈2–3 days) — **DONE**

Rule to enforce: **a term's first appearance in any track must define it at
that point.** Items 13, 14, 17 and 18 are in as written. Item 14's note uses
the engine's actual ladder (mangan 5, haneman 6–7, baiman 8–10, sanbaiman
11–12, yakuman 13+) and states the tier-crossing fact that "the hand is
already big" actually rests on — a han only changes the payout at the tier
lines. Items 15 and 16 are in as teach content (the kan mechanics step and
the full claim order, win > kan > pon > chi, now sit in basics
`calling-tiles`), but their dedicated drills are deferred to Phase 3: every
lesson in the course is pinned at exactly three drills by test, so new drills
replace old ones — which is exactly what the codex/strategy rebuild does.
The rule itself is now enforced by `src/dojo/__tests__/vocabulary.test.ts`,
which lints the full reading order for first-use of ippatsu, ura, mangan and
menzen (word-boundary, across text, tables, prompts, options, whys, notes
and captions).

13. `ippatsu` + `ura dora` get a short definition block in
    `riichi/insta-riichi`, worded to the engine: ippatsu is a one-go-around
    window that pays on a **discard** win and closes at the declarant's next
    draw (any chi/pon/kan on a discard closes it early); ura dora are hidden
    indicators staged in the dead wall (one per kan) that only a riichi
    winner's score reveals.
14. `mangan` + the han ladder get defined in basics `dora-and-scoring` —
    five han = mangan (capped), the ladder continues haneman/baiman/
    sanbaiman/yakuman — using the app's own `basePoints` as the source of
    truth, with one worked example ("three dora + tanyao + riichi = 5 han =
    mangan, capped").
15. `kan` mechanics: one teach step + one drill (replacement draw, ura
    indicators appear, a kan dora is revealed, opponents benefit from the
    revealed dora, ippatsu ends) in basics `calling-tiles` or at the start of
    strategy `melding`.
16. Call priority: one step, one drill (tsumo > ron > kan > pon > chi;
    pon beats chi; chi is left-only — the basics already has the left-only
    rule, just not the full order).
17. Round structure: one step in basics `game-flow` or `graduation` —
    dealer rotates, East round → South round, honba, and what "leading in
    the last hand" means (so `no-riichi` exception 4 stops being a free
    pass).
18. `menzen tsumo` named in basics `dora-and-scoring` (the tsumo/ron
    paragraph) so strategy `melding` stops introducing it.

### Phase 2 — Teach scoring (≈2–3 days) — highest value per day

19. New strategy chapter **"What your hand is worth"** (before the riichi
    chapter, after yaku), ~3 lessons:
    - *Han and the ladder*: han stacks, the limit ladder, mangan's cap and
      why "at 4+ han with a narrow wait, riichi adds nothing" — the
      no-riichi exception finally has its arithmetic.
    - *Fu, loosely*: you do not need exact fu; you need "pinfu-shaped hands
      are cheap, triplet hands are expensive", the two or three fu facts that
      justify it (20/30 base, +10 closed ron, triplet and wait fu), and how
      to read the score the app prints after a win (yaku, han, fu, dora,
      aka, ura lines — the student has seen this screen in matches and
      never been told what it means).
    - *Drills*: "Is this hand mangan? Would declaring riichi change the
      payout?" on three real hands (use `scoreHand` with and without the
      riichi flag — the engine already does both). This makes
      `riichi/no-riichi`, `push-fold` and `big-hands` reproducible.

### Phase 3 — Turn the Yaku Codex into practice (≈1+ week — the big one)

20. **Every codex lesson gets ≥1 tile drill** (the `Step` schema,
    `scriptedState` and the board all support it; the codex just never calls
    it). Templates that work per lesson type:
    - *Shape yaku*: show a 13-tile hand, "which tile completes this
      [yaku]?" — e.g. kokushi's 13-way wait, chuuren's nine gates, ittsu's
      missing middle run.
    - *Recognition under pressure*: "discard one of these four tiles and the
      hand still scores [yaku] — which one?" (tanyao-keeper, chanta-keeper,
      ryuuiisou-keeper drills).
    - *Open/closed*: "you hold [13 tiles]; an opponent throws [tile]. Call
      or not, and what does the hand score open?" (sanshoku dropping to 1
      han, pinfu dying, tanyao surviving — the codex currently *states*
      these in text; make them decisions).
21. **De-leak the questions.** Option labels become bare yaku names (or bare
    tile strings); the definitions stay in the teach step and the `why`
    field. Lint it in the test suite: no `label` containing a
    `" — "` definition clause in a codex drill.
22. **Put the safety lessons on a table.** Give the flush/limit-hand safety
    questions a real scripted position: the suspect's river on screen, the
    student's hand on screen, "which of these four tiles is safe to throw?"
    — the exact skill the lesson claims to install.
23. **One "count the hand" drill per lesson**: a completed hand (real table,
    seat and round stated), the student totals the yaku including
    suppression and dora; `why` walks the count. This is the skill the codex
    exists to build and currently never tests.
24. Re-sequence the codex's opening: the `riichi-family` lesson (which
    defines ippatsu) belongs earlier or, better, its definitions move to the
    strategy track per phase 1 and the codex lesson becomes pure reference.
    Mark the track explicitly as *reference — read any time* in the track
    blurb, so students don't think it is a required sequential course.

### Phase 4 — Deepen the judgement lessons (≈3–4 days)

25. `defense/push-fold`: teach the comparison in three numbers — (a) your
    acceptance tiles (count them out loud on the scripted position; the
    engine's `ukeire` already computes them), (b) their likely wait size vs
    wall left, (c) the danger class of the tile you must throw
    (genbutsu/suji/dead/unknown — the safe-tiles lesson becomes the
    reference). Add one "list the three numbers, then decide" drill before
    the current three.
26. `yaku/big-hands`: give each threshold its *why* (tile counts: nine
    one-suit tiles by turn four ≈ X acceptance tiles vs a standard hand's)
    and add one boundary drill per hand type (just-below-threshold vs
    just-above, same lesson).
27. `riichi/no-riichi`: after phase 2, re-write exception 1's drill to show
    the two `scoreHand` outputs (with/without riichi) side by side — the
    lesson's title promise ("you should know them by name") becomes true.
28. `melding`: second lesson — kan calls (when to declare, the dora-flip
    risk, chankan awareness) and open-hand yaku selection (which open yaku
    survive your hand: tanyao, yakuhai, chanta… and which die: pinfu,
    riichi, menzen tsumo).
29. `defense`: a "read their wait" drill — a riichi player's river on
    screen, list the candidate waits, then rank your hand's four candidate
    discards by danger. This is the missing bridge between safe-tiles and
    push-fold.

### Phase 5 — Endgame (≈1 day)

30. Short lesson (Riichi Book ch. 10 territory): the last ~10 draws, the
    noten payment made concrete (amount + who pays), dealer-last-hand, and
    "why late tenpai with a good wait pushes" — turning `push-fold` drill 3
    from a vibe into a rule.

### Phase 6 — Make the test suite protect the course (≈1 day, alongside)

31. **First-use vocabulary lint**: a `JARGON` map (term → lesson id that
    defines it); the test fails if a lesson uses a term before its definer
    appears in teaching order.
32. **Codex drill-shape test**: ≥1 tile option per codex lesson; ≥1
    "count the han" drill per lesson; no definition-clause labels.
33. **Figure verification** (phase 0 item 12) as a standing test.
34. Keep the existing efficiency-drill replay — it is the best guardrail in
    the repo.

---

## 6. Suggested order and effort summary

| Phase | Content | Effort | Unblocks |
|---|---|---|---|
| 0 ✅ | Fix the 10 verified errors + figure test | done | Trust in the examples |
| 1 ✅ | Vocabulary (ippatsu, ura, mangan ladder, kan, priority, rounds) | done (two drills → Phase 3) | Everything downstream |
| 2 | Scoring chapter | ~2–3 days | no-riichi, push-fold, big-hands, melding |
| 3 | Codex rebuild (tile drills, de-leaked questions, tables, han counting) | ~1+ week | The track actually teaches |
| 4 | Judgement depth (push/fold method, boundary drills, melding II, wait reading) | ~3–4 days | The strategy track's promise |
| 5 | Endgame lesson | ~1 day | Late-hand decisions |
| 6 | Test-suite guardrails | ~1 day | No regression |

Total: roughly 3–4 weeks of focused content work, with phases 0–2 (≈a week)
delivering most of the "the course lies to me / the course assumes things it
never taught" fixes, and phase 3 delivering most of the "content is thin"
fixes.

**Not on the list, deliberately:** rewriting the basics/strategy
building-blocks-through-safe-tiles arc — it is good; and any engine changes.
The engine already implements everything the course needs (scoring, pao,
ura, ura indicators on state); the gap is entirely in the content layer.
