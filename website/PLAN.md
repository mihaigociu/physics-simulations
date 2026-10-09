# Physics Website — Plan

An educational website that puts the simulations from `../physics-simulations`
in the browser. Students, especially kids aged 10–12, open a link and start
playing: there's nothing to install, no account and no Python.

**In scope:** Free Fall, Spring Launcher, Bucket Drip (Torricelli), Electric Field.
**Out of scope:** Permeability Analysis (`permeability.py`). It's an offline
OpenPNM analysis with nothing interactive.

---

## 1. Goals and constraints

| Goal | What it means in practice |
|---|---|
| Zero setup | A static website that works in any current browser, including school Chromebooks, iPads and phones. |
| Kid-friendly | Large touch targets (≥ 44 px), few controls on screen at once, friendly visuals, short text, immediate feedback. |
| Works with touch | Every interaction works with fingers. Keyboard shortcuts (Space, R, A, 1/2/3, +/−) stay as extras for desktop. |
| Bilingual | Romanian and English from day one. The existing material is already split this way (`*_RO.md`, Terra/Marte/Luna labels). |
| Teacher-friendly | Shareable links that preload a setup (e.g. `?world=moon&h=50&m1=0.1&m2=50`) and a projector-friendly full-screen mode. |
| Private by design | Children use it, so there are no cookies, no accounts, no ads and no third-party trackers. That keeps GDPR simple. |
| Works offline | Once a classroom has loaded the site, it keeps working on bad Wi-Fi (PWA). |
| Cheap to run | Free static hosting and no server to maintain. |

---

## 2. Key decision: port to TypeScript, don't run Python in the browser

There are three ways to get the Python code into a browser:

| Option | How | Verdict |
|---|---|---|
| **A. pygbag** (pygame → WebAssembly) | Package the existing pygame scripts nearly unchanged | ❌ Fixed 1600×900 canvas with no responsive layout. Poor touch support. Large download and slow start on cheap devices. The UI stays pygame-drawn, so it can't get a nicer interface. |
| **B. Pyodide / PyScript** | Keep the physics in Python and build the UI in HTML | ❌ About 10–30 MB of runtime to download (numpy/scipy), several seconds of start-up on a school laptop, and two languages to maintain. |
| **C. Port the physics to TypeScript** ✅ | Rewrite the physics (small) and build a proper web UI | ✅ Fast, small, responsive and works with touch. |

**Why C is cheap here:** the physics is small, and most of it has a closed-form
solution, so no SciPy is needed:

- **Free fall:** the code already uses closed forms (`t = √(2h/g)`, and the
  `tanh`/`acosh` drag solution). It's a direct port.
- **Bucket drip:** `solve_ivp` isn't needed. With Torricelli's law,
  `√h` decreases linearly with time: `h(t) = (√h₀ − (A_h/A_b)·C_d·√(g/2)·t)²`,
  and the drain time is `T = √h₀ / ((A_h/A_b)·C_d·√(g/2))`. That's exact and
  never needs an integrator.
- **Spring launcher:** energy conservation plus projectile motion, also closed form.
- **Electric field:** Coulomb superposition for three point charges with a
  small integrator, about 50 lines.

The Python repo stays the **reference implementation**. A small Python
script generates "golden" values (fall times, drain times, ranges, a few
trajectory points), and the TypeScript tests must match them. This is how we
check that the port is physically correct (see §7).

---

