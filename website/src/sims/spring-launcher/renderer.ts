/**
 * Draws the launch scene: sky, ground with a distance scale, the launcher,
 * the predicted path, the previous shot, the flight trail, the ball and its
 * velocity arrows. Reads the state, never changes it.
 *
 * Flights range from centimetres to kilometres, so the camera fits the
 * predicted path (and the previous shot) before launch and keeps that view
 * for the whole flight. The launcher and ball are drawn at a fixed screen
 * size so they stay visible at any zoom.
 */

import type { Planet } from '../../shared/planets';
import { niceStep, ticks } from '../../chart/ticks';
import { WorldTransform } from '../../engine/transform';
import { COMPRESSION_MAX, MASS_MAX, MASS_MIN } from './physics';
import { current, maxHeightSoFar, predictedPath, type SpringState } from './model';

export const COLORS = {
  trail: '#e05a00',
  ball: '#c82828',
  ghost: '#8a8a95',
  vx: '#0b8fa0',
  vy: '#c2185b',
  spring: '#0a8f4a',
  launcher: '#4a4a55',
};

export interface Shot {
  points: { x: number; y: number }[];
  range: number;
  maxHeight: number;
}

export interface SceneOptions {
  previous: Shot | null;
  showArrows: boolean;
  num: (value: number, digits: number) => string;
  /** "previous: 22.4 m" */
  previousLabel: (range: string) => string;
  /** "highest: 6.4 m" */
  apexLabel: (height: string) => string;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";
const TUBE_LEN = 58;
const TUBE_W = 24;

/** Digits for a distance label: fewer as the numbers get bigger. */
const digitsFor = (metres: number) => (metres < 10 ? 2 : metres < 100 ? 1 : 0);

export function sceneTransform(state: SpringState, previous: Shot | null, width: number, height: number) {
  const groundH = Math.max(40, Math.min(56, height * 0.09));
  const groundY = height - groundH;
  const xMax = Math.max(state.flight.range, previous?.range ?? 0, 1) * 1.06;
  const yMax = Math.max(state.flight.maxHeight, previous?.maxHeight ?? 0, 0.5) * 1.1;
  const left = Math.min(96, width * 0.16);
  const top = 76; // room for the result banner
  // The path is the ball's centre, so height 0 sits one radius above the ground
  const base = groundY - ballRadius(state.params.mass);
  const tf = new WorldTransform(
    { xMin: 0, xMax, yMin: 0, yMax },
    { x: left, y: top, width: width - left - 28, height: base - top },
    { x: 0, y: 1 },
  );
  return { tf, groundY, groundH };
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SpringState,
  planet: Planet,
  o: SceneOptions,
): void {
  const { tf, groundY, groundH } = sceneTransform(state, o.previous, width, height);
  const P = (x: number, y: number) => tf.toScreen(x, y);

  // Sky and ground
  ctx.fillStyle = planet.sky;
  ctx.fillRect(0, 0, width, groundY);
  ctx.fillStyle = planet.ground;
  ctx.fillRect(0, groundY, width, groundH);
  ctx.fillStyle = 'rgb(0 0 0 / 0.55)';
  ctx.fillRect(0, groundY - 1, width, 3);

  // Distance scale along the ground
  const visibleX = tf.toWorld(width, 0).x;
  const step = niceStep(visibleX, Math.max(3, Math.floor(width / 110)));
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgb(255 255 255 / 0.85)';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 1.5;
  for (const v of ticks(Math.floor(visibleX / step) * step, step)) {
    const x = Math.round(P(v, 0).x) + 0.5;
    if (x > width - 12) break;
    if (v === 0) continue; // the launcher stands there
    ctx.beginPath();
    ctx.moveTo(x, groundY + 2);
    ctx.lineTo(x, groundY + 8);
    ctx.stroke();
    ctx.fillText(`${o.num(v, step < 1 ? 1 : 0)} m`, x, groundY + 11);
  }

  // Previous shot, for comparison
  if (o.previous && o.previous.points.length > 1) {
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    polyline(ctx, o.previous.points.map((p) => P(p.x, p.y)));
    ctx.setLineDash([]);
    const end = P(o.previous.range, 0);
    ctx.fillStyle = planet.ink;
    ctx.globalAlpha = 0.75;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(o.previousLabel(o.num(o.previous.range, digitsFor(o.previous.range))), end.x, end.y - 22);
    ctx.globalAlpha = 1;
  }

  // Predicted path (dotted)
  ctx.strokeStyle = planet.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 6]);
  ctx.lineCap = 'round';
  polyline(ctx, predictedPath(state).map((p) => P(p.x, p.y)));
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Flight trail
  if (state.samples.length > 1) {
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    polyline(ctx, [...state.samples.map((s) => P(s.x, s.y)), P(current(state).x, current(state).y)]);
  }

  // Highest point, once passed
  if (state.phase !== 'ready' && state.time >= state.flight.apexTime && state.flight.maxHeight > 0.01) {
    const apexX = state.launch.vx * state.flight.apexTime;
    const top = P(apexX, state.flight.maxHeight);
    const foot = { x: top.x, y: groundY };
    ctx.strokeStyle = planet.ink;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = planet.ink;
    ctx.beginPath();
    ctx.arc(top.x, top.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const h = maxHeightSoFar(state);
    ctx.fillText(o.apexLabel(o.num(h, digitsFor(h))), top.x, top.y - 8);
  }

  drawLauncher(ctx, state, P(0, 0));

  const r = ballRadius(state.params.mass);
  if (state.phase !== 'ready') {
    const now = current(state);
    const p = P(now.x, now.y);
    drawBall(ctx, p.x, p.y, r);
    if (o.showArrows && state.phase === 'flying') drawArrows(ctx, p.x, p.y, now.vx, now.vy, state.launch.v);
  }

  // Landing flag
  if (state.phase === 'landed') {
    const p = P(state.flight.range, 0);
    ctx.strokeStyle = planet.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, groundY);
    ctx.lineTo(p.x, groundY - 34);
    ctx.stroke();
    ctx.fillStyle = COLORS.trail;
    ctx.beginPath();
    ctx.moveTo(p.x, groundY - 34);
    ctx.lineTo(p.x + 16, groundY - 28);
    ctx.lineTo(p.x, groundY - 22);
    ctx.fill();
  }
}

