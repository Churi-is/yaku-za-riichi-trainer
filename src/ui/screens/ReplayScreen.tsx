/** ReplayScreen — graded timeline of every human turn + per-round reveals. Owned by Worker D. */
import { useMemo, useState } from 'react';
import type { Meld, SeatIndex, TileId } from '@engine/types';
import type { HandLog } from '@replay/types';
import { useSession } from '@state/session';
import { gradeMatch } from '@state/analysisAdapter';
import type { GradedTurn } from '@analysis/types';
import Tile from '@ui/components/Tile';
import { sortTiles } from '@ui/tiles';
import { PERSONALITIES } from '@ai/index';

function GradeBadge({ grade }: { grade: GradedTurn['grade'] }) {
  return <span className={`grade-badge grade-${grade}`}>{grade}</span>;
}

function TurnCard({ turn }: { turn: GradedTurn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="turn-card">
      <div className="turn-head" onClick={() => setOpen((o) => !o)}>
        <GradeBadge grade={turn.grade} />
        <strong style={{ flex: 1 }}>{turn.actionLabel}</strong>
        <span className="metric">
          shanten {fmtSh(turn.shantenBefore)}→{fmtSh(turn.shantenAfter)} · ukeire {turn.ukeireBefore}→{turn.ukeireAfter}
        </span>
        <span className="muted">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="turn-body stack" style={{ gap: 8 }}>
          <div>{turn.explanation}</div>
          {turn.category !== 'none' && (
            <div className="muted" style={{ fontSize: 12 }}>Category: {turn.category}</div>
          )}
          {turn.alternatives.length > 0 && (
            <div>
              <h4 style={{ margin: '4px 0' }}>Better options</h4>
              {turn.alternatives.map((a, i) => (
                <div className="alt-item" key={i}>
                  <strong>{a.label}</strong>
                  <div className="muted" style={{ fontSize: 12.5 }}>{a.reasoning}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The discard a call was made on (the closest preceding discard entry). */
function calledTileOf(hand: HandLog, seq: number): TileId | null {
  for (let i = hand.entries.length - 1; i >= 0; i--) {
    const e = hand.entries[i];
    if (e.seq >= seq) continue;
    if (e.action.type === 'discard') return e.action.tile;
  }
  return null;
}

/**
 * Rebuild each seat's called sets from the hand's action log so the reveal
 * shows COMPLETE hands (the log schema only stores concealed tiles).
 */
function meldsFromHand(hand: HandLog): Record<SeatIndex, Meld[]> {
  const out: Record<SeatIndex, Meld[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const e of hand.entries) {
    const a = e.action;
    if (a.type === 'chi' || a.type === 'pon' || a.type === 'minkan') {
      const called = calledTileOf(hand, e.seq);
      const tiles = sortTiles(called === null ? [...a.tiles] : [...a.tiles, called]);
      out[e.seat].push({ type: a.type, tiles, calledFrom: null, calledTile: called, concealed: false });
    } else if (a.type === 'ankan') {
      out[e.seat].push({
        type: 'ankan',
        tiles: [a.kind * 4, a.kind * 4 + 1, a.kind * 4 + 2, a.kind * 4 + 3],
        calledFrom: null, calledTile: null, concealed: true,
      });
    } else if (a.type === 'kakan') {
      const kind = Math.floor(a.tile / 4);
      const others = [0, 1, 2, 3].map((c) => kind * 4 + c).filter((id) => id !== a.tile).slice(0, 3);
      out[e.seat].push({
        type: 'kakan',
        tiles: sortTiles([a.tile, ...others]),
        calledFrom: null, calledTile: null, concealed: false,
      });
    }
  }
  return out;
}

function fmtSh(n: number): string {
  return n === -1 ? 'win' : n === 0 ? 'tenpai' : `${n}`;
}

export default function ReplayScreen() {
  const go = useSession((s) => s.go);
  const matchLog = useSession((s) => s.matchLog);

  const graded = useMemo(() => {
    if (!matchLog) return [];
    const entries = matchLog.hands.flatMap((h) => h.entries);
    return gradeMatch(entries);
  }, [matchLog]);

  const seatName = (seat: SeatIndex): string => {
    if (seat === 0) return 'You';
    const id = PERSONALITIES[(seat - 1) % PERSONALITIES.length];
    return id?.name ?? `Seat ${seat}`;
  };

  if (!matchLog) {
    return (
      <div className="screen stack">
        <div className="screen-head"><h1>Replay</h1></div>
        <p className="muted">No match recorded yet.</p>
        <button className="btn btn-primary" onClick={() => go('menu')}>Back to menu</button>
      </div>
    );
  }

  const byHand = new Map<number, GradedTurn[]>();
  for (const t of graded) {
    if (!byHand.has(t.handId)) byHand.set(t.handId, []);
    byHand.get(t.handId)!.push(t);
  }

  // resolved wait guesses
  const guesses = matchLog.waitGuesses;

  return (
    <div className="screen stack">
      <div className="screen-head">
        <h1>Graded Replay<span className="kan jp">牌譜</span></h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => go('summary')}>Summary →</button>
          <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>Menu</button>
        </div>
      </div>

      {graded.length === 0 && (
        <p className="muted">No gradeable turns were recorded for this match.</p>
      )}

      {matchLog.hands.map((hand) => {
        const turns = byHand.get(hand.handId) ?? [];
        const handGuesses = guesses.filter((g) => g.handId === hand.handId);
        const wind = hand.roundWind[0].toUpperCase() + hand.roundWind.slice(1);
        return (
          <div key={hand.handId}>
            <h3 className="round-section-head">
              {wind} {hand.roundNumber} · Honba {hand.honba}
              {hand.result.winner !== null && ` · ${seatName(hand.result.winner)} won`}
              {hand.result.reason === 'exhaustiveDraw' && ' · Draw'}
            </h3>

            <div className="timeline">
              {turns.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No decisions to grade this hand.</p>}
              {turns.map((t, i) => <TurnCard key={i} turn={t} />)}
            </div>

            {/* Practice-mode wait guesses this hand */}
            {handGuesses.length > 0 && (
              <div className="card" style={{ marginTop: 10 }}>
                <h4 style={{ margin: '0 0 6px' }}>Your wait guesses</h4>
                {handGuesses.map((g, i) => (
                  <div key={i} className="row spread" style={{ fontSize: 13, padding: '3px 0' }}>
                    <span>{seatName(g.seat)}: you guessed {g.submittedKinds.map(kindStr).join(', ') || '—'}</span>
                    <span>
                      {g.actualWaits && g.actualWaits.length > 0
                        ? <>actual {g.actualWaits.map(kindStr).join(', ')} · {g.correct ? <span style={{ color: 'var(--good)' }}>✓ correct</span> : <span style={{ color: 'var(--bad)' }}>✗ miss</span>}</>
                        : <span className="muted">wasn't tenpai / unresolved</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Per-round reveal of what each seat held */}
            <div className="card" style={{ marginTop: 10 }}>
              <h4 style={{ margin: '0 0 6px' }}>Hand reveal</h4>
              <div className="reveal-grid">
                {([0, 1, 2, 3] as SeatIndex[]).map((s) => (
                  <div className="reveal-seat" key={s}>
                    <strong>{seatName(s)}</strong>{' '}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {hand.result.deltas[s] >= 0 ? '+' : ''}{(hand.result.deltas[s] ?? 0).toLocaleString()}
                    </span>
                    <div className="reveal-tiles">
                      {sortTiles(hand.revealedHands[s] ?? []).map((t, i) => <Tile key={i} id={t} size="xs" />)}
                      {meldsFromHand(hand)[s].map((m, mi) => (
                        <span className="reveal-meld" key={`m${mi}`}>
                          {m.tiles.map((t, j) => (
                            <Tile key={j} id={t} size="xs" faceDown={m.type === 'ankan' && (j === 0 || j === 3)} />
                          ))}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => go('summary')}>Session summary →</button>
      </div>
    </div>
  );
}

function kindStr(k: number): string {
  if (k < 9) return `${(k % 9) + 1}m`;
  if (k < 18) return `${(k % 9) + 1}p`;
  if (k < 27) return `${(k % 9) + 1}s`;
  return ['E', 'S', 'W', 'N', 'Haku', 'Hatsu', 'Chun'][k - 27];
}
