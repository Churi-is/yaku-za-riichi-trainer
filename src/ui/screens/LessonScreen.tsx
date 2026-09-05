/**
 * LessonScreen — a lesson played on the real table.
 *
 * Every position in the course is a genuine engine state: the board below is
 * the same component the match uses, fed by `scriptedState`, and the tiles you
 * are allowed to tap are the ones the engine says are legal discards.
 *
 * THE COACH CARD. Where it goes and how big it is are decided per step by
 * `@dojo/coach`, from what the step is pointing at and how much it has to say
 * — top when the subject is your hand, bottom when the subject is somebody
 * else's pond, a side rail when the screen is wide enough for the board and
 * the card to sit apart. The felt is inset by exactly the card's band, so the
 * board scales into the space that is actually free and the card can never
 * sit on top of a seat. On a phone the card also collapses to a one-line peek
 * bar, so a long explanation can hand the whole table back.
 *
 * Pointing is done by dimming: the spotlight in TableBoard fades everything
 * that is not the subject. While a discard drill is open it narrows the hand
 * to the coach's options — the decision is between those tiles — and once
 * answered the board lights the correct discard while the coach explains.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LegalAction, SeatIndex, TileId } from '@engine/types';
import { getLegalActions, kindOf, toPublicView } from '@engine/index';
import { parseHand } from '@ai/handEval';
import TableBoard from '@ui/components/TableBoard';
import Tile from '@ui/components/Tile';
import { useOrientation } from '@ui/hooks/useOrientation';
import { lessonById, nextLesson, type DrillOption, type Step } from '@dojo/course';
import { coachPlacement } from '@dojo/coach';
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

/** A wide screen can sit the card beside the felt rather than over it. */
function useWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 760 && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 760 && window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return wide;
}

/** The collapsed card is a peek bar: one line of grip, no band of felt. */
const PEEK_BAND = 0.075;

export default function LessonScreen() {
  const go = useSession((s) => s.go);
  const lessonId = useSession((s) => s.lessonId);
  const openLesson = useSession((s) => s.openLesson);
  const completeLesson = useSession((s) => s.completeLesson);
  const { orient, compact } = useOrientation();
  const wide = useWide();

  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => { setAt(0); setPicked(null); setCollapsed(false); }, [lessonId]);
  useEffect(() => { setCollapsed(false); }, [at]);

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

  const answered = picked !== null;
  const chosen = answered ? step.options![picked!] : null;
  const isTileDrill = step.kind === 'drill' && (step.options ?? []).some((o) => o.tile);
  const blocked = step.kind === 'drill' && !answered;

  const focusTiles = useMemo(() => {
    if (!table) return [];
    const pond = step.focusPond ? tilesInRivers(table.view, step.focusPond) : [];
    if (step.focus) return [...tilesInHand(table.view, step.focus), ...pond];
    if (pond.length) return pond;
    // While a discard drill is open the spotlight narrows the hand to the
    // coach's options: the decision is between those tiles, and dimming the
    // rest keeps the felt readable. After the answer the board lights the
    // correct discard while the coach explains itself.
    if (isTileDrill && !answered) {
      return (step.options ?? []).flatMap((o) => (o.tile ? tilesInHand(table.view, o.tile) : []));
    }
    if (answered) {
      const right = (step.options ?? []).find((o) => o.correct && o.tile);
      if (right) return tilesInHand(table.view, right.tile!);
    }
    return [];
  }, [table, step, answered, isTileDrill]);

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

  // --- where the card goes and how much room it takes ---------------------
  const place = useMemo(
    () => coachPlacement(step, table?.view ?? null, wide),
    [step, table, wide],
  );
  // An answered drill has the verdict and every explanation to show, so it is
  // always the biggest the card ever gets; a collapsed card is just its grip.
  const band = place.slot === 'rail'
    ? 0
    : collapsed
      ? PEEK_BAND
      : answered ? 0.62 : place.band;
  // The felt gives up exactly the card's band, so the board scales into the
  // rest instead of hiding underneath it.
  const feltStyle = place.slot === 'rail'
    ? undefined
    : place.slot === 'top'
      ? { top: `calc(${band * 100}% + 8px)` }
      : { bottom: `calc(${band * 100}% + 8px)` };

  const peek = (step.kind === 'drill' ? step.prompt : (step.table ?? step.text?.[0])) ?? lesson.title;

  // A fresh step — or a freshly opened card — starts at the top of its text.
  useEffect(() => {
    const el = cardRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: 0 });
  }, [at, collapsed, answered]);

  return (
    <div className="lesson-live" data-orient={orient} data-coach={place.slot}>
      <header className="lesson-bar">
        <button className="btn btn-ghost btn-sm" aria-label="Back to the dojo" onClick={() => go('dojo')}>←</button>
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

      <div className="lesson-felt">
        <div className="lesson-board" style={feltStyle}>
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

        <section
          ref={cardRef}
          className={`coach coach-${place.slot} coach-${place.size}${answered ? ' coach-open' : ''}${collapsed ? ' coach-collapsed' : ''}`}
          style={place.slot === 'rail' ? undefined : { maxHeight: `${band * 100}%` }}
        >
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
          {(place.slot === 'rail' || !collapsed) && (<>
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
                <p className="tap-hint">Tap a lit tile on the table.</p>
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
      </div>

      <footer className="lesson-foot">
        {at > 0 && (
          <button className="btn btn-ghost" aria-label="Previous step" onClick={() => { setAt(at - 1); setPicked(null); }}>←</button>
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