## 3. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Site framework | **Astro 7** (static output) | Content-first: explainers and quizzes are mostly text, and only the simulations need JavaScript ("islands"). Built-in i18n routing. MDX for the explainer pages. It produces plain HTML, CSS and JS that any static host can serve. |
| Interactive UI | **Svelte 5** components inside Astro | Very small runtime, simple reactive state that fits sliders and buttons well, and easy to read. |
| Language | **TypeScript** (strict) | The physics code is typed with units in the names (`heightM`, `gMps2`), which catches mistakes. |
| Rendering | **HTML Canvas 2D** with a HiDPI-aware wrapper | All four sims are 2D and only draw a few hundred shapes per frame. Canvas is fast everywhere, and WebGL isn't needed. |
| Charts | **Own small canvas chart module**, ported from the `Chart` class in `free_fall_simulation.py` | The Python chart already follows careful design rules (shared axes, end labels that avoid collisions, nice tick steps). A port keeps that behaviour, avoids a dependency and redraws at 60 fps. |
| Styling | Plain CSS with custom properties (design tokens) | Planet themes (sky and ground colours) become CSS variables. No CSS framework is needed for a site this size. |
| Fonts | **Atkinson Hyperlegible** or **Lexend** (self-hosted) | Designed to be easy to read for young and dyslexic readers. Self-hosting means no request goes to Google Fonts. |
| Quizzes | Content files (YAML/JSON per language) plus one Svelte `Quiz` component | Converted from `QUIZ.md` / `QUIZ_RO.md` and the quiz in `FALLING_OBJECTS*.md`. Answers are checked in the browser, nothing is stored, and each question can link to "try it in the sim" with preset parameters. |
| Offline | `@vite-pwa/astro` (service worker) | Lets the site be "installed" on tablets and run without Wi-Fi. |
| Tests | **Vitest** (physics and chart maths), **Playwright** (smoke tests and screenshots at phone, tablet and desktop sizes) | |
| Quality gates | ESLint, Prettier, `astro check`, a Lighthouse CI budget (performance and accessibility ≥ 95) | |
| Hosting | **GitHub Pages** via GitHub Actions, from the `website/` folder of `mihaigociu/physics-simulations` → <https://mihaigociu.github.io/physics-simulations/> | Free, HTTPS, deploys on every push to `main` that touches `website/`. Moving to its own repo or a custom domain later only changes `site`/`base` in `astro.config.mjs`. |
| Package manager | npm (Node 23 is already installed) | |

No backend, database, accounts or analytics (decided: no analytics for now).

---

## 4. Architecture

### 4.1 Layers inside each simulation

Each simulation is split into three layers, and only the outer one depends on
the browser:

```
┌────────────────────────────────────────────────────────────┐
│  Controls (Svelte)   sliders · buttons · planet picker      │  UI layer
│  Readouts (Svelte)   time, speed, energy… (formatted per    │
│                      locale: RO uses 9,81 not 9.81)         │
├────────────────────────────────────────────────────────────┤
│  Renderer (Canvas)   draws a *state* → pixels; no physics    │  View layer
│  Charts   (Canvas)   shared chart module                     │
├────────────────────────────────────────────────────────────┤
│  Model (pure TS)     params + state + step(dt) + closed-form │  Physics layer
│                      helpers. No DOM, no time, deterministic │  (unit-tested)
└────────────────────────────────────────────────────────────┘
          ▲ driven by the shared engine loop ▼
```

- **Model:** pure functions, `createState(params)`, `step(state, dt) → state`,
  plus analytic helpers (`fallTime`, `drainTime`, `range`, …). This layer is
  tested against the Python golden values.
- **Engine (shared):** a fixed-timestep loop (`requestAnimationFrame` plus an
  accumulator, physics at 120 Hz) with pause and a speed multiplier
  (0.1×–10×). It also handles the world-to-screen transform, canvas resizing
  (`ResizeObserver`, `devicePixelRatio`), pointer events (mouse, touch and
  pen in one API) and pausing when the tab is hidden.
- **Renderer:** reads the state and draws it, and never changes it. Any
  layout can therefore reuse it: phone portrait, tablet landscape or a
  projector.
- **Controls:** Svelte components bound to `params`. Changing a parameter
  resets or re-solves the model as it does in the Python version (for
  example, switching planet resets the bucket).

### 4.2 Shared modules

- `planets.ts` holds the single source of truth for Earth, Mars and Moon:
  `g`, air density, sky and ground colours, and the RO/EN names. Today this
  data is duplicated across three Python files.
