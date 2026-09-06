# Yakuza-Style Mahjong Trainer

Browser-based single-player riichi mahjong trainer:

- **Matches** — full 4-player riichi against three AI opponents, each with
  their own readable personality (aggressive / balanced / defensive) and three
  difficulty tiers. East-only or hanchan length, with red fives, kuitan and a
  two-han minimum toggle.
- **The Dojo** — a structured course taught on the real game table, where
  every lesson is a scripted, playable position with spotlights, a coach card,
  and tile-tap or judgement drills. It runs in three tracks:
  - **Basics** — a gentle on-ramp for players who have never touched mahjong:
    the tiles, a turn of play, sets and the pair, tenpai and waits, the common
    yaku, riichi, calling, dora and scoring, and furiten.
  - **Strategy** — tile efficiency and judgement (the five-block method,
    pursuing yaku, riichi timing, defence, calling), structured on *Riichi
    Book I* by Daina Chiba.
  - **Yaku Codex** — a reference through every yaku the game recognises, from
    the one-han luck yaku and everyday shapes to the flushes and yakuman limit
    hands, each with recognition drills on complete example hands.

No backend, no accounts, no multiplayer, nothing persisted between sessions.

## Choose your table

Play against **22 Yakuza / Like a Dragon-inspired characters**: six Easy,
six Medium, six Hard, and four **Special** opponents. Specials have a separate
label and estimated difficulty in their descriptions—not a tier above Hard.
Select a seat on the small table, then a character—or drag their card into
place. Seated characters swap places; clearing one seat never shifts the others.
Search, level filters, and quick table presets help you build a lineup.

Characters use their own difficulty by default, with an optional uniform
practice level in Table Settings. Distinct preferences cover calls, dora,
flushes, pairs, kans, defense, and final-round position. Specials add Nugget's
self-sabotage, Mr. Shakedown's mangan minimum, Komaki's ron-only counters, and
Pocket Circuit Fighter's alternating racing gears. All bots use public
information only. See [the bot guide](docs/BOTS.md) for the roster and logic.

## Development

Use Node 22 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck  # includes unused-local/parameter checks
npm test           # all unit, UI, self-play, and benchmark tests
npm run build
```

The full suite includes seeded statistical tests and can take several minutes.
Run a single suite with, for example:

```bash
npm test -- src/ai/__tests__/benchmark.test.ts
```

## Layout

```text
src/engine/     rules, tile math, yaku detection, scoring — pure, no UI
src/ai/         parameterized opponents — public information only
src/dojo/       course content, coach placement, scripted table positions
src/ui/         screens, components, deterministic table geometry
src/state/      in-memory session store and paced game loop
src/styles/     theme, tiles, table, and screen styles
src/shared/     game-independent helpers, including the shared RNG
```

## Docs and deployment

- [Architecture and rules](docs/ARCHITECTURE.md) — module boundaries, engine
  usage, tile encoding, and rule choices.
- [Opponents and table setup](docs/BOTS.md) — character policies and controls.
- [Cloudflare deployment](docs/DEPLOY-CLOUDFLARE.md) — build and hosting setup.

Hosted on Cloudflare Workers at <https://riichi.churi.net>.
