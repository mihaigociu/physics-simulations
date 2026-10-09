/**
 * Small live line chart on a canvas, ported from the `Chart` class in
 * free_fall_simulation.py and keeping its rules:
 * hairline grid, 2 px lines, end markers with a surface ring, and direct
 * value labels only at the line ends, placed so they never overlap.
 *
 * Title, legend and notes are HTML around the canvas (see ChartCard.svelte),
 * so they stay crisp, translatable and readable by screen readers.
 */

import { ticks } from './ticks';

export interface XY {
  x: number;
  y: number;
}

export interface Series {
  points: readonly XY[];
  color: string;
  width?: number;
  dashed?: boolean;
  /** Draw a dot at the last point (default true). */
  marker?: boolean;
  /** Label next to the last point, e.g. "19.8 m/s". */
  endText?: string;
}

export interface Axis {
  /** Lower end of the axis (default 0). */
  min?: number;
  max: number;
  step: number;
  label: string;
}

export interface ChartSpec {
  x: Axis;
  y: Axis;
  series: readonly Series[];
  formatTick: (value: number) => string;
}

export const CHART_COLORS = {
  surface: '#fcfcfb',
  grid: '#e8e8e4',
  axis: '#bebeb9',
  inkPrimary: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#82817d',
};

const PAD = { left: 46, right: 18, top: 14, bottom: 44 };
const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function drawChart(ctx: CanvasRenderingContext2D, width: number, height: number, spec: ChartSpec): void {
  const plot = { x: PAD.left, y: PAD.top, w: width - PAD.left - PAD.right, h: height - PAD.top - PAD.bottom };
  const xMin = spec.x.min ?? 0;
  const yMin = spec.y.min ?? 0;
  const frac = (v: number, min: number, max: number) => (max > min ? (v - min) / (max - min) : 0);
  const toPx = (p: XY) => ({
    x: plot.x + frac(p.x, xMin, spec.x.max) * plot.w,
    y: plot.y + plot.h - frac(p.y, yMin, spec.y.max) * plot.h,
  });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CHART_COLORS.surface;
  ctx.fillRect(0, 0, width, height);

  // Grid and y tick labels
  ctx.font = `12px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  for (const v of ticks(spec.y.max, spec.y.step, yMin)) {
    const y = Math.round(toPx({ x: xMin, y: v }).y) + 0.5;
    if (v !== yMin) {
      // A zero line inside the plot (negative values below it) is drawn darker
      ctx.strokeStyle = v === 0 ? CHART_COLORS.axis : CHART_COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
    }
    ctx.fillStyle = CHART_COLORS.inkMuted;
    ctx.fillText(spec.formatTick(v), plot.x - 8, y);
  }

  // Axes
  ctx.strokeStyle = CHART_COLORS.axis;
  ctx.beginPath();
  ctx.moveTo(plot.x + 0.5, plot.y);
  ctx.lineTo(plot.x + 0.5, plot.y + plot.h + 0.5);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h + 0.5);
  ctx.stroke();

  // x ticks and labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of ticks(spec.x.max, spec.x.step, xMin)) {
    const x = Math.round(toPx({ x: v, y: yMin }).x) + 0.5;
    ctx.strokeStyle = CHART_COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(x, plot.y + plot.h);
    ctx.lineTo(x, plot.y + plot.h + 4);
    ctx.stroke();
    ctx.fillStyle = CHART_COLORS.inkMuted;
    ctx.fillText(spec.formatTick(v), x, plot.y + plot.h + 8);
  }
  ctx.fillStyle = CHART_COLORS.inkSecondary;
  ctx.fillText(spec.x.label, plot.x + plot.w / 2, plot.y + plot.h + 26);

  // Series, in the given order: callers put the heaviest line first so a
  // thinner one stays visible on top of it when they coincide
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y - 8, plot.w + 8, plot.h + 8);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of spec.series) {
    if (s.points.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? 2;
    ctx.setLineDash(s.dashed ? [5, 5] : []);
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const q = toPx(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([]);

  drawEnds(ctx, spec.series, toPx, { x: 0, y: 0, w: width, h: height });
}

/**
 * End markers plus direct labels. Two series can end on the same pixel (a
 * vacuum tie), at the same height but different times, or hard against the
 * edge, so each label tries four spots around its marker and is dropped if
 * none is free. The legend still identifies the series in that case.
 */
function drawEnds(ctx: CanvasRenderingContext2D, series: readonly Series[], toPx: (p: XY) => XY, bounds: Box): void {
  const markers: XY[] = [];
  let ends: { at: XY; text: string }[] = [];

  for (const s of series) {
    const last = s.points.at(-1);
    if (!last) continue;
    const at = toPx(last);
    if (s.marker ?? true) {
      ctx.fillStyle = CHART_COLORS.surface;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 5, 0, Math.PI * 2);
      ctx.fill();
      markers.push(at);
    }
    if (s.endText) ends.push({ at, text: s.endText });
  }

  // Same pixel and same value: one shared label, not two stacked copies
  const [e0, e1] = ends;
  if (ends.length === 2 && e0 && e1 && e0.text === e1.text && Math.abs(e0.at.x - e1.at.x) <= 3 && Math.abs(e0.at.y - e1.at.y) <= 3) {
    ends = [e0];
  }

  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const placed: Box[] = [];
  for (const e of [...ends].sort((a, b) => a.at.y - b.at.y)) {
    const w = ctx.measureText(e.text).width;
    const h = 14;
    const { x, y } = e.at;
    const candidates: XY[] = [
      { x: x + 12, y: y - h / 2 }, // right
      { x: x - 12 - w, y: y - h / 2 }, // left
      { x: x - w / 2, y: y - 14 - h }, // above
      { x: x - w / 2, y: y + 14 }, // below
    ];
    for (const c of candidates) {
      const box = { x: c.x, y: c.y, w, h };
      const inside = box.x >= bounds.x + 4 && box.y >= bounds.y + 4 && box.x + w <= bounds.x + bounds.w - 4 && box.y + h <= bounds.y + bounds.h - 4;
      if (!inside || placed.some((p) => overlaps(p, box))) continue;
      const hitsMarker = markers.some((m) => (m.x !== x || m.y !== y) && overlaps({ x: m.x - 8, y: m.y - 8, w: 16, h: 16 }, box));
      if (hitsMarker) continue;
      placed.push(box);
      ctx.fillStyle = CHART_COLORS.inkPrimary;
      ctx.fillText(e.text, c.x, c.y);
      break;
    }
  }
}