- `chart/` is the ported line chart (nice ticks, shared axes, legend, end
  labels).
- `ui/` contains `Slider`, `Button`, `PlanetPicker`, `SpeedControl`,
  `PlayPauseReset`, `Readout` and `FullscreenToggle`. Each has large hit
  areas, keyboard support and ARIA labels.
- `url-state.ts` reads and writes sim parameters to the query string, which
  makes teacher share links possible.
- `i18n/` holds UI strings (`ro.json`, `en.json`) and number and unit
  formatting through `Intl.NumberFormat`.

### 4.3 Site map

```
/                         → redirect to /ro/ or /en/ (browser language)
/{lang}/                  Home: 4 big cards, each with an animated preview
/{lang}/free-fall/        Simulation + "What's going on?" panel + "Things to try"
/{lang}/free-fall/learn   Explainer (from FALLING_OBJECTS*.md)
/{lang}/free-fall/quiz    Quiz
/{lang}/spring-launcher/  (same pattern)
/{lang}/bucket/           (same pattern)
/{lang}/electric-field/   (same pattern)
/{lang}/quiz/             Mixed quiz across all sims (from QUIZ*.md)
/{lang}/teachers/         How to use in class, share links, learning goals
/{lang}/about/
```

### 4.4 Simulation page layout (responsive)

```
Desktop / landscape tablet              Phone / portrait tablet
┌──────────┬───────────────┬────────┐   ┌──────────────────────┐
│ Controls │   Simulation  │ Charts │   │  Planet picker        │
│ sliders  │   canvas      │ (1–3)  │   │  Simulation canvas    │
│ planet   │               │        │   │  ▶ Drop  ⟲  speed     │
│ ▶ ⏸ ⟲    │               │        │   │  [Controls|Charts|?]  │ ← tabs
└──────────┴───────────────┴────────┘   └──────────────────────┘
          "What's going on?" (collapsible explainer below)
```

### 4.5 Project structure

The site lives in `website/` inside the `physics-simulations` repo, so the
Python reference code sits right next to it (`../*.py`).

```
website/
├── PLAN.md
├── package.json, astro.config.mjs, tsconfig.json
├── public/                  icons, manifest, fonts
├── scripts/
│   └── golden/              Python scripts that emit reference values → JSON
├── src/
│   ├── engine/              loop.ts, canvas.ts, pointer.ts, transform.ts
│   ├── shared/              planets.ts, url-state.ts, format.ts
│   ├── chart/               chart.ts, ticks.ts (nice_step / axis_max port)
│   ├── ui/                  Slider.svelte, PlanetPicker.svelte, …
│   ├── sims/
│   │   ├── free-fall/       model.ts, renderer.ts, FreeFall.svelte, model.test.ts
│   │   ├── spring-launcher/
│   │   ├── bucket/
│   │   └── electric-field/
│   ├── content/
│   │   ├── learn/{ro,en}/   free-fall.mdx, …
│   │   └── quiz/{ro,en}/    free-fall.yaml, mixed.yaml, …
│   ├── i18n/                ro.json, en.json
│   ├── layouts/, components/
│   └── pages/[lang]/…       Astro routes
└── tests/e2e/               Playwright

../.github/workflows/website.yml   test + build on PRs; deploy to Pages from main
```

---

## 5. Notes for porting each simulation

Phase 1 aims to match what the Python versions do. Improvements are listed
separately so they can be scheduled later.

### 5.1 Free Fall (flagship, ported first)
- **Port:** two objects with mass sliders (0.1–50 kg), height (1–100 m),
  strobe trail every 0.25 s, three linked charts (d–t, v–t, v–d) with a
  shared time axis, air-resistance toggle with per-world air density,
  prediction box, and slow motion.
- **Already web-ready:** the closed-form `air_fall_exact` and the
  `nice_step`/`axis_max` tick logic port line by line.
