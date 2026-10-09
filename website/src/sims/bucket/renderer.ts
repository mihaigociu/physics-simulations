/**
 * Draws the bucket scene to scale: a bucket on a stand with a hole at the
 * bottom of its side, the water jet leaving at Torricelli's speed √(2gh),
 * and a tray on the ground that collects what drains out.
 *
 * A side hole makes the physics visible: the jet reaches far when the bucket
 * is full and curls in as the level (and so the speed) drops. The flow is the
 * same as through a bottom hole, since h is measured above the hole either way.
 */

import type { Planet } from '../../shared/planets';
import { WorldTransform } from '../../engine/transform';
import { BUCKET_HEIGHT, BUCKET_RADIUS } from './physics';
import { readout, type BucketState } from './model';

export const STAND_HEIGHT = 0.3; // m, bucket bottom above the ground
const TRAY_X0 = 0.21;
const TRAY_X1 = 1.0;
const TRAY_DEPTH = 0.05;
const WIDTH = 2 * BUCKET_RADIUS;
const TOP = STAND_HEIGHT + BUCKET_HEIGHT;

export const COLORS = {
  water: '#3296ff',
  waterDeep: '#1e78e0',
  jetFlow: 'rgb(255 255 255 / 0.55)',
  bucket: '#5a5a64',
  stand: '#8a7a68',
  tray: '#6b6b75',
};

