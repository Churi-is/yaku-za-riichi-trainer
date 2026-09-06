# Yakuza-Style Mahjong Trainer

Browser-based single-player riichi mahjong trainer:

- **Matches** — full 4-player riichi against three AI opponents, each with
  their own readable personality (aggressive / balanced / defensive) and three
  difficulty tiers. East-only or hanchan length, with red fives, kuitan and a
  two-han minimum toggle.
- **The Dojo** — a structured course in tile efficiency and judgement, taught
  on the real game table: every lesson is a scripted, playable position with
  spotlights, a coach card, and tile-tap or judgement drills.

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
src/dojo/       course content, coach placement, scripted table positions
src/ui/         screens, table, components        (Worker D)
src/state/      session store + game loop         (Worker D)
```

## Deploying

Hosted on Cloudflare Workers at <https://riichi.churi.net>. Setup steps:
`docs/DEPLOY-CLOUDFLARE.md`.

## Docs

- `docs/PLAN.md` — how the build is split across four parallel workers
- `docs/CONTRACTS.md` — the cross-worker seams (read before editing shared types)
- `docs/worker-{A,B,C,D}-*.md` — per-worker briefs
- `docs/DEPLOY-CLOUDFLARE.md` — Cloudflare Workers deployment guide
