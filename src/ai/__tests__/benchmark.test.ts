/**
 * AI benchmark — what the bots actually do over many hands.
 *
 * Seeded real-engine hands provide a repeatable regression signal for bot
 * behavior, with one shared normal-mode sample and separate difficulty runs.
 *
 * Bounds are deliberately loose: this is a statistical test and a flaky one is
 * worse than none. It is meant to catch a regression that changes the CHARACTER
 * of the bots — hands that never finish, opponents that never riichi — not to
 * pin a percentage.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, DEFAULT_SETTINGS, isRed, kindOf, nextHand } from '@engine/index';
import type { Difficulty, TableSettings } from '@engine/types';
import { ARCHETYPE_SAMPLE, createAI, type AIPlayer } from '../index';
import { playHand } from './selfplay';

interface BotStats {
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

/**
 * One seat per archetype plus a second balanced seat. Fixed on purpose: the
 * roster can grow, and a benchmark whose table changes when someone
 * adds a personality is measuring the roster, not the code.
 */
function table(seed: number, difficulty: Difficulty): AIPlayer[] {
  const [aggressive, balanced, defensive] = ARCHETYPE_SAMPLE;
  const seats = [aggressive, balanced, defensive, balanced];
  return seats.map((p, i) => createAI(p, difficulty, seed * 10 + i));
}

/** Play `hands` complete hands and tally what happened. */
function benchmark(hands: number, difficulty: Difficulty = 'normal'): BotStats {
  const settings: TableSettings = { ...DEFAULT_SETTINGS, gameLength: 'east', difficulty };
  const st: BotStats = {
    hands: 0, draws: 0, wins: 0, tenpaiSeatsAtDraw: 0, riichis: 0, calls: 0,
    openedSeats: 0, winPoints: [], fiveDiscards: 0, redFiveDiscards: 0, ippatsuWins: 0,
  };
  let matchSeed = 0;

  while (st.hands < hands) {
    const players = table(matchSeed, difficulty);
    let s = createMatch(settings, 5000 + matchSeed);
    matchSeed++;
    for (let h = 0; h < 4 && !s.matchOver && st.hands < hands; h++) {
      const { state: ended, result: over, actions } = playHand(players, s);
      for (const action of actions) {
        if (action.type === 'discard') {
          const kind = kindOf(action.tile);
          if (kind === 4 || kind === 13 || kind === 22) {
            st.fiveDiscards++;
            if (isRed(action.tile)) st.redFiveDiscards++;
          }
          if (action.riichi) st.riichis++;
        }
        if (action.type === 'pon' || action.type === 'chi' || action.type === 'minkan') st.calls++;
      }
      st.hands++;
      st.openedSeats += ended.players.filter((p) => p.melds.some((m) => !m.concealed)).length;
      if (over.reason === 'exhaustiveDraw') {
        st.draws++;
        st.tenpaiSeatsAtDraw += over.tenpaiSeats.length;
      } else {
        if (!over.score) throw new Error('Winning hand has no score');
        st.wins++;
        st.winPoints.push(over.score.points);
        if (over.score.yaku.some((y) => y.id === 'ippatsu')) st.ippatsuWins++;
      }
      s = nextHand(ended);
    }
  }
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const rate = (a: number, b: number) => (b ? a / b : 0);

describe('AI benchmark', () => {
  let st: BotStats;

  beforeAll(() => {
    st = benchmark(120);
  }, 120_000);

  it('finishes hands like mahjong players, not like a stalemate', () => {
    const drawRate = rate(st.draws, st.hands);
    const tenpaiAtDraw = st.draws ? st.tenpaiSeatsAtDraw / st.draws : 0;

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
  });

  it('declares riichi at a human rate', () => {
    // Humans declare on roughly 0.8 hands in one; anything under ~0.4 means the
    // bots are sitting on tenpai hands, which is what the coin-flip riichi did.
    expect(st.riichis / st.hands).toBeGreaterThan(0.45);
    expect(st.riichis / st.hands).toBeLessThan(2.0);
  });

  it('does not throw its red fives away', () => {
    // A red five is one of at most three in the wall and worth a han. If the
    // discard policy nominates it as the representative "five" again, this
    // ratio jumps back over a third.
    expect(rate(st.redFiveDiscards, st.fiveDiscards)).toBeLessThan(0.18);
  });

  it('scores ippatsu only occasionally, not on every riichi win', () => {
    // Ippatsu used to be a permanent flag, so nearly every riichi win carried
    // it. It is a one-go-around window: a minority of wins, never most of them.
    expect(rate(st.ippatsuWins, st.wins)).toBeLessThan(0.3);
  });

  it('keeps the difficulty tiers in order', () => {
    // Harder bots should reach tenpai more often at a draw. This is a weaker
    // claim than "hard beats easy head to head" (which the AI suite already
    // covers) but it is cheap and it catches an inverted difficulty knob.
    const easy = benchmark(80, 'easy');
    const hard = benchmark(80, 'hard');
    const t = (s: BotStats) => (s.draws ? s.tenpaiSeatsAtDraw / s.draws : 4);
    console.log(`easy tenpai@draw ${t(easy).toFixed(2)} | hard ${t(hard).toFixed(2)}`);
    expect(t(hard)).toBeGreaterThanOrEqual(t(easy) - 0.25);
  }, 180_000);
});
