/**
 * The table roster — nine opponents, three per archetype.
 *
 * Yakuza-flavoured but generic (no copyrighted character lore). Each tagline
 * honestly telegraphs how the seat plays: knowing who you are sitting against
 * is half of riichi, and a bot whose behaviour you cannot learn is just noise.
 *
 * Archetype sets the shape of a player; `tune` gives each of the three within
 * an archetype its own edge, so "aggressive" is a family rather than a clone.
 */
import type { Personality } from './types';

export const PERSONALITIES: Personality[] = [
  // --- aggressive ----------------------------------------------------------
  {
    id: 'kenta',
    name: 'Kenta the Rush',
    archetype: 'aggressive',
    tagline:
      'Calls pon and chi early to slap together fast, cheap hands. Riichi the instant he is tenpai, and he will not back down — he deals in more than anyone at the table.',
    tune: { callGreed: 0.9, riichiPatience: 0.02 },
  },
  {
    id: 'ryu',
    name: 'Ryu the Hammer',
    archetype: 'aggressive',
    tagline:
      'Plays closed and swings for the fences: dora, big waits, expensive hands. Rarely calls, never folds, and punishes anyone who feeds him.',
    tune: { callGreed: 0.25, riichiPatience: 0.15, defenseThreshold: 0.95 },
  },
  {
    id: 'goro',
    name: 'Goro the Bulldozer',
    archetype: 'aggressive',
    tagline:
      'Takes every call that moves the hand forward and pushes through declared riichi without blinking. Fast, loud, and reckless with his stack.',
    tune: { callGreed: 0.95, defenseThreshold: 0.98, efficiencyNoise: 0.16 },
  },

  // --- balanced ------------------------------------------------------------
  {
    id: 'sada',
    name: 'Sada the Steady',
    archetype: 'balanced',
    tagline:
      'Reads the table, calls only when it clearly buys speed or value, and folds when the maths turns against him. The benchmark for solid play.',
  },
  {
    id: 'mika',
    name: 'Mika the Ledger',
    archetype: 'balanced',
    tagline:
      'An accountant at the table. Counts safe tiles, values her hand honestly, and takes the small certain profit over the big gamble every time.',
    tune: { riichiPatience: 0.62, efficiencyNoise: 0.06, defenseThreshold: 0.38 },
  },
  {
    id: 'hoshi',
    name: 'Hoshi the Gambler',
    archetype: 'balanced',
    tagline:
      'Solid until she smells a big hand, then she chases it. Calls for yakuhai and dora, holds dama when the hand is already worth the wait.',
    tune: { callGreed: 0.62, riichiPatience: 0.7 },
  },

  // --- defensive -----------------------------------------------------------
  {
    id: 'tsuru',
    name: 'Tsuru the Wall',
    archetype: 'defensive',
    tagline:
      'Closed, patient, and very hard to deal into. Holds strong shapes, waits for value, and slips out on genbutsu and suji the moment danger shows.',
  },
  {
    id: 'ito',
    name: 'Ito the Undertaker',
    archetype: 'defensive',
    tagline:
      'Folds early and completely. He will happily take a noten penalty rather than hand you a mangan, and he almost never pays out.',
    tune: { defenseThreshold: 0.12, riichiPatience: 0.9, callGreed: 0.08 },
  },
  {
    id: 'nao',
    name: 'Nao the Needle',
    archetype: 'defensive',
    tagline:
      'Quiet, cheap and quick. Opens for a single yakuhai, takes tenpai for the penalty payment, and wins small hands off you all evening.',
    tune: { callGreed: 0.5, riichiPatience: 0.5, defenseThreshold: 0.3 },
  },
];

export function personalityById(id: string): Personality {
  const p = PERSONALITIES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown personality id: ${id}`);
  return p;
}

/** One representative of each archetype, in a stable order. */
export const ARCHETYPE_SAMPLE: Personality[] = ['aggressive', 'balanced', 'defensive']
  .map((a) => PERSONALITIES.find((p) => p.archetype === a)!);

/** The default three-seat table when the player has not chosen. */
export const DEFAULT_OPPONENTS: string[] = ARCHETYPE_SAMPLE.map((p) => p.id);
