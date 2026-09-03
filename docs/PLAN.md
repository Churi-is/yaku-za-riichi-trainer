# Build plan — 4 parallel workers

Browser-only single-player riichi trainer. No backend, no accounts, no
multiplayer, nothing persisted between sessions. The player already knows how
to play; the app trains three judgment skills: **which yaku to pursue, how to
read opponents, how to guess waits.**

## Split

| Worker | Owns | Blocked by | Blocks |
|---|---|---|---|
| **A — Engine** | `src/engine/**` | — | B, C (shanten/ukeire/waits/tiles), D (game loop) |
| **B — AI** | `src/ai/**` | A (shanten/ukeire) | D (real opponents) |
| **C — Analysis** | `src/analysis/**`, `src/replay/types.ts` | A (shanten/waits/scoreHand) | D (overlay + replay content) |
| **D — UI** | `src/ui/**`, `src/state/**`, `src/replay/log.ts`, `src/replay/summary.ts` | nothing hard (stubs) | — |

Detailed briefs: `worker-A-engine.md`, `worker-B-ai.md`,
`worker-C-analysis.md`, `worker-D-ui.md`. Seams: `CONTRACTS.md`.

## Why this split works in parallel

All cross-worker seams are **already scaffolded and compiling on `main`**
before anyone starts, which is the condition that makes simultaneous branches
viable. Engine stubs throw with clear messages, analysis stubs return empty
arrays, the AI stub passes its turn — so every branch builds and runs from
commit one and nobody waits on a type that doesn't exist yet.

The one real serialization risk is `shanten` / `ukeire` / `waits` / `tiles`:
B and C both need them for their *numeric* work. Mitigation — Worker A ships
those four as the first deliverable, ahead of the game loop and scoring. In the
meantime B builds its decision layers and C builds its structural reasoning
(suji, kabe, genbutsu, river parsing, band mapping) against fixtures, neither
of which needs shanten.

## Critical path

`A.tiles + A.shanten` → B and C unblocked → `A.applyAction` → D's real loop →
merge B → merge C → integration polish.

## Two invariants everyone enforces

1. **Public-information firewall.** `PublicView` is the only input to the AI and
   to every analysis function. Nothing in `src/ai` or `src/analysis` may import
   `GameState`. An AI that cheats or an overlay that peeks invalidates the
   training premise — the player would be learning to read signals that aren't
   real. Each of A, B, C ships a test asserting this.
2. **One analysis module, two disclosure policies.** Live overlays and replay
   grading call the *same* functions in `src/analysis`, so hints and grades can
   never contradict each other. The difference is only what's shown: replay may
   reveal best discards; **live play never gives tile advice.**

## Merge protocol

Each worker on their own branch, merging peers as needed
(`git fetch origin && git merge origin/<branch>`; in files you don't own, take
theirs). Contract changes require a dated note in `CONTRACTS.md` pushed
immediately. Final integration lands in D's branch or a dedicated integration
branch once A, B, and C are green.

## Accepted defaults

Red fives: 3, one per suit, when enabled. No abortive draws — hands end by win
or exhaustive draw only. Renhou = mangan. Single yakuman scoring, no stacking.
Plain point ranking, no uma/oka. Wait guessing targets opponents' waits only.
