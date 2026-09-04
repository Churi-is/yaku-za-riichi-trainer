/** MatchScreen — the live table. Owned by Worker D. */
import { useEffect, useMemo, useState } from 'react';
import type { Action, SeatIndex, TileId } from '@engine/types';
import { useSession } from '@state/session';
import { useMatch, getLogBuilder } from '@state/gameLoop';
import { usingFallback } from '@state/engineAdapter';

import ScoreBoard from '@ui/components/ScoreBoard';
import DoraDisplay from '@ui/components/DoraDisplay';
import DiscardRiver from '@ui/components/DiscardRiver';
import SeatInfo from '@ui/components/SeatInfo';
import HandView from '@ui/components/HandView';
import CallButtons from '@ui/components/CallButtons';
import PauseMenu from '@ui/components/PauseMenu';
import HandEndBanner from '@ui/components/HandEndBanner';
import PersonalitiesIntro from '@ui/components/PersonalitiesIntro';

import OverlayToggleBar from '@ui/overlays/OverlayToggleBar';
import YakuAdvisorPanel from '@ui/overlays/YakuAdvisorPanel';
import OpponentReadingPanel from '@ui/overlays/OpponentReadingPanel';
import WaitGuessingPanel from '@ui/overlays/WaitGuessingPanel';

export default function MatchScreen() {
  const go = useSession((s) => s.go);
  const overlays = useSession((s) => s.overlays);
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
  const opp1 = view.seats[1]; // right
  const opp2 = view.seats[2]; // top
  const opp3 = view.seats[3]; // left

  const noDiscardsYet = ([0, 1, 2, 3] as SeatIndex[]).every((s) => view.seats[s].river.length === 0);
  const showIntro = !introDismissed && !handEnd && !matchResult && noDiscardsYet
    && seatPersonalities.length > 0;

  const anyOverlayOn = overlays.yakuAdvisor || overlays.opponentReading || overlays.waitGuessing;

  return (
    <div className="match">
      <div className="match-top">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setPaused(true)}>☰ Pause</button>
          {usingFallback() && <span className="pill" title="Worker A's engine has not merged yet; using Worker D's built-in fallback rules engine.">demo engine</span>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>You: {me.points.toLocaleString()}</span>
        </div>
        <OverlayToggleBar />
      </div>

      <div className="table-wrap">
        <div className="table">
          {/* Top opponent (seat 2) */}
          <div className="seat-top">
            <SeatInfo seat={opp2} personalityName={seatName(2)} isTurn={view.turn === 2} isDealer={view.dealer === 2} thinking={aiThinking} />
            <DiscardRiver river={opp2.river} orientation="top" />
          </div>

          {/* Left opponent (seat 3) */}
          <div className="seat-left">
            <SeatInfo seat={opp3} personalityName={seatName(3)} isTurn={view.turn === 3} isDealer={view.dealer === 3} thinking={aiThinking} />
            <DiscardRiver river={opp3.river} orientation="left" />
          </div>

          {/* Center */}
          <div className="center-area">
            <div className="center-info">
              <ScoreBoard view={view} />
              <DoraDisplay indicators={view.doraIndicators} tilesRemaining={view.tilesRemaining} />
            </div>
          </div>

          {/* Right opponent (seat 1) */}
          <div className="seat-right">
            <SeatInfo seat={opp1} personalityName={seatName(1)} isTurn={view.turn === 1} isDealer={view.dealer === 1} thinking={aiThinking} />
            <DiscardRiver river={opp1.river} orientation="right" />
          </div>

          {/* Human (seat 0) river */}
          <div className="seat-bottom">
            <DiscardRiver river={me.river} orientation="bottom" />
          </div>
        </div>

        {/* Overlay layer — floats top-right, scrolls, never covers rivers on wide screens */}
        {anyOverlayOn && (
          <div className="overlay-layer">
            {overlays.yakuAdvisor && <YakuAdvisorPanel view={view} />}
            {overlays.opponentReading && <OpponentReadingPanel view={view} seatName={seatName} />}
            {overlays.waitGuessing && <WaitGuessingPanel view={view} seatName={seatName} />}
          </div>
        )}
      </div>

      {/* Call / action bar */}
      <CallButtons
        legal={humanLegal}
        riichiMode={riichiMode}
        onEnterRiichiMode={() => setRiichiMode(true)}
        onCancelRiichi={() => setRiichiMode(false)}
        onAct={act}
      />

      {/* Human hand dock */}
      <div className="hand-dock">
        <div className="row center" style={{ justifyContent: 'center', marginBottom: 4 }}>
          <span className="opp-name">You</span>
          <span className="opp-meta">
            Seat {me.seatWind[0].toUpperCase()} · {me.points.toLocaleString()} pts
            {me.riichi && <span style={{ color: 'var(--accent-red)' }}> · RIICHI</span>}
            {view.dealer === 0 && <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}>Dealer</span>}
          </span>
        </div>
        <HandView
          hand={view.hand}
          drawnTile={view.drawnTile}
          melds={me.melds}
          discardActions={humanLegal.filter((l) => l.action.type === 'discard')}
          onDiscard={onDiscard}
          riichiMode={riichiMode}
          locked={!canAct || isCallWindow}
        />
        {!humanTurn && !handEnd && !matchResult && (
          <div className="center muted" style={{ fontSize: 12, marginTop: 4 }}>
            {aiThinking ? 'Opponents are playing…' : 'Waiting…'}
          </div>
        )}
      </div>

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
