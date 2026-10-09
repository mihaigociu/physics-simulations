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
| `npm test` | Unit tests (Vitest) |
| `npm run check` | Type-check Astro, Svelte and TS files |
| `npm run build` | Static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Layout

```
src/
  engine/    fixed-step loop, HiDPI canvas, world↔screen transform
  shared/    planets (g, air, colours), simulation registry, number formatting
  i18n/      ro.json (reference) and en.json; a test keeps their keys in sync
  ui/        Svelte components (interactive islands)
  components/, layouts/, pages/[lang]/…   Astro pages and building blocks
  styles/    design tokens and global CSS
```

## Adding text

Every visible string goes in both `src/i18n/ro.json` and `src/i18n/en.json`.
`npm test` fails if a key is missing from either file.

## Deploy

Pushing to `main` with changes under `website/` runs
`.github/workflows/website.yml`, which tests, builds and publishes to GitHub
Pages. One-time setup: in the repo on GitHub, **Settings → Pages → Build and
deployment → Source: GitHub Actions**.
