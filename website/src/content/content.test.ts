import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { LOCALES } from '../i18n';

const dir = (...p: string[]) => join(import.meta.dirname, ...p);

interface QuizFile {
  questions: { q: string; options: string[]; answer: number; why: string; stars: number; try?: string }[];
  bonus?: { q: string; a: string }[];
}

const quizNames = readdirSync(dir('quiz', 'en')).filter((f) => f.endsWith('.yaml'));
const load = (lang: string, name: string) => parse(readFileSync(dir('quiz', lang, name), 'utf8')) as QuizFile;

describe('quizzes', () => {
  it.each(quizNames)('%s exists in every language', (name) => {
    for (const lang of LOCALES) expect(readdirSync(dir('quiz', lang))).toContain(name);
  });

  // Translations must stay in step: same questions, same right answers
  it.each(quizNames)('%s: Romanian and English agree on answers, stars and links', (name) => {
    const [ro, en] = [load('ro', name), load('en', name)];
    expect(ro.questions.length).toBe(en.questions.length);
    ro.questions.forEach((q, i) => {
      const other = en.questions[i]!;
      expect(q.options.length, `question ${i + 1}`).toBe(other.options.length);
      expect(q.answer, `question ${i + 1}`).toBe(other.answer);
      expect(q.stars, `question ${i + 1}`).toBe(other.stars);
      expect(q.try, `question ${i + 1}`).toBe(other.try);
    });
    expect(ro.bonus?.length ?? 0).toBe(en.bonus?.length ?? 0);
  });

  // Every question has a, b, c, d. A YAML slip ("31,25 J" or "a: b" inside
  // [ ... ]) silently splits or merges options, and this catches it
  it.each(quizNames)('%s: every question has four options', (name) => {
    for (const lang of LOCALES) {
      for (const q of load(lang, name).questions) expect(q.options, q.q).toHaveLength(4);
    }
  });

  it.each(quizNames)('%s: every answer points at an option', (name) => {
    for (const lang of LOCALES) {
      for (const q of load(lang, name).questions) expect(q.answer).toBeLessThan(q.options.length);
    }
  });
});

describe('learn pages', () => {
  it('exist in every language', () => {
    const en = readdirSync(dir('learn', 'en')).sort();
    for (const lang of LOCALES) expect(readdirSync(dir('learn', lang)).sort()).toEqual(en);
  });
});
