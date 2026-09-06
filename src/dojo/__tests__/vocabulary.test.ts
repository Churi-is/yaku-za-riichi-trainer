/**
 * First-use vocabulary lint.
 *
 * The course's recurring failure mode is a term being used as a decision
 * criterion before any lesson has defined it (ippatsu, ura, mangan all
 * entered the strategy track that way). The rule this test enforces: a term
 * may only appear in the teaching text of a lesson at or after the lesson
 * that defines it, in reading order.
 *
 * When a new term is properly defined at first use, add it here. `phrase`
 * is a word-boundary regex (case-insensitive) over the lesson's full text —
 * summary, steps, notes, prompts, options and figure captions.
 */
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS } from '../course';

const JARGON: { pattern: RegExp; definedIn: string }[] = [
  { pattern: /\bippatsu\b/i, definedIn: 'insta-riichi' },
  { pattern: /\bura\b/i, definedIn: 'insta-riichi' },
  { pattern: /\bmangan\b/i, definedIn: 'dora-and-scoring' },
  { pattern: /\bmenzen\b/i, definedIn: 'dora-and-scoring' },
];

function lessonText(id: string): string {
  const found = ALL_LESSONS.find((x) => x.lesson.id === id);
  if (!found) return '';
  const { lesson } = found;
  const parts: string[] = [lesson.summary];
  for (const s of lesson.steps) {
    parts.push(...(s.text ?? []), s.table ?? '', s.prompt ?? '');
    if (s.note) parts.push(s.note.title, s.note.text);
    for (const o of s.options ?? []) parts.push(o.label ?? '', o.why);
    for (const f of s.figures ?? []) parts.push(f.caption);
  }
  return parts.join(' ');
}

describe('first-use vocabulary', () => {
  it('every defined term is actually defined in its definer lesson', () => {
    for (const { pattern, definedIn } of JARGON) {
      expect(
        lessonText(definedIn).match(pattern),
        `definer "${definedIn}" no longer mentions its own term`,
      ).toBeTruthy();
    }
  });

  it('no lesson before the definer uses the term', () => {
    const ids = ALL_LESSONS.map((x) => x.lesson.id);
    for (const { pattern, definedIn } of JARGON) {
      const definerIdx = ids.indexOf(definedIn);
      expect(definerIdx, `unknown definer lesson "${definedIn}"`).toBeGreaterThanOrEqual(0);
      for (let i = 0; i < definerIdx; i++) {
        const text = lessonText(ids[i]);
        expect(
          text.match(pattern),
          `"${ids[i]}" uses a term first defined in "${definedIn}" — define it at first use`,
        ).toBeNull();
      }
    }
  });
});
