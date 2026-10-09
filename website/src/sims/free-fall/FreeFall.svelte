<script lang="ts">
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../../engine/loop';
  import { manageCanvas, type ManagedCanvas } from '../../engine/canvas';
  import { getPlanet, PLANETS, type PlanetId } from '../../shared/planets';
  import { formatNumber } from '../../shared/format';
  import { t, tf, type Locale, type TKey } from '../../i18n';
  import type { ChartSpec, Series } from '../../chart/chart';
  import { CHART_COLORS } from '../../chart/chart';
  import Slider from '../../ui/Slider.svelte';
  import PlanetPicker from '../../ui/PlanetPicker.svelte';
  import SpeedControl, { SPEEDS } from '../../ui/SpeedControl.svelte';
  import ChartCard from '../../ui/ChartCard.svelte';
  import { HEIGHT_MAX, HEIGHT_MIN, MASS_MAX, MASS_MIN, vacuumFallTime, vacuumImpactSpeed } from './physics';
  import {
    chartAxes,
    createState,
    DEFAULT_PARAMS,
    drop,
    hasAir,
    step,
    vacuumCurve,
    verdict,
    type FreeFallParams,
    type FreeFallState,
    type Sample,
  } from './model';
  import { BALL_COLORS, drawScene } from './renderer';
  import { paramsFromQuery, queryFromParams } from './url';

  let { lang }: { lang: Locale } = $props();

  const num = (v: number, digits: number) => formatNumber(lang, v, digits);
  const tr = (key: TKey) => t(lang, key);

  // ---- state ----
  let params = $state<FreeFallParams>({ ...DEFAULT_PARAMS });
  let sim: FreeFallState = createState(DEFAULT_PARAMS);
  let paused = $state(false);
  let speed = $state(1);
  /** Bumped whenever `sim` changed, to refresh readouts and charts. */
  let frame = $state(0);
  let copied = $state(false);

  const planet = $derived(getPlanet(params.planet));
  const axes = $derived(chartAxes(params));
  const airActive = $derived(hasAir(params));

  // Snapshot of the mutable simulation for the template (re-read on each frame bump)
  const view = $derived.by(() => {
    void frame;
    return {
      phase: sim.phase,
      time: sim.time,
      balls: sim.balls.map((b) => ({ mass: b.mass, v: b.v, landTime: b.landTime, landed: b.landed })),
      verdict: verdict(sim),
    };
  });

  // ---- control ----
  let loop: FixedStepLoop | undefined;
  let sceneDirty = true;

  function restart(next: FreeFallState) {
    sim = next;
    paused = false;
    if (loop) {
      loop.paused = false;
      loop.clearAccumulator();
    }
    sceneDirty = true;
    frame++;
  }

  function setParams(patch: Partial<FreeFallParams>) {
    params = { ...params, ...patch };
    // Changing the setup restarts the experiment, as in the Python version
    restart(createState(params));
    // Debounced: dragging a slider fires many changes, and Safari throttles replaceState
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      history.replaceState(null, '', location.pathname + queryFromParams(params) + location.hash);
    }, 300);
  }
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  function onDrop() {
    restart(drop(params));
  }

  function togglePause() {
    if (sim.phase !== 'falling') return;
    paused = !paused;
    if (loop) loop.paused = paused;
  }

  function onReset() {
    restart(createState(params));
  }

  function setSpeed(value: number) {
    speed = value;
    if (loop) loop.speed = value;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard can be blocked; the address bar still has the link
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const onButton = target.closest('button, a, summary');
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (onButton) return; // let the focused button handle its own Space
      e.preventDefault();
      if (sim.phase === 'falling') togglePause();
      else onDrop();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'r') onReset();
    else if (key === 'a') setParams({ air: !params.air });
    else if (key === '+' || key === '=') setSpeed(SPEEDS[Math.min(SPEEDS.indexOf(speed) + 1, SPEEDS.length - 1)]!);
    else if (key === '-' || key === '_') setSpeed(SPEEDS[Math.max(SPEEDS.indexOf(speed) - 1, 0)]!);
    else if (['1', '2', '3'].includes(key)) {
      const id = PLANETS[Number(key) - 1]!.id;
      if (id !== params.planet) setParams({ planet: id });
    }
  }

  // ---- mass slider on a log scale, so 0.1–1 kg isn't squeezed into a sliver ----
  const LOG_SPAN = Math.log(MASS_MAX / MASS_MIN);
  const massToPos = (m: number) => Math.log(m / MASS_MIN) / LOG_SPAN;
  const posToMass = (p: number) => {
    const m = MASS_MIN * Math.exp(p * LOG_SPAN);
    return m < 10 ? Math.round(m * 10) / 10 : Math.round(m);
  };

  // ---- scene ----
  let sceneCanvas: HTMLCanvasElement;
  let scene: ManagedCanvas | undefined;

  onMount(() => {
    // A shared link may carry a setup
    if (location.search) {
      params = paramsFromQuery(location.search);
      sim = createState(params);
      frame++;
    }
    scene = manageCanvas(sceneCanvas, () => (sceneDirty = true));
    const sceneText = { num };

    loop = new FixedStepLoop({
      update(dt) {
        const before = sim.phase;
        step(sim, dt);
        if (sim.phase !== before) sceneDirty = true; // draw the landing frame
      },
      render() {
        // Idle (ready, landed or paused) costs nothing until something changes
        if (!(sim.phase === 'falling' && !paused) && !sceneDirty) return;
        drawScene(scene!.ctx, scene!.size.width, scene!.size.height, sim, getPlanet(sim.params.planet), sceneText);
        sceneDirty = false;
        frame++; // readouts and charts follow the scene
      },
    });
    loop.speed = speed;
    loop.start();
    return () => {
      loop?.stop();
      scene?.dispose();
    };
  });

  // Fonts arrive after first paint; redraw once they do
  onMount(() => {
    document.fonts?.ready.then(() => {
      sceneDirty = true;
      frame++;
    });
  });

  // ---- charts ----
  type Key = keyof Sample;

  function series(x: Key, y: Key): Series[] {
    void frame;
    const order = sim.balls[0].mass > sim.balls[1].mass ? [0, 1] : [1, 0]; // heavy first, drawn wider
    const unit = y === 'd' ? 'm' : 'm/s';
    const out: Series[] = [];
    if (airActive) {
      out.push({
        points: vacuumCurve(params).map((s) => ({ x: s[x], y: s[y] })),
        color: CHART_COLORS.inkMuted,
        width: 1.5,
        dashed: true,
        marker: false,
      });
    }
    order.forEach((i, rank) => {
      const ball = sim.balls[i]!;
      const points = ball.samples.map((s) => ({ x: s[x], y: s[y] }));
      const last = points.at(-1);
      out.push({
        points,
        color: BALL_COLORS[i]!,
        width: rank === 0 ? 5 : 2,
        endText: sim.phase !== 'ready' && last ? `${num(last.y, 1)} ${unit}` : undefined,
      });
    });
    return out;
  }

  const fmtTick = (v: number) => formatNumber(lang, v, Number.isInteger(v) ? 0 : v * 10 === Math.round(v * 10) ? 1 : 2);

  const charts = $derived([
    {
      id: 'dt',
      tab: tr('freeFall.tabDistTime'),
      title: tr('freeFall.chartDistTime'),
      spec: (): ChartSpec => ({
        x: { ...axes.t, label: tr('freeFall.axisTime') },
        y: { ...axes.d, label: '' },
        series: series('t', 'd'),
        formatTick: fmtTick,
      }),
    },
    {
      id: 'vt',
      tab: tr('freeFall.tabSpeedTime'),
      title: tr('freeFall.chartSpeedTime'),
      spec: (): ChartSpec => ({
        x: { ...axes.t, label: tr('freeFall.axisTime') },
        y: { ...axes.v, label: '' },
        series: series('t', 'v'),
        formatTick: fmtTick,
      }),
    },
    {
      id: 'vd',
      tab: tr('freeFall.tabSpeedDist'),
      title: tr('freeFall.chartSpeedDist'),
      spec: (): ChartSpec => ({
        x: { ...axes.d, label: tr('freeFall.axisDistance') },
        y: { ...axes.v, label: '' },
        series: series('d', 'v'),
        formatTick: fmtTick,
      }),
    },
  ]);
  let chartTab = $state(0);

  const legend = $derived([
    ...(airActive ? [{ label: tr('freeFall.vacuumLine'), color: CHART_COLORS.inkMuted, dashed: true }] : []),
    { label: `${num(params.massA, 1)} kg`, color: BALL_COLORS[0] },
    { label: `${num(params.massB, 1)} kg`, color: BALL_COLORS[1] },
  ]);

  const chartNote = $derived.by(() => {
    if (view.phase === 'ready') return tr('freeFall.noteReady');
    if (params.air && !airActive) return tr('freeFall.noteNoAtmosphere');
    if (airActive) return tr('freeFall.noteAir');
    if (view.phase === 'landed') return tr('freeFall.noteLanded');
    return tr('freeFall.noteFalling');
  });

  // ---- text ----
  const ratioText = $derived.by(() => {
    const [a, b] = [params.massA, params.massB];
    if (a === b) return tr('freeFall.ratioEqual');
    const ratio = Math.max(a, b) / Math.min(a, b);
    const x = num(ratio, ratio < 10 ? 1 : 0);
    return tf(lang, a > b ? 'freeFall.ratioBlue' : 'freeFall.ratioRed', { x });
  });

  const airNote = $derived(
    tr(params.planet === 'earth' ? 'freeFall.airNoteEarth' : params.planet === 'mars' ? 'freeFall.airNoteMars' : 'freeFall.airNoteMoon'),
  );

  function ballLine(i: number): string {
    const b = view.balls[i]!;
    const m = num(b.mass, 1);
    if (b.landTime !== null) return tf(lang, 'freeFall.ballLanded', { m, t: num(b.landTime, 2) });
    if (view.phase !== 'ready') return tf(lang, 'freeFall.ballFalling', { m, v: num(b.v, 1) });
    return tf(lang, 'freeFall.ballReady', { m });
  }

  const banner = $derived.by(() => {
    const v = view.verdict;
    if (!v) return null;
    if (v.kind === 'apart') return { text: tf(lang, 'freeFall.bannerApart', { gap: num(v.gap, 2) }), tone: 'warn' };
    return { text: tr(v.kind === 'same' ? 'freeFall.bannerSame' : 'freeFall.bannerAlmost'), tone: 'ok' };
  });

  const resultText = $derived.by(() => {
    const v = view.verdict;
    if (!v) return '';
    if (v.kind === 'apart') return tf(lang, 'freeFall.resultApart', { gap: num(v.gap, 2) });
    return tr(v.kind === 'same' ? 'freeFall.resultSame' : 'freeFall.resultAlmost');
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="ff" style:--sky={planet.sky} style:--accent={planet.accent}>
  <div class="ff__toolbar">
    <PlanetPicker {lang} value={params.planet} onchange={(id: PlanetId) => setParams({ planet: id })} />
    <div class="toolbar__right">
      <SpeedControl {lang} value={speed} onchange={setSpeed} />
      <button type="button" class="link-btn" onclick={copyLink} aria-live="polite">
        {copied ? tr('ui.copied') : tr('ui.copyLink')}
      </button>
    </div>
  </div>

  <section class="ff__controls" aria-label={tr('ui.sections')}>
    <Slider
      label={tr('freeFall.height')}
      bind:value={() => params.height, (v) => setParams({ height: v })}
      min={HEIGHT_MIN}
      max={HEIGHT_MAX}
      step={1}
      display="{num(params.height, 0)} m"
      color="#00a03c"
    />
    <Slider
      label={tr('freeFall.massBlue')}
      bind:value={() => params.massA, (v) => setParams({ massA: v })}
      min={MASS_MIN}
      max={MASS_MAX}
      display="{num(params.massA, 1)} kg"
      color={BALL_COLORS[0]}
      toPosition={massToPos}
      fromPosition={posToMass}
    />
    <Slider
      label={tr('freeFall.massRed')}
      bind:value={() => params.massB, (v) => setParams({ massB: v })}
      min={MASS_MIN}
      max={MASS_MAX}
      display="{num(params.massB, 1)} kg"
      color={BALL_COLORS[1]}
      toPosition={massToPos}
      fromPosition={posToMass}
    />
    <p class="ratio">{ratioText}</p>

    <div class="air">
      <button
        type="button"
        role="switch"
        aria-checked={params.air}
        class="switch"
        onclick={() => setParams({ air: !params.air })}
      >
        <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
        <span>{tr('freeFall.air')}: <strong>{params.air ? tr('ui.on') : tr('ui.off')}</strong></span>
      </button>
      {#if params.air}
        <p class="air__note" class:air__note--active={airActive}>{airNote}</p>
      {/if}
    </div>

    <div class="card prediction">
      <h3>{tr('freeFall.predictionTitle')}</h3>
      <p class="muted">g = {num(planet.g, 2)} m/s² {tr(`planetsOn.${params.planet}`)}</p>
      <p class="formula">t = √(2h / g) = √(2 × {num(params.height, 1)} / {num(planet.g, 2)})</p>
      <p class="big">t = {num(vacuumFallTime(params.height, planet.g), 2)} s</p>
      <p class="muted">{tr('freeFall.impactSpeed')} = {num(vacuumImpactSpeed(params.height, planet.g), 1)} m/s</p>
      {#if airActive}<p class="warn">{tr('freeFall.airWarning')}</p>{/if}
    </div>

    <div class="card result" aria-live="polite">
      <h3>{tr('freeFall.resultTitle')}</h3>
      <p class="big">{tr('freeFall.clock')}: <span class="mono">{num(view.time, 2)} s</span></p>
      <p style:color={BALL_COLORS[0]}>{ballLine(0)}</p>
      <p style:color={BALL_COLORS[1]}>{ballLine(1)}</p>
      {#if resultText}
        <p class="verdict" class:warn={view.verdict?.kind === 'apart'}>{resultText}</p>
      {/if}
    </div>
  </section>

  <section class="ff__scene">
    <div class="scene-img" role="img" aria-label={tf(lang, 'freeFall.sceneLabel', { h: num(params.height, 0) })}>
      <canvas bind:this={sceneCanvas} aria-hidden="true"></canvas>
    </div>
    {#if banner}
      <div class="banner banner--{banner.tone}" role="status">{banner.text}</div>
    {/if}
  </section>

  <div class="ff__actions">
    {#if view.phase === 'falling'}
      <button type="button" class="button action action--pause" onclick={togglePause}>
        {paused ? tr('ui.resume') : tr('ui.pause')}
      </button>
    {:else}
      <button type="button" class="button action action--drop" onclick={onDrop}>{tr('ui.drop')}</button>
    {/if}
    <button type="button" class="button button--secondary action" onclick={onReset}>{tr('ui.reset')}</button>
  </div>

  <section class="ff__charts">
    <div class="chart-tabs" role="tablist">
      {#each charts as c, i (c.id)}
        <button type="button" role="tab" aria-selected={chartTab === i} onclick={() => (chartTab = i)}>{c.tab}</button>
      {/each}
    </div>
    {#each charts as c, i (c.id)}
      <div class="chart-slot" class:chart-slot--active={chartTab === i}>
        <ChartCard title={c.title} {legend} spec={c.spec} {frame} summary={c.title} />
      </div>
    {/each}
    <p class="chart-note">{chartNote}</p>
  </section>

  <p class="ff__shortcuts"><strong>{tr('ui.shortcuts')}:</strong> {tr('freeFall.shortcutsText')}</p>
</div>

<style>
  .ff {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
    grid-template-areas:
      'toolbar'
      'scene'
      'actions'
      'controls'
      'charts'
      'shortcuts';
  }

  .ff__toolbar {
    grid-area: toolbar;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .toolbar__right {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .link-btn {
    min-height: var(--touch);
    padding-inline: var(--space-4);
    border: 2px solid var(--border);
    border-radius: 999px;
    background: var(--surface-raised);
    color: var(--brand);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .ff__controls {
    grid-area: controls;
    display: grid;
    gap: var(--space-3);
    align-content: start;
  }

  .ff__scene {
    grid-area: scene;
    position: relative;
    height: clamp(380px, 62vh, 640px);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--sky);
    box-shadow: var(--shadow);
  }

  .scene-img,
  .ff__scene canvas {
    width: 100%;
    height: 100%;
  }

  .banner {
    position: absolute;
    top: var(--space-3);
    left: 50%;
    translate: -50% 0;
    padding: var(--space-2) var(--space-6);
    border: 3px solid;
    border-radius: var(--radius-sm);
    background: #fff;
    font-size: var(--text-xl);
    font-weight: 700;
    white-space: nowrap;
    animation: pop 0.35s ease-out;
  }

  .banner--ok {
    color: #00873a;
  }

  .banner--warn {
    color: #c25e00;
  }

  @keyframes pop {
    from {
      scale: 0.6;
      opacity: 0;
    }
  }

  .ff__actions {
    grid-area: actions;
    display: flex;
    align-items: start;
    gap: var(--space-3);
  }

  .action {
    flex: 1;
    min-height: 56px;
    font-size: var(--text-lg);
  }

  .action--drop {
    background: #00873a;
    flex: 2;
  }

  .action--pause {
    background: #b07800;
    flex: 2;
  }

  .ratio {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .switch__track {
    flex: none;
    width: 52px;
    height: 30px;
    border-radius: 15px;
    background: #b9b9b4;
    position: relative;
    transition: background 0.15s;
  }

  .switch__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition: translate 0.15s;
  }

  .switch[aria-checked='true'] .switch__track {
    background: #e07800;
  }

  .switch[aria-checked='true'] .switch__thumb {
    translate: 22px 0;
  }

  .air__note {
    margin: 0;
    font-size: var(--text-sm);
    color: #00873a;
  }

  .air__note--active {
    color: #b05400;
  }

  .card {
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
  }

  .card h3 {
    font-size: var(--text-base);
    margin-bottom: var(--space-1);
  }

  .card p {
    margin: 0 0 var(--space-1);
  }

  .muted {
    color: var(--ink-2);
    font-size: var(--text-sm);
  }

  .formula {
    font-size: var(--text-sm);
  }

  .big {
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .prediction .big {
    color: #00873a;
  }

  .mono,
  .result p {
    font-variant-numeric: tabular-nums;
  }

  .warn {
    color: #b05400;
    font-size: var(--text-sm);
  }

  .verdict {
    font-weight: 700;
    color: #00873a;
  }

  .verdict.warn {
    color: #b05400;
  }

  .ff__charts {
    grid-area: charts;
    display: grid;
    gap: var(--space-3);
    align-content: start;
  }

  .chart-tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: 999px;
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .chart-tabs button {
    flex: 1;
    min-height: calc(var(--touch) - 8px);
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .chart-tabs button[aria-selected='true'] {
    background: var(--brand);
    color: #fff;
  }

  .chart-slot {
    display: none;
    height: 300px;
  }

  .chart-slot--active {
    display: block;
  }

  .chart-slot :global(.chart) {
    height: 100%;
  }

  .chart-note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .ff__shortcuts {
    grid-area: shortcuts;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  @media (hover: none) {
    .ff__shortcuts {
      display: none;
    }
  }

  /* Tablet and small laptop: controls beside the scene, charts in a row below */
  @media (min-width: 48rem) {
    .ff {
      grid-template-columns: minmax(17rem, 20rem) 1fr;
      /* A tall controls column gives its spare height to the actions row, not the buttons */
      grid-template-rows: auto auto 1fr auto auto;
      grid-template-areas:
        'toolbar toolbar'
        'controls scene'
        'controls actions'
        'charts charts'
        'shortcuts shortcuts';
    }

    .ff__scene {
      height: clamp(460px, 70vh, 720px);
    }

    .chart-tabs {
      display: none;
    }

    .ff__charts {
      grid-template-columns: repeat(3, 1fr);
    }

    .chart-slot {
      display: block;
      height: 280px;
    }

    .chart-note {
      grid-column: 1 / -1;
    }
  }

  /* Wide screens: charts in their own column, like the Python layout */
  @media (min-width: 78rem) {
    .ff {
      grid-template-columns: 19rem 1fr minmax(22rem, 26rem);
      grid-template-rows: auto auto 1fr auto;
      grid-template-areas:
        'toolbar toolbar toolbar'
        'controls scene charts'
        'controls actions charts'
        'shortcuts shortcuts shortcuts';
    }

    .ff__charts {
      grid-template-columns: 1fr;
    }

    .chart-slot {
      height: auto;
      aspect-ratio: 16 / 10.5;
    }
  }
</style>
