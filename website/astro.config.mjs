// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// Deployed to GitHub Pages as a project site:
// https://mihaigociu.github.io/physics-simulations/
// If the site moves to its own repo or domain, only `site` and `base` change.
export default defineConfig({
  site: 'https://mihaigociu.github.io',
  base: '/physics-simulations',
  trailingSlash: 'always',
  integrations: [svelte()],
});
