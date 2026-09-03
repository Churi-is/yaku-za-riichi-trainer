# Worker D — UI, Game Loop, Overlays Shell, Replay & Session Screens

You own everything the player sees and the loop that drives a match in
**Yakuza-Style Mahjong Trainer** — a browser-only single-player riichi trainer
(no backend, no accounts, no multiplayer, nothing persisted between sessions).

You integrate all three other workers. You are also the only worker who can
work at nearly full speed from minute one, because every dependency you have is
already scaffolded as a compiling stub: the engine stubs throw with clear
messages, analysis stubs return empty arrays, the AI stub passes. **Build
against the stubs, then pull peer branches as they land.**

## Your scope

`src/ui/**`, `src/state/**`, `src/main.tsx`, `src/replay/log.ts`,
`src/replay/summary.ts`, styles. You own the log *writer*; Worker C owns the log
*schema* in `src/replay/types.ts`.

Already scaffolded: app shell + screen router (`ui/App.tsx`), session store
(`state/session.ts`) with screen routing / settings / overlay toggles, and
placeholder components for all screens, overlays, and table pieces.

## Screens

`main menu → table settings → match → post-match replay → session summary → menu`

### Table settings (mirrors Yakuza's rule-change screen)
Selectable before **every** match: red dora on/off, kuitan on/off, 2-han
minimum on/off, game length (East-only or hanchan), and opponent difficulty
(Easy / Normal / Hard). Include a compact **"current rules" summary card** — a
reminder of the chosen settings, *not* a rules tutorial.

### Match screen
Your hand; three AI hands (tile backs / counts only — never their faces);
discard rivers; meld areas; dora indicator display; score display with honba
and riichi sticks; seat and round winds; call buttons (chi / pon / kan / ron /
riichi / tsumo) with correct timing windows and confirmation; the three overlay
toggles; and a pause menu that can change overlay toggles mid-match.

At match start, show the three AI **personalities** (name + one-line style
description from `PERSONALITIES`) so the player can start building a mental
model of each seat.

Tiles: clean readable standard faces — man/pin/sou with Japanese numerals,
winds, dragons. Red fives visibly red when enabled. English UI text throughout.
Responsive for desktop and touch (tap targets, no hover-only affordances).

### Replay
Turn-by-turn timeline covering **every one of your turns** (draws, discards,
calls, riichi, folds), each with a grade badge — Excellent / Good / Fair / Poor
/ Blunder — and its plain-English explanation, from `gradeMatch`. Each turn
expands to **"what were the better options"** with reasoning. Also per-round
reveals of what each AI actually held, so the player can verify their reads —
including practice-mode wait guesses vs. the true waits.

### Session summary
Hands played, wins/placement, yaku won with, grade distribution, wait-guess
accuracy, most common mistake categories. In-memory only.

## Game loop (`src/state/gameLoop.ts`)

The heart of your work:

1. `createMatch(settings, seed)` → state.
2. Loop: `pendingSeats(state)` → for AI seats call
   `createAI(...).decide(toPublicView(state, seat), getLegalActions(state, seat))`
   and apply it; for seat 0 (always the human), surface legal actions as UI
   buttons and wait.
3. Append an `ActionLogEntry` for every action, including
   `viewBefore = toPublicView(state, 0)` before each human action — the replay
   grader needs it.
4. On hand end, record the `HandLog` with revealed hands; `nextHand(state)`
   until `matchOver`.
5. Pace AI turns with a short delay so the table reads naturally; never block
   the UI thread.

Guard the loop against a throwing engine stub so the app degrades gracefully
while Worker A is still building.

## Overlays — the product's core

Three **independent** panels, each with its own toggle button on the game
screen. Requirements, all of them load-bearing:

- **Any combination may be active simultaneously.** Toggles work mid-hand.
- With all toggles off, the game plays exactly like plain mahjong.
- Panels **reposition or auto-collapse so they never block discard rivers, dora,
  or call prompts.**
- They must **never delay or interfere with turn flow.** Compute off the
  critical path; a slow overlay must not stall a call window.
- Every probability is **labelled as an estimate**.
- Tooltips explain the *method* behind each signal — that's the teaching.

**A. Yaku advisor** — top 5 yaku, each showing exactly four things: name, han
(closed/open), the yaku's plain-language definition, and a probability band.
**Render nothing else.** Never display tiles to keep/discard/seek, never show
waits, never reference which of the player's tiles fit a yaku. If the data from
`suggestYaku` would let you render tile advice, don't — the constraint is on
what's *shown*.

**B. Opponent reading** — per-opponent hand direction, river cues, threat state,
and a Low/Medium/High deal-in risk estimate, all phrased probabilistically,
each signal with a "why" tooltip.

**C. Wait guessing** — up to ~3 ranked wait guesses per tenpai opponent with
confidence and one-line reasoning. Includes a **practice mode sub-toggle**:
on an opponent's riichi, prompt the player to submit a guess *before that
opponent's next discard*, record it, resolve at round end, score it in the
replay and summary. Keep the prompt non-blocking — it must not stall the game.

All three read exclusively from `@analysis`. **Do not compute analysis in the
UI** — if something's missing, ask Worker C for it. That keeps live overlays and
replay grades consistent by construction.

## Absolute prohibitions (product-level)

No how-to-play tutorial. **No discard or tile advice during live play,
anywhere** — the replay may reveal best discards; live overlays never do. No
win-streak or meta progression, no online play, no accounts, no persistent
history, no monetization.

## Integration order

1. Screens, routing, settings, tile rendering, static table layout — zero
   dependencies, start here.
2. Game loop against engine stubs; log writer; overlay panel shells rendering
   empty analysis gracefully.
3. Merge Worker A → real game. Merge Worker B → real opponents. Merge Worker C
   → real overlay content and grading.

Pull peers freely: `git fetch origin && git merge origin/<branch>`. In files you
don't own, take theirs.

## Testing & quality

- `npm run typecheck` and `npm test` pass; `npm run dev` serves on `0.0.0.0`
  (already configured, `allowedHosts: true` for the proxied preview host).
- Component tests for tile rendering and overlay panels with empty data.
- Manual pass: full hanchan playable on desktop and on a narrow touch viewport,
  all overlay combinations toggled mid-hand without layout breakage.
- Never render another seat's concealed tiles outside the replay reveal.

## Definition of done

Full loop playable menu → settings → match → replay → summary → menu; all three
overlays toggle independently mid-hand without blocking the table; replay shows
a graded timeline of every human turn with expandable alternatives; session
summary populated.
