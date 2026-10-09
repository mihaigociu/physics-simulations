/**
 * Draws the field scene: a faint metre grid, field arrows, the particle's
 * trail, the fixed charges, the particle and the force on it.
 * Reads the state, never changes it.
 */

import { WorldTransform } from '../../engine/transform';
import { BOUND, CHARGE, field, HIT_RADIUS } from './physics';
import type { FieldState } from './model';

export const COLORS = {
  background: '#11131c',
  grid: 'rgb(255 255 255 / 0.06)',
  axis: 'rgb(255 255 255 / 0.16)',
  label: 'rgb(255 255 255 / 0.45)',
  arrow: '255 122 122',
  plus: '#e03232',
  minus: '#2a6ae8',
  particle: '#2ccf5a',
  trail: '#20d8d8',
  force: '#ffd23f',
  selected: '#ffd23f',
};

/** Charges are drawn (and grabbed) at this radius, in CSS px. */
export const CHARGE_RADIUS = 14;
const GRID_N = 20; // arrows per side, as in the Python version

export interface SceneOptions {
  showField: boolean;
  selected: number | null;
  num: (value: number, digits: number) => string;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

/** The square area −2…2 m fitted into the canvas. Shared with the pointer code. */
export function sceneTransform(width: number, height: number): WorldTransform {
  const pad = 10;
  return new WorldTransform(
    { xMin: -BOUND, xMax: BOUND, yMin: -BOUND, yMax: BOUND },
    { x: pad, y: pad, width: width - 2 * pad, height: height - 2 * pad },
  );
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: FieldState, o: SceneOptions): void {
  const tf = sceneTransform(width, height);
  const P = (x: number, y: number) => tf.toScreen(x, y);
  const side = tf.length(2 * BOUND);

  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, width, height);
  const corner = P(-BOUND, BOUND);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(corner.x, corner.y, side, side);

  // Metre grid, with the axes a little brighter
  ctx.lineWidth = 1;
  for (let v = -BOUND; v <= BOUND + 1e-9; v += 0.5) {
    ctx.strokeStyle = Math.abs(v) < 1e-9 ? COLORS.axis : COLORS.grid;
    const a = P(v, -BOUND);
    const b = P(v, BOUND);
    ctx.beginPath();
    ctx.moveTo(Math.round(a.x) + 0.5, a.y);
    ctx.lineTo(Math.round(b.x) + 0.5, b.y);
    ctx.stroke();
    const c = P(-BOUND, v);
    const d = P(BOUND, v);
    ctx.beginPath();
    ctx.moveTo(c.x, Math.round(c.y) + 0.5);
    ctx.lineTo(d.x, Math.round(d.y) + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.label;
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const v of [-1, 1]) {
    const p = P(v, 0);
    ctx.fillText(`${o.num(v, 0)} m`, p.x + 3, p.y + 3);
    const q = P(0, v);
    ctx.fillText(`${o.num(v, 0)} m`, q.x + 3, q.y + 3);
  }

  // Field arrows: direction of the field, length growing with log(strength)
  if (o.showField && state.charges.length) {
    const cell = side / GRID_N;
    const scale = cell * 0.17;
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j <= GRID_N; j++) {
        const x = -BOUND + (i * 2 * BOUND) / GRID_N;
        const y = -BOUND + (j * 2 * BOUND) / GRID_N;
        if (state.charges.some((c) => Math.hypot(c.x - x, c.y - y) < 0.12)) continue;
        const { ex, ey } = field(state.charges, x, y);
        const mag = Math.hypot(ex, ey);
        if (mag < 1e-9) continue;
        const len = Math.min(cell * 0.9, Math.log1p(mag) * scale);
        const s = P(x, y);
        const ux = ex / mag;
        const uy = -ey / mag; // screen y points down
        const alpha = Math.min(0.95, 0.25 + Math.log1p(mag) / 8);
        arrow(ctx, s.x - (ux * len) / 2, s.y - (uy * len) / 2, s.x + (ux * len) / 2, s.y + (uy * len) / 2, `rgb(${COLORS.arrow} / ${alpha})`, 1.5, 5);
      }
    }
  }

  // Trail
  if (state.samples.length > 1) {
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    state.samples.forEach((s, i) => {
      const q = P(s.x, s.y);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    const now = P(state.particle.x, state.particle.y);
    ctx.lineTo(now.x, now.y);
    ctx.stroke();
  }

  // Fixed charges
  state.charges.forEach((c, i) => {
    const q = P(c.x, c.y);
    if (o.selected === i) {
      ctx.strokeStyle = COLORS.selected;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(q.x, q.y, CHARGE_RADIUS + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    disc(ctx, q.x, q.y, CHARGE_RADIUS, c.sign > 0 ? COLORS.plus : COLORS.minus, c.sign > 0 ? '+' : '−', 18);
  });

  // Particle, and the force on it
  const p = state.particle;
  const pp = P(p.x, p.y);
  const { ex, ey } = field(state.charges, p.x, p.y);
  const fx = p.sign * CHARGE * ex;
  const fy = p.sign * CHARGE * ey;
  const f = Math.hypot(fx, fy);
  if (f > 0 && state.stop !== 'hit') {
    // log scale in nN, so weak and strong forces both show
    const len = Math.min(side * 0.18, 14 + Math.log1p(f * 1e9) * 9);
    arrow(ctx, pp.x, pp.y, pp.x + (fx / f) * len, pp.y - (fy / f) * len, COLORS.force, 3, 9);
  }
  if (state.phase === 'ready') {
    ctx.strokeStyle = COLORS.particle;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  disc(ctx, pp.x, pp.y, Math.max(8, tf.length(HIT_RADIUS) * 0.6), COLORS.particle, p.sign > 0 ? '+' : '−', 13);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, sign: string, size: number) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign, x, y + 1);
}

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width: number, head: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - head * 0.6 * Math.cos(a), y1 - head * 0.6 * Math.sin(a));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5));
  ctx.lineTo(x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5));
  ctx.fill();
}
