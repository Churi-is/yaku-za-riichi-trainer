/**
 * DojoScreen — the course contents page.
 *
 * A linear syllabus in reading order. Every row says what the lesson is about
 * AND what it costs you: how many screens, how many drills. A row that is the
 * next thing to do is marked as such, and a chapter you have finished says so
 * on its own header rather than making you scan fourteen ticks. Progress is
 * session-only, like everything else here.
 */
import { CHAPTERS, ALL_LESSONS, lessonShape } from '@dojo/course';
import { useSession } from '@state/session';
import { useMatch } from '@state/gameLoop';

export default function DojoScreen() {
  const go = useSession((s) => s.go);
  const openLesson = useSession((s) => s.openLesson);
  const completed = useSession((s) => s.completed);
  const resetMatch = useMatch((s) => s.reset);

  const done = ALL_LESSONS.filter((x) => completed.includes(x.lesson.id)).length;
  const total = ALL_LESSONS.length;
  const next = ALL_LESSONS.find((x) => !completed.includes(x.lesson.id));

  return (
    <div className="screen screen-narrow">
      <div className="screen-head">
        <h1>The Dojo<span className="kan jp">道場</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('menu')}>← Menu</button>
      </div>

      <div className="screen-body stack">
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row spread" style={{ margin: 0, alignItems: 'baseline' }}>
          <strong style={{ fontSize: 15 }}>{done} of {total} lessons</strong>
          <span className="muted" style={{ fontSize: 12 }}>session progress</span>
        </div>
        <div className="course-bar"><span style={{ width: `${(done / total) * 100}%` }} /></div>
        {next ? (
          <button className="btn btn-primary course-cta" onClick={() => openLesson(next.lesson.id)}>
            <span className="cta-kicker">{done === 0 ? 'Start the course' : 'Continue'}</span>
            <span className="cta-title">{next.lesson.title}</span>
          </button>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Every lesson done. Take it to the table and see how much of it survives contact.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => { resetMatch(); go('opponents'); }}
            >
              Play a Match<span className="kan jp" style={{ marginLeft: 8, opacity: 0.85 }}>対局</span>
            </button>
          </div>
        )}
      </div>

      {CHAPTERS.map((c) => {
        const chDone = c.lessons.filter((l) => completed.includes(l.id)).length;
        return (
          <section key={c.id} className="stack" style={{ gap: 8 }}>
            <div className="chapter-head">
              <span className="jp kan">{c.kanji}</span>
              <div className="chapter-text">
                <h3 style={{ margin: 0 }}>{c.title}</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{c.blurb}</p>
              </div>
              <span className="chapter-meta">
                {c.book > 0 && <span className="book-tag">Book ch.{c.book}</span>}
                <span className={`chapter-count${chDone === c.lessons.length ? ' all' : ''}`}>
                  {chDone}/{c.lessons.length}
                </span>
              </span>
            </div>
            <div className="lesson-list">
              {c.lessons.map((l) => {
                const isDone = completed.includes(l.id);
                const isNext = next?.lesson.id === l.id;
                const { steps, drills } = lessonShape(l);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`lesson-row${isDone ? ' done' : ''}${isNext ? ' next' : ''}`}
                    onClick={() => openLesson(l.id)}
                  >
                    <span className="tick" aria-hidden="true">{isDone ? '✓' : ''}</span>
                    <span className="lesson-text">
                      <span className="lesson-title">{l.title}</span>
                      <span className="lesson-sum">{l.summary}</span>
                      <span className="lesson-meta">
                        <span>{steps} screens</span>
                        {drills > 0 && <span>{drills} drills</span>}
                        {isNext && <span className="up-next">Up next</span>}
                      </span>
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
    </div>
  );
}
