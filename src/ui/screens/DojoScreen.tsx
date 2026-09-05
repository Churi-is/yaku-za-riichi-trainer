/**
 * DojoScreen — the course contents page.
 *
 * A linear syllabus, in reading order, with the chapter it came from and how
 * far through you are. Progress is session-only, like everything else here.
 */
import { CHAPTERS, ALL_LESSONS } from '@dojo/course';
import { useSession } from '@state/session';

export default function DojoScreen() {
  const go = useSession((s) => s.go);
  const openLesson = useSession((s) => s.openLesson);
  const completed = useSession((s) => s.completed);

  const done = ALL_LESSONS.filter((x) => completed.includes(x.lesson.id)).length;
  const total = ALL_LESSONS.length;
  const next = ALL_LESSONS.find((x) => !completed.includes(x.lesson.id));

  return (
    <div className="screen screen-narrow stack">
      <div className="screen-head">
        <h1>The Dojo<span className="kan jp">道場</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>← Menu</button>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row spread" style={{ margin: 0, alignItems: 'baseline' }}>
          <strong style={{ fontSize: 15 }}>{done} of {total} lessons</strong>
          <span className="muted" style={{ fontSize: 12 }}>session progress</span>
        </div>
        <div className="course-bar"><span style={{ width: `${(done / total) * 100}%` }} /></div>
        {next && (
          <button className="btn btn-primary" onClick={() => openLesson(next.lesson.id)}>
            {done === 0 ? 'Start the course' : 'Continue'} — {next.lesson.title}
          </button>
        )}
      </div>

      {CHAPTERS.map((c) => {
        const doneIn = c.lessons.filter((l) => completed.includes(l.id)).length;
        return (
        <section key={c.id} className="stack" style={{ gap: 8 }}>
          <div className="chapter-head">
            <span className="jp kan">{c.kanji}</span>
            <div>
              <h3 style={{ margin: 0 }}>{c.title}</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{c.blurb}</p>
            </div>
            <span className="chapter-prog" aria-label={`${doneIn} of ${c.lessons.length} lessons done`}>
              {doneIn}/{c.lessons.length}
            </span>
            {c.book > 0 && <span className="book-tag">Book ch.{c.book}</span>}
          </div>
          <div className="lesson-list">
            {c.lessons.map((l) => {
              const isDone = completed.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`lesson-row${isDone ? ' done' : ''}`}
                  onClick={() => openLesson(l.id)}
                >
                  <span className="tick" aria-hidden="true">{isDone ? '✓' : ''}</span>
                  <span className="lesson-text">
                    <span className="lesson-title">{l.title}</span>
                    <span className="lesson-sum">{l.summary}</span>
                  </span>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
