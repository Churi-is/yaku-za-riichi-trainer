# Yakuza-Style Mahjong Trainer

Browser-based single-player riichi mahjong trainer: a full 4-player riichi game
plus three toggleable live training overlays (yaku advisor, opponent reading,
wait guessing) and post-match turn grading.

No backend, no accounts, no multiplayer, nothing persisted between sessions.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run typecheck
```

## Layout

```
src/engine/     rules, yaku detection, scoring   (Worker A) — pure, no UI
src/ai/         parameterized opponent model     (Worker B) — public info only
src/analysis/   overlays + replay grading        (Worker C) — public info only
src/ui/         screens, table, overlay panels   (Worker D)
src/state/      session store + game loop        (Worker D)
src/replay/     action log, session summary      (schema C, writer D)
```

## Deploying

Hosted on Cloudflare Workers at <https://riichi.churi.net>. Setup steps:
`docs/DEPLOY-CLOUDFLARE.md`.

## Docs

- `docs/PLAN.md` — how the build is split across four parallel workers
- `docs/PLAN-MOBILE-LAYOUT.md` — portrait/landscape match-table layout plan (sideways side-seat tiles, no-clip/no-overlap invariants)
- `docs/CONTRACTS.md` — the cross-worker seams (read before editing shared types)
- `docs/worker-{A,B,C,D}-*.md` — per-worker briefs
- `docs/DEPLOY-CLOUDFLARE.md` — Cloudflare Workers deployment guide
