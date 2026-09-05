/**
 * LessonScreen — one lesson: prose, tile diagrams and drills.
 *
 * The drills are the point. Reading that a two-sided shape accepts eight tiles
 * does nothing; being asked which tile to throw, getting it wrong, and being
 * told why is what sticks. Every option carries an explanation, not just the
 * right one, because knowing why the plausible answer is wrong is the lesson.
 */
import { useMemo, useState } from 'react';
import { parseHand } from '@ai/handEval';
import type { TileId } from '@engine/types';
import Tile from '@ui/components/Tile';
import { lessonById, nextLesson, type LessonSection, type Quiz } from '@dojo/course';
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

function Section({ s }: { s: LessonSection }) {
  switch (s.kind) {
    case 'tiles':
      return (
        <figure className="tile-figure">
          <TileRow notation={s.tiles ?? ''} />
          {s.caption && <figcaption>{s.caption}</figcaption>}
        </figure>
      );
    case 'callout':
      return (
        <aside className="lesson-note">
          {s.title && <strong>{s.title}</strong>}
          <span>{s.text}</span>
        </aside>
      );
    case 'list':
      return (
        <ul className="lesson-list-items">
          {(s.items ?? []).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    default:
      return <p className="lesson-p">{s.text}</p>;
  }
}

function Drill({ quiz, index }: { quiz: Quiz; index: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const chosen = quiz.options.find((o) => o.tile === picked);

  return (
    <div className="drill">
      <div className="drill-head">
        <span className="drill-n">Drill {index + 1}</span>
        {answered && (
          <span className={chosen?.correct ? 'verdict ok' : 'verdict no'}>
            {chosen?.correct ? 'Correct' : 'Not the best'}
          </span>
        )}
      </div>
      <p className="lesson-p">{quiz.prompt}</p>
      <TileRow notation={quiz.hand} size="sm" />
      <div className="drill-options">
        {quiz.options.map((o) => {
          const state = !answered ? '' : o.correct ? ' right' : o.tile === picked ? ' wrong' : ' dim';
          return (
            <button
              key={o.tile}
              type="button"
              className={`drill-opt${state}`}
              disabled={answered}
              onClick={() => setPicked(o.tile)}
            >
              <span className="opt-tiles"><TileRow notation={o.tile} size="sm" /></span>
              <span className="opt-label">Discard</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="drill-why">
          {quiz.options.map((o) => (
            <p key={o.tile} className={o.correct ? 'why right' : o.tile === picked ? 'why wrong' : 'why'}>
              <strong>{o.correct ? '✓' : o.tile === picked ? '✕' : '·'}</strong> {o.why}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LessonScreen() {
  const go = useSession((s) => s.go);
  const lessonId = useSession((s) => s.lessonId);
  const openLesson = useSession((s) => s.openLesson);
  const completeLesson = useSession((s) => s.completeLesson);

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
  const next = nextLesson(lesson.id);

  return (
    <div className="screen screen-narrow stack">
      <div className="screen-head">
        <div>
          <span className="crumb">{chapter.title}</span>
          <h1 style={{ fontSize: 21 }}>{lesson.title}</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => go('dojo')}>← Dojo</button>
      </div>

      <article className="lesson-body">
        {lesson.sections.map((s, i) => <Section key={i} s={s} />)}
        {(lesson.quizzes ?? []).map((q, i) => <Drill key={i} quiz={q} index={i} />)}
      </article>

      <div className="start-bar">
        <button
          className="btn btn-primary"
          onClick={() => {
            completeLesson(lesson.id);
            if (next) openLesson(next.id);
            else go('dojo');
          }}
        >
          {next ? `Done — next: ${next.title}` : 'Finish the course'}
        </button>
      </div>
    </div>
  );
}
