/**
 * TableBoard — renders the deterministic layout from @ui/table/layout:
 * every plate, back, discard and meld tile is absolutely positioned in board
 * coordinates inside a uniformly scaled board. No flex/grid/percentage layout
 * touches the table, so it is pixel-identical across browsers and viewports.
 */
import { useRef, type CSSProperties } from 'react';
import type { PublicView, SeatIndex } from '@engine/types';
import Tile, { type TileRotation } from './Tile';
import SeatPlate from './SeatPlate';
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
}

export default function TableBoard({ view, seatName, aiThinking, orient, compact = false }: TableBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const variant: BoardVariant = orient === 'portrait' ? 'portrait' : compact ? 'compact' : 'landscape';
  const L = layoutBoard(view, variant);
  const scale = useFitScale(hostRef, L.m.W, L.m.H);

  const pos = (t: { x: number; y: number }): CSSProperties => ({
    left: t.x,
    top: t.y,
    '--tw': `${L.m.tile.w}px`,
    '--th': `${L.m.tile.h}px`,
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
        {L.plates.map((p) => (
          <div
            key={p.seat}
            className="abs plate-box"
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            <SeatPlate
              seat={view.seats[p.seat]}
              name={seatName(p.seat)}
              isTurn={view.turn === p.seat}
              isDealer={view.dealer === p.seat}
              thinking={aiThinking}
              vertical={p.vertical}
            />
          </div>
        ))}

        {L.backs.map(renderTile)}
        {L.melds.map(renderTile)}
        {([0, 1, 2, 3] as SeatIndex[]).flatMap((s) => L.ponds[s]).map(renderTile)}

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
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <TableCenter view={view} />
        </div>
      </div>
    </div>
  );
}
