/**
 * A fan-made Yakuza / Like a Dragon roster. These mahjong styles are imagined
 * for the trainer, not claims about the characters' canonical playing ability.
 * Eighteen regulars (six per level) and four opt-in Special opponents. Special
 * means a different decision rule, not a harder tier; each has its own estimate.
 */
import type { Difficulty, TableSettings } from '@engine/types';
import type { Personality, RosterDifficulty } from './types';

export const DIFFICULTY_LABEL: Record<RosterDifficulty, string> = {
  special: 'Special', easy: 'Easy', normal: 'Medium', hard: 'Hard',
};

export const PERSONALITIES: Personality[] = [
  // --- easy: readable habits and room to make mistakes ----------------------
  {
    id: 'shinji', name: 'Shinji Tanaka', shortName: 'Shinji', title: 'Eager enforcer',
    archetype: 'aggressive', difficulty: 'easy',
    tagline: 'Calls first, thinks later. Chases quick open hands and declares riichi without much fear of a counterattack.',
    tell: 'Frequent early calls; a riichi rarely makes him back off.',
    tune: { callGreed: 0.9, riichiPatience: 0.02, valueGreed: 0.2, kanGreed: 0.45 },
  },
  {
    id: 'rikiya', name: 'Rikiya Shimabukuro', shortName: 'Rikiya', title: 'Heart before head',
    archetype: 'aggressive', difficulty: 'easy',
    tagline: 'Loves honor pairs and a good pon. Protects his favorite tiles a little too long and pushes with more heart than caution.',
    tell: 'Honor pons and stubborn pairs give his direction away.',
    tune: { callGreed: 0.82, defenseThreshold: 0.9, pairBias: 0.65, valueGreed: 0.65, efficiencyNoise: 0.12 },
  },
  {
    id: 'yuya', name: 'Yuya', shortName: 'Yuya', title: 'Opening act',
    archetype: 'balanced', difficulty: 'easy',
    tagline: 'Prefers straightforward, inexpensive hands. Happy to trade value for speed, but loose shapes leave plenty of openings.',
    tell: 'Quick, cheap calls rather than a long build-up.',
    tune: { callGreed: 0.62, valueGreed: 0.12, riichiPatience: 0.3, efficiencyNoise: 0.12 },
  },
  {
    id: 'shinada', name: 'Tatsuo Shinada', shortName: 'Shinada', title: 'One more long shot',
    archetype: 'balanced', difficulty: 'easy',
    tagline: 'Hangs onto dora and dreams of a payday. His taste for pairs and big rewards can cost him a much simpler win.',
    tell: 'Dora stays in his hand even when the extra width would help.',
    tune: { valueGreed: 0.95, pairBias: 0.8, kanGreed: 0.6, efficiencyNoise: 0.14, defenseThreshold: 0.55 },
  },
  {
    id: 'nanba', name: 'Nanba', shortName: 'Nanba', title: 'Survival instinct',
    archetype: 'defensive', difficulty: 'easy',
    tagline: 'Keeps the hand closed and gets out of trouble early. Often gives up a promising shape rather than risk his points.',
    tell: 'Very few calls; safe discards appear as soon as pressure rises.',
    tune: { callGreed: 0.08, defenseThreshold: 0.12, riichiPatience: 0.85, pairBias: 0.5, efficiencyNoise: 0.13 },
  },
  {
    id: 'date', name: 'Makoto Date', shortName: 'Date', title: 'Old-school observer',
    archetype: 'defensive', difficulty: 'easy',
    tagline: 'Patient and cautious, but not always efficient. Trusts a safe exit more than a speculative win and rarely risks a kan.',
    tell: 'Quiet rivers and early retreats; give him time and he still gets there.',
    tune: { callGreed: 0.15, defenseThreshold: 0.2, kanGreed: 0.05, placementAwareness: 0.8 },
  },

  // --- medium: sound plans, distinct trade-offs -----------------------------
  {
    id: 'ichiban', name: 'Ichiban Kasuga', shortName: 'Ichiban', title: "The hero's gamble",
    archetype: 'aggressive', difficulty: 'normal',
    tagline: 'Builds momentum with fast calls and wide waits. Pushes harder from behind, especially when a dealer hand could turn the match.',
    tell: 'A losing score makes his already-bold play even more ambitious.',
    tune: { callGreed: 0.87, valueGreed: 0.3, defenseThreshold: 0.82, placementAwareness: 0.85, kanGreed: 0.5 },
  },
  {
    id: 'nishiki', name: 'Akira Nishikiyama', shortName: 'Nishikiyama', title: 'The rising koi',
    archetype: 'aggressive', difficulty: 'normal',
    tagline: 'Wants a hand worth showing off. Leans into a promising flush and hoards value, even when the faster route is less glamorous.',
    tell: 'Off-suit discards can betray a growing flush ambition.',
    tune: { callGreed: 0.56, flushBias: 0.95, valueGreed: 0.9, defenseThreshold: 0.88, riichiPatience: 0.25 },
  },
  {
    id: 'akiyama', name: 'Shun Akiyama', shortName: 'Akiyama', title: 'Easy money',
    archetype: 'balanced', difficulty: 'normal',
    tagline: 'Takes the clean, profitable route. Balances acceptance with value and only opens when the speed is worth the price.',
    tell: 'Measured calls; a valuable narrow hand may stay quietly in dama.',
    tune: { callGreed: 0.4, valueGreed: 0.65, riichiPatience: 0.58, efficiencyNoise: 0.08 },
  },
  {
    id: 'adachi', name: 'Koichi Adachi', shortName: 'Adachi', title: 'Patient detective',
    archetype: 'balanced', difficulty: 'normal',
    tagline: 'Builds around value honors and useful pairs. Watches the scoreboard and is happy to bank a small win when it serves his position.',
    tell: 'Honor calls are deliberate, and a lead makes him more careful.',
    tune: { pairBias: 0.55, valueGreed: 0.7, placementAwareness: 0.95, defenseThreshold: 0.4, kanGreed: 0.15 },
  },
  {
    id: 'saeko', name: 'Saeko Mukoda', shortName: 'Saeko', title: 'Cool under pressure',
    archetype: 'defensive', difficulty: 'normal',
    tagline: 'Small wins, clean exits. Opens for practical value or tenpai, then switches to safety rather than getting dragged into a fight.',
    tell: 'A quick open hand does not mean she is committed to pushing it.',
    tune: { callGreed: 0.5, defenseThreshold: 0.3, riichiPatience: 0.5, valueGreed: 0.3, placementAwareness: 0.85 },
  },
  {
    id: 'seonhee', name: 'Seonhee', shortName: 'Seonhee', title: 'Quiet control',
    archetype: 'defensive', difficulty: 'normal',
    tagline: 'Likes closed value and an understated flush. Keeps expensive hands quiet when they can already win, and avoids unnecessary kans.',
    tell: 'Few calls and off-suit releases; silence is not the same as safety.',
    tune: { callGreed: 0.14, flushBias: 0.7, valueGreed: 0.8, riichiPatience: 0.9, kanGreed: 0.05 },
  },

  // --- hard: precise execution without erasing character -------------------
  {
    id: 'majima', name: 'Goro Majima', shortName: 'Majima', title: 'Mad Dog of Shimano',
    archetype: 'aggressive', difficulty: 'hard',
    tagline: 'Fast, sharp, and hard to pin down. Mixes near-equal discards, loves a sound kan, and keeps attacking long after cautious players leave.',
    tell: 'Varied discards and bold kans, but never random tile throwing.',
    tune: { callGreed: 0.9, defenseThreshold: 0.96, riichiPatience: 0.04, kanGreed: 0.95, deviation: 0.38, efficiencyNoise: 0.08 },
  },
  {
    id: 'saejima', name: 'Taiga Saejima', shortName: 'Saejima', title: 'Tiger of Sasai',
    archetype: 'aggressive', difficulty: 'hard',
    tagline: 'Patient construction, heavy impact. Protects pairs and closed value, then commits hard when a strong hand is close to completion.',
    tell: 'Fewer calls than other attackers; pairs and dora carry real weight.',
    tune: { callGreed: 0.22, pairBias: 0.95, valueGreed: 0.85, defenseThreshold: 0.92, riichiPatience: 0.3, kanGreed: 0.7 },
  },
  {
    id: 'kiryu', name: 'Kazuma Kiryu', shortName: 'Kiryu', title: 'Dragon of Dojima',
    archetype: 'balanced', difficulty: 'hard',
    tagline: 'Disciplined shapes and decisive riichi. Preserves closed value, respects real threats, and adjusts his risks to the score rather than his pride.',
    tell: 'Rare wasted discards; his calls usually buy something substantial.',
    tune: { callGreed: 0.28, efficiencyNoise: 0.06, valueGreed: 0.65, defenseThreshold: 0.46, placementAwareness: 1, kanGreed: 0.25 },
  },
  {
    id: 'ryuji', name: 'Ryuji Goda', shortName: 'Ryuji', title: 'Dragon of Kansai',
    archetype: 'aggressive', difficulty: 'hard',
    tagline: 'Hunts big hands with ruthless efficiency. Favors dora and well-supported flushes, and makes you pay for challenging a loaded hand.',
    tell: 'Off-suit tiles go first when his hand is leaning toward a flush.',
    tune: { callGreed: 0.35, flushBias: 0.9, valueGreed: 1, defenseThreshold: 0.95, riichiPatience: 0.18, kanGreed: 0.6 },
  },
  {
    id: 'daigo', name: 'Daigo Dojima', shortName: 'Daigo', title: 'The sixth chairman',
    archetype: 'defensive', difficulty: 'hard',
    tagline: 'Plays the match, not just the hand. Protects a final-round lead, pursues a needed comeback, and avoids giving away a winning position.',
    tell: 'The scoreboard changes his appetite for risk more than most.',
    tune: { callGreed: 0.25, defenseThreshold: 0.3, placementAwareness: 1, riichiPatience: 0.72, valueGreed: 0.6, kanGreed: 0.08 },
  },
  {
    id: 'kashiwagi', name: 'Osamu Kashiwagi', shortName: 'Kashiwagi', title: 'Iron composure',
    archetype: 'defensive', difficulty: 'hard',
    tagline: 'A precise, patient defender. Checks safety against every threatening seat, keeps useful pairs, and refuses needless kan exposure.',
    tell: 'Careful retreats and very few calls; hard to bait into a bad push.',
    tune: { callGreed: 0.1, defenseThreshold: 0.18, pairBias: 0.6, riichiPatience: 0.85, efficiencyNoise: 0.06, kanGreed: 0.02 },
  },

  // --- special: deliberately unusual rules, not a fourth strength tier -------
  {
    id: 'nugget', name: 'Nugget', shortName: 'Nugget', title: 'Fowl play',
    archetype: 'aggressive', difficulty: 'easy',
    special: { style: 'selfSabotage', rule: 'Actively self-sabotaging', estimatedDifficulty: 'Very easy — intentionally terrible' },
    tagline: 'A brilliant real-estate hire. A catastrophic mahjong player. Pecks apart useful shapes, throws away value, and turns down wins instead of taking them.',
    tell: 'No calls, no riichi, no voluntary wins. Even a perfect hand is not safe from this chicken.',
    tune: { defenseThreshold: 0.98, valueGreed: 0, callGreed: 0.05 },
  },
  {
    id: 'shakedown', name: 'Mr. Shakedown', shortName: 'Shakedown', title: 'Hiroya Egashira · Mangan or nothing',
    archetype: 'aggressive', difficulty: 'normal',
    special: { style: 'manganMinimum', rule: 'Visible mangan minimum', estimatedDifficulty: 'Medium — very swingy' },
    tagline: 'Small change is not worth collecting. Refuses wins below a visible mangan and will slow a hand down to keep extra dora. A payday or a wasted evening.',
    tell: 'His floor is 8,000 points, or 12,000 as dealer, before honba and sticks. Hidden ura never counts toward his demand.',
    tune: { callGreed: 0.2, defenseThreshold: 0.86, riichiPatience: 0.1, valueGreed: 1, flushBias: 0.85, kanGreed: 0.65 },
  },
  {
    id: 'komaki', name: 'Sotaro Komaki', shortName: 'Komaki', title: 'Tiger Drop',
    archetype: 'defensive', difficulty: 'normal',
    special: { style: 'ronOnly', rule: 'Counterattacks only', estimatedDifficulty: 'Medium — silent ron traps' },
    tagline: 'Waits for you to make the first mistake. Never opens, never declares riichi, and refuses tsumo. Builds natural-yaku ron waits and reshapes when furiten blocks the counter.',
    tell: 'No calls does not mean no threat. He can pass a winning self-draw, but will take a legal ron.',
    tune: { callGreed: 0.05, defenseThreshold: 0.32, riichiPatience: 0.95, valueGreed: 0.65, pairBias: 0.5, kanGreed: 0 },
  },
  {
    id: 'pocket-fighter', name: 'Pocket Circuit Fighter', shortName: 'Fighter', title: 'Redline / pit stop',
    archetype: 'balanced', difficulty: 'normal',
    special: { style: 'gearShift', rule: 'Three-turn gear shifts', estimatedDifficulty: 'Easy–Medium — a readable rhythm' },
    tagline: 'Races through three attacking discards, then spends three on safety-first pit stops. Repeats the cycle all hand, whether or not the timing is sensible.',
    tell: 'Count his river: three redline turns, three pit stops. Always takes wins; a declared riichi still locks his discards.',
    tune: { efficiencyNoise: 0.1, valueGreed: 0.3, placementAwareness: 0.2 },
  },
];

/** Display/filter category. Specials keep their estimates in their descriptions. */
export function rosterDifficulty(personality: Pick<Personality, 'difficulty' | 'special'>): RosterDifficulty {
  return personality.special ? 'special' : personality.difficulty;
}

/** Regular quick tables never silently include a self-sabotaging novelty bot. */
export const REGULAR_PERSONALITIES = PERSONALITIES.filter((p) => !p.special);
export const SPECIAL_PERSONALITIES = PERSONALITIES.filter((p) => p.special);

export function personalityById(id: string): Personality {
  const p = PERSONALITIES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown personality id: ${id}`);
  return p;
}

/** Explicit representatives so adding/reordering cards cannot change benchmarks. */
export const ARCHETYPE_SAMPLE: Personality[] = ['shinji', 'akiyama', 'date'].map(personalityById);

/** Right, across, left: one of each native difficulty and archetype. */
export const DEFAULT_OPPONENTS: [string, string, string] = ['ichiban', 'kiryu', 'date'];

export function opponentDifficulty(
  personality: Personality,
  settings: Pick<TableSettings, 'difficulty' | 'opponentDifficulty'>,
): Difficulty {
  return settings.opponentDifficulty === 'uniform' ? settings.difficulty : personality.difficulty;
}
