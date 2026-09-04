/**
 * Replay log WRITER (Worker D). The schema lives in replay/types.ts (Worker C);
 * this module builds those records as a match is played.
 *
 * A MatchLogBuilder accumulates per-hand action entries and finalized HandLogs,
 * plus practice-mode wait guesses. The game loop calls into it; grading (Worker
 * C) and the replay UI (Worker D) read the finished MatchLog back out.
 */
import type {
  Action, HandResult, SeatIndex, TableSettings, TileId, PublicView, Wind,
} from '@engine/types';
import type { ActionLogEntry, HandLog, MatchLog } from './types';
import type { WaitGuessRecord } from '@analysis/types';

export class MatchLogBuilder {
  private settings: TableSettings;
  private hands: HandLog[] = [];
  private waitGuesses: WaitGuessRecord[] = [];

  // current hand accumulation
  private handId = -1;
  private roundWind: Wind = 'east';
  private roundNumber = 1;
  private honba = 0;
  private dealer: SeatIndex = 0;
  private entries: ActionLogEntry[] = [];
  private seq = 0;

  constructor(settings: TableSettings) {
    this.settings = settings;
  }

  /** Begin a new hand's log. */
  beginHand(meta: { handId: number; roundWind: Wind; roundNumber: number; honba: number; dealer: SeatIndex }) {
    this.handId = meta.handId;
    this.roundWind = meta.roundWind;
    this.roundNumber = meta.roundNumber;
    this.honba = meta.honba;
    this.dealer = meta.dealer;
    this.entries = [];
    this.seq = 0;
  }

  /**
   * Record one applied action. `viewBefore` MUST be the HUMAN seat's public
   * view captured immediately before the action (grading reruns analysis from
   * it); pass it for human actions, null is acceptable for AI actions but we
   * still snapshot the human view so the timeline has context.
   */
  record(seat: SeatIndex, action: Action, viewBefore: PublicView | null) {
    this.entries.push({
      handId: this.handId,
      seq: this.seq++,
      seat,
      action,
      viewBefore,
    });
  }

  /** Finalize the current hand with its engine result + revealed hands. */
  endHand(result: HandResult) {
    const log: HandLog = {
      handId: this.handId,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      honba: this.honba,
      dealer: this.dealer,
      entries: this.entries,
      result,
      revealedHands: result.revealedHands,
    };
    this.hands.push(log);
  }

  addWaitGuess(record: WaitGuessRecord) {
    this.waitGuesses.push(record);
  }

  /** Replace the wait-guess list (e.g. after round-end resolution). */
  setWaitGuesses(records: WaitGuessRecord[]) {
    this.waitGuesses = records;
  }

  getWaitGuesses(): WaitGuessRecord[] {
    return this.waitGuesses;
  }

  /** All entries across finished hands plus the in-progress hand. */
  allEntries(): ActionLogEntry[] {
    const finished = this.hands.flatMap((h) => h.entries);
    return [...finished, ...this.entries];
  }

  getHands(): HandLog[] {
    return this.hands;
  }

  build(): MatchLog {
    return {
      settings: this.settings,
      hands: this.hands,
      waitGuesses: this.waitGuesses,
    };
  }
}

/** Convenience for computing the winning tile ids present in a hand log. */
export function humanTurnCount(log: MatchLog): number {
  let n = 0;
  for (const h of log.hands) {
    for (const e of h.entries) {
      if (e.seat === 0 && (e.action.type === 'discard' || e.action.type === 'chi'
        || e.action.type === 'pon' || e.action.type === 'ankan' || e.action.type === 'minkan'
        || e.action.type === 'kakan' || e.action.type === 'ron' || e.action.type === 'tsumo')) n++;
    }
  }
  return n;
}

export type { TileId };
