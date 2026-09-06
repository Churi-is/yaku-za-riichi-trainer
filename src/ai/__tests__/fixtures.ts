/** Public-only fixtures shared by AI regression tests. */
import type { LegalAction, Meld, PublicView, SeatIndex, TileId } from '@engine/types';
import { parseHand, kindOf, ownTiles } from '../handEval';

export interface SeatFix {
  hand?: string;          // tiles visible to viewer (own hand)
  melds?: Meld[];
  river?: string[];       // discarded tile notations (e.g. "4m")
  riichi?: boolean;
  riichiTurn?: number | null;
  concealedCount?: number;
}

const SUIT_BASE: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
const HONOR_CHARS: Record<string, number> = {
  E: 27, S: 28, W: 29, N: 30, P: 31, F: 32, C: 33,
};
export function tileNotationToId(tok: string): TileId {
  if (HONOR_CHARS[tok] !== undefined) return HONOR_CHARS[tok] * 4 + 1;
  const m = tok.match(/^(\d)([mpsz])$/);
  if (!m) throw new Error(`bad tile ${tok}`);
  const rank = Number(m[1]);
  const suit = m[2];
  const kind = suit === 'z' ? 27 + rank - 1 : SUIT_BASE[suit] + rank - 1;
  // avoid red-five copy (copy 0) for plain 5s in fixtures
  return kind * 4 + (rank === 5 && suit !== 'z' ? 1 : 0);
}

export function makeView(opts: {
  viewer?: SeatIndex;
  hand: string;
  melds?: Meld[];
  seats?: Partial<Record<SeatIndex, SeatFix>>;
  tilesRemaining?: number;
  doraIndicators?: string[];
}): PublicView {
  const viewer = opts.viewer ?? 0;
  const ownMelds = opts.melds ?? [];
  const hand = parseHand(opts.hand);

  const seats = {} as PublicView['seats'];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    const fix = opts.seats?.[s];
    const river = (fix?.river ?? []).map((tok, i) => ({
      tile: tileNotationToId(tok),
      tsumogiri: false,
      riichiDeclaration: fix?.riichi ? i === (fix.river ?? []).length - 1 : false,
      calledBy: null,
      turnNumber: i,
    }));
    const melds = fix?.melds ?? (s === viewer ? ownMelds : []);
    seats[s] = {
      seat: s,
      seatWind: (['east', 'south', 'west', 'north'] as const)[s],
      melds,
      river,
      points: 25000,
      riichi: fix?.riichi ?? false,
      riichiTurn: fix?.riichi ? (fix.riichiTurn ?? (river.length - 1)) : null,
      ippatsu: false,
      concealedCount: fix?.concealedCount ?? (s === viewer ? hand.length : 13),
      isClosed: melds.every((mm) => mm.concealed),
      aiPersonalityId: null,
    };
  }

  const visible = new Array(34).fill(0);
  for (const t of hand) visible[kindOf(t)]++;
  for (let s = 0 as SeatIndex; s < 4; s++) {
    for (const m of seats[s].melds) for (const t of m.tiles) visible[kindOf(t)]++;
    for (const e of seats[s].river) visible[kindOf(e.tile)]++;
  }
  const dora = (opts.doraIndicators ?? []).map(tileNotationToId);
  for (const d of dora) visible[kindOf(d)]++;

  return {
    viewer,
    settings: { redDora: true, kuitan: true, twoHanMinimum: false, gameLength: 'east', difficulty: 'normal' },
    roundWind: 'east',
    roundNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealer: 0,
    turn: viewer,
    phase: 'awaitingDiscard',
    hand,
    drawnTile: null,
    furiten: false,
    seats,
    doraIndicators: dora,
    tilesRemaining: opts.tilesRemaining ?? 40,
    lastDiscard: null,
    visibleCounts: visible,
  };
}

export function discardsFor(view: PublicView): LegalAction[] {
  const out: LegalAction[] = [];
  const seen = new Set<number>();
  for (const t of ownTiles(view)) {
    const k = kindOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ action: { type: 'discard', seat: view.viewer, tile: t }, label: `discard ${k}` });
  }
  return out;
}
