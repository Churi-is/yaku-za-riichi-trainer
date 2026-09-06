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

## Choose your table

Play against **22 Yakuza / Like a Dragon-inspired characters**: six Easy,
six Medium, six Hard, and four **Special** opponents. Specials have a separate
label and estimated difficulty in their descriptions—not a tier above Hard.
Select a seat on the small table, then a character—or drag their card into place. Seated characters swap places; clearing
one seat never shifts the others. Search, level filters, and quick table presets
help you build a lineup.

Characters use their own difficulty by default, with an optional uniform
practice level in Table Settings. Distinct preferences cover calls, dora,
flushes, pairs, kans, defense, and final-round position. Specials add Nugget's
self-sabotage, Mr. Shakedown's mangan minimum, Komaki's ron-only counters, and
Pocket Circuit Fighter's alternating racing gears. All bots use public
information only. See [`docs/BOTS.md`](docs/BOTS.md) for the roster and logic.

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
