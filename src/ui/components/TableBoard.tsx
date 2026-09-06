/**
 * TableBoard — renders the deterministic layout from @ui/table/layout:
 * every back, discard, meld, hand tile and the centre block is absolutely
 * positioned in board coordinates inside a uniformly scaled board. No
 * flex/grid/percentage layout touches the table, so it is pixel-identical
 * across browsers and viewports.
 *
 * The human hand lives on the felt too (face-up along the bottom edge, drawn
 * tile set apart, own melds beside it). Tiles are small on a phone, so a
 * discard is a two-step gesture: tap to lift the tile, tap again (or press
 * the confirm button in the action bar) to throw it.
 */
import { useRef, type CSSProperties } from 'react';
import type { LegalAction, PublicView, SeatIndex, TileId } from '@engine/types';
import Tile, { type TileRotation } from './Tile';
import TableCenter from './TableCenter';
import { useBoxSize, fitScale } from '@ui/hooks/useFitScale';
import type { Orientation } from '@ui/hooks/useOrientation';
import { fitMetrics, layoutBoard, type BoardVariant, type PlacedTile } from '@ui/table/layout';
import { tileLabel } from '@ui/tiles';

interface TableBoardProps {
  view: PublicView;
  aiThinking: boolean;
  orient: Orientation;
  compact?: boolean;
  /** discard interaction for the on-table hand */
  discardActions: LegalAction[];
  onDiscard: (tile: TileId, riichi: boolean) => void;
  /** the tile currently lifted out of the hand, awaiting confirmation */
  selected: TileId | null;
  onSelect: (tile: TileId | null) => void;
  riichiMode: boolean;
  locked: boolean;
  /**
   * Dojo mode: tiles to spotlight. Everything else on the felt dims, so the
   * coach can point at a shape without describing where to look.
   */
  highlight?: TileId[];
  /** Spotlight the centre block (dora, wall count, round) instead of tiles. */
  focusCentre?: boolean;
  /** One tap answers, instead of lift-then-confirm. */
  tapToAnswer?: boolean;
}

export default function TableBoard({
  view, aiThinking, orient, compact = false,
  discardActions, onDiscard, selected, onSelect, riichiMode, locked,
  highlight, focusCentre = false, tapToAnswer = false,
}: TableBoardProps) {
  const focus = new Set<TileId>(highlight ?? []);
  const spotlit = focus.size > 0 || focusCentre;
  // Face-down backs all share a sentinel id; spotlighting one would light
  // every back on the table, so they never take the mark.
  const mark = (id: TileId, faceDown?: boolean) => (!faceDown && focus.has(id) ? ' tile-focus' : '');
  const hostRef = useRef<HTMLDivElement>(null);
  const variant: BoardVariant = orient === 'portrait' ? 'portrait' : compact ? 'compact' : 'landscape';
  const box = useBoxSize(hostRef);
  // stretch the board to the shape of the felt, then scale it to fit exactly
  const metrics = fitMetrics(variant, box.w, box.h);
  const L = layoutBoard(view, variant, metrics);
  const scale = fitScale(box, L.m.W, L.m.H);

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
  const tapTile = (t: TileId) => {
    if (!canDiscard(t)) return;
    if (tapToAnswer) { onSelect(t); return; }
    if (selected === t) onDiscard(t, riichiMode && riichiable.has(t));
    else onSelect(t);
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
      className={`abs${t.latest ? ' tile-latest' : ''}${t.tsumogiri ? ' tile-tsumogiri' : ''}${mark(t.id, t.faceDown)}`}
      style={pos(t)}
      faceDown={t.faceDown}
      rotation={t.rot as TileRotation}
      dimmed={t.dimmed}
    />
  );

  return (
    <div className="board-host" ref={hostRef}>
      <div
        className={`board${spotlit ? ' spotlit' : ''}`}
        data-orient={orient}
        style={{ width: L.m.W, height: L.m.H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
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
          className={`abs board-center${focusCentre ? ' tile-focus' : ''}`}
          style={{ left: L.center.x, top: L.center.y }}
        >
          <TableCenter view={view} center={L.center} thinking={aiThinking} />
        </div>

        {L.hand.map((t) => {
          const label = tileLabel(t.id);
          const playable = canDiscard(t.id);
          const isSelected = selected === t.id;
          return (
            <Tile
              key={t.key}
              id={t.id}
              size="rv"
              className={`abs hand-tile${t.key === 'h-drawn' ? ' drawn' : ''}${mark(t.id)}`}
              style={pos(t, L.m.hand)}
              onClick={() => tapTile(t.id)}
              disabled={!playable}
              selected={isSelected}
              dimmed={!locked && riichiMode && !riichiable.has(t.id)}
              ariaLabel={`${label}${t.key === 'h-drawn' ? ' (just drawn)' : ''}`}
              title={isSelected ? `Tap again to discard ${label}` : label}
            />
          );
        })}
      </div>
    </div>
  );
}
