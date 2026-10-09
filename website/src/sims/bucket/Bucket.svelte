<script lang="ts">
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../../engine/loop';
  import { manageCanvas, type ManagedCanvas } from '../../engine/canvas';
  import { getPlanet, PLANETS, type PlanetId } from '../../shared/planets';
  import { formatNumber } from '../../shared/format';
  import { t, tf, type Locale, type TKey } from '../../i18n';
  import { CHART_COLORS, type ChartSpec, type Series } from '../../chart/chart';
  import Slider from '../../ui/Slider.svelte';
  import PlanetPicker from '../../ui/PlanetPicker.svelte';
  import SpeedControl from '../../ui/SpeedControl.svelte';
  import ChartCard from '../../ui/ChartCard.svelte';
  import ShareButton from '../../ui/ShareButton.svelte';
  import { ignoreShortcut, replaceQuery, stepSpeed } from '../../ui/sim-helpers';
  import { HOLE_MAX, HOLE_MIN, timeUntilLeft, VOLUME_MAX, VOLUME_MIN } from './physics';
  import { chartAxes, createState, DEFAULT_PARAMS, readout, start, step, type BucketParams, type BucketState, type Sample } from './model';
  import { COLORS, drawScene } from './renderer';
  import { paramsFromQuery, queryFromParams } from './url';

  let { lang }: { lang: Locale } = $props();

  // Real drains take minutes; slow motion is rarely wanted here
  const SPEEDS = [0.5, 1, 2, 5, 10, 20, 50];

  const num = (v: number, digits: number) => formatNumber(lang, v, digits);
  const tr = (key: TKey) => t(lang, key);
  /** "42.3 s" or "1 min 42 s". */
  const duration = (s: number) => {
    if (s < 60) return `${num(s, 1)} s`;
    const whole = Math.round(s);
    return `${Math.floor(whole / 60)} min ${whole % 60} s`;
  };

  // ---- state ----
  let params = $state<BucketParams>({ ...DEFAULT_PARAMS });
  let sim: BucketState = createState(DEFAULT_PARAMS);
  /** The last finished run, drawn dashed on the charts for comparison. */
  let previous = $state.raw<BucketState | null>(null);
  let latest: BucketState | null = null;
  let paused = $state(false);
  let speed = $state(5);
  let frame = $state(0);

  const planet = $derived(getPlanet(params.planet));

  const view = $derived.by(() => {
    void frame;
    return { phase: sim.phase, time: sim.time, drain: sim.drain, now: readout(sim), axes: chartAxes(sim, previous) };
  });

  const halves = $derived({ first: timeUntilLeft(view.drain, 0.5), total: view.drain.time });

  // ---- control ----
  let loop: FixedStepLoop | undefined;
  let sceneDirty = true;

  function restart(next: BucketState) {
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

  function setParams(patch: Partial<BucketParams>) {
    params = { ...params, ...patch };
    restart(createState(params));
    replaceQuery(queryFromParams(params));
  }

  const onStart = () => restart(start(params));
  const onReset = () => restart(createState(params));

  function togglePause() {
    if (sim.phase !== 'draining') return;
    paused = !paused;
    if (loop) loop.paused = paused;
  }

  function setSpeed(value: number) {
    speed = value;
    if (loop) loop.speed = value;
  }

  function onKeydown(e: KeyboardEvent) {
    if (ignoreShortcut(e)) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (sim.phase === 'draining') togglePause();
      else onStart();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'r') onReset();
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
    // Each step is a closed-form evaluation, so 60 Hz is plenty even at 50×
    loop = new FixedStepLoop(
      {
        update(dt) {
          const before = sim.phase;
          step(sim, dt);
          if (sim.phase !== before) {
            sceneDirty = true;
            if (sim.phase === 'empty') latest = sim;
          }
        },
        render() {
          if (!(sim.phase === 'draining' && !paused) && !sceneDirty) return;
          drawScene(scene!.ctx, scene!.size.width, scene!.size.height, sim, getPlanet(sim.params.planet), { num });
          sceneDirty = false;
          frame++;
        },
      },
      { stepHz: 60 },
    );
    loop.speed = speed;
    loop.start();
    document.fonts?.ready.then(() => (sceneDirty = true));
    return () => {
      loop?.stop();
      scene?.dispose();
    };
  });

  // ---- charts ----
  function series(key: keyof Sample, color: string): Series[] {
    const out: Series[] = [];
    if (previous) {
      out.push({ points: previous.samples.map((s) => ({ x: s.t, y: s[key] })), color: CHART_COLORS.inkMuted, width: 2, dashed: true, marker: false });
    }
    const points = sim.samples.map((s) => ({ x: s.t, y: s[key] }));
    const last = points.at(-1);
    out.push({ points, color, width: 3, endText: last && sim.phase === 'draining' ? `${num(last.y, key === 'hCm' ? 1 : 2)} ${key === 'hCm' ? 'cm' : 'm/s'}` : undefined });
    return out;
  }

  const fmtTick = (v: number) => formatNumber(lang, v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);

  const legend = $derived.by(() => {
    void frame;
    return previous
      ? [
          { label: tr('bucket.seriesPrevious'), color: CHART_COLORS.inkMuted, dashed: true },
          { label: tr('bucket.seriesNow'), color: COLORS.waterDeep },
        ]
      : [];
  });

  const charts = $derived([
    {
      id: 'height',
      tab: tr('bucket.tabHeight'),
      title: tr('bucket.chartHeight'),
      spec: (): ChartSpec => ({
        x: { ...view.axes.t, label: tr('bucket.axisTime') },
        y: { ...view.axes.h, label: '' },
        series: series('hCm', COLORS.waterDeep),
        formatTick: fmtTick,
      }),
    },
    {
      id: 'speed',
      tab: tr('bucket.tabSpeed'),
      title: tr('bucket.chartSpeed'),
      spec: (): ChartSpec => ({
        x: { ...view.axes.t, label: tr('bucket.axisTime') },
        y: { ...view.axes.v, label: '' },
        series: series('v', '#0b8fa0'),
        formatTick: fmtTick,
      }),
    },
  ]);
  let chartTab = $state(0);

  const banner = $derived(view.phase === 'empty' ? tf(lang, 'bucket.banner', { t: duration(view.drain.time) }) : null);
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
      label={tr('bucket.volume')}
      bind:value={() => params.volume, (v) => setParams({ volume: v })}
      min={VOLUME_MIN}
      max={VOLUME_MAX}
      step={0.5}
      display="{num(params.volume, 1)} L"
      color={COLORS.waterDeep}
    />
    <Slider
      label={tr('bucket.hole')}
      bind:value={() => params.hole, (v) => setParams({ hole: v })}
      min={HOLE_MIN}
      max={HOLE_MAX}
      step={1}
      display="{num(params.hole, 0)} mm"
      color="#5a5a64"
    />

    <div class="card prediction">
      <h3>{tr('bucket.predictionTitle')}</h3>
      <dl class="facts">
        <dt>{tr('bucket.emptyIn')}</dt><dd class="mono">{duration(halves.total)}</dd>
        <dt>{tr('bucket.firstHalf')}</dt><dd class="mono">{duration(halves.first)}</dd>
        <dt>{tr('bucket.secondHalf')}</dt><dd class="mono">{duration(halves.total - halves.first)}</dd>
      </dl>
    </div>

    <div class="card result" aria-live="polite">
      <h3>{tr('bucket.nowTitle')}</h3>
      <p class="big">{tr('bucket.clock')}: <span class="mono">{duration(view.time)}</span></p>
      <dl class="facts">
        <dt>{tr('bucket.volumeNow')}</dt><dd class="mono">{num(view.now.volume, 2)} L</dd>
        <dt>{tr('bucket.levelNow')}</dt><dd class="mono">{num(view.now.hCm, 1)} cm</dd>
        <dt>{tr('bucket.speedNow')}</dt><dd class="mono">{num(view.phase === 'ready' ? 0 : view.now.v, 2)} m/s</dd>
        <dt>{tr('bucket.flowNow')}</dt><dd class="mono">{num(view.phase === 'ready' ? 0 : view.now.flow, 3)} L/s</dd>
        <dt>{tr('bucket.drained')}</dt><dd class="mono">{num(view.now.drained, 2)} L</dd>
      </dl>
      {#if view.phase === 'ready'}
        <p class="muted">{tr('bucket.ready')}</p>
      {:else if view.phase === 'empty'}
        <p class="verdict">
          {tf(lang, 'bucket.emptyAfter', {
            t: duration(halves.total),
            a: duration(halves.first),
            b: duration(halves.total - halves.first),
            r: num((halves.total - halves.first) / halves.first, 1),
          })}
        </p>
      {/if}
    </div>
  </section>

  <section class="sim__scene">
    <div class="scene-img" role="img" aria-label={tf(lang, 'bucket.sceneLabel', { v: num(params.volume, 1), d: num(params.hole, 0) })}>
      <canvas bind:this={sceneCanvas} aria-hidden="true"></canvas>
    </div>
    {#if banner}
      <div class="banner banner--ok" role="status">{banner}</div>
    {/if}
  </section>

  <div class="sim__actions">
    {#if view.phase === 'draining'}
      <button type="button" class="button action action--pause" onclick={togglePause}>
        {paused ? tr('ui.resume') : tr('ui.pause')}
      </button>
    {:else}
      <button type="button" class="button action action--drop" onclick={onStart}>{tr('bucket.start')}</button>
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
        <ChartCard title={c.title} {legend} spec={c.spec} {frame} summary={c.title} />
      </div>
    {/each}
    <p class="chart-note">{view.phase === 'ready' && !previous ? tr('bucket.noteReady') : tr('bucket.noteRun')}</p>
  </section>

  <p class="sim__shortcuts"><strong>{tr('ui.shortcuts')}:</strong> {tr('bucket.shortcutsText')}</p>
</div>

<style>
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
