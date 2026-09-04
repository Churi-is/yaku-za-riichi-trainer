/** Tile — renders a single mahjong tile face or back. Owned by Worker D. */
import type { TileId } from '@engine/types';
import { isRedFiveId, tileFace } from '@ui/tiles';

export type TileSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';

/** Which way the tile is laid on the table. 'left'/'right' render it sideways. */
export type TileOrientation = 'upright' | 'left' | 'right';

export interface TileProps {
  id: TileId;
  /** Render the tile back (never reveals a concealed opponent tile). */
  faceDown?: boolean;
  size?: TileSize;
  /** Rotated sideways, e.g. riichi declaration tile or a called meld tile (upright rows). */
  rotated?: boolean;
  /** Sideways seat: which way the tile lies (see PLAN-MOBILE-LAYOUT §5.2). */
  orientation?: TileOrientation;
  /**
   * Perpendicular marker inside a sideways group (called tile / riichi declaration).
   * Cancels the side rotation so the tile reads upright to the viewer.
   */
  marker?: boolean;
  /** Dimmed, e.g. a tile that was called away or a spent discard. */
  dimmed?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}

export default function Tile({
  id, faceDown = false, size = 'md', rotated = false, orientation = 'upright',
  marker = false, dimmed = false, selected = false, disabled = false,
  onClick, title, ariaLabel,
}: TileProps) {
  const cls = [
    'tile',
    `tile-${size}`,
    rotated ? 'tile-rotated' : '',
    orientation === 'left' ? 'tile-s-left' : orientation === 'right' ? 'tile-s-right' : '',
    marker ? 'tile-marker' : '',
    dimmed ? 'tile-dimmed' : '',
    selected ? 'tile-selected' : '',
    onClick ? 'tile-clickable' : '',
    disabled ? 'tile-disabled' : '',
    faceDown ? 'tile-back' : '',
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={cls} aria-hidden="true" title={title} />;
  }

  const face = tileFace(id);
  const red = isRedFiveId(id);
  const label = ariaLabel ?? (red ? `red ${face.label}` : face.label);
  const content = (
    <span className={`tile-face tile-group-${face.group}${red ? ' tile-red' : ''}`}>
      <span className="tile-glyph">{face.glyph}</span>
      {face.suitGlyph && <span className="tile-suit">{face.suitGlyph}</span>}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cls} role="img" aria-label={label} title={title ?? label}>
      {content}
    </div>
  );
}
