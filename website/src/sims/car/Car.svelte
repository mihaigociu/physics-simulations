<script lang="ts">
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../../engine/loop';
  import { manageCanvas, type ManagedCanvas } from '../../engine/canvas';
  import { formatNumber } from '../../shared/format';
  import { t, tf, type Locale, type TKey } from '../../i18n';
  import { CHART_COLORS, type ChartSpec, type Series, type XY } from '../../chart/chart';
  import SpeedControl, { SPEEDS } from '../../ui/SpeedControl.svelte';
  import ChartCard from '../../ui/ChartCard.svelte';
  import ShareButton from '../../ui/ShareButton.svelte';
  import { ignoreShortcut, replaceQuery, stepSpeed } from '../../ui/sim-helpers';
  import Pedal from './Pedal.svelte';
  import {
    BRAKE_MAX,
    chartAxes,
    COAST_TIME,
    coastLeft,
    createState,
    CRUISE_SPEED,
    cruiseStage,
    FLAG,
    GAS_MAX,
    MODES,
    parkResult,
    ratesBefore,
    sampleAt,
    step,
    type CarState,
    type Mode,
    type Pedals,
    type Sample,
  } from './model';
  import { drawScene } from './renderer';
  import { modeFromQuery, queryFromMode } from './url';

  let { lang }: { lang: Locale } = $props();

  const num = (v: number, digits: number) => formatNumber(lang, v, digits);
  const tr = (key: TKey) => t(lang, key);

  const COLORS = { x: '#1e64c8', v: '#00873a', a: '#8a3ffc', tangent: '#e07800', target: '#c62828' };
  /** Keyboard pedals deepen while held: a tap is gentle, holding 1 s is full. */
  const KEY_START = 0.2;
  const KEY_RAMP = 0.8; // per second of wall time

  // ---- state ----
  let mode = $state<Mode>('free');
  let sim: CarState = createState('free');
  let paused = $state(false);
  let speed = $state(1);
  /** Bumped whenever `sim` changed, to refresh readouts and charts. */
  let frame = $state(0);
  /** Time picked on a chart while paused, or null for "now". */
  let cursorT = $state<number | null>(null);
  /** Closest park this visit, m from the flag (kept in memory only). */
  let bestPark = $state<number | null>(null);

  const touch: Pedals = { gas: 0, brake: 0 };
  const keys: Pedals = { gas: 0, brake: 0 };
  const held = { gas: false, brake: false };

  // Snapshot of the mutable simulation for the template (re-read on each frame bump)
  const view = $derived.by(() => {
    void frame;
    const reading: Sample = cursorT === null ? { t: sim.time, x: sim.x, v: sim.v, a: sim.a } : sampleAt(sim, cursorT);
    return {
      phase: sim.phase,
      reading,
      pedals: { ...sim.pedals },
      stage: cruiseStage(sim),
      coastLeft: coastLeft(sim),
      park: parkResult(sim),
      oneSecond: ratesBefore(sim, reading.t, 1),
      tenth: ratesBefore(sim, reading.t, 0.1),
    };
  });

  // ---- control ----
  let loop: FixedStepLoop | undefined;
  let sceneDirty = true;

  function redraw() {
    sceneDirty = true;
    frame++;
  }

  function restart(next: CarState) {
    sim = next;
    paused = false;
    cursorT = null;
    if (loop) {
      loop.paused = false;
      loop.clearAccumulator();
    }
    applyPedals();
    redraw();
  }

  function setMode(next: Mode) {
    if (next === mode) return;
    mode = next;
    restart(createState(next));
    replaceQuery(queryFromMode(next));
  }

  function onReset() {
    restart(createState(mode));
  }

  function setPaused(value: boolean) {
    paused = value;
    if (loop) loop.paused = value;
    if (!value) cursorT = null;
    redraw();
  }

  function togglePause() {
    if (sim.phase === 'driving') setPaused(!paused);
  }

  /** Copy the touch and keyboard pedals into the simulation. */
  function applyPedals() {
    const done = sim.phase === 'done';
    const next = { gas: done ? 0 : Math.max(touch.gas, keys.gas), brake: done ? 0 : Math.max(touch.brake, keys.brake) };
    if (next.gas !== sim.pedals.gas || next.brake !== sim.pedals.brake) sceneDirty = true;
    sim.pedals = next;
  }

  /** Pressing a pedal while paused carries on driving. */
  function pressed(kind: keyof Pedals) {
    if (paused && sim.phase === 'driving') setPaused(false);
    if (kind === 'gas' && sim.phase === 'ready') cursorT = null;
  }

  function setTouchPedal(kind: keyof Pedals, depth: number) {
    touch[kind] = depth;
    if (depth > 0) pressed(kind);
    applyPedals();
    redraw();
  }

  function setKey(kind: keyof Pedals, down: boolean) {
    held[kind] = down;
    keys[kind] = down ? Math.max(keys[kind], KEY_START) : 0;
    if (down) pressed(kind);
    applyPedals();
    redraw();
  }

  function releaseAll() {
    touch.gas = touch.brake = keys.gas = keys.brake = 0;
    held.gas = held.brake = false;
    applyPedals();
    redraw();
  }

  function setSpeed(value: number) {
    speed = value;
    if (loop) loop.speed = value;
  }

  function onKeydown(e: KeyboardEvent) {
    if (ignoreShortcut(e)) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!e.repeat) setKey(e.key === 'ArrowUp' ? 'gas' : 'brake', true);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      togglePause();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'r') onReset();
    else if (key === '+' || key === '=') setSpeed(stepSpeed(SPEEDS, speed, 1));
    else if (key === '-' || key === '_') setSpeed(stepSpeed(SPEEDS, speed, -1));
    else if (['1', '2', '3'].includes(key)) setMode(MODES[Number(key) - 1]!);
  }

  function onKeyup(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') setKey('gas', false);
    else if (e.key === 'ArrowDown') setKey('brake', false);
  }

  /** Touching a graph freezes time there, so you can look back along it. */
  function onScrub(time: number) {
    if (sim.phase === 'ready') return;
    if (sim.phase === 'driving' && !paused) setPaused(true);
    cursorT = Math.min(sim.time, Math.max(sim.samples[0]!.t, time));
    redraw();
  }

  function clearCursor() {
    cursorT = null;
    redraw();
  }

  // ---- scene ----
  let sceneCanvas: HTMLCanvasElement;
  let scene: ManagedCanvas | undefined;

  onMount(() => {
    // A shared link may pick a challenge
    if (location.search) {
      mode = modeFromQuery(location.search);
      sim = createState(mode);
      frame++;
    }
    scene = manageCanvas(sceneCanvas, () => (sceneDirty = true));

    loop = new FixedStepLoop({
      update(dt) {
        // Held arrow keys press deeper, in wall time so slow motion doesn't slow the foot
        const wall = dt / (loop?.speed ?? 1);
        for (const kind of ['gas', 'brake'] as const) {
          if (held[kind]) keys[kind] = Math.min(1, keys[kind] + KEY_RAMP * wall);
        }
        applyPedals();
        const before = sim.phase;
        step(sim, dt);
        if (sim.phase !== before) {
          sceneDirty = true;
          applyPedals(); // a finished challenge lets go of the pedals
          const result = parkResult(sim);
          if (result) bestPark = Math.min(bestPark ?? Infinity, Math.abs(result.miss));
        }
      },
      render() {
        // Idle (ready, done or paused) costs nothing until something changes
        if (!(sim.phase === 'driving' && !paused) && !sceneDirty) return;
        const cursor = cursorT === null ? null : { t: cursorT, x: sampleAt(sim, cursorT).x };
        drawScene(scene!.ctx, scene!.size.width, scene!.size.height, sim, { num, inside: tr('car.insideCar') }, { cursor, flag: sim.mode === 'park' });
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
    document.fonts?.ready.then(redraw);
  });

  // ---- charts ----
  type Key = 'x' | 'v' | 'a';

  const fmtTick = (v: number) => formatNumber(lang, v, Number.isInteger(v) ? 0 : v * 10 === Math.round(v * 10) ? 1 : 2);
  const UNITS: Record<Key, string> = { x: 'm', v: 'm/s', a: 'm/s²' };

  function chartSpec(key: Key): ChartSpec {
    void frame;
    const axes = chartAxes(sim, { x: sim.mode === 'park' ? FLAG * 1.1 : undefined, v: sim.mode === 'cruise' ? CRUISE_SPEED * 1.2 : undefined });
    const range = axes[key];
    const points: XY[] = [];
    for (const s of sim.samples) if (s.t >= axes.t.min) points.push({ x: s.t, y: s[key] });
    const last = points.at(-1);
    if (!last || last.x < sim.time) points.push({ x: sim.time, y: sim[key] });

    const r = view.reading;
    const live = cursorT === null;
    const started = sim.phase !== 'ready';
    const series: Series[] = [];
    const across = (y: number): Series => ({
      points: [
        { x: axes.t.min, y },
        { x: axes.t.max, y },
      ],
      color: COLORS.target,
      width: 1.5,
      dashed: true,
      marker: false,
    });
    if (key === 'x' && sim.mode === 'park') series.push(across(FLAG));
    if (key === 'v' && sim.mode === 'cruise') series.push(across(CRUISE_SPEED));

    series.push({
      points,
      color: COLORS[key],
      width: 3,
      marker: live,
      endText: live && started ? `${num(sim[key], key === 'x' ? 0 : 1)} ${UNITS[key]}` : undefined,
    });

    if (started) {
      // Tangent: a short straight line touching the curve, as steep as the curve is right there
      if (key !== 'a') {
        const slope = key === 'x' ? r.v : r.a;
        const half = (axes.t.max - axes.t.min) * 0.12;
        series.push({
          points: [
            { x: r.t - half, y: r[key] - slope * half },
            { x: r.t + half, y: r[key] + slope * half },
          ],
          color: COLORS.tangent,
          width: 2.5,
          marker: false,
          endText: `${num(slope, 1)} ${UNITS[key === 'x' ? 'v' : 'a']}`,
        });
      }
      if (!live) {
        series.push({
          points: [
            { x: r.t, y: range.min },
            { x: r.t, y: range.max },
          ],
          color: CHART_COLORS.inkMuted,
          width: 1,
          dashed: true,
          marker: false,
        });
        series.push({ points: [{ x: r.t, y: r[key] }], color: COLORS[key], endText: `${num(r[key], key === 'x' ? 0 : 1)} ${UNITS[key]}` });
      }
    }
    return {
      x: { ...axes.t, label: tr('car.axisTime') },
      y: { ...range, label: '' },
      series,
      formatTick: fmtTick,
    };
  }

  const charts = $derived([
    {
      id: 'x' as const,
      tab: tr('car.tabDistance'),
      title: tr('car.chartDistance'),
      legend: [
        { label: tr('car.seriesDistance'), color: COLORS.x },
        { label: tr('car.tangentSpeed'), color: COLORS.tangent },
        ...(mode === 'park' ? [{ label: tr('car.seriesFlag'), color: COLORS.target, dashed: true }] : []),
      ],
    },
    {
      id: 'v' as const,
      tab: tr('car.tabSpeed'),
      title: tr('car.chartSpeed'),
      legend: [
        { label: tr('car.seriesSpeed'), color: COLORS.v },
        { label: tr('car.tangentAccel'), color: COLORS.tangent },
        ...(mode === 'cruise' ? [{ label: tf(lang, 'car.seriesTarget', { v: num(CRUISE_SPEED, 0) }), color: COLORS.target, dashed: true }] : []),
      ],
    },
    {
      id: 'a' as const,
      tab: tr('car.tabAccel'),
      title: tr('car.chartAccel'),
      legend: [{ label: tr('car.seriesAccel'), color: COLORS.a }],
    },
  ]);
  let chartTab = $state(0);

  const chartNote = $derived.by(() => {
    if (view.phase === 'ready') return tr('car.noteReady');
    if (cursorT !== null) return tr('car.noteScrub');
    return tr('car.noteLive');
  });

  // ---- text ----
  const MODE_KEYS: Record<Mode, TKey> = { free: 'car.modeFree', cruise: 'car.modeCruise', park: 'car.modePark' };

  const kmh = (v: number) => num(v * 3.6, 0);

  const banner = $derived.by(() => {
    if (view.phase !== 'done') return null;
    if (mode === 'cruise') return { text: tr('car.bannerCruise'), tone: 'ok' };
    const p = view.park;
    if (!p) return null;
    const off = num(Math.abs(p.miss), 1);
    if (p.stars === 3) return { text: tr('car.bannerPerfect'), tone: 'ok' };
    return { text: tf(lang, p.miss < 0 ? 'car.bannerShort' : 'car.bannerLong', { d: off }), tone: p.stars >= 2 ? 'ok' : 'warn' };
  });

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
</script>

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} onblur={releaseAll} />

<div class="sim sim--wide-scene sim--car">
  <div class="sim__toolbar">
    <div class="modes" role="radiogroup" aria-label={tr('car.mode')}>
      {#each MODES as id, i (id)}
        <button type="button" role="radio" aria-checked={mode === id} onclick={() => setMode(id)}>
          {tr(MODE_KEYS[id])}<kbd aria-hidden="true">{i + 1}</kbd>
        </button>
      {/each}
    </div>
    <div class="toolbar__right">
      <SpeedControl {lang} value={speed} onchange={setSpeed} />
      <ShareButton {lang} />
    </div>
  </div>

  <section class="sim__controls" aria-label={tr('ui.sections')}>
    <div class="card mission" aria-live="polite">
      {#if mode === 'free'}
        <h3>{tr('car.freeTitle')}</h3>
        <p>{tr('car.freeText')}</p>
        <p class="muted">{tr('car.noFriction')}</p>
      {:else if mode === 'cruise'}
        <h3>{tr('car.cruiseTitle')}</h3>
        <ol class="steps">
          <li class:done={view.stage !== 'speedUp'}>{tf(lang, 'car.cruiseStep1', { v: num(CRUISE_SPEED, 0), kmh: kmh(CRUISE_SPEED) })}</li>
          <li class:done={view.stage === 'coast' || view.stage === 'done'}>{tr('car.cruiseStep2')}</li>
          <li class:done={view.stage === 'done'}>
            {view.stage === 'coast' ? tf(lang, 'car.cruiseStep3Count', { s: num(Math.ceil(view.coastLeft), 0) }) : tf(lang, 'car.cruiseStep3', { s: num(COAST_TIME, 0) })}
          </li>
        </ol>
        {#if view.stage === 'done'}
          <p class="verdict">{tf(lang, 'car.cruiseDone', { v: num(view.reading.v, 1) })}</p>
        {:else if view.stage === 'letGo' && view.pedals.gas === 0 && view.pedals.brake === 0 && view.reading.v === 0}
          <p class="warn">{tr('car.cruiseStopped')}</p>
        {/if}
      {:else}
        <h3>{tr('car.parkTitle')}</h3>
        <p>{tf(lang, 'car.parkText', { d: num(FLAG, 0) })}</p>
        {#if view.park}
          <p class="stars" aria-label={tf(lang, 'car.starsLabel', { n: view.park.stars })}>{stars(view.park.stars)}</p>
          <p class="verdict" class:warn={view.park.stars < 2}>
            {view.park.stars === 3
              ? tf(lang, 'car.parkPerfect', { d: num(Math.abs(view.park.miss), 2) })
              : tf(lang, view.park.miss < 0 ? 'car.parkShort' : 'car.parkLong', { d: num(Math.abs(view.park.miss), 1) })}
          </p>
          <p class="muted">{tr('car.parkTip')}</p>
        {/if}
        {#if bestPark !== null}
          <p class="muted">{tf(lang, 'car.parkBest', { d: num(bestPark, 2) })}</p>
        {/if}
      {/if}
    </div>

    <div class="card readings">
      <h3>
        {tr('car.dashTitle')}
        {#if cursorT !== null}
          <span class="at">{tf(lang, 'car.dashAt', { t: num(view.reading.t, 1) })}</span>
          <button type="button" class="linkish" onclick={clearCursor}>{tr('car.backToNow')}</button>
        {/if}
      </h3>
      <dl class="facts">
        <dt>{tr('car.clock')}</dt><dd class="mono">{num(view.reading.t, 1)} s</dd>
        <dt style:color={COLORS.x}>{tr('car.distance')}</dt><dd class="mono">{num(view.reading.x, 1)} m</dd>
        <dt style:color={COLORS.v}>{tr('car.speed')}</dt><dd class="mono">{num(view.reading.v, 1)} m/s <span class="sub">= {kmh(view.reading.v)} km/h</span></dd>
        <dt style:color={COLORS.a}>{tr('car.accel')}</dt><dd class="mono">{num(view.reading.a, 1)} m/s²</dd>
      </dl>
    </div>

    <div class="card equations">
      <h3>{tr('car.eqTitle')}</h3>
      {#if view.oneSecond}
        {@const r = view.oneSecond}
        <p class="eq-q">{tr('car.eqSpeedQ')}</p>
        <p class="formula">v ≈ Δx / Δt = {num(r.dx, 1)} m / {num(r.dt, 1)} s = <strong>{num(r.dx / r.dt, 1)} m/s</strong></p>
        <p class="eq-q">{tr('car.eqAccelQ')}</p>
        <p class="formula">a ≈ Δv / Δt = {num(r.dv, 1)} m/s / {num(r.dt, 1)} s = <strong>{num(r.dv / r.dt, 1)} m/s²</strong></p>
        <details>
          <summary>{tr('car.eqMore')}</summary>
          <p>{tr('car.eqShorter')}</p>
          <table>
            <tbody>
              <tr><th scope="row">Δt = {num(r.dt, 1)} s</th><td class="mono">v ≈ {num(r.dx / r.dt, 2)} m/s</td></tr>
              {#if view.tenth}
                <tr><th scope="row">Δt = {num(view.tenth.dt, 2)} s</th><td class="mono">v ≈ {num(view.tenth.dx / view.tenth.dt, 2)} m/s</td></tr>
              {/if}
              <tr><th scope="row">{tr('car.eqSpeedometer')}</th><td class="mono">v = {num(view.reading.v, 2)} m/s</td></tr>
            </tbody>
          </table>
          <p>{tr('car.eqDerivative')}</p>
          <p class="formula big-formula">v = dx/dt &nbsp;&nbsp; a = dv/dt</p>
          <p>{tr('car.eqTangent')}</p>
        </details>
      {:else}
        <p class="muted">{tr('car.eqWaiting')}</p>
      {/if}
    </div>
  </section>

  <section class="sim__scene car-scene">
    <div
      class="scene-img"
      role="img"
      aria-label={tf(lang, 'car.sceneLabel', { x: num(view.reading.x, 0), v: num(view.reading.v, 1) })}
    >
      <canvas bind:this={sceneCanvas} aria-hidden="true"></canvas>
    </div>
    {#if banner}
      <div class="banner banner--{banner.tone}" role="status">{banner.text}</div>
    {/if}
  </section>

  <div class="sim__actions car-actions">
    <div class="buttons">
      {#if view.phase === 'done'}
        <button type="button" class="button action action--drop" onclick={onReset}>{tr('car.again')}</button>
      {:else}
        <button type="button" class="button action action--pause" disabled={view.phase === 'ready'} onclick={togglePause}>
          {paused ? tr('ui.resume') : tr('ui.pause')}
        </button>
        <button type="button" class="button button--secondary action" onclick={onReset}>{tr('ui.reset')}</button>
      {/if}
    </div>
    <div class="pedals">
      <div class="pedal-slot pedal-slot--brake">
        <Pedal
          kind="brake"
          label={tr('car.brake')}
          depth={view.pedals.brake}
          detail={view.pedals.brake > 0 ? `−${num(BRAKE_MAX * view.pedals.brake, 1)} m/s²` : '0 m/s²'}
          disabled={view.phase === 'done'}
          onchange={(d) => setTouchPedal('brake', d)}
        />
      </div>
      <div class="pedal-slot pedal-slot--gas">
        <Pedal
          kind="gas"
          label={tr('car.gas')}
          depth={view.pedals.gas}
          detail={view.pedals.gas > 0 ? `+${num(GAS_MAX * view.pedals.gas, 1)} m/s²` : '0 m/s²'}
          disabled={view.phase === 'done'}
          onchange={(d) => setTouchPedal('gas', d)}
        />
      </div>
    </div>
    <p class="pedal-hint">{tr('car.pedalHint')}</p>
  </div>

  <section class="sim__charts">
    <div class="chart-tabs" role="tablist">
      {#each charts as c, i (c.id)}
        <button type="button" role="tab" aria-selected={chartTab === i} onclick={() => (chartTab = i)}>{c.tab}</button>
      {/each}
    </div>
    {#each charts as c, i (c.id)}
      <div class="chart-slot" class:chart-slot--active={chartTab === i}>
        <ChartCard title={c.title} legend={c.legend} spec={() => chartSpec(c.id)} {frame} summary={c.title} onscrub={onScrub} />
      </div>
    {/each}
    <p class="chart-note">
      {chartNote}
      {#if cursorT !== null && view.phase === 'driving'}
        <button type="button" class="linkish" onclick={() => setPaused(false)}>{tr('car.keepDriving')}</button>
      {/if}
    </p>
  </section>

  <p class="sim__shortcuts"><strong>{tr('ui.shortcuts')}:</strong> {tr('car.shortcutsText')}</p>
</div>

<style>
  .car-scene {
    background: #9fd3ff;
  }

  /* A road is wide and low: a shorter scene keeps the pedals on screen */
  @media (min-width: 48rem) {
    .car-scene {
      height: clamp(300px, 44vh, 480px);
    }
  }

  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .modes button {
    position: relative;
    min-height: var(--touch);
    padding: var(--space-1) var(--space-6) var(--space-1) var(--space-4);
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .modes button[aria-checked='true'] {
    border-color: var(--brand);
    background: var(--brand);
    color: #fff;
  }

  .modes kbd {
    position: absolute;
    top: 4px;
    right: 6px;
    font: inherit;
    font-size: 0.7rem;
    opacity: 0.55;
  }

  @media (hover: none) {
    .modes kbd {
      display: none;
    }

    .modes button {
      padding-right: var(--space-4);
    }
  }

  .mission p {
    font-size: var(--text-sm);
  }

  .steps {
    margin: 0 0 var(--space-2);
    padding-left: 1.4em;
    font-size: var(--text-sm);
  }

  .steps li {
    margin-bottom: var(--space-1);
  }

  .steps li.done {
    color: #00873a;
    font-weight: 700;
  }

  .steps li.done::marker {
    content: '✓  ';
  }

  .stars {
    font-size: 1.8rem;
    line-height: 1;
    color: #e0a000;
    letter-spacing: 0.1em;
  }

  .verdict {
    font-weight: 700;
    color: #00873a;
  }

  .verdict.warn {
    color: #b05400;
    font-size: var(--text-base);
  }

  .readings h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-2);
  }

  .at {
    font-size: var(--text-sm);
    font-weight: 700;
    color: #7a5b00;
    background: #fff3c4;
    padding: 0 var(--space-2);
    border-radius: 999px;
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-3);
    margin: var(--space-2) 0 0;
  }

  .facts dt {
    font-weight: 700;
  }

  .facts dd {
    margin: 0;
    font-weight: 700;
    text-align: right;
  }

  .sub {
    display: block;
    font-weight: 400;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .eq-q {
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .formula {
    font-variant-numeric: tabular-nums;
    margin-bottom: var(--space-2) !important;
  }

  .big-formula {
    font-size: var(--text-lg);
    font-weight: 700;
    text-align: center;
  }

  details {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
  }

  summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    font-weight: 700;
    color: var(--brand);
    cursor: pointer;
  }

  table {
    width: 100%;
    margin-block: var(--space-2);
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--border);
    text-align: left;
    font-weight: 400;
  }

  td {
    text-align: right;
    font-weight: 700;
  }

  /* Buttons on the left, pedals on the right where a thumb rests */
  .car-actions {
    display: grid;
    grid-template-columns: minmax(7rem, 1fr) minmax(0, 1.6fr);
    grid-template-areas:
      'buttons pedals'
      'hint hint';
    gap: var(--space-2) var(--space-3);
    align-items: start;
  }

  .buttons {
    grid-area: buttons;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .buttons .action {
    flex: none;
    min-height: 52px;
  }

  .buttons .action:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pedals {
    grid-area: pedals;
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    align-items: end;
    gap: var(--space-3);
  }

  .pedal-slot--brake {
    height: 100px;
  }

  .pedal-slot--gas {
    height: 124px;
  }

  .pedal-hint {
    grid-area: hint;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
    text-align: right;
  }

  .linkish {
    padding: 0;
    border: 0;
    background: none;
    color: var(--brand);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }

  @media (min-width: 48rem) {
    .car-actions {
      grid-template-columns: minmax(10rem, 14rem) 1fr;
    }

    .pedals {
      justify-self: end;
      width: min(100%, 22rem);
    }
  }
</style>
