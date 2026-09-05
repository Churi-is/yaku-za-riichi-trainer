/**
 * LessonScreen — a lesson as a scripted sequence of turns, one screen at a time.
 *
 * The old version was a page: all the prose, then a drill at the bottom. This
 * hands the same material out as the hand needs it. Each step is a position at
 * a named turn — hand, drawn tile, what the table is showing — with only the
 * paragraph that position calls for, and every lesson ends in three drills on
 * positions of the reader's own.
 *
 * Drills explain every option, not just the right one: knowing why the
 * plausible answer is wrong is the actual lesson.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseHand } from '@ai/handEval';
import type { TileId } from '@engine/types';
import Tile from '@ui/components/Tile';
import { lessonById, nextLesson, type DrillOption, type Step } from '@dojo/course';
import { useSession } from '@state/session';

function TileRow({ notation, size = 'md' }: { notation: string; size?: 'sm' | 'md' }) {
  const ids = useMemo<TileId[]>(() => {
    try { return parseHand(notation); } catch { return []; }
  }, [notation]);
  return (
    <div className="tile-row">
      {ids.map((id, i) => <Tile key={`${id}-${i}`} id={id} size={size} />)}
    </div>
  );
}

/** The scripted position: hand, the tile just drawn, and any called sets. */
function Position({ step }: { step: Step }) {
  if (!step.hand && !step.meld && !step.figures) return null;
  return (
    <div className="position">
      {step.turn && <span className="turn-chip">{step.turn}</span>}
      {(step.hand || step.draw) && (
        <div className="position-hand">
          {step.hand && <TileRow notation={step.hand} size="sm" />}
          {step.draw && (
            <div className="drawn">
              <TileRow notation={step.draw} size="sm" />
              <span className="drawn-label">drawn</span>
            </div>
          )}
        </div>
      )}
      {step.meld && (
        <div className="position-meld">
          <TileRow notation={step.meld} size="sm" />
          <span className="drawn-label">called</span>
        </div>
      )}
      {step.caption && <p className="position-caption">{step.caption}</p>}
    </div>
  );
}

function OptionFace({ o }: { o: DrillOption }) {
  if (o.tile) {
    return (
      <>
        <TileRow notation={o.tile} size="sm" />
        <span className="opt-label">Discard</span>
      </>
    );
  }
  return <span className="opt-word">{o.label}</span>;
}

function Drill({ step, onAnswered }: { step: Step; onAnswered: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const chosen = picked !== null ? step.options![picked] : null;

  return (
    <>
      <p className="lesson-p prompt">{step.prompt}</p>
      <div className="drill-options">
        {(step.options ?? []).map((o, i) => {
          const state = !answered
            ? ''
            : o.correct ? ' right' : i === picked ? ' wrong' : ' dim';
          return (
            <button
              key={i}
              type="button"
              className={`drill-opt${o.label ? ' wide' : ''}${state}`}
              disabled={answered}
              onClick={() => { setPicked(i); onAnswered(); }}
            >
              <OptionFace o={o} />
            </button>
          );
        })}
      </div>
      {answered && (
        <>
          <div className={`verdict-line ${chosen?.correct ? 'ok' : 'no'}`}>
            {chosen?.correct ? 'Correct' : 'Not the best answer'}
          </div>
          <div className="drill-why">
            {(step.options ?? []).map((o, i) => (
              <p key={i} className={o.correct ? 'why right' : i === picked ? 'why wrong' : 'why'}>
                <strong>{o.correct ? '✓' : i === picked ? '✕' : '·'}</strong>{' '}
                {o.why}
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function LessonScreen() {
  const go = useSession((s) => s.go);
  const lessonId = useSession((s) => s.lessonId);
  const openLesson = useSession((s) => s.openLesson);
  const completeLesson = useSession((s) => s.completeLesson);

  const [at, setAt] = useState(0);
  const [answered, setAnswered] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // A new lesson, or a new step, starts at the top of the screen.
  useEffect(() => { setAt(0); setAnswered(false); }, [lessonId]);
  // jsdom has no scrollTo; guard rather than crash the whole screen in tests.
  useEffect(() => { top.current?.scrollTo?.({ top: 0 }); }, [at]);

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
  const step = steps[Math.min(at, steps.length - 1)];
  const last = at >= steps.length - 1;
  const next = nextLesson(lesson.id);
  const blocked = step.kind === 'drill' && !answered;

  const advance = () => {
    if (last) {
      completeLesson(lesson.id);
      if (next) openLesson(next.id);
      else go('dojo');
      return;
    }
    setAt(at + 1);
    setAnswered(false);
  };

  return (
    <div className="screen screen-narrow stack" ref={top}>
      <div className="screen-head">
        <div>
          <span className="crumb">{chapter.title}</span>
          <h1 style={{ fontSize: 20 }}>{lesson.title}</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => go('dojo')}>← Dojo</button>
      </div>

      <div className="step-dots" aria-label={`Step ${at + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span
            key={i}
            className={`dot${i === at ? ' on' : ''}${i < at ? ' past' : ''}${s.kind === 'drill' ? ' drill' : ''}`}
          />
        ))}
        <span className="step-count">{at + 1} / {steps.length}</span>
      </div>

      <article className="lesson-body">
        {step.table && <p className="table-note">{step.table}</p>}
        <Position step={step} />
        {step.figures?.map((f, i) => (
          <figure className="tile-figure" key={i}>
            <TileRow notation={f.tiles} />
            <figcaption>{f.caption}</figcaption>
          </figure>
        ))}
        {(step.text ?? []).map((t, i) => <p className="lesson-p" key={i}>{t}</p>)}
        {step.note && (
          <aside className="lesson-note">
            <strong>{step.note.title}</strong>
            <span>{step.note.text}</span>
          </aside>
        )}
        {step.kind === 'drill' && <Drill key={at} step={step} onAnswered={() => setAnswered(true)} />}
      </article>

      <div className="start-bar step-bar">
        {at > 0 && (
          <button className="btn btn-ghost" onClick={() => { setAt(at - 1); setAnswered(false); }}>
            ←
          </button>
        )}
        <button className="btn btn-primary" disabled={blocked} onClick={advance}>
          {blocked
            ? 'Choose an answer'
            : last
              ? (next ? `Done — next: ${next.title}` : 'Finish the course')
              : step.kind === 'drill' ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  );
}
