/** HandView — the human player's concealed hand + drawn tile + melds.
 *  Tile size is fluid: it divides the dock width by the tile count so all 14
 *  always fit on a phone without wrapping. */
import type { CSSProperties } from 'react';
import type { LegalAction, Meld, TileId } from '@engine/types';
import Tile from './Tile';
import MeldArea from './MeldArea';
import { sortTiles } from '@ui/tiles';

export interface HandViewProps {
  hand: TileId[];
  drawnTile: TileId | null;
  melds: Meld[];
  /** Legal discard actions right now (used to enable tiles + riichi flag). */
  discardActions: LegalAction[];
  onDiscard: (tile: TileId, riichi: boolean) => void;
  /** Whether the player is choosing a riichi discard. */
  riichiMode: boolean;
  /** Disable interaction (e.g. not the player's turn). */
  locked: boolean;
}

export default function HandView({
  hand, drawnTile, melds, discardActions, onDiscard, riichiMode, locked,
}: HandViewProps) {
  const plain = new Map<TileId, boolean>();
  const riichiable = new Map<TileId, boolean>();
  for (const la of discardActions) {
    if (la.action.type !== 'discard') continue;
    const t = la.action.tile;
    if (la.action.riichi) riichiable.set(t, true);
    else plain.set(t, true);
  }

  const sortedHand = sortTiles(hand);

  const canDiscard = (t: TileId): boolean => {
    if (locked) return false;
    if (riichiMode) return riichiable.has(t);
    return plain.has(t) || riichiable.has(t);
  };

  const doDiscard = (t: TileId) => {
    if (!canDiscard(t)) return;
    onDiscard(t, riichiMode && riichiable.has(t));
  };

  const count = sortedHand.length + (drawnTile !== null ? 1 : 0) + 0.7;

  return (
    <div className="hand-dock" style={{ '--hand-n': count } as CSSProperties}>
      {melds.length > 0 && (
        <div className="hand-melds">
          <MeldArea melds={melds} size="meld" />
        </div>
      )}
      <div className="hand-row">
        {sortedHand.map((t, i) => (
          <Tile
            key={`${t}-${i}`}
            id={t}
            size="hand"
            onClick={() => doDiscard(t)}
            disabled={!canDiscard(t)}
            dimmed={!locked && riichiMode && !riichiable.has(t)}
          />
        ))}
        {drawnTile !== null && (
          <>
            <span className="drawn-sep" />
            <Tile
              id={drawnTile}
              size="hand"
              onClick={() => doDiscard(drawnTile)}
              disabled={!canDiscard(drawnTile)}
              dimmed={!locked && riichiMode && !riichiable.has(drawnTile)}
              title="just drawn"
            />
          </>
        )}
      </div>
    </div>
  );
}
