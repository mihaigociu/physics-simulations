import { defineConfig } from 'vitest/config';

// Unit tests cover the pure TypeScript modules only (physics, engine maths,
// formatting, i18n). They run without Astro or a browser.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
