<script lang="ts">
  /**
   * One live chart: HTML title and legend around a self-sizing canvas.
   * The parent passes a `draw` function and bumps `frame` whenever the data
   * changed, so the canvas redraws only when needed. With `onscrub`, dragging
   * across the plot reports the x value under the finger.
   */
  import { onMount } from 'svelte';
  import { manageCanvas, type ManagedCanvas } from '../engine/canvas';
  import { chartXAt, drawChart, type ChartSpec } from '../chart/chart';

  interface LegendItem {
    label: string;
    color: string;
    dashed?: boolean;
  }

  interface Props {
    title: string;
    legend: LegendItem[];
    spec: () => ChartSpec;
    frame: number;
    /** Short text alternative for screen readers. */
    summary: string;
    /** Called with the x value under the pointer while it is pressed on the plot. */
    onscrub?: (x: number) => void;
  }

  let { title, legend, spec, frame, summary, onscrub }: Props = $props();

  let scrubbing: number | null = null;

  function scrubAt(e: PointerEvent) {
    if (!managed || !onscrub) return;
    const rect = canvas.getBoundingClientRect();
    onscrub(chartXAt(managed.size.width, spec(), e.clientX - rect.left));
  }

  function onPointerDown(e: PointerEvent) {
    if (!onscrub || scrubbing !== null) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubbing = e.pointerId;
    scrubAt(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId === scrubbing) scrubAt(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId === scrubbing) scrubbing = null;
  }

  let canvas: HTMLCanvasElement;
  let managed: ManagedCanvas | undefined = $state();
  let resized = $state(0);

  onMount(() => {
    managed = manageCanvas(canvas, () => resized++);
    return () => managed?.dispose();
  });

  $effect(() => {
    void frame;
    void resized;
    if (!managed) return;
    const { width, height } = managed.size;
    drawChart(managed.ctx, width, height, spec());
  });
</script>

<figure class="chart">
  <figcaption>
    <span class="title">{title}</span>
    {#if legend.length > 1}
      <ul class="legend">
        {#each legend as item (item.label)}
          <li><span class="swatch" class:dashed={item.dashed} style:--c={item.color}></span>{item.label}</li>
        {/each}
      </ul>
    {/if}
  </figcaption>
  <div
    class="plot"
    class:plot--scrub={onscrub}
    role="img"
    aria-label={summary}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>
</figure>

<style>
  .chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--space-3) var(--space-3) var(--space-1);
    border: 1px solid #dededa;
    border-radius: 10px;
    background: #fcfcfb;
  }

  figcaption {
    padding-inline: var(--space-1);
  }

  .title {
    display: block;
    font-weight: 700;
    font-size: var(--text-sm);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
    color: var(--ink-2);
  }

  .legend li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .swatch {
    width: 18px;
    height: 0;
    border-top: 3px solid var(--c);
  }

  .swatch.dashed {
    border-top-style: dashed;
    border-top-width: 2px;
  }

  .plot {
    flex: 1;
    min-height: 150px;
  }

  canvas {
    width: 100%;
    height: 100%;
  }

  /* Sideways drags scrub; vertical swipes still scroll the page on phones */
  .plot--scrub {
    cursor: ew-resize;
    touch-action: pan-y;
  }
</style>