export interface SceneOptions {
  num: (value: number, digits: number) => string;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

/** Where the jet leaving at speed v from height y0 hits height yEnd, and its path. */
function jet(v: number, g: number, x0: number, y0: number, yEnd: number, points = 40): { x: number; y: number }[] {
  const tEnd = Math.sqrt((2 * (y0 - yEnd)) / g);
  return Array.from({ length: points + 1 }, (_, i) => {
    const t = (tEnd * i) / points;
    return { x: x0 + v * t, y: y0 - 0.5 * g * t * t };
  });
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BucketState,
  planet: Planet,
  o: SceneOptions,
): void {
  const groundH = Math.max(32, Math.min(48, height * 0.08));
  const groundY = height - groundH;
  const tf = new WorldTransform(
    { xMin: -0.2, xMax: TRAY_X1 + 0.06, yMin: 0, yMax: TOP + 0.04 },
    { x: 12, y: 70, width: width - 24, height: groundY - 70 },
    { x: 0.5, y: 1 },
  );
  const P = (x: number, y: number) => tf.toScreen(x, y);
  const px = (m: number) => tf.length(m);
  const r = readout(state);
  const h = r.hCm / 100;
  const { g } = planet;
  const wall = Math.max(4, px(0.012));

  // Sky and ground
  ctx.fillStyle = planet.sky;
  ctx.fillRect(0, 0, width, groundY);
  ctx.fillStyle = planet.ground;
  ctx.fillRect(0, groundY, width, groundH);
  ctx.fillStyle = 'rgb(0 0 0 / 0.55)';
  ctx.fillRect(0, groundY - 1, width, 3);

  // Stand
  ctx.fillStyle = COLORS.stand;
  const plate = P(-0.02, STAND_HEIGHT);
  ctx.fillRect(plate.x, plate.y, px(WIDTH + 0.04), Math.max(5, px(0.015)));
  for (const lx of [0.0, WIDTH - 0.02]) {
    const top = P(lx, STAND_HEIGHT);
    ctx.fillRect(top.x, top.y, Math.max(4, px(0.02)), groundY - top.y);
  }

  // Tray with the water collected so far
  const trayTop = P(TRAY_X0, TRAY_DEPTH);
  const trayW = px(TRAY_X1 - TRAY_X0);
  const trayH = groundY - trayTop.y;
  const fill = (r.drained / state.params.volume) * 0.9;
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(trayTop.x, groundY - trayH * fill, trayW, trayH * fill);
  ctx.strokeStyle = COLORS.tray;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(trayTop.x, trayTop.y);
  ctx.lineTo(trayTop.x, groundY);
  ctx.lineTo(trayTop.x + trayW, groundY);
  ctx.lineTo(trayTop.x + trayW, trayTop.y);
  ctx.stroke();

  // Water in the bucket
  const inner0 = P(0, STAND_HEIGHT);
  const innerW = px(WIDTH);
  if (h > 0) {
    const surface = P(0, STAND_HEIGHT + h);
    const grad = ctx.createLinearGradient(0, surface.y, 0, inner0.y);
    grad.addColorStop(0, COLORS.water);
    grad.addColorStop(1, COLORS.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(inner0.x, surface.y, innerW, inner0.y - surface.y);
    ctx.strokeStyle = '#a8d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inner0.x, surface.y);
    ctx.lineTo(inner0.x + innerW, surface.y);
    ctx.stroke();
  }

  // Jet from the side hole
  const holeD = state.params.hole / 1000;
  const holePxH = Math.max(4, px(holeD));
  const holeCentre = P(WIDTH, STAND_HEIGHT + holeD / 2);
  if (state.phase === 'draining' && h > 0) {
    const pts = jet(r.v, g, WIDTH, STAND_HEIGHT + holeD / 2, TRAY_DEPTH * fill).map((p) => P(p.x, p.y));
    const lineW = Math.max(3, px(holeD) * 0.9);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.water;
    ctx.lineWidth = lineW;
    stroke(ctx, pts);
    // Moving dashes travel along the jet at the water's real speed
    ctx.strokeStyle = COLORS.jetFlow;
    ctx.lineWidth = Math.max(1.5, lineW * 0.4);
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -((state.time * px(r.v)) % 16);
    stroke(ctx, pts);
    ctx.setLineDash([]);
    // Splash
    const end = pts.at(-1)!;
    ctx.fillStyle = 'rgb(255 255 255 / 0.7)';
    ctx.beginPath();
    ctx.ellipse(end.x, end.y, lineW * 1.6, lineW * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bucket walls, with the hole cut into the right wall
  ctx.fillStyle = COLORS.bucket;
  const topLeft = P(0, TOP);
  ctx.fillRect(topLeft.x - wall, topLeft.y, wall, inner0.y - topLeft.y + wall); // left
  ctx.fillRect(inner0.x - wall, inner0.y, innerW + 2 * wall, wall); // bottom
  const rightX = inner0.x + innerW;
  ctx.fillRect(rightX, topLeft.y, wall, holeCentre.y - holePxH / 2 - topLeft.y); // right, above the hole
  ctx.fillRect(rightX, holeCentre.y + holePxH / 2, wall, inner0.y + wall - (holeCentre.y + holePxH / 2)); // below
  if (state.phase === 'ready') {
    // A plug in the hole until the start
    ctx.fillStyle = '#b5651d';
    ctx.beginPath();
    ctx.roundRect(rightX - 1, holeCentre.y - holePxH / 2 - 1, wall + 7, holePxH + 2, 2);
    ctx.fill();
  }

  // Ruler beside the bucket, in cm above the hole
  ctx.strokeStyle = planet.ink;
  ctx.fillStyle = planet.ink;
  ctx.lineWidth = 1.5;
  const rulerX = topLeft.x - wall - 14;
  ctx.beginPath();
  ctx.moveTo(rulerX, P(0, TOP).y);
  ctx.lineTo(rulerX, inner0.y);
  ctx.stroke();
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let cm = 0; cm <= BUCKET_HEIGHT * 100 + 1e-9; cm += 5) {
    const y = Math.round(P(0, STAND_HEIGHT + cm / 100).y) + 0.5;
    const major = cm % 10 === 0;
    ctx.beginPath();
    ctx.moveTo(rulerX - (major ? 8 : 4), y);
    ctx.lineTo(rulerX, y);
    ctx.stroke();
    if (major) ctx.fillText(`${o.num(cm, 0)} cm`, rulerX - 11, y);
  }

  // Current level, in bold beside the ruler
  if (h > 0) {
    const y = P(0, STAND_HEIGHT + h).y;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = planet.ink;
    const label = `${o.num(r.hCm, 1)} cm`;
    ctx.fillText(label, rightX + wall + 10, Math.min(y, holeCentre.y - 22));
  }
}

function stroke(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}
