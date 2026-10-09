<script lang="ts">
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../../engine/loop';
  import { manageCanvas, type ManagedCanvas } from '../../engine/canvas';
  import { getPlanet, PLANETS, type PlanetId } from '../../shared/planets';
  import { formatNumber } from '../../shared/format';
  import { t, tf, type Locale, type TKey } from '../../i18n';
  import type { ChartSpec, Series } from '../../chart/chart';
  import Slider from '../../ui/Slider.svelte';
  import PlanetPicker from '../../ui/PlanetPicker.svelte';
  import SpeedControl from '../../ui/SpeedControl.svelte';
  import ChartCard from '../../ui/ChartCard.svelte';
  import ShareButton from '../../ui/ShareButton.svelte';
  import { ignoreShortcut, replaceQuery, stepSpeed } from '../../ui/sim-helpers';
  import { ANGLE_MAX, ANGLE_MIN, COMPRESSION_MAX, COMPRESSION_MIN, K_MAX, K_MIN, MASS_MAX, MASS_MIN } from './physics';
  import {
    chartAxes,
    createState,
    current,
    DEFAULT_PARAMS,
    distanceSoFar,
    fire,
    maxHeightSoFar,
    step,
    type Sample,
    type SpringParams,
    type SpringState,
  } from './model';
  import { COLORS, drawScene, type Shot } from './renderer';
  import { paramsFromQuery, queryFromParams } from './url';

  let { lang }: { lang: Locale } = $props();

  const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
  const ENERGY = { kinetic: '#0a8f4a', potential: '#1e64c8', total: '#c82828', spring: '#8a5a00' };
  const VELOCITY = { vx: COLORS.vx, vy: COLORS.vy, speed: '#6a1b9a' };

  const num = (v: number, digits: number) => formatNumber(lang, v, digits);
  const tr = (key: TKey) => t(lang, key);
  /** Fewer decimals as numbers grow: 0.183, 25.5, 706. */
  const auto = (v: number) => num(v, Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0);

  // ---- state ----
  let params = $state<SpringParams>({ ...DEFAULT_PARAMS });
  let sim: SpringState = createState(DEFAULT_PARAMS);
  let paused = $state(false);
  let speed = $state(1);
  let showArrows = $state(true);
  /** Bumped whenever `sim` changed, to refresh readouts and charts. */
  let frame = $state(0);
  /** The shot before the current one, drawn as a dashed ghost for comparison. */
  let previous: Shot | null = null;
  /** The most recent completed shot; becomes `previous` when the next one starts. */
  let latest: Shot | null = null;

  const planet = $derived(getPlanet(params.planet));

  const view = $derived.by(() => {
    void frame;
    const now = current(sim);
    return {
      phase: sim.phase,
      time: sim.time,
      launch: sim.launch,
      flight: sim.flight,
      now,
      highest: maxHeightSoFar(sim),
      path: distanceSoFar(sim),
      axes: chartAxes(sim),
    };
  });

  // ---- control ----
  let loop: FixedStepLoop | undefined;
  let sceneDirty = true;

  function restart(next: SpringState) {
    if (latest) {
      previous = latest;
      latest = null;
    }
    sim = next;
    paused = false;
    if (loop) {
      loop.paused = false;
      loop.clearAccumulator();
    }
    sceneDirty = true;
    frame++;
  }

  function setParams(patch: Partial<SpringParams>) {
    params = { ...params, ...patch };
    restart(createState(params));
    replaceQuery(queryFromParams(params));
  }

  function onLaunch() {
    restart(fire(params));
  }

  function togglePause() {
    if (sim.phase !== 'flying') return;
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

  function toggleArrows() {
    showArrows = !showArrows;
    sceneDirty = true;
  }

  function onKeydown(e: KeyboardEvent) {
    if (ignoreShortcut(e)) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (sim.phase === 'flying') togglePause();
      else onLaunch();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'r') onReset();
    else if (key === 'v') toggleArrows();
    else if (key === '+' || key === '=') setSpeed(stepSpeed(SPEEDS, speed, 1));
    else if (key === '-' || key === '_') setSpeed(stepSpeed(SPEEDS, speed, -1));
    else if (['1', '2', '3'].includes(key)) {
      const id = PLANETS[Number(key) - 1]!.id;
      if (id !== params.planet) setParams({ planet: id });
    }
  }

  // ---- scene ----
  let sceneCanvas: HTMLCanvasElement;
  let scene: ManagedCanvas | undefined;

  onMount(() => {
    if (location.search) {
      params = paramsFromQuery(location.search);
      sim = createState(params);
      frame++;
    }
    scene = manageCanvas(sceneCanvas, () => (sceneDirty = true));
    const sceneText = {
      num,
      previousLabel: (d: string) => tf(lang, 'spring.previous', { d }),
      apexLabel: (h: string) => tf(lang, 'spring.apex', { h }),
    };

    loop = new FixedStepLoop({
      update(dt) {
        const before = sim.phase;
        step(sim, dt);
        if (sim.phase !== before) {
          sceneDirty = true;
          if (sim.phase === 'landed') {
            latest = { points: sim.samples.map((s) => ({ x: s.x, y: s.y })), range: sim.flight.range, maxHeight: sim.flight.maxHeight };
          }
        }
      },
      render() {
        if (!(sim.phase === 'flying' && !paused) && !sceneDirty) return;
        drawScene(scene!.ctx, scene!.size.width, scene!.size.height, sim, getPlanet(sim.params.planet), {
          ...sceneText,
          previous,
          showArrows,
        });
        sceneDirty = false;
        frame++;
      },
    });
    loop.speed = speed;
    loop.start();
    document.fonts?.ready.then(() => {
      sceneDirty = true;
    });
    return () => {
      loop?.stop();
      scene?.dispose();
    };
  });

  // ---- charts ----
  function line(key: keyof Sample, color: string, width = 2, end?: (v: number) => string): Series {
    const points = sim.samples.map((s) => ({ x: s.t, y: s[key] }));
    const last = points.at(-1);
    return { points, color, width, endText: end && last ? end(last.y) : undefined };
  }

  const fmtTick = (v: number) => formatNumber(lang, v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);

  const charts = $derived([
    {
      id: 'energy',
      tab: tr('spring.tabEnergy'),
      title: tr('spring.chartEnergy'),
      legend: [
        { label: tr('spring.seriesKinetic'), color: ENERGY.kinetic },
        { label: tr('spring.seriesPotential'), color: ENERGY.potential },
        { label: tr('spring.seriesTotal'), color: ENERGY.total },
      ],
      spec: (): ChartSpec => ({
        x: { ...view.axes.t, label: tr('spring.axisTime') },
        y: { ...view.axes.energy, label: '' },
        series: [
          line('total', ENERGY.total, 4, (v) => `${auto(v)} J`),
          line('kinetic', ENERGY.kinetic),
          line('potential', ENERGY.potential),
        ],
        formatTick: fmtTick,
      }),
    },
    {
      id: 'velocity',
      tab: tr('spring.tabVelocity'),
      title: tr('spring.chartVelocity'),
      legend: [
        { label: tr('spring.seriesVx'), color: VELOCITY.vx },
        { label: tr('spring.seriesVy'), color: VELOCITY.vy },
        { label: tr('spring.seriesSpeed'), color: VELOCITY.speed },
      ],
      spec: (): ChartSpec => ({
        x: { ...view.axes.t, label: tr('spring.axisTime') },
        y: { min: -view.axes.v.max, max: view.axes.v.max, step: view.axes.v.step, label: '' },
        series: [
          line('speed', VELOCITY.speed, 4),
          line('vx', VELOCITY.vx, 2, (v) => `${auto(v)} m/s`),
          line('vy', VELOCITY.vy, 2, (v) => `${auto(v)} m/s`),
        ],
        formatTick: fmtTick,
      }),
    },
  ]);
  let chartTab = $state(0);

  // ---- text ----
  const energies = $derived(
    view.phase === 'ready'
      ? { spring: view.launch.springEnergy, kinetic: 0, potential: 0 }
      : { spring: 0, kinetic: view.now.kinetic, potential: view.now.potential },
  );
  const energyRows = $derived([
    { key: 'spring.energySpring' as const, value: energies.spring, color: ENERGY.spring },
    { key: 'spring.energyKinetic' as const, value: energies.kinetic, color: ENERGY.kinetic },
    { key: 'spring.energyPotential' as const, value: energies.potential, color: ENERGY.potential },
  ]);

  const banner = $derived(view.phase === 'landed' ? tf(lang, 'spring.banner', { d: auto(view.flight.range) }) : null);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sim sim--wide-scene" style:--sky={planet.sky} style:--accent={planet.accent}>
  <div class="sim__toolbar">
    <PlanetPicker {lang} value={params.planet} onchange={(id: PlanetId) => setParams({ planet: id })} />
    <div class="toolbar__right">
      <SpeedControl {lang} value={speed} onchange={setSpeed} speeds={SPEEDS} />
      <ShareButton {lang} />
    </div>
  </div>

  <section class="sim__controls" aria-label={tr('ui.sections')}>
    <Slider
      label={tr('spring.compression')}
      bind:value={() => params.compression, (v) => setParams({ compression: v })}
      min={COMPRESSION_MIN}
      max={COMPRESSION_MAX}
      step={0.05}
      display="{num(params.compression, 2)} m"
      color={COLORS.spring}
    />
    <Slider
      label={tr('spring.angle')}
      bind:value={() => params.angle, (v) => setParams({ angle: v })}
      min={ANGLE_MIN}
      max={ANGLE_MAX}
      step={1}
      display="{num(params.angle, 0)}°"
      color="#1e64c8"
    />
    <Slider
      label={tr('spring.stiffness')}
      bind:value={() => params.k, (v) => setParams({ k: v })}
      min={K_MIN}
      max={K_MAX}
      step={10}
      display="{num(params.k, 0)} N/m"
      color="#6a1b9a"
    />
    <Slider
      label={tr('spring.mass')}
      bind:value={() => params.mass, (v) => setParams({ mass: v })}
      min={MASS_MIN}
      max={MASS_MAX}
      step={0.1}
      display="{num(params.mass, 1)} kg"
      color={COLORS.ball}
    />

    <button type="button" role="switch" aria-checked={showArrows} class="switch" onclick={toggleArrows}>
      <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
      <span>{tr('spring.arrows')}: <strong>{showArrows ? tr('ui.on') : tr('ui.off')}</strong></span>
    </button>

    <div class="card energy">
      <h3>{tr('spring.energyTitle')}</h3>
      {#each energyRows as row (row.key)}
        <div class="energy__row">
          <span class="energy__label">{tr(row.key)}</span>
          <span class="mono">{auto(row.value)} J</span>
          <span class="energy__bar" aria-hidden="true">
            <span style:width="{(row.value / Math.max(view.launch.springEnergy, 1e-9)) * 100}%" style:background={row.color}></span>
          </span>
        </div>
      {/each}
      <p class="energy__total"><strong>{tr('spring.energyTotal')}:</strong> <span class="mono">{auto(energies.spring + energies.kinetic + energies.potential)} J</span></p>
    </div>

    <div class="card prediction">
      <h3>{tr('spring.predictionTitle')}</h3>
      <p class="formula">E = ½ × k × x² = ½ × {num(params.k, 0)} × {num(params.compression, 2)}² = <strong>{auto(view.launch.springEnergy)} J</strong></p>
      <p class="formula">
        v = √(2E / m) = √(2 × {auto(view.launch.springEnergy)} / {num(params.mass, 1)}) = <strong>{auto(view.launch.v)} m/s</strong>
      </p>
      <dl class="facts">
        <dt>{tr('spring.range')}</dt><dd class="mono">{auto(view.flight.range)} m</dd>
        <dt>{tr('spring.maxHeight')}</dt><dd class="mono">{auto(view.flight.maxHeight)} m</dd>
        <dt>{tr('spring.flightTime')}</dt><dd class="mono">{auto(view.flight.time)} s</dd>
      </dl>
    </div>

    <div class="card result" aria-live="polite">
      <h3>{tr('spring.resultTitle')}</h3>
      <p class="big">{tr('spring.clock')}: <span class="mono">{num(view.time, 2)} s</span></p>
      {#if view.phase === 'ready'}
        <p class="muted">{tr('spring.ready')}</p>
      {:else}
        <dl class="facts">
          <dt>{tr('spring.distance')}</dt><dd class="mono">{auto(view.now.x)} m</dd>
          <dt>{tr('spring.heightNow')}</dt><dd class="mono">{auto(Math.max(0, view.now.y))} m</dd>
          <dt>{tr('spring.highest')}</dt><dd class="mono">{auto(view.highest)} m</dd>
          <dt>{tr('spring.path')}</dt><dd class="mono">{auto(view.path)} m</dd>
          <dt>{tr('spring.speedNow')}</dt><dd class="mono">{auto(view.now.speed)} m/s</dd>
        </dl>
        {#if view.phase === 'landed'}
          <p class="verdict">{tf(lang, 'spring.landed', { d: auto(view.flight.range), t: num(view.flight.time, 2) })}</p>
        {/if}
      {/if}
    </div>
  </section>

  <section class="sim__scene">
    <div class="scene-img" role="img" aria-label={tf(lang, 'spring.sceneLabel', { a: num(params.angle, 0) })}>
      <canvas bind:this={sceneCanvas} aria-hidden="true"></canvas>
    </div>
    {#if banner}
      <div class="banner banner--ok" role="status">{banner}</div>
    {/if}
  </section>

  <div class="sim__actions">
    {#if view.phase === 'flying'}
      <button type="button" class="button action action--pause" onclick={togglePause}>
        {paused ? tr('ui.resume') : tr('ui.pause')}
      </button>
    {:else}
      <button type="button" class="button action action--drop" onclick={onLaunch}>{tr('spring.launch')}</button>
    {/if}
    <button type="button" class="button button--secondary action" onclick={onReset}>{tr('ui.reset')}</button>
  </div>

  <section class="sim__charts sim__charts--two">
    <div class="chart-tabs" role="tablist">
      {#each charts as c, i (c.id)}
        <button type="button" role="tab" aria-selected={chartTab === i} onclick={() => (chartTab = i)}>{c.tab}</button>
      {/each}
    </div>
    {#each charts as c, i (c.id)}
      <div class="chart-slot" class:chart-slot--active={chartTab === i}>
        <ChartCard title={c.title} legend={c.legend} spec={c.spec} {frame} summary={c.title} />
      </div>
    {/each}
    <p class="chart-note">
      {view.phase === 'ready' ? tr('spring.noteReady') : `${tr('spring.noteEnergy')} ${tr('spring.noteVelocity')}`}
    </p>
  </section>

  <p class="sim__shortcuts"><strong>{tr('ui.shortcuts')}:</strong> {tr('spring.shortcutsText')}</p>
</div>

<style>
  .energy__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 var(--space-2);
    font-size: var(--text-sm);
    margin-bottom: var(--space-2);
  }

  .energy__label {
    color: var(--ink-2);
  }

  .energy__bar {
    grid-column: 1 / -1;
    height: 10px;
    border-radius: 5px;
    background: var(--border);
    overflow: hidden;
  }

  .energy__bar span {
    display: block;
    height: 100%;
    border-radius: 5px;
  }

  .energy__total {
    margin: 0;
    padding-top: var(--space-1);
    border-top: 1px solid var(--border);
    color: #c82828;
  }

  .formula {
    font-size: var(--text-sm);
  }

  .formula strong {
    white-space: nowrap;
  }

  .facts {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-1) var(--space-3);
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }

  .facts dt {
    color: var(--ink-2);
  }

  .facts dd {
    margin: 0;
    font-weight: 700;
    text-align: right;
  }

  .verdict {
    margin-top: var(--space-2) !important;
    font-weight: 700;
    color: #00873a;
  }
</style>
