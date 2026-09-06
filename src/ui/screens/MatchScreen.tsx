/** MatchScreen — the live table, top-down. Owned by Worker D. */
import { useEffect, useMemo, useState } from 'react';
import type { Action, SeatIndex, TileId } from '@engine/types';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';
import { usingFallback } from '@state/engineAdapter';
import { useOrientation } from '@ui/hooks/useOrientation';
import { useFocusTrap } from '@ui/hooks/useFocusTrap';

import ScoreStrip from '@ui/components/ScoreStrip';
import TableBoard from '@ui/components/TableBoard';
import CallBar from '@ui/components/CallBar';
import PauseMenu from '@ui/components/PauseMenu';
import HandEndBanner from '@ui/components/HandEndBanner';
import PersonalitiesIntro from '@ui/components/PersonalitiesIntro';

/** Final standings on the match-complete card: every seat, ranked. */
function FinalStandings({
  ranking, finalPoints, seatName,
}: {
  ranking: SeatIndex[];
  finalPoints: Record<SeatIndex, number>;
  seatName: (seat: SeatIndex) => string;
}) {
  const medal = ['🥇', '🥈', '🥉', '4th'];
  return (
    <div className="final-table" role="list" aria-label="Final standings">
      {ranking.map((s, i) => (
        <div className={`final-row${s === 0 ? ' you' : ''}`} role="listitem" key={s}>
          <span className="final-medal" aria-hidden="true">{medal[i]}</span>
          <span className="final-name">{s === 0 ? 'You' : seatName(s)}</span>
          <span className="final-pts">{finalPoints[s].toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/** Match-complete card: full standings, winner, rematch and exit. */
function MatchComplete({
  matchResult, onRematch, onMenu, seatName,
}: {
  matchResult: NonNullable<ReturnType<typeof useMatch.getState>['matchResult']>;
  onRematch: () => void;
  onMenu: () => void;
  seatName: (seat: SeatIndex) => string;
}) {
  const cardRef = useFocusTrap<HTMLDivElement>(true);

  const place = matchResult.ranking.indexOf(0) + 1;
  const winnerSeat = matchResult.ranking[0];
  const winnerName = winnerSeat === 0 ? 'You' : seatName(winnerSeat);

  return (
    <div className="scrim">
      <div
        className="card handend-card stack"
        role="dialog"
        aria-modal="true"
        aria-label="Match complete"
        ref={cardRef}
        tabIndex={-1}
      >
        <h2 style={{ margin: 0 }}>Match complete<span className="kan jp" style={{ color: 'var(--gold-dim)', fontSize: '0.7em', marginLeft: 8 }}>終局</span></h2>
        <p className="muted" style={{ margin: 0 }}>
          You finished {ordinal(place)} with {matchResult.finalPoints[0].toLocaleString()} points
          {' — '}{winnerSeat === 0 ? 'you take the table.' : `${winnerName} takes the win.`}
          {' '}({matchResult.handsPlayed} hand{matchResult.handsPlayed === 1 ? '' : 's'} played)
        </p>
        <FinalStandings ranking={matchResult.ranking} finalPoints={matchResult.finalPoints} seatName={seatName} />
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onRematch}>
            Rematch<span className="kan jp" style={{ marginLeft: 8, opacity: 0.85 }}>再戦</span>
          </button>
          <button className="btn" onClick={onMenu}>Back to menu</button>
        </div>
      </div>
    </div>
  );
}

export default function MatchScreen() {
  const go = useSession((s) => s.go);
  const settings = useSession((s) => s.settings);
  const opponents = useSession((s) => s.opponents);

  const state = useMatch((s) => s.state);
  const view = useMatch((s) => s.view);
  const humanLegal = useMatch((s) => s.humanLegal);
  const aiThinking = useMatch((s) => s.aiThinking);
  const seatPersonalities = useMatch((s) => s.seatPersonalities);
  const handEnd = useMatch((s) => s.handEnd);
  const matchResult = useMatch((s) => s.matchResult);
  const paused = useMatch((s) => s.paused);
  const introDismissed = useMatch((s) => s.introDismissed);
  const engineMessage = useMatch((s) => s.message);
  const humanAct = useMatch((s) => s.humanAct);
  const advanceHand = useMatch((s) => s.advanceHand);
  const start = useMatch((s) => s.start);
  const setPaused = useMatch((s) => s.setPaused);
  const dismissIntro = useMatch((s) => s.dismissIntro);

  const { orient, compact } = useOrientation();

  const [riichiMode, setRiichiMode] = useState(false);
  const [selected, setSelected] = useState<TileId | null>(null);

  const seatName = useMemo(() => {
    const map: Record<number, string> = { 0: 'You' };
    for (const p of seatPersonalities) map[p.seat] = p.name;
    return (seat: SeatIndex) => map[seat] ?? `Seat ${seat}`;
  }, [seatPersonalities]);

  const legalKey = humanLegal.length;
  // A lifted tile only makes sense while the player still owns the decision.
  useEffect(() => { setSelected(null); }, [legalKey, riichiMode]);

  if (!state || !view) {
    return (
      <div className="screen center stack">
        <p className="muted">No match in progress.</p>
        <button className="btn btn-primary" onClick={() => go('settings')}>New Match</button>
      </div>
    );
  }

  const act = (action: Action) => {
    setRiichiMode(false);
    setSelected(null);
    humanAct(action);
  };

  const onDiscard = (tile: TileId, riichi: boolean) => {
    act({ type: 'discard', seat: 0, tile, riichi });
  };

  const rematch = () => {
    // Same table, same rules — straight back into a fresh intro.
    start(settings, Math.floor(Math.random() * 1e9), opponents);
  };

  const humanTurn = humanLegal.length > 0;
  const isCallWindow = humanTurn && humanLegal.some((l) => l.action.type === 'pass');
  const canAct = humanTurn && !paused;
  const locked = !canAct || isCallWindow;

  const riichiable = new Set<TileId>();
  for (const l of humanLegal) {
    if (l.action.type === 'discard' && l.action.riichi) riichiable.add(l.action.tile);
  }

  const noDiscardsYet = ([0, 1, 2, 3] as SeatIndex[]).every((s) => view.seats[s].river.length === 0);
  const showIntro = !introDismissed && !handEnd && !matchResult && noDiscardsYet
    && seatPersonalities.length > 0;

  const waitingOn = view.turn !== 0 && !showIntro ? seatName(view.turn) : null;
  const statusText = showIntro
    ? 'Press Deal to start the match'
    : waitingOn ? `${waitingOn} is playing` : 'Dealing';
  const furiten = Boolean(view.furiten);

  return (
    <div className="match" data-orient={orient}>
      {/* Screen-reader live channel: whose turn it is, hand and match results. */}
      <span className="sr-only" role="status" aria-live="polite">
        {handEnd
          ? `Hand over: ${handEnd.result.reason === 'exhaustiveDraw' ? 'exhaustive draw' : `${handEnd.result.reason} by ${handEnd.result.winner !== null ? seatName(handEnd.result.winner) : ''}`}`
          : matchResult
            ? `Match complete. You finished ${ordinal(matchResult.ranking.indexOf(0) + 1)}.`
            : statusText}
      </span>

      <ScoreStrip view={view} seatName={seatName} />

      <div className="match-main">
        <div className="felt-wrap">
          <TableBoard
            view={view}
            seatName={seatName}
            aiThinking={aiThinking}
            orient={orient}
            compact={compact}
            discardActions={humanLegal.filter((l) => l.action.type === 'discard')}
            onDiscard={onDiscard}
            selected={selected}
            onSelect={setSelected}
            riichiMode={riichiMode}
            locked={locked}
          />
        </div>
      </div>

      <footer className="dock-bottom">
        <CallBar
          legal={paused ? [] : humanLegal}
          furiten={furiten}
          riichiMode={riichiMode}
          selected={selected}
          onEnterRiichiMode={() => { setRiichiMode(true); setSelected(null); }}
          onCancelRiichi={() => { setRiichiMode(false); setSelected(null); }}
          onConfirmDiscard={() => {
            if (selected !== null) onDiscard(selected, riichiMode && riichiable.has(selected));
          }}
          onClearSelection={() => setSelected(null)}
          onAct={act}
          status={(
            <span className="turn-status">
              <span className="dot" aria-hidden="true" />
              {waitingOn ? `${waitingOn} is playing…` : 'Dealing…'}
            </span>
          )}
        />
        <div className="tool-row">
          {engineMessage && (
            <span className="pill pill-error" role="alert" style={{ flex: 1, whiteSpace: 'normal' }}>
              {engineMessage}
            </span>
          )}
          {usingFallback() && !engineMessage && (
            <span className="pill" title="Worker A's engine has not merged yet; using Worker D's built-in fallback rules engine.">demo</span>
          )}
          <span className="spacer" />
          <button
            type="button"
            className="tab-btn"
            aria-label="Pause menu"
            disabled={Boolean(handEnd || matchResult || showIntro)}
            onClick={() => setPaused(true)}
          >
            <span aria-hidden="true">☰</span>
            <span className="en">Pause</span>
          </button>
        </div>
      </footer>

      {showIntro && (
        <PersonalitiesIntro personalities={seatPersonalities} onStart={dismissIntro} />
      )}

      {handEnd && !matchResult && (
        <HandEndBanner
          result={handEnd.result}
          roundLabel={handEnd.roundLabel}
          seatName={seatName}
          onContinue={advanceHand}
          continueLabel="Next hand"
          meldsOf={(s) => view.seats[s].melds}
        />
      )}

      {matchResult && (
        <MatchComplete
          matchResult={matchResult}
          seatName={seatName}
          onMenu={() => go('menu')}
          onRematch={rematch}
        />
      )}

      {paused && !matchResult && (
        <PauseMenu
          onResume={() => setPaused(false)}
          onQuitToMenu={() => { setPaused(false); go('menu'); }}
        />
      )}
    </div>
  );
}

function ordinal(n: number): string {
  return ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
}