- **Phone layout:** the three charts become swipeable tabs.
- **Later:** a "feather vs hammer" preset (Apollo 15) and a short Apollo 15
  video link on the learn page.

### 5.2 Spring Launcher
- **Port:** sliders for compression, angle and k, the planet picker, a
  predicted path, the flight with a fading trail, and energy (KE/PE/total)
  and velocity (vx/vy/speed) charts.
- **Fixes while porting:**
  - Landing currently snaps to `y = 0` on the first frame below ground. We
    should interpolate the exact touchdown point so the reported range
    matches `v²·sin(2θ)/g`.
  - The physics runs on a fixed timestep from the shared engine instead of
    `dt = 1/FPS`, which assumed the frame rate was reached.
  - The charts currently plot against sample index. They should use real
    time on the x axis.
- **Later:** a mass slider (shows `v ∝ 1/√m`), a "hit the target" game mode
  (very motivating for kids), and comparing with the previous shot as a
  ghost trail.

### 5.3 Bucket Drip (Torricelli)
- **Port:** the 10 L bucket, the hole, the planet picker, readouts for
  volume, height and time, and the speed multiplier.
- **Replace** SciPy `solve_ivp` with the exact analytic solution (§2).
- **Add** (cheap and very useful for teaching): an animated water jet whose
  speed is `√(2gh)`, and a live chart of height against time showing the
  curve flattening.
- **Later:** sliders for hole size and bucket width, and a "race two
  buckets" mode.

### 5.4 Electric Field
- **Port:** three fixed charges, the field-arrow grid (log-scaled), a test
  particle with a trail, tap or click to place the particle, pause, reset
  and the field toggle.
- **Fix while porting:** replace the explicit Euler integrator with
  **velocity Verlet** or **RK4** and use a smaller step close to charges.
  Euler adds energy over time, so the particle can drift into orbits that
  aren't physical. Clamp or stop the particle when it gets very close to a
  charge.
- **Later:** drag charges around (the field recomputes live), add or remove
  charges and flip their sign, draw field lines instead of arrows,
  equipotential shading, and a sign selector for the test charge.

---

## 6. Content and translation

- **UI strings:** `src/i18n/{ro,en}.json`. Every visible label goes through
  `t('key')`.
- **Explainers:** `FALLING_OBJECTS.md` and `FALLING_OBJECTS_RO.md` become
  MDX. The MDX can embed small live widgets, for example a mini drop
  inside the text.
- **New explainers** for Spring, Bucket and Electric Field, in the same
  tone. These are new writing, a phase 5 item.
- **Quizzes:** `QUIZ.md`, `QUIZ_RO.md` and the free-fall quiz are converted
  into structured YAML (question, options, correct answer, explanation,
  optional sim preset link). This is a one-off conversion script plus a
  manual review.
- **Numbers:** formatted per locale (`9,81 m/s²` in Romanian, `9.81 m/s²`
  in English).

---

## 7. Checking the physics

1. A script (`scripts/golden/*.py`) imports the formulas from
   `../physics-simulations` and writes a JSON file of reference cases: fall
   times with and without air on all three worlds, bucket drain times,
   launcher ranges and maximum heights, and the first N electric-field
   trajectory points (where we can tolerate the integrator difference).
2. Vitest checks that the TypeScript model matches them (relative tolerance
   about 1e-6 for closed forms, looser for integrated paths).
3. Invariant tests: in a vacuum both objects land together, total energy
   stays constant within a tolerance in the launcher and in the field, and a
   Moon run with air switched on gives the same result as with air off.
4. Playwright: every page loads in both languages, the sims start, and
   screenshots are taken at 390×844, 820×1180 and 1440×900.

---

