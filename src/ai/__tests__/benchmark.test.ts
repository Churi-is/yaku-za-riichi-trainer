/**
 * AI benchmark — what the bots actually do over many hands.
 *
 * The audit that motivated the overhaul (docs/bot-audit.md) was run from a
 * throwaway script, which meant the numbers were reproducible only by whoever
 * still had the script. They are the clearest signal we have of whether these
 * opponents play mahjong, so they live here now.
 *
 * Bounds are deliberately loose: this is a statistical test and a flaky one is
 * worse than none. It is meant to catch a regression that changes the CHARACTER
 * of the bots — hands that never finish, opponents that never riichi — not to
 * pin a percentage.
 */
import { describe, expect, it } from 'vitest';
import {
  applyAction, createMatch, DEFAULT_SETTINGS, getLegalActions, isTerminalOrHonor,
  kindOf, nextHand, RED_FIVE_IDS, toPublicView,
} from '@engine/index';
import type {
  Action, Difficulty, GameState, SeatIndex, TableSettings,
} from '@engine/types';
import { createAI, PERSONALITIES, type AIPlayer } from '../index';

export interface BotStats {
  hands: number;
  draws: number;
  wins: number;
  tenpaiSeatsAtDraw: number;
  riichis: number;
  calls: number;
  openedSeats: number;
  winPoints: number[];
  fiveDiscards: number;
  redFiveDiscards: number;
  ippatsuWins: number;
}

function table(seed: number, difficulty: Difficulty): AIPlayer[] {
  return [0, 1, 2, 3].map((i) =>
    createAI(PERSONALITIES[i % PERSONALITIES.length], difficulty, seed * 10 + i));
}

/** Play `hands` complete hands and tally what happened. */
export function benchmark(hands: number, difficulty: Difficulty = 'normal'): BotStats {
  const settings: TableSettings = { ...DEFAULT_SETTINGS, gameLength: 'east', difficulty };
  const st: BotStats = {
    hands: 0, draws: 0, wins: 0, tenpaiSeatsAtDraw: 0, riichis: 0, calls: 0,
    openedSeats: 0, winPoints: [], fiveDiscards: 0, redFiveDiscards: 0, ippatsuWins: 0,
  };
  const red = new Set<number>(RED_FIVE_IDS);
  let matchSeed = 0;

  while (st.hands < hands) {
    const players = table(matchSeed, difficulty);
    let s: GameState = createMatch(settings, 5000 + matchSeed);
    matchSeed++;
    for (let h = 0; h < 4 && !s.matchOver && st.hands < hands; h++) {
      const meldsBefore = s.players.map((p) => p.melds.length);
      let guard = 0;
      while (!s.handOver && !s.matchOver && guard++ < 600) {
        let acted = false;
        for (const seat of [0, 1, 2, 3] as SeatIndex[]) {
          const legal = getLegalActions(s, seat);
          if (legal.length === 0) continue;
          let a: Action;
          try {
            a = players[seat].decide(toPublicView(s, seat), legal).action;
          } catch {
            a = legal[0].action;
          }
          if (a.type === 'discard') {
            const k = kindOf(a.tile);
            if (k === 4 || k === 13 || k === 22) {
              st.fiveDiscards++;
              if (red.has(a.tile)) st.redFiveDiscards++;
            }
            if (a.riichi) st.riichis++;
          }
          if (a.type === 'pon' || a.type === 'chi' || a.type === 'minkan') st.calls++;
          s = applyAction(s, a);
          acted = true;
          break;
        }
        if (!acted) break;
      }
      const over = s.handOver;
      if (over) {
        st.hands++;
        for (let i = 0; i < 4; i++) {
          if (s.players[i].melds.length > meldsBefore[i]) st.openedSeats++;
        }
        if (over.reason === 'exhaustiveDraw') {
          st.draws++;
          st.tenpaiSeatsAtDraw += over.tenpaiSeats.length;
        } else if (over.score) {
          st.wins++;
          st.winPoints.push(over.score.points);
          if (over.score.yaku.some((y) => y.id === 'ippatsu')) st.ippatsuWins++;
        }
      }
      if (!s.matchOver && s.handOver) s = nextHand(s);
    }
  }
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (a: number, b: number) => (b ? a / b : 0);

describe('AI benchmark', () => {
  const HANDS = 120;

  it('finishes hands like mahjong players, not like a stalemate', () => {
    const st = benchmark(HANDS);
    const drawRate = rate(st.draws, st.hands);
    const tenpaiAtDraw = st.draws ? st.tenpaiSeatsAtDraw / st.draws : 0;

    // eslint-disable-next-line no-console
    console.log(
      `hands ${st.hands} | draws ${(100 * drawRate).toFixed(1)}% `
      + `| tenpai@draw ${tenpaiAtDraw.toFixed(2)}/4 `
      + `| riichi ${(st.riichis / st.hands).toFixed(2)}/hand `
      + `| calls ${(st.calls / st.hands).toFixed(2)}/hand `
      + `| opened ${(st.openedSeats / st.hands).toFixed(2)}/hand `
      + `| mean win ${mean(st.winPoints).toFixed(0)} `
      + `| ippatsu ${st.ippatsuWins}/${st.wins} wins`,
    );

    // Real tables draw about one hand in six. Before the overhaul these bots
    // drew 58% of hands, so this bound is the regression that matters.
    expect(drawRate).toBeLessThan(0.4);
    // And when a hand does expire, more than one seat should have got there.
    expect(tenpaiAtDraw).toBeGreaterThan(1.1);
  }, 120_000);

  it('declares riichi at a human rate', () => {
    const st = benchmark(HANDS);
    // Humans declare on roughly 0.8 hands in one; anything under ~0.4 means the
    // bots are sitting on tenpai hands, which is what the coin-flip riichi did.
    expect(st.riichis / st.hands).toBeGreaterThan(0.45);
    expect(st.riichis / st.hands).toBeLessThan(2.0);
  }, 120_000);

  it('does not throw its red fives away', () => {
    const st = benchmark(HANDS);
    // A red five is one of at most three in the wall and worth a han. If the
    // discard policy nominates it as the representative "five" again, this
    // ratio jumps back over a third.
    expect(rate(st.redFiveDiscards, st.fiveDiscards)).toBeLessThan(0.18);
  }, 120_000);

  it('scores ippatsu only occasionally, not on every riichi win', () => {
    const st = benchmark(HANDS);
    // Ippatsu used to be a permanent flag, so nearly every riichi win carried
    // it. It is a one-go-around window: a minority of wins, never most of them.
    expect(rate(st.ippatsuWins, st.wins)).toBeLessThan(0.3);
  }, 120_000);

  it('keeps the difficulty tiers in order', () => {
    // Harder bots should reach tenpai more often at a draw. This is a weaker
    // claim than "hard beats easy head to head" (which the AI suite already
    // covers) but it is cheap and it catches an inverted difficulty knob.
    const easy = benchmark(80, 'easy');
    const hard = benchmark(80, 'hard');
    const t = (s: BotStats) => (s.draws ? s.tenpaiSeatsAtDraw / s.draws : 4);
    // eslint-disable-next-line no-console
    console.log(`easy tenpai@draw ${t(easy).toFixed(2)} | hard ${t(hard).toFixed(2)}`);
    expect(t(hard)).toBeGreaterThanOrEqual(t(easy) - 0.25);
  }, 180_000);
});
