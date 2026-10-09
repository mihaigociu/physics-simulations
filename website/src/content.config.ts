import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Explainer pages: src/content/learn/<lang>/<sim>.md → id "<lang>/<sim>"
const learn = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/learn' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

// Quizzes: src/content/quiz/<lang>/<sim>.yaml
const quiz = defineCollection({
  loader: glob({ pattern: '*/*.yaml', base: './src/content/quiz' }),
  schema: z.object({
    questions: z
      .array(
        z.object({
          q: z.string(),
          options: z.array(z.string()).min(2),
          /** Index into `options`. */
          answer: z.number().int().nonnegative(),
          why: z.string(),
          stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          /** Optional simulation preset, e.g. "?world=moon&h=20". */
          try: z.string().optional(),
        }),
      )
      .refine((qs) => qs.every((q) => q.answer < q.options.length), 'answer index out of range'),
    bonus: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { learn, quiz };
