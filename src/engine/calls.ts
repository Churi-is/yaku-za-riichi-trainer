/**
 * engine/calls — chi/pon/kan options and the kuikae rule. Owned by Worker A.
 *
 * No kuikae: right after a call you may not discard the kind you just called,
 * nor the mirror tile of a chi (chi 3-4-5 on the 3 means you cannot drop the 6).
 * These come back to the UI as `LegalAction.forbiddenDiscards`.
 */
import {
  isRed, isRedKind, kindOf, kindsLabel, sortIds, tileName,
} from './tiles';
import type {
  Action, GameState, PlayerState, SeatIndex, TileId, TileKind,
} from './types';

export type CallKind = 'ron' | 'pon' | 'minkan' | 'chi';

export interface CallOption {
  kind: CallKind;
  action: Action;
  label: string;
  forbiddenDiscards: TileKind[];
}

function idsOfKind(player: PlayerState, kind: TileKind): TileId[] {
  return player.hand.filter((id) => kindOf(id) === kind);
}

/**
 * Which copies to offer. Fives are red-sensitive, so where it matters we offer
 * both "spend the red five" and "keep it"; everything else collapses to one
 * option because the copies are indistinguishable.
 */
function idChoices(player: PlayerState, kind: TileKind, n: number): TileId[][] {
  const ids = idsOfKind(player, kind);
  if (ids.length < n) return [];
  if (!isRedKind(kind)) return [ids.slice(0, n)];
  const red = ids.filter(isRed);
  const plain = ids.filter((id) => !isRed(id));
  const out: TileId[][] = [];
  if (plain.length >= n) out.push(plain.slice(0, n));
  if (red.length >= 1 && plain.length >= n - 1) out.push([red[0], ...plain.slice(0, n - 1)]);
  return out.length ? out : [ids.slice(0, n)];
}

/** Kuikae: the kinds this seat may not discard immediately after the call. */
export function kuikaeFor(kind: CallKind, calledKind: TileKind, runLow: TileKind | null): TileKind[] {
  if (kind !== 'chi' || runLow === null) return [calledKind];
  const forbidden: TileKind[] = [calledKind];
  const rank = calledKind - runLow; // 0, 1 (kanchan) or 2
  if (rank === 0 && runLow % 9 <= 5) forbidden.push(runLow + 3);
  if (rank === 2 && runLow % 9 >= 1) forbidden.push(runLow - 1);
  // A kanchan chi has no mirror tile: only the called kind is forbidden.
  return forbidden;
}

export function chiOptions(state: GameState, seat: SeatIndex): CallOption[] {
  const win = state.callWindow;
  if (!win || win.chankan) return [];
  // Chi only from the kamicha — the player immediately to the left.
  if (win.from !== (((seat + 3) % 4) as SeatIndex)) return [];
  const player = state.players[seat];
  if (player.riichi) return []; // a riichi player may not chi
  const c = kindOf(win.tile);
  if (c >= 27) return []; // honors never run
  const out: CallOption[] = [];
  const shapes: TileKind[] = [];
  if (c % 9 >= 2) shapes.push(c - 2);
  if (c % 9 >= 1 && c % 9 <= 7) shapes.push(c - 1);
  if (c % 9 <= 6) shapes.push(c);
  for (const low of shapes) {
    const others = [low, low + 1, low + 2].filter((k) => k !== c);
    const [a, b] = others;
    for (const first of idChoices(player, a, 1)) {
      for (const second of idChoices(player, b, 1)) {
        const tiles = sortIds([first[0], second[0]]) as [TileId, TileId];
        out.push({
          kind: 'chi',
          action: { type: 'chi', seat, tiles },
          label: `Chi ${kindsLabel([kindOf(tiles[0]), kindOf(tiles[1])])}`,
          forbiddenDiscards: kuikaeFor('chi', c, low),
        });
      }
    }
  }
  return out;
}

export function ponOptions(state: GameState, seat: SeatIndex): CallOption[] {
  const win = state.callWindow;
  if (!win || win.chankan) return [];
  const player = state.players[seat];
  if (player.riichi) return [];
  const c = kindOf(win.tile);
  const out: CallOption[] = [];
  for (const pair of idChoices(player, c, 2)) {
    out.push({
      kind: 'pon',
      action: { type: 'pon', seat, tiles: pair as [TileId, TileId] },
      label: `Pon ${tileName(c)}`,
      forbiddenDiscards: kuikaeFor('pon', c, null),
    });
  }
  return out;
}

export function minkanOptions(state: GameState, seat: SeatIndex): CallOption[] {
  const win = state.callWindow;
  if (!win || win.chankan) return [];
  const player = state.players[seat];
  if (player.riichi) return [];
  const c = kindOf(win.tile);
  const out: CallOption[] = [];
  for (const three of idChoices(player, c, 3)) {
    out.push({
      kind: 'minkan',
      action: { type: 'minkan', seat, tiles: three as [TileId, TileId, TileId] },
      label: `Kan ${tileName(c)}`,
      forbiddenDiscards: kuikaeFor('minkan', c, null),
    });
  }
  return out;
}

/** Every call a seat may make on the tile currently in the window. */
export function callOptionsFor(state: GameState, seat: SeatIndex): CallOption[] {
  return [...ponOptions(state, seat), ...minkanOptions(state, seat), ...chiOptions(state, seat)];
}

/** Seats with at least one non-ron call available, in turn order from `from`. */
export function callCandidates(state: GameState): SeatIndex[] {
  const win = state.callWindow;
  if (!win) return [];
  const order: SeatIndex[] = [
    ((win.from + 1) % 4) as SeatIndex,
    ((win.from + 2) % 4) as SeatIndex,
    ((win.from + 3) % 4) as SeatIndex,
  ];
  return order;
}
