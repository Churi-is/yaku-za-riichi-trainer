/** Shared AI contract. All decisions consume public information only. */
import type { Action, Difficulty, LegalAction, PublicView } from '@engine/types';

export type Archetype = 'aggressive' | 'balanced' | 'defensive';

/** Opt-in novelty rules, not an extra execution/difficulty tier. */
export type SpecialStyle = 'selfSabotage' | 'manganMinimum' | 'ronOnly' | 'gearShift';
export interface SpecialPersonality {
  style: SpecialStyle;
  rule: string;
  /** Approximate native strength, deliberately separate from the Special badge. */
  estimatedDifficulty: string;
}
export type RosterDifficulty = Difficulty | 'special';

/** Personality tendencies × execution level. All numeric knobs are 0–1. */
export interface AIParams {
  archetype: Archetype;
  /** Chance of an efficiency mistake, not a random illegal action. */
  efficiencyNoise: number;
  callGreed: number;
  /** Higher = willing to push into more danger. */
  defenseThreshold: number;
  /** Higher = more willing to keep a valuable hand in dama. */
  riichiPatience: number;
  /** Chance of varying between near-equivalent, same-shanten discards. */
  deviation: number;
  /** Retain dora and value honors rather than always choosing maximum speed. */
  valueGreed: number;
  /** Favor a flush when the dealt hand already has a dominant suit. */
  flushBias: number;
  /** Preserve pairs for chiitoitsu / toitoi when the shape supports it. */
  pairBias: number;
  kanGreed: number;
  /** Execution strength of risk-aware discard tie-breaking. */
  safetyAwareness: number;
  /** Adjust risk to dealer status and final-round point standings. */
  placementAwareness: number;
}

export interface Personality {
  id: string;
  name: string;
  /** Compact name for the seating diagram. */
  shortName: string;
  title: string;
  archetype: Archetype;
  /** Native execution level; Specials display their separate category instead. */
  difficulty: Difficulty;
  special?: SpecialPersonality;
  tagline: string;
  /** Learnable tendency, not a claim to know the concealed hand. */
  tell: string;
  /** Normal-level tendencies, scaled by difficulty AFTER tuning. */
  tune?: Partial<Pick<AIParams,
    'callGreed' | 'defenseThreshold' | 'riichiPatience' | 'efficiencyNoise'
    | 'valueGreed' | 'flushBias' | 'pairBias' | 'kanGreed'
    | 'placementAwareness' | 'deviation'>>;
}

export interface AIDecision {
  action: Action;
  /** Debug only; never reveals live hand analysis to the human player. */
  rationale?: string;
}

export interface AIPlayer {
  params: AIParams;
  decide(view: PublicView, legal: LegalAction[]): AIDecision;
}
