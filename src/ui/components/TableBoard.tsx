/**
 * TableBoard — the top-down table: walls at the rim, each seat's concealed
 * backs and melds along their edge, rivers inside the walls, round info in
 * the middle. Designed at fixed coordinates per orientation and scaled to
 * fit, so portrait phones and wide desktops get the same real-table geometry.
 */
import { useRef, type CSSProperties } from 'react';
import type { PublicView, SeatIndex } from '@engine/types';
import Tile, { type TileRotation } from './Tile';
import DiscardRiver from './DiscardRiver';
import MeldArea from './MeldArea';
import SeatPlate from './SeatPlate';
import TableCenter from './TableCenter';
import { useFitScale } from '@ui/hooks/useFitScale';
import type { Orientation } from '@ui/hooks/useOrientation';

const DIMS: Record<string, { w: number; h: number }> = {
  portrait: { w: 380, h: 470 },
  landscape: { w: 1000, h: 560 },
  'landscape-compact': { w: 760, h: 430 },
};

function Backs({ count, rotation, vertical }: { count: number; rotation: TileRotation; vertical?: boolean }) {
  const n = Math.min(count, 13);
  return (
    <div
      aria-label={`${count} concealed tiles`}
      style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 1 }}
    >
      {Array.from({ length: n }).map((_, i) => (
        <Tile key={i} id={0} size="bk" faceDown rotation={rotation} />
      ))}
    </div>
  );
}

export interface TableBoardProps {
  view: PublicView;
  seatName: (seat: SeatIndex) => string;
  aiThinking: boolean;
  orient: Orientation;
  compact?: boolean;
}

export default function TableBoard({ view, seatName, aiThinking, orient, compact = false }: TableBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const variant = orient === 'landscape' && compact ? 'landscape-compact' : orient;
  const scale = useFitScale(hostRef, DIMS[variant].w, DIMS[variant].h);

  const me = view.seats[0];
  const right = view.seats[1];
  const top = view.seats[2];
  const left = view.seats[3];

  const used = `${Math.round((1 - Math.min(1, view.tilesRemaining / 70)) * 100)}%`;

  const plate = (s: SeatIndex, vertical?: boolean) => (
    <SeatPlate
      seat={view.seats[s]}
      name={seatName(s)}
      isTurn={view.turn === s}
      isDealer={view.dealer === s}
      thinking={aiThinking}
      vertical={vertical}
    />
  );

  return (
    <div className="board-host" ref={hostRef}>
      <div
        className="board"
        data-orient={orient}
        data-compact={orient === 'landscape' && compact ? 'true' : 'false'}
        style={{ '--s': scale } as CSSProperties}
      >
        {/* the four walls; the used portion fades back into the felt */}
        <div className="wall wall-h top"><span className="wall-used" style={{ width: used }} /></div>
        <div className="wall wall-h bottom"><span className="wall-used" style={{ width: used }} /></div>
        <div className="wall wall-v left"><span className="wall-used" style={{ height: used }} /></div>
        <div className="wall wall-v right"><span className="wall-used" style={{ height: used }} /></div>

        <div className="board-grid">
          {/* across (seat 2) */}
          <div className="zone zone-top">
            {plate(2)}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <MeldArea melds={top.melds} size="bk" rotation={180} />
              <Backs count={top.concealedCount} rotation={180} />
            </div>
            <DiscardRiver river={top.river} rotation={180} />
            {top.riichi && <span className="table-stick" aria-label="riichi stick" />}
          </div>

          {/* left (seat 3) */}
          <div className="zone zone-left">
            {plate(3, true)}
            <div className="side-col">
              <Backs count={left.concealedCount} rotation={90} vertical />
              <MeldArea melds={left.melds} size="bk" rotation={90} vertical />
            </div>
            <DiscardRiver river={left.river} rotation={90} side />
            {left.riichi && <span className="table-stick vert" aria-label="riichi stick" />}
          </div>

          {/* centre: round wind, dora, sticks */}
          <div className="zone zone-center">
            <TableCenter view={view} />
          </div>

          {/* right (seat 1) */}
          <div className="zone zone-right">
            {right.riichi && <span className="table-stick vert" aria-label="riichi stick" />}
            <DiscardRiver river={right.river} rotation={270} side />
            <div className="side-col">
              <MeldArea melds={right.melds} size="bk" rotation={270} vertical />
              <Backs count={right.concealedCount} rotation={270} vertical />
            </div>
            {plate(1, true)}
          </div>

          {/* own river */}
          <div className="zone zone-bottom">
            {me.riichi && <span className="table-stick" aria-label="riichi stick" />}
            <DiscardRiver river={me.river} rotation={0} />
          </div>
        </div>
      </div>
    </div>
  );
}
