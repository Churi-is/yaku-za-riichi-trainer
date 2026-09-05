/**
 * LessonScreen — a lesson played on the real table.
 *
 * Every position in the course is a genuine engine state: the board below is
 * the same component the match uses, fed by `scriptedState`, and the tiles you
 * are allowed to tap are the ones the engine says are legal discards. The
 * coach speaks from a card that floats over the felt and moves out of the way
 * of whatever it is pointing at — talk about the hand and the card sits up by
 * the wall, talk about the dora and it drops to the bottom.
 *
 * Pointing is done by dimming: the spotlight in TableBoard fades everything
 * that is not the subject, which is less work to read than "look at the third
 * tile from the left".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LegalAction, SeatIndex, TileId } from '@engine/types';
import { getLegalActions, kindOf, toPublicView } from '@engine/index';
import { parseHand } from '@ai/handEval';
import TableBoard from '@ui/components/TableBoard';
import Tile from '@ui/components/Tile';
import { useOrientation } from '@ui/hooks/useOrientation';
import { lessonById, nextLesson, type DrillOption, type Step } from '@dojo/course';
import { scriptedState, tilesInHand, tilesInRivers } from '@dojo/table';
import { useSession } from '@state/session';

const NO_NAME = (s: SeatIndex) => (s === 0 ? 'You' : `Seat ${s}`);

function TileRow({ notation, size = 'sm' }: { notation: string; size?: 'sm' | 'md' }) {
  const ids = useMemo<TileId[]>(() => {
    try { return parseHand(notation); } catch { return []; }
  }, [notation]);
  return (
    <div className="tile-row">
      {ids.map((id, i) => <Tile key={`${id}-${i}`} id={id} size={size} />)}
    </div>
  );
}

function OptionFace({ o }: { o: DrillOption }) {
  if (o.tile) {
    return (
      <>
        <TileRow notation={o.tile} />
        <span className="opt-label">Discard</span>
      </>
    );
  }
  return <span className="opt-word">{o.label}</span>;
}

export default function LessonScreen() {
  const go = useSession((s) => s.go);
  const lessonId = useSession((s) => s.lessonId);
  const openLesson = useSession((s) => s.openLesson);
  const completeLesson = useSession((s) => s.completeLesson);
  const { orient, compact } = useOrientation();

  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const coachRef = useRef<HTMLElement>(null);

  useEffect(() => { setAt(0); setPicked(null); setCollapsed(false); }, [lessonId]);
  useEffect(() => { setCollapsed(false); }, [at]);
  // a long explanation may leave the card scrolled; a new step starts at its top
  useEffect(() => {
    const el = coachRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: 0 });
  }, [at, collapsed]);

  const found = lessonId ? lessonById(lessonId) : null;
  if (!found) {
    return (
      <div className="screen center stack">
        <p className="muted">No lesson open.</p>
        <button className="btn btn-primary" onClick={() => go('dojo')}>Back to the dojo</button>
      </div>
    );
  }

  const { chapter, lesson } = found;
  const steps = lesson.steps;
  const step: Step = steps[Math.min(at, steps.length - 1)];
  const last = at >= steps.length - 1;
  const next = nextLesson(lesson.id);

  // --- the position, built by the engine ----------------------------------
  const table = useMemo(() => {
    if (!step.hand) return null;
    try {
      const state = scriptedState({
        hand: step.hand,
        draw: step.draw,
        dora: step.dora,
        rivers: step.rivers,
        riichi: step.riichi,
        wall: step.wall,
        seatWind: step.seatWind,
      });
      return { state, view: toPublicView(state, 0) };
    } catch {
      return null; // a broken script is caught by the test suite, not the player
    }
  }, [step]);

  const legal: LegalAction[] = useMemo(
    () => (table ? getLegalActions(table.state, 0).filter((l) => l.action.type === 'discard') : []),
    [table],
  );

  const focusTiles = useMemo(() => {
    if (!table) return [];
    const pond = step.focusPond ? tilesInRivers(table.view, step.focusPond) : [];
    if (step.focus) return [...tilesInHand(table.view, step.focus), ...pond];
    if (pond.length) return pond;
    // While a tile drill is open the whole hand stays lit: spotlighting the
    // answer options would dim the very tiles the player has to weigh. After
    // the answer, the board points at the correct discard while the coach
    // explains itself.
    if (step.kind === 'drill' && picked !== null) {
      const right = (step.options ?? []).find((o) => o.correct && o.tile);
      if (right) return tilesInHand(table.view, right.tile!);
    }
    return [];
  }, [table, step, picked]);

  const answered = picked !== null;
  const chosen = answered ? step.options![picked!] : null;
  const isTileDrill = step.kind === 'drill' && (step.options ?? []).some((o) => o.tile);
  const blocked = step.kind === 'drill' && !answered;

  /** Tapping a tile on the felt answers a discard drill. */
  const tapTile = (tile: TileId | null) => {
    if (tile === null || !isTileDrill || answered) return;
    const i = (step.options ?? []).findIndex(
      (o) => o.tile && kindOf(parseHand(o.tile)[0]) === kindOf(tile),
    );
    setPicked(i >= 0 ? i : -1);
  };

  const advance = () => {
    if (last) {
      completeLesson(lesson.id);
      if (next) openLesson(next.id); else go('dojo');
      return;
    }
    setAt(at + 1);
    setPicked(null);
  };

  // Keep the card off the thing being pointed at.
  const cardAt = step.cardAt
    ?? (step.focusCentre ? 'bottom' : focusTiles.length || isTileDrill ? 'top' : 'bottom');
  const peek = (step.kind === 'drill' ? step.prompt : (step.table ?? step.text?.[0])) ?? lesson.title;

  return (
    <div className="lesson-live" data-orient={orient}>
      <header className="lesson-bar">
        <button className="btn btn-ghost btn-sm" onClick={() => go('dojo')}>←</button>
        <div className="lesson-bar-title">
          <span className="crumb">{chapter.title}</span>
          <strong>{lesson.title}</strong>
        </div>
        <div className="step-dots" aria-label={`Step ${at + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <span
              key={i}
              className={`dot${i === at ? ' on' : ''}${i < at ? ' past' : ''}${s.kind === 'drill' ? ' drill' : ''}`}
            />
          ))}
        </div>
      </header>

      <div className="lesson-felt" data-dock={cardAt} data-collapsed={collapsed ? 'yes' : 'no'}>
        <section className="coach" ref={coachRef}>
          <button
            type="button"
            className="coach-grip"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand the coach card' : 'Collapse the coach card'}
          >
            {step.turn && <span className="turn-chip">{step.turn}</span>}
            {collapsed
              ? <span className="coach-peek">{peek}</span>
              : <span className="grip-word">Coach</span>}
            <span className="grip-chev" aria-hidden="true">▾</span>
          </button>
          {!collapsed && (<>
          {step.table && <p className="table-note">{step.table}</p>}
          {(step.text ?? []).map((t, i) => <p className="lesson-p" key={i}>{t}</p>)}
          {step.figures?.map((f, i) => (
            <figure className="tile-figure" key={i}>
              <TileRow notation={f.tiles} />
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
          {step.note && (
            <aside className="lesson-note">
              <strong>{step.note.title}</strong>
              <span>{step.note.text}</span>
            </aside>
          )}

          {step.kind === 'drill' && (
            <>
              <p className="lesson-p prompt">{step.prompt}</p>
              {isTileDrill && !answered && (
                <p className="tap-hint">Tap a tile on the table.</p>
              )}
              {(!isTileDrill || answered) && (
                <div className="drill-options">
                  {(step.options ?? []).map((o, i) => {
                    const state = !answered ? '' : o.correct ? ' right' : i === picked ? ' wrong' : ' dim';
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`drill-opt${o.label ? ' wide' : ''}${state}`}
                        disabled={answered}
                        onClick={() => setPicked(i)}
                      >
                        <OptionFace o={o} />
                      </button>
                    );
                  })}
                </div>
              )}
              {answered && (
                <>
                  <div className={`verdict-line ${chosen?.correct ? 'ok' : 'no'}`}>
                    {chosen?.correct ? 'Correct' : picked === -1 ? 'Not one of the choices' : 'Not the best answer'}
                  </div>
                  <div className="drill-why">
                    {(step.options ?? []).map((o, i) => (
                      <p key={i} className={o.correct ? 'why right' : i === picked ? 'why wrong' : 'why'}>
                        <strong>{o.correct ? '✓' : i === picked ? '✕' : '·'}</strong> {o.why}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          </>)}
        </section>

        <div className="felt-area">
          {table ? (
            <TableBoard
              view={table.view}
              seatName={NO_NAME}
              aiThinking={false}
              orient={orient}
              compact={compact}
              discardActions={isTileDrill && !answered ? legal : []}
              onDiscard={() => undefined}
              selected={null}
              onSelect={tapTile}
              riichiMode={false}
              locked={!isTileDrill || answered}
              highlight={focusTiles}
              focusCentre={step.focusCentre}
              tapToAnswer
            />
          ) : (
            <div className="lesson-nofelt" />
          )}
        </div>
      </div>

      <footer className="lesson-foot">
        {at > 0 && (
          <button className="btn btn-ghost" onClick={() => { setAt(at - 1); setPicked(null); }}>←</button>
        )}
        <span className="step-count">{at + 1} / {steps.length}</span>
        <button className="btn btn-primary" disabled={blocked} onClick={advance}>
          {blocked
            ? (isTileDrill ? 'Tap a tile' : 'Choose an answer')
            : last
              ? (next ? 'Next lesson' : 'Finish')
              : step.kind === 'drill' ? 'Continue' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
