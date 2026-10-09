<script lang="ts">
  /**
   * One live chart: HTML title and legend around a self-sizing canvas.
   * The parent passes a `draw` function and bumps `frame` whenever the data
   * changed, so the canvas redraws only when needed.
   */
  import { onMount } from 'svelte';
  import { manageCanvas, type ManagedCanvas } from '../engine/canvas';
  import { drawChart, type ChartSpec } from '../chart/chart';

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
  }

  let { title, legend, spec, frame, summary }: Props = $props();

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
  <div class="plot" role="img" aria-label={summary}>
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
</style>