## 8. Delivery phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Foundations** | Astro + Svelte + TS scaffold, engine loop, canvas wrapper, `planets.ts`, i18n, design tokens, layout shell, CI and a deploy of a placeholder page to GitHub Pages | A live URL exists, with CI green on every push |
| **1. Free Fall** | Full port with charts, responsive layout, URL presets, golden tests, the learn page from the existing explainer, and the quiz | A child can use it on a phone or tablet in both languages |
| **2. Spring Launcher** | Port plus the landing, timestep and chart fixes, and quiz part 3 | Golden tests pass and the range matches `v²sin2θ/g` |
| **3. Bucket Drip** | Port with the analytic solution, water jet, h–t chart, and quiz part 1 | Drain times match the Python values |
| **4. Electric Field** | Port with the Verlet/RK4 integrator, tap to place, and quiz part 2 | Energy drift stays within tolerance |
| **5. Polish** | Home page with animated cards, mixed quiz, teacher page, PWA/offline, accessibility pass, Lighthouse ≥ 95, new explainers for sims 2–4 | Ready to share with schools |
| **6. Enhancements** | Picked from the "Later" items in §5 | — |

Phase 1 carries the most risk because it builds every shared piece (engine,
charts, UI kit, i18n). Phases 2–4 then mostly reuse it.

---

## 9. Decisions

| Topic | Decision |
|---|---|
| Default language | Follow the browser language; fall back to Romanian. A choice made with the RO/EN switch is remembered (localStorage, nothing sent anywhere). |
| Hosting and repo | GitHub Pages from `website/` in `physics-simulations` (creating a separate repo failed). |
| Analytics | None for now. |
| Name | Working title "Fizica în joacă" / "Physics Playground", stored in `src/i18n/*.json` (`site.name`) so it's a one-line change. |

### Still open: age level and quiz difficulty

**Proposal:** design every page for ages 10–12 first, with depth you can
opt into instead of a site-wide mode:

- Simulation pages and their "What's going on?" panels use the simple
  register of `FALLING_OBJECTS.md`.
- Each learn page ends with a collapsible **"Go deeper"** section for the
  formulas (Torricelli, Coulomb, energy equations).
- Every quiz question gets a difficulty tag (⭐ / ⭐⭐ / ⭐⭐⭐). The
  free-fall quiz is mostly ⭐–⭐⭐, and most of `QUIZ.md` becomes ⭐⭐–⭐⭐⭐
  "challenge" questions. Students can filter by stars.

This doesn't block anything until the quiz work in phase 1, and the tags
are cheap to change later.

## 10. Progress

- **Phase 0 (foundations): done.** Astro 7 + Svelte 5 + TypeScript scaffold;
  engine (`FixedStepLoop`, `manageCanvas`, `WorldTransform`); `planets.ts`,
  simulation registry, locale-aware number formatting; RO/EN i18n with a
  key-parity test; design tokens; layout with language switch; home page
  with an animated strobe-drop hero and four cards; "coming soon" pages for
  each simulation; 404 page; GitHub Actions workflow for Pages. 27 unit
  tests passing, `astro check` clean, about 33 KB of JavaScript in total.
  Playwright (e2e) and the PWA are deferred to phases 1 and 5.
- **Phase 1 (Free Fall): done.** Port of `free_fall_simulation.py` with all
  of its features: two balls on a log-scale mass slider (0.1–50 kg), height
  1–100 m, Earth/Mars/Moon, an air-resistance switch with per-world air
  density, a strobe every 0.25 s, three live charts, the prediction and
  result cards, a "same time!" banner, slow motion (0.1×–4×) and the
  keyboard shortcuts. On top of the Python version:
  - responsive layout (charts become tabs on phones);
  - share links that preload a setup (`?world=moon&h=50&m1=0.1&m2=50&air=1`);
  - landing times solved exactly inside the last step, strobes exactly on
    the 0.25 s marks, and a midpoint (RK2) step with air;
  - a Learn page from `FALLING_OBJECTS*.md` whose "things to try" are
    one-click setups;
  - a 10-question quiz with star difficulty, explanations and "try it"
    links, plus the 4 bonus questions with hidden answers.

  Tests: 158 unit tests, including the closed-form fall times matched to
  1e-10 against the Python output and the step-by-step landings within
  1 ms (`scripts/golden/free_fall.py`). 17 Playwright browser tests run on
  desktop and phone. CI runs both.
