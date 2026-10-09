# Physics Playground · Fizica în joacă

The browser version of the simulations in this repository, for students who
shouldn't have to install Python. See [PLAN.md](PLAN.md) for the full plan.

Live site: <https://mihaigociu.github.io/physics-simulations/>

## Develop

Requires Node 22 or newer.

```bash
cd website
npm install
npm run dev      # http://localhost:4321/physics-simulations/
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest): physics checked against the Python originals |
| `npm run test:e2e` | Browser tests (Playwright) on the built site; run `npm run build` first. First time: `npx playwright install chromium` |
| `npm run check` | Type-check Astro, Svelte and TS files |
| `npm run build` | Static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Layout

```
src/
  engine/    fixed-step loop, HiDPI canvas, world↔screen transform
  shared/    planets (g, air, colours), simulation registry, number formatting
  i18n/      ro.json (reference) and en.json; a test keeps their keys in sync
  sims/      one folder per simulation: physics, model, renderer, Svelte UI, tests
  chart/     live canvas line chart and tick maths (ported from the Python Chart)
  content/   Learn pages (Markdown) and quizzes (YAML), per language
  ui/        shared Svelte components: sliders, world picker, charts, quiz
  components/, layouts/, pages/[lang]/…   Astro pages and building blocks
  styles/    design tokens and global CSS
```

## Reference values from Python

`src/sims/*/golden.json` holds numbers produced by the original Python
simulations, and the unit tests require the TypeScript port to match them.
To regenerate after changing a Python file (uses the repo's `.venv`):

```bash
../.venv/bin/python scripts/golden/free_fall.py > src/sims/free-fall/golden.json
```

## Adding text

Every visible string goes in both `src/i18n/ro.json` and `src/i18n/en.json`.
`npm test` fails if a key is missing from either file.

## Deploy

Pushing to `main` with changes under `website/` runs
`.github/workflows/website.yml`, which tests, builds and publishes to GitHub
Pages. One-time setup: in the repo on GitHub, **Settings → Pages → Build and
deployment → Source: GitHub Actions**.
