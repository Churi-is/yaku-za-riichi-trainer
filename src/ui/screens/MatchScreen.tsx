/** MatchScreen — the live table, top-down. Owned by Worker D. */
import { useEffect, useMemo, useState } from 'react';
import type { Action, SeatIndex, TileId } from '@engine/types';
import { useSession } from '@state/session';
import { useMatch, getLogBuilder } from '@state/gameLoop';
import { usingFallback } from '@state/engineAdapter';
import { useOrientation } from '@ui/hooks/useOrientation';

import ScoreStrip from '@ui/components/ScoreStrip';
import TableBoard from '@ui/components/TableBoard';
import HandView from '@ui/components/HandView';
import CallBar from '@ui/components/CallBar';
import PauseMenu from '@ui/components/PauseMenu';
import HandEndBanner from '@ui/components/HandEndBanner';
import PersonalitiesIntro from '@ui/components/PersonalitiesIntro';

import OverlayToggleBar from '@ui/overlays/OverlayToggleBar';
import OverlayDock from '@ui/overlays/OverlayDock';

export default function MatchScreen() {
  const go = useSession((s) => s.go);
  const setMatchLog = useSession((s) => s.setMatchLog);

  const state = useMatch((s) => s.state);
  const view = useMatch((s) => s.view);
  const humanLegal = useMatch((s) => s.humanLegal);
  const aiThinking = useMatch((s) => s.aiThinking);
  const seatPersonalities = useMatch((s) => s.seatPersonalities);
  const handEnd = useMatch((s) => s.handEnd);
  const matchResult = useMatch((s) => s.matchResult);
  const humanAct = useMatch((s) => s.humanAct);
  const advanceHand = useMatch((s) => s.advanceHand);

  const { orient, compact } = useOrientation();

  const [paused, setPaused] = useState(false);
  const [riichiMode, setRiichiMode] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);

  // Reset intro when a new match starts (new personalities set).
  useEffect(() => { setIntroDismissed(false); }, [seatPersonalities]);

  const seatName = useMemo(() => {
    const map: Record<number, string> = { 0: 'You' };
    for (const p of seatPersonalities) map[p.seat] = p.name;
    return (seat: SeatIndex) => map[seat] ?? `Seat ${seat}`;
  }, [seatPersonalities]);

  // When the match finishes, package the log and jump to replay.
  useEffect(() => {
    if (matchResult) {
      const builder = getLogBuilder();
      if (builder) setMatchLog(builder.build());
    }
  }, [matchResult, setMatchLog]);

  if (!state || !view) {
    return (
      <div className="screen center">
        <p>No match in progress.</p>
        <button className="btn btn-primary" onClick={() => go('settings')}>New Match</button>
      </div>
    );
  }

  const act = (action: Action) => {
    setRiichiMode(false);
    humanAct(action);
  };

  const onDiscard = (tile: TileId, riichi: boolean) => {
    act({ type: 'discard', seat: 0, tile, riichi });
  };

  const humanTurn = humanLegal.length > 0;
  const isCallWindow = humanTurn && humanLegal.some((l) => l.action.type === 'pass');
  const canAct = humanTurn && !paused;

  const me = view.seats[0];

  const noDiscardsYet = ([0, 1, 2, 3] as SeatIndex[]).every((s) => view.seats[s].river.length === 0);
  const showIntro = !introDismissed && !handEnd && !matchResult && noDiscardsYet
    && seatPersonalities.length > 0;

  return (
    <div className="match" data-orient={orient}>
      <ScoreStrip
        view={view}
        seatName={seatName}
        tools={(
          <>
            {usingFallback() && (
              <span className="pill" title="Worker A's engine has not merged yet; using Worker D's built-in fallback rules engine.">demo</span>
            )}
            {!humanTurn && !handEnd && !matchResult && (
              <span className="pill turn-status" role="status">
                {aiThinking ? 'Opponents playing…' : 'Waiting…'}
              </span>
            )}
            <OverlayToggleBar />
            <button
              type="button"
              className="tab-btn"
              aria-label="Pause menu"
              title="Pause"
              onClick={() => setPaused(true)}
            >
              ☰
            </button>
          </>
        )}
      />

      <div className="match-main">
        <div className="felt-wrap">
          <TableBoard view={view} seatName={seatName} aiThinking={aiThinking} orient={orient} compact={compact} />
        </div>
        <OverlayDock view={view} seatName={seatName} callWindow={isCallWindow && canAct} />
      </div>

      <footer className="dock-bottom">
        <HandView
          hand={view.hand}
          drawnTile={view.drawnTile}
          melds={me.melds}
          discardActions={humanLegal.filter((l) => l.action.type === 'discard')}
          onDiscard={onDiscard}
          riichiMode={riichiMode}
          locked={!canAct || isCallWindow}
        />
        <CallBar
          legal={humanLegal}
          riichiMode={riichiMode}
          onEnterRiichiMode={() => setRiichiMode(true)}
          onCancelRiichi={() => setRiichiMode(false)}
          onAct={act}
        />
      </footer>

      {showIntro && (
        <PersonalitiesIntro personalities={seatPersonalities} onStart={() => setIntroDismissed(true)} />
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
        <div className="scrim">
          <div className="card handend-card stack center">
            <h2>Match complete</h2>
            <p className="muted">
              You finished {ordinal(matchResult.ranking.indexOf(0) + 1)} with {matchResult.finalPoints[0].toLocaleString()} points.
            </p>
            <button className="btn btn-primary" onClick={() => go('replay')}>See your graded replay →</button>
            <button className="btn" onClick={() => go('summary')}>Session summary</button>
          </div>
        </div>
      )}

      {paused && (
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
