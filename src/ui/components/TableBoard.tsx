/**
 * TableBoard — renders the deterministic layout from @ui/table/layout:
 * every back, discard, meld and hand tile is absolutely positioned in board
 * coordinates inside a uniformly scaled board. No flex/grid/percentage layout
 * touches the table, so it is pixel-identical across browsers and viewports.
 * The human hand lives on the felt too (face-up along the bottom edge, drawn
 * tile set apart, own melds beside it) and stays tappable.
 */
import { useRef, type CSSProperties } from 'react';
import type { LegalAction, PublicView, SeatIndex, TileId } from '@engine/types';
import Tile, { type TileRotation } from './Tile';
import TableCenter from './TableCenter';
import { useFitScale } from '@ui/hooks/useFitScale';
import type { Orientation } from '@ui/hooks/useOrientation';
import { layoutBoard, type BoardVariant, type PlacedTile } from '@ui/table/layout';

export interface TableBoardProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  aiThinking: boolean;
  orient: Orientation;
  compact?: boolean;
  /** discard interaction for the on-table hand */
  discardActions: LegalAction[];
  onDiscard: (tile: TileId, riichi: boolean) => void;
  riichiMode: boolean;
  locked: boolean;
}

export default function TableBoard({
  view, seatName: _seatName, aiThinking: _aiThinking, orient, compact = false,
  discardActions, onDiscard, riichiMode, locked,
}: TableBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const variant: BoardVariant = orient === 'portrait' ? 'portrait' : compact ? 'compact' : 'landscape';
  const L = layoutBoard(view, variant);
  const scale = useFitScale(hostRef, L.m.W, L.m.H);

  const plain = new Set<TileId>();
  const riichiable = new Set<TileId>();
  for (const la of discardActions) {
    if (la.action.type !== 'discard') continue;
    if (la.action.riichi) riichiable.add(la.action.tile);
    else plain.add(la.action.tile);
  }
  const canDiscard = (t: TileId): boolean => {
    if (locked) return false;
    if (riichiMode) return riichiable.has(t);
    return plain.has(t) || riichiable.has(t);
  };
  const doDiscard = (t: TileId) => {
    if (!canDiscard(t)) return;
    onDiscard(t, riichiMode && riichiable.has(t));
  };

  const pos = (t: { x: number; y: number }, box = L.m.tile): CSSProperties => ({
    left: t.x,
    top: t.y,
    '--tw': `${box.w}px`,
    '--th': `${box.h}px`,
  }) as CSSProperties;

  const renderTile = (t: PlacedTile) => (
    <Tile
      key={t.key}
      id={t.id}
      size="rv"
      className="abs"
      style={pos(t)}
      faceDown={t.faceDown}
      rotation={t.rot as TileRotation}
      dimmed={t.dimmed}
    />
  );

  return (
    <div className="board-host" ref={hostRef}>
      <div
        className="board"
        data-orient={orient}
        style={{ width: L.m.W, height: L.m.H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {L.backs.map(renderTile)}
        {L.melds.map(renderTile)}
        {([0, 1, 2, 3] as SeatIndex[]).flatMap((s) => L.ponds[s]).map(renderTile)}

        {L.hand.map((t) => (
          <Tile
            key={t.key}
            id={t.id}
            size="rv"
            className="abs"
            style={pos(t, L.m.hand)}
            onClick={() => doDiscard(t.id)}
            disabled={!canDiscard(t.id)}
            dimmed={!locked && riichiMode && !riichiable.has(t.id)}
            title={t.key === 'h-drawn' ? 'just drawn' : undefined}
          />
        ))}

        {L.sticks.map((s) => (
          <span
            key={`stick${s.seat}`}
            className={`table-stick abs${s.vertical ? ' vert' : ''}`}
            aria-label="riichi stick"
            style={{
              left: s.x,
              top: s.y,
              width: s.vertical ? L.m.stick.h : L.m.stick.w,
              height: s.vertical ? L.m.stick.w : L.m.stick.h,
            }}
          />
        ))}

        <div
          className="board-center abs"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            '--cube': `${L.m.cube}px`,
            // dora-tray tiles share the board's tile size (bug: they used to
            // fall back to a tiny hard-coded size)
            '--rv-w': `${L.m.tile.w}px`,
            '--rv-h': `${L.m.tile.h}px`,
          } as CSSProperties}
        >
          <TableCenter view={view} />
        </div>
      </div>
    </div>
  );
}
