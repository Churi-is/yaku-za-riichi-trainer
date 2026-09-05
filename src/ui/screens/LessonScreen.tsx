/**
 * LessonScreen — a lesson played on the real table.
 *
 * Every position in the course is a genuine engine state: the board below is
 * the same component the match uses, fed by `scriptedState`, and the tiles you
 * are allowed to tap are the ones the engine says are legal discards.
 *
 * The coach speaks from a card that takes real room on the screen rather than
 * floating over the felt, so it can never cover its own subject: the board
 * rescales to whatever is left. In portrait the card sits above or below the
 * felt, sized to what it has to say and placed next to whatever is lit — talk
 * about the hand and it sits just above the hand, point at the far pond or the
 * dora and it moves to the top. In landscape it docks in a column beside the
 * felt, on the side of the seat being discussed.
 *
 * Pointing is done by dimming: the spotlight in TableBoard fades everything
 * that is not the subject, which is less work to read than "look at the third
 * tile from the left".
 */
import { useEffect, useMemo, useState } from 'react';
import type { LegalAction, SeatIndex, TileId } from '@engine/types';
import { getLegalActions, kindOf, toPublicView } from '@engine/index';
import { parseHand } from '@ai/handEval';
import TableBoard from '@ui/components/TableBoard';
import Tile from '@ui/components/Tile';
import { useOrientation } from '@ui/hooks/useOrientation';
import { lessonById, nextLesson, type DrillOption, type Step } from '@dojo/course';
import { scriptedState, stepScript, tilesInHand, tilesInRivers } from '@dojo/table';
import { cardSize, landscapeSide, portraitEnd, subjectOf } from '@dojo/coach';
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

const wordCount = (parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;

export default function LessonScreen() {
  const go = useSession((s) => s.go);
  const lessonId = useSession((s) => s.lessonId);
  const openLesson = useSession((s) => s.openLesson);
  const completeLesson = useSession((s) => s.completeLesson);
  const { orient, compact, width } = useOrientation();

  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => { setAt(0); setPicked(null); }, [lessonId]);

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
    const script = stepScript(step);
    if (!script) return null;
    try {
      const state = scriptedState(script);
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
  const tapping = isTileDrill && !answered;
  const blocked = step.kind === 'drill' && !answered;

  const focusTiles = useMemo(() => {
    if (!table) return [];
    const pond = step.focusPond ? tilesInRivers(table.view, step.focusPond) : [];
    if (isTileDrill) {
      // A tile drill spotlights the tiles it is asking about — and, once
      // answered, just the right one — alongside whatever pond evidence the
      // question rests on.
      const asked = answered
        ? [(step.options ?? []).find((o) => o.correct)?.tile].filter((t): t is string => Boolean(t))
        : (step.options ?? []).filter((o) => o.tile).map((o) => o.tile!);
      return [...asked.flatMap((t) => tilesInHand(table.view, t)), ...pond];
    }
    if (step.focus) return [...tilesInHand(table.view, step.focus), ...pond];
    return pond;
  }, [table, step, isTileDrill, answered]);

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

  // --- where the coach sits ------------------------------------------------
  // Beside the subject, never over it: the card takes real space and the
  // board rescales to what is left. Portrait stacks it above or below the
  // felt; a wide enough landscape docks it in a column left or right.
  // (A tile drill counts as "about the hand" before and after it is answered,
  // so the card does not jump sides the moment you tap.)
  const subject = subjectOf(table?.view ?? null, focusTiles, { centre: step.focusCentre, tapping: isTileDrill });
  const docked = orient === 'landscape' && width >= 640;
  const place = docked ? landscapeSide(subject) : portraitEnd(subject, step.cardAt);
  const words = wordCount([
    step.table, ...(step.text ?? []), step.note?.text, step.prompt,
    ...(step.figures ?? []).map((f) => f.caption),
  ]);
  const size = cardSize(words, {
    answered,
    figures: step.figures?.length,
    choices: step.kind === 'drill' && !isTileDrill ? (step.options ?? []).length : 0,
  });

  return (
    <div className="lesson-live" data-orient={orient} data-coach={place}>
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

      <div className={`lesson-stage stage-${place}`}>
        <div className="lesson-felt">
          {table ? (
            <TableBoard
              view={table.view}
              seatName={NO_NAME}
              aiThinking={false}
              orient={orient}
              compact={compact}
              discardActions={tapping ? legal : []}
              onDiscard={() => undefined}
              selected={null}
              onSelect={tapTile}
              riichiMode={false}
              locked={!tapping}
              highlight={focusTiles}
              focusCentre={step.focusCentre}
              tapToAnswer
            />
          ) : (
            <div className="lesson-nofelt" />
          )}
        </div>

        <section
          key={`${lesson.id}-${at}`}
          className={`coach coach-${place} coach-${size}`}
          aria-live="polite"
        >
          {step.turn && <span className="turn-chip">{step.turn}</span>}
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
              {tapping && (
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
        </section>
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
