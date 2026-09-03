/**
 * SHARED CONTRACT — AI player model types. Owned by Worker B.
 */
import type { Action, LegalAction, PublicView } from '@engine/types';

export type Archetype = 'aggressive' | 'balanced' | 'defensive';

/** Tunable knobs; archetype × difficulty resolves to one of these. */
export interface AIParams {
  /** 0-1 chance of picking a sub-optimal efficiency choice. */
  efficiencyNoise: number;
  /** 0-1 eagerness to call pon/chi. */
  callGreed: number;
  /** 0-1 opponent-threat level at which it starts folding. */
  defenseThreshold: number;
  /** 0-1; higher = waits longer / prefers dama. */
  riichiPatience: number;
  /** 0-1; higher = more obvious tells (low = subtle). */
  tellSubtlety: number;
  /** 0-1 chance of deviating from archetype (Hard only). */
  deviation: number;
}

export interface Personality {
  id: string;
  name: string;
  archetype: Archetype;
  /** One-line style description shown at match start. */
  tagline: string;
}

export interface AIDecision {
  action: Action;
  /** Debug only; never surfaced to the player during live play. */
  rationale?: string;
}

export interface AIPlayer {
  personality: Personality;
  params: AIParams;
  /** Choose among the legal actions using ONLY the public view. */
  decide(view: PublicView, legal: LegalAction[]): AIDecision;
}
