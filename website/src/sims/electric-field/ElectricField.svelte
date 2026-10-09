<script lang="ts">
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../../engine/loop';
  import { manageCanvas, type ManagedCanvas } from '../../engine/canvas';
  import { formatNumber } from '../../shared/format';
  import { t, tf, type Locale, type TKey } from '../../i18n';
  import { type ChartSpec, type Series } from '../../chart/chart';
  import { axisMax, axisRange } from '../../chart/ticks';
  import SpeedControl from '../../ui/SpeedControl.svelte';
  import ChartCard from '../../ui/ChartCard.svelte';
  import ShareButton from '../../ui/ShareButton.svelte';
  import { ignoreShortcut, replaceQuery, stepSpeed } from '../../ui/sim-helpers';
  import { CHARGE, energy, field, nearestDistance, stopReason } from './physics';
  import {
    addCharge,
    CHARGE_SNAP,
    createState,
    flipCharge,
    LAYOUT_IDS,
    LAYOUTS,
    layoutCharges,
    matchingLayout,
    MAX_CHARGES,
    moveCharge,
    placeParticle,
    release,
    removeCharge,
    resetParticle,
    step,
    type FieldState,
    type LayoutId,
    type Sample,
  } from './model';
  import { CHARGE_RADIUS, COLORS, drawScene, sceneTransform } from './renderer';
  import { queryFromSetup, setupFromQuery } from './url';

  let { lang }: { lang: Locale } = $props();

  // The forces are tiny (nanonewtons), so real motion is slow
  const SPEEDS = [1, 2, 5, 10, 20, 50];
  const ENERGY = { kinetic: '#2ccf5a', potential: '#2a6ae8', total: '#e03232' };
  const LAYOUT_KEYS: Record<LayoutId, TKey> = {
    original: 'field.layoutOriginal',
    pair: 'field.layoutPair',
    dipole: 'field.layoutDipole',
    single: 'field.layoutSingle',
    empty: 'field.layoutEmpty',
  };

  const num = (v: number, digits: number) => formatNumber(lang, v, digits);
  const tr = (key: TKey) => t(lang, key);

  // ---- state ----
  let sim: FieldState = createState(layoutCharges('original'), LAYOUTS.original.start);
  let selected = $state<number | null>(null);
  let showField = $state(true);
  let paused = $state(false);
  let speed = $state(10);
  let frame = $state(0);

  const view = $derived.by(() => {
    void frame;
    const p = sim.particle;
    const { ex, ey } = field(sim.charges, p.x, p.y);
    return {
      phase: sim.phase,
      stop: sim.stop,
      time: sim.time,
      sign: p.sign,
      count: sim.charges.length,
      layout: matchingLayout(sim.charges),
      speed: Math.hypot(p.vx, p.vy),
      nearest: nearestDistance(sim.charges, p.x, p.y),
      force: Math.hypot(ex, ey) * CHARGE,
      energy: energy(sim.charges, p),
    };
  });

  // ---- control ----
  let loop: FixedStepLoop | undefined;
  let sceneDirty = true;

  function changed(urlToo = true) {
    sceneDirty = true;
    frame++;
    if (urlToo) replaceQuery(queryFromSetup({ charges: sim.charges, start: sim.start, sign: sim.particle.sign }));
  }

  function setRunning(next: boolean) {
    paused = !next;
    if (loop) {
      loop.paused = !next;
      loop.clearAccumulator();
    }
  }

  function onRelease() {
    resetParticle(sim);
    release(sim);
    setRunning(true);
    changed(false);
  }

  function onReset() {
    resetParticle(sim);
    setRunning(true);
    changed(false);
  }

  function togglePause() {
    if (sim.phase !== 'running') return;
    setRunning(paused);
  }

  function chooseLayout(id: LayoutId) {
    sim = createState(layoutCharges(id), LAYOUTS[id].start, sim.particle.sign);
    selected = null;
    setRunning(true);
    changed();
  }

  function setSign(sign: 1 | -1) {
    sim.particle.sign = sign;
    resetParticle(sim);
    changed();
  }

  /** After the charges change, a waiting particle may now be on top of one. */
  function chargesChanged() {
    if (sim.phase === 'ready') sim.stop = stopReason(sim.charges, sim.particle);
    changed();
  }

  function onAdd(sign: 1 | -1) {
    const i = addCharge(sim, sign);
    if (i >= 0) selected = i;
    chargesChanged();
  }

  function onFlip() {
    if (selected === null) return;
    flipCharge(sim, selected);
    chargesChanged();
  }

  function onRemove() {
    if (selected === null) return;
    removeCharge(sim, selected);
    selected = null;
    chargesChanged();
  }

  function setSpeed(value: number) {
    speed = value;
    if (loop) loop.speed = value;
  }

  function nudgeSelected(dx: number, dy: number) {
    if (selected === null) return;
    const c = sim.charges[selected]!;
    moveCharge(sim, selected, c.x + dx * CHARGE_SNAP, c.y + dy * CHARGE_SNAP);
    chargesChanged();
  }

  function onKeydown(e: KeyboardEvent) {
    if (ignoreShortcut(e)) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (sim.phase === 'running') togglePause();
      else onRelease();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
      e.preventDefault();
      onRemove();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'r') onReset();
    else if (key === 'f') {
      showField = !showField;
      sceneDirty = true;
    } else if (key === '+' || key === '=') setSpeed(stepSpeed(SPEEDS, speed, 1));
    else if (key === '-' || key === '_') setSpeed(stepSpeed(SPEEDS, speed, -1));
  }

  /** Arrow keys move the selected charge, but only while the scene has focus (so the page still scrolls). */
  function onSceneKeydown(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const m = moves[e.key];
    if (m && selected !== null) {
      e.preventDefault();
      nudgeSelected(m[0], m[1]);
    }
  }

  // ---- pointer: tap to place the particle, drag charges ----
  let sceneCanvas: HTMLCanvasElement;
  let scene: ManagedCanvas | undefined;
  let drag: { index: number; startX: number; startY: number; moved: boolean } | null = null;

  function local(e: PointerEvent) {
    const rect = sceneCanvas.getBoundingClientRect();
    const tfm = sceneTransform(rect.width, rect.height);
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return { px, py, world: tfm.toWorld(px, py), tfm };
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const { px, py, world, tfm } = local(e);
    // Nearest charge under the finger, with a generous touch margin
    let hit = -1;
    let best = CHARGE_RADIUS + 10;
    sim.charges.forEach((c, i) => {
      const s = tfm.toScreen(c.x, c.y);
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < best) {
        best = d;
        hit = i;
      }
    });
    if (hit >= 0) {
      selected = hit;
      drag = { index: hit, startX: px, startY: py, moved: false };
      sceneCanvas.setPointerCapture(e.pointerId);
      sceneDirty = true;
      frame++;
    } else {
      selected = null;
      placeParticle(sim, world.x, world.y);
      changed();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    const { px, py, world } = local(e);
    if (!drag.moved && Math.hypot(px - drag.startX, py - drag.startY) < 4) return;
    drag.moved = true;
    moveCharge(sim, drag.index, world.x, world.y);
    if (sim.phase === 'ready') sim.stop = stopReason(sim.charges, sim.particle);
    sceneDirty = true;
    frame++;
  }

  function onPointerUp() {
    if (drag?.moved) chargesChanged();
    drag = null;
  }

  onMount(() => {
    if (location.search) {
      const setup = setupFromQuery(location.search);
      sim = createState(setup.charges, setup.start, setup.sign);
      frame++;
    }
    scene = manageCanvas(sceneCanvas, () => (sceneDirty = true));
    loop = new FixedStepLoop({
      update(dt) {
        const before = sim.phase;
        step(sim, dt);
        if (sim.phase !== before) sceneDirty = true;
      },
      render() {
        if (!(sim.phase === 'running' && !paused) && !sceneDirty) return;
        drawScene(scene!.ctx, scene!.size.width, scene!.size.height, sim, { showField, selected, num });
        sceneDirty = false;
        frame++;
      },
    });
    loop.speed = speed;
    loop.start();
    document.fonts?.ready.then(() => (sceneDirty = true));
    return () => {
      loop?.stop();
      scene?.dispose();
    };
  });

  // Redraw when the selection or arrows toggle change
  $effect(() => {
    void selected;
    void showField;
    sceneDirty = true;
  });

  // ---- chart ----
  const nJ = (j: number) => j * 1e9;

  function line(key: keyof Sample, color: string, width = 2, end = false): Series {
    const points = sim.samples.map((s) => ({ x: s.t, y: nJ(s[key]) }));
    const last = points.at(-1);
    return { points, color, width, endText: end && last ? `${num(last.y, 2)} nJ` : undefined };
  }

  const fmtTick = (v: number) => formatNumber(lang, v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);

  const chartSpec = (): ChartSpec => {
    void frame;
    const values = sim.samples.flatMap((s) => [nJ(s.kinetic), nJ(s.potential), nJ(s.total)]);
    const range = values.length ? axisRange(Math.min(...values), Math.max(...values)) : axisRange(0, 1);
    return {
      x: { ...axisMax(Math.max(sim.time, 1)), label: tr('field.axisTime') },
      y: { ...range, label: '' },
      series: [line('total', ENERGY.total, 4, true), line('kinetic', ENERGY.kinetic), line('potential', ENERGY.potential)],
      formatTick: fmtTick,
    };
  };

  const banner = $derived(view.stop === 'hit' && view.phase === 'stopped' ? tr('field.bannerHit') : view.stop === 'out' && view.phase === 'stopped' ? tr('field.bannerOut') : null);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sim sim--field">
  <div class="sim__toolbar">
    <div class="layouts" role="radiogroup" aria-label={tr('field.layout')}>
      {#each LAYOUT_IDS as id (id)}
        <button type="button" role="radio" aria-checked={view.layout === id} onclick={() => chooseLayout(id)}>{tr(LAYOUT_KEYS[id])}</button>
      {/each}
    </div>
    <div class="toolbar__right">
      <SpeedControl {lang} value={speed} onchange={setSpeed} speeds={SPEEDS} />
      <ShareButton {lang} />
    </div>
  </div>

  <section class="sim__controls" aria-label={tr('ui.sections')}>
    <p class="hint">{tr('field.hint')}</p>

    <div class="card">
      <h3>{tr('field.charges')}</h3>
      <div class="row">
        <button type="button" class="chip chip--plus" disabled={view.count >= MAX_CHARGES} onclick={() => onAdd(1)}>{tr('field.addPlus')}</button>
        <button type="button" class="chip chip--minus" disabled={view.count >= MAX_CHARGES} onclick={() => onAdd(-1)}>{tr('field.addMinus')}</button>
      </div>
      <div class="row">
        <button type="button" class="chip" disabled={selected === null} onclick={onFlip}>{tr('field.flip')}</button>
        <button type="button" class="chip" disabled={selected === null} onclick={onRemove}>{tr('field.remove')}</button>
      </div>
      <p class="muted small">
        {view.count >= MAX_CHARGES ? tf(lang, 'field.full', { n: MAX_CHARGES }) : selected === null ? tr('field.noSelection') : tr('field.selectedHint')}
      </p>
    </div>

    <div class="sign" role="radiogroup" aria-label={tr('field.particleSign')}>
      <span>{tr('field.particleSign')}:</span>
      <button type="button" role="radio" aria-checked={view.sign === 1} onclick={() => setSign(1)}>+</button>
      <button type="button" role="radio" aria-checked={view.sign === -1} onclick={() => setSign(-1)}>−</button>
    </div>

    <button type="button" role="switch" aria-checked={showField} class="switch" onclick={() => (showField = !showField)}>
      <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
      <span>{tr('field.arrows')}: <strong>{showField ? tr('ui.on') : tr('ui.off')}</strong></span>
    </button>

    <div class="card result" aria-live="polite">
      <h3>{tr('field.nowTitle')}</h3>
      <p class="big">{tr('field.clock')}: <span class="mono">{num(view.time, 1)} s</span></p>
      <dl class="facts">
        <dt>{tr('field.speed')}</dt><dd class="mono">{num(view.speed * 100, 2)} cm/s</dd>
        <dt>{tr('field.nearest')}</dt><dd class="mono">{Number.isFinite(view.nearest) ? `${num(view.nearest * 100, 0)} cm` : '–'}</dd>
        <dt>{tr('field.force')}</dt><dd class="mono">{num(view.force * 1e9, 2)} nN</dd>
        <dt>{tr('field.energyKinetic')}</dt><dd class="mono">{num(nJ(view.energy.kinetic), 3)} nJ</dd>
        <dt>{tr('field.energyPotential')}</dt><dd class="mono">{num(nJ(view.energy.potential), 3)} nJ</dd>
        <dt>{tr('field.energyTotal')}</dt><dd class="mono total">{num(nJ(view.energy.total), 3)} nJ</dd>
      </dl>
      {#if view.count > 0 && view.force < 1e-18}
        <p class="verdict">{tr('field.zeroForce')}</p>
      {:else if view.phase === 'stopped' && view.stop}
        <p class="warn">{tr(view.stop === 'hit' ? 'field.stopHit' : 'field.stopOut')}</p>
      {/if}
    </div>
  </section>

  <section class="sim__scene field-scene">
    <canvas
      bind:this={sceneCanvas}
      tabindex="0"
      aria-label={tf(lang, 'field.sceneLabel', { n: view.count })}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={onSceneKeydown}
    ></canvas>
    {#if banner}
      <div class="banner banner--warn" role="status">{banner}</div>
    {/if}
  </section>

  <div class="sim__actions">
    {#if view.phase === 'running'}
      <button type="button" class="button action action--pause" onclick={togglePause}>{paused ? tr('ui.resume') : tr('ui.pause')}</button>
    {:else}
      <button type="button" class="button action action--drop" onclick={onRelease}>{tr('field.release')}</button>
    {/if}
    <button type="button" class="button button--secondary action" onclick={onReset}>{tr('ui.reset')}</button>
  </div>

  <section class="sim__charts sim__charts--one">
    <div class="chart-slot chart-slot--active">
      <ChartCard
        title={tr('field.chartEnergy')}
        legend={[
          { label: tr('field.seriesKinetic'), color: ENERGY.kinetic },
          { label: tr('field.seriesPotential'), color: ENERGY.potential },
          { label: tr('field.seriesTotal'), color: ENERGY.total },
        ]}
        spec={chartSpec}
        {frame}
        summary={tr('field.chartEnergy')}
      />
    </div>
    <p class="chart-note">{view.phase === 'ready' ? tr('field.noteReady') : tr('field.energyNote')}</p>
  </section>

  <p class="sim__shortcuts"><strong>{tr('ui.shortcuts')}:</strong> {tr('field.shortcutsText')}</p>
</div>

<style>
  /* Phones: a full-width square. Wider screens: fit the window height; the
     square area is letterboxed inside, so no scrolling to see the whole field */
  .field-scene {
    background: #07080d;
    aspect-ratio: 1;
    height: auto;
  }

  @media (min-width: 48rem) {
    .field-scene {
      aspect-ratio: auto;
      height: clamp(380px, calc(100vh - 300px), 720px);
    }
  }

  .field-scene canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
  }

  .field-scene canvas:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  .layouts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .layouts button,
  .sign button,
  .chip {
    min-height: var(--touch);
    padding: var(--space-1) var(--space-4);
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .layouts button[aria-checked='true'],
  .sign button[aria-checked='true'] {
    border-color: var(--brand);
    background: var(--brand);
    color: #fff;
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .chip--plus {
    border-color: #e03232;
    color: #c82828;
  }

  .chip--minus {
    border-color: #2a6ae8;
    color: #1e56c8;
  }

  .row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .row .chip {
    flex: 1;
  }

  .sign {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
  }

  .sign button {
    min-width: var(--touch);
    font-size: 1.3rem;
    line-height: 1;
  }

  .hint {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: #fff8e1;
    font-size: var(--text-sm);
  }

  .small {
    font-size: 0.85rem;
    margin: 0 !important;
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

  .facts .total {
    color: #c82828;
  }

  .verdict {
    margin-top: var(--space-2) !important;
    font-weight: 700;
    color: #00873a;
  }

  .warn {
    margin-top: var(--space-2) !important;
  }
</style>