function polyline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

/** Ball size on screen: a little bigger for heavier balls. */
function ballRadius(mass: number): number {
  return 9 + 6 * Math.cbrt((mass - MASS_MIN) / (MASS_MAX - MASS_MIN));
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * A tube planted at the launch point, pointing along the launch angle, with
 * the spring inside. Before launch the spring is squeezed (shorter) and the
 * ball sits on it; after launch it springs back to full length.
 */
function drawLauncher(ctx: CanvasRenderingContext2D, state: SpringState, mouth: { x: number; y: number }) {
  const a = (state.params.angle * Math.PI) / 180;
  const r = ballRadius(state.params.mass);
  ctx.save();
  ctx.translate(mouth.x, mouth.y);
  ctx.rotate(-a); // canvas y points down; the tube points up the angle along +x

  // Tube: from -TUBE_LEN (bottom) to 0 (mouth)
  ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
  ctx.fillRect(-TUBE_LEN, -TUBE_W / 2, TUBE_LEN, TUBE_W);
  ctx.strokeStyle = COLORS.launcher;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -TUBE_W / 2);
  ctx.lineTo(-TUBE_LEN, -TUBE_W / 2);
  ctx.lineTo(-TUBE_LEN, TUBE_W / 2);
  ctx.lineTo(0, TUBE_W / 2);
  ctx.stroke();

  // Spring: squeezed in proportion to the compression before launch
  const restLen = TUBE_LEN - 2 * r - 2;
  const squeeze = state.phase === 'ready' ? 1 - 0.7 * (state.params.compression / COMPRESSION_MAX) : 1;
  const len = Math.max(8, restLen * squeeze);
  const coils = 9;
  ctx.strokeStyle = COLORS.spring;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-TUBE_LEN + 2, 0);
  for (let i = 1; i <= coils * 2; i++) {
    const x = -TUBE_LEN + 2 + (len * i) / (coils * 2);
    ctx.lineTo(x, i % 2 ? -TUBE_W / 2 + 5 : TUBE_W / 2 - 5);
  }
  ctx.lineTo(-TUBE_LEN + 2 + len, 0);
  ctx.stroke();
  // Plate on top of the spring
  ctx.fillStyle = COLORS.launcher;
  ctx.fillRect(-TUBE_LEN + 2 + len - 2, -TUBE_W / 2 + 3, 4, TUBE_W - 6);

  // Waiting ball, resting on the plate
  if (state.phase === 'ready') {
    ctx.rotate(a);
    const bx = (-TUBE_LEN + 4 + len + r) * Math.cos(a);
    const by = -(-TUBE_LEN + 4 + len + r) * Math.sin(a);
    drawBall(ctx, bx, by, r);
  }
  ctx.restore();

  // Base block on the ground
  ctx.fillStyle = COLORS.launcher;
  ctx.beginPath();
  ctx.roundRect(mouth.x - 26, mouth.y + r - 4, 30, 8, 3);
  ctx.fill();
}

/** Velocity split into its horizontal and vertical parts, scaled to the launch speed. */
function drawArrows(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, v0: number) {
  const k = 64 / Math.max(v0, 1e-9);
  arrow(ctx, x, y, x + vx * k, y, COLORS.vx, 'vx');
  arrow(ctx, x, y, x, y - vy * k, COLORS.vy, 'vy');
}

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, label: string) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 4) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - 8 * Math.cos(a), y1 - 8 * Math.sin(a));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45));
  ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45));
  ctx.fill();
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x1 + 12 * Math.cos(a), y1 + 12 * Math.sin(a));
}
