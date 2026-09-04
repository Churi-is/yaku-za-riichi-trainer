/**
 * fullGameSim — the deep mode plays real hands, so the properties that matter
 * are about the table it invents: it must be a legal, complete, consistent
 * mahjong position that agrees with everything the viewer can see, and it must
 * never invent knowledge the viewer does not have.
 */
import { describe, expect, it } from 'vitest';
import {
  applyAction, createMatch, DEFAULT_SETTINGS, getLegalActions, kindOf, toPublicView,
} from '@engine/index';
import { createRng } from '@engine/rng';
import { createAI, PERSONALITIES } from '@ai/index';
import type { Action, GameState, SeatIndex, TileId } from '@engine/types';
import { determinize, simulateFullGames } from '../fullGameSim';

const ais = [0, 1, 2, 3].map((i) => createAI(PERSONALITIES[i % PERSONALITIES.length], 'normal', i));

function stepOnce(s: GameState): GameState {
  for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
    const legal = getLegalActions(s, seat);
    if (!legal.length) continue;
    let a: Action;
    try { a = ais[seat].decide(toPublicView(s, seat), legal).action; } catch { a = legal[0].action; }
    return applyAction(s, a);
  }
  return s;
}

/** A real mid-hand position from the real engine. */
function midHand(seed = 42, steps = 40): GameState {
  let s = createMatch({ ...DEFAULT_SETTINGS, gameLength: 'east' }, seed);
  for (let i = 0; i < steps && !s.handOver; i++) s = stepOnce(s);
  return s;
}

/** Every tile in a state, counted once. Called tiles live in a meld AND in the
 *  discarder's river, so the river copy has to be skipped to count honestly. */
function allTiles(s: GameState): TileId[] {
  const out: TileId[] = [...s.wall, ...s.deadWall];
  for (const p of s.players) {
    out.push(...p.hand, ...p.melds.flatMap((m) => m.tiles));
    if (p.drawnTile !== null) out.push(p.drawnTile);
    for (const d of p.river) if (d.calledBy === null) out.push(d.tile);
  }
  return out;
}

describe('determinize', () => {
  it('builds a complete, duplicate-free table from a public view', () => {
    const real = midHand();
    const view = toPublicView(real, 0);
    const d = determinize(view, createRng(5));
    expect(d).not.toBeNull();

    const tiles = allTiles(d!);
    expect(tiles.length).toBe(136);
    expect(new Set(tiles).size).toBe(136); // every tile exists exactly once
  });

  it('agrees with everything the viewer can see', () => {
    const real = midHand();
    const view = toPublicView(real, 0);
    const d = determinize(view, createRng(9))!;

    expect(d.wall.length).toBe(view.tilesRemaining);
    expect(d.doraIndicators).toEqual(view.doraIndicators);
    expect(d.players[0].hand).toEqual(view.hand);
    expect(d.players[0].drawnTile).toBe(view.drawnTile);
    for (const s of [0, 1, 2, 3] as SeatIndex[]) {
      const pv = view.seats[s];
      expect(d.players[s].river.map((r) => r.tile)).toEqual(pv.river.map((r) => r.tile));
      expect(d.players[s].melds).toEqual(pv.melds);
      expect(d.players[s].points).toBe(pv.points);
      expect(d.players[s].riichi).toBe(pv.riichi);
      expect(d.players[s].seatWind).toBe(pv.seatWind);
      // and it holds the right NUMBER of unknown tiles, not the right tiles
      expect(d.players[s].hand.length).toBe(pv.concealedCount);
    }
  });

  it('invents a different table every time, never the real one by design', () => {
    const real = midHand();
    const view = toPublicView(real, 0);
    const rng = createRng(3);
    const a = determinize(view, rng)!;
    const b = determinize(view, rng)!;
    expect(a.players[1].hand).not.toEqual(b.players[1].hand);
    // the viewer's own hand is knowledge, so it is identical in both
    expect(a.players[0].hand).toEqual(b.players[0].hand);
  });

  it('never places a tile the viewer has already seen into a hidden hand', () => {
    const real = midHand();
    const view = toPublicView(real, 0);
    const d = determinize(view, createRng(11))!;
    const seen = new Set<TileId>([...view.hand, ...view.doraIndicators]);
    if (view.drawnTile !== null) seen.add(view.drawnTile);
    for (const s of [0, 1, 2, 3] as SeatIndex[]) {
      for (const m of view.seats[s].melds) for (const t of m.tiles) seen.add(t);
      for (const r of view.seats[s].river) seen.add(r.tile);
    }
    const hidden = [...d.players.slice(1).flatMap((p) => p.hand), ...d.wall];
    for (const t of hidden) expect(seen.has(t)).toBe(false);
  });
});

describe('simulateFullGames', () => {
  it('plays hands to a real conclusion and reports what happened', () => {
    const view = toPublicView(midHand(), 0);
    const r = simulateFullGames(view, { runs: 8, seed: 4 });
    expect(r.runs).toBe(8);
    expect(r.wins + r.dealIns + r.draws).toBeLessThanOrEqual(r.runs);
    expect(r.wins).toBeGreaterThanOrEqual(0);
    // every reported yaku was in a hand the viewer actually won
    for (const y of r.yaku) expect(y.hits).toBeLessThanOrEqual(r.wins);
    expect(r.meanPoints).toBeGreaterThanOrEqual(0);
  }, 60000);

  it('reports progress as it goes, so a long run stays usable', () => {
    const view = toPublicView(midHand(), 0);
    const seen: number[] = [];
    simulateFullGames(view, {
      runs: 4, seed: 6, onProgress: (done, total) => { seen.push(done); expect(total).toBe(4); },
    });
    expect(seen).toEqual([1, 2, 3, 4]);
  }, 60000);

  it('is deterministic for a seed', () => {
    const view = toPublicView(midHand(), 0);
    const a = simulateFullGames(view, { runs: 4, seed: 12 });
    const b = simulateFullGames(view, { runs: 4, seed: 12 });
    expect(a).toEqual(b);
  }, 60000);

  it('produces outcomes in the same ballpark as replaying the true position', () => {
    // The determinized tables should behave like the real one: if they did
    // not, the deep mode would be measuring a different game. Compared loosely
    // — this is a smoke test on a small sample, not a statistical claim.
    const real = midHand();
    const view = toPublicView(real, 0);
    const RUNS = 12;

    let control = 0;
    for (let i = 0; i < RUNS; i++) {
      const c: GameState = { ...real, wall: [...real.wall] };
      const rng = createRng(i + 1);
      for (let j = c.wall.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1));
        [c.wall[j], c.wall[k]] = [c.wall[k], c.wall[j]];
      }
      let s = c;
      for (let step = 0; step < 400 && !s.handOver && !s.matchOver; step++) {
        const next = stepOnce(s);
        if (next === s) break;
        s = next;
      }
      if (s.handOver?.reason === 'exhaustiveDraw') control++;
    }
    const sim = simulateFullGames(view, { runs: RUNS, seed: 21 });
    const simDraws = sim.draws;
    // Both should mostly run to exhaustion or mostly not; a gross mismatch
    // (all vs none) would mean the invented tables are not playable hands.
    expect(Math.abs(control - simDraws)).toBeLessThanOrEqual(RUNS * 0.6);
  }, 120000);
});