- **Phase 2 (Spring Launcher): done.** Port of `spring_launcher_simulation.py`:
  sliders for squeeze, angle and stiffness, Earth/Mars/Moon, the predicted
  path, the flight trail, and energy (kinetic/potential/total) and velocity
  (vx/vy/speed) charts. The fixes listed in §5.2:
  - the flight is computed exactly, so the landing point matches
    v²·sin(2θ)/g (Python stopped up to one 1/60 s frame early);
  - time is real seconds on a fixed timestep;
  - the charts use a real time axis.
  Also added (cheap and useful for teaching):
  - a ball-mass slider (v ∝ 1/√m);
  - the previous shot as a dashed ghost, to compare angles;
  - vx/vy velocity arrows on the ball;
  - energy bars;
  - a highest-point marker and a landing flag;
  - a camera that fits flights from 0.2 m to 4 km;
  - share links (`?world=moon&x=1.2&a=30&k=800&m=1`).
  Quiz: `QUIZ.md` questions 15–21 and 23, plus 2 bonus questions. No Learn
  page yet (new writing, phase 5), so its tab is hidden. Shared
  `sim.css`, `ShareButton` and `sim-helpers` were pulled out of Free Fall
  for reuse. A test now checks that each quiz's RO and EN versions agree on
  answers, stars and links.
- **Phase 3 (Bucket): done.** Port of `bucket_drip_simulation.py`. The
  default bucket matches the Python one: 10 L, 10 cm radius, 10 mm hole,
  Cd = 1. SciPy is replaced by the exact solution √h(t) = √h₀ − c·t. Its drain
  time equals the Python file's own closed form to 1e-9; SciPy's event
  detection is 0.01–0.03 s off near the √h singularity at empty. Additions:
  - the hole is on the side at the bottom (same physics), so the jet shows
    Torricelli's v = √(2gh) shrinking as the bucket drains, with moving
    dashes at the water's real speed;
  - a tray that fills with the drained water;
  - sliders for starting water (1–12 L) and hole diameter (4–20 mm), for
    quiz Q5 and Q7;
  - a plug until you pull it;
  - prediction of the first and second half drain times;
  - water height and jet speed charts (the speed falls in a straight
    line), with the last run dashed for comparison;
  - speeds up to 50×.

  Quiz: `QUIZ.md` questions 1–7 (Q6 turned into multiple choice), plus two
  bonus questions (a quarter is left at half time; the jet's reach doesn't
  depend on g). Also fixed a speed-label bug: 20× was shown as "2×".
- **Phase 4 (Electric Field): done.** Port of
  `pygame_electric_field_simulation.py`: same k, charges, mass and layout,
  log-scaled field arrows, the trail, tap to place the particle, pause,
  reset and the arrows toggle. The integrator is velocity Verlet with
  sub-steps that shrink near charges. It matches the Python update loop run
  with 100× finer steps to 5×10⁻⁵ m. Its energy error over 20 s is
  4×10⁻⁷, against 2×10⁻³ for the Python default 0.05 s step. A crash into a
  charge or leaving the area is detected inside the step. From the §5.4
  "later" list:
  - draggable charges that snap to a 10 cm grid;
  - adding, removing and flipping charges (up to 8);
  - a +/− test particle;
  - preset layouts ("Two +" for quiz Q13, "+ and −", "One charge",
    "Empty");
  - a yellow force arrow on the particle, and an exact zero-force message;
  - readouts (speed, distance, force, energy) and a live energy chart
    showing the total staying flat;
  - share links (`?layout=pair&p=0,0`, or `?c=0,0,+;1,1,-` for edited
    layouts).

  Quiz: `QUIZ.md` questions 8–14, plus two bonus questions. A content test
  now requires four options per question, to catch YAML slips. Field lines
  and equipotential shading are left for phase 6.
