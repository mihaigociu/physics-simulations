/**
 * Draws the road scene: sky and hills, the road with distance markers, the
 * strobe "ghost" cars, the car itself, and two insets: fuzzy dice hanging
 * from the mirror (they show acceleration, not speed) and a speedometer.
 * Reads the state, never changes it.
 */

import { CAR_LENGTH, FLAG, STROBE_INTERVAL, type CarState } from './model';

export const CAR_COLOR = '#e0432b';
const CURSOR_COLOR = '#f2b600';

export interface SceneText {
  /** Number formatter for the current locale. */
  num: (value: number, digits: number) => string;
  /** Inset captions. */
  inside: string;
}

export interface SceneExtras {
  /** Where the car was at the chart cursor, when scrubbing, m. */
  cursor: { x: number; t: number } | null;
  /** Draw the parking flag. */
  flag: boolean;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";
const WHEEL_R = 0.34; // m
const CAR_H = 1.45; // m, roof height

/** Repeatable "random" number in [0, 1) for scenery item `i`. */
function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: CarState,
  text: SceneText,
  extras: SceneExtras,
): void {
  const narrow = width < 520;
  // Pixels per metre: about 30 m of road across the scene
  const scale = Math.min(30, Math.max(11, width / 30));
  const carScreenX = width * (narrow ? 0.45 : 0.4);
  const worldLeft = state.x - carScreenX / scale;
  const worldRight = worldLeft + width / scale;
  const sx = (m: number) => (m - worldLeft) * scale;

  const horizonY = height * 0.46;
  const roadH = Math.min(96, Math.max(46, height * 0.17));
  const roadTop = height * 0.64;
  const roadBottom = roadTop + roadH;
  const laneY = roadTop + roadH * 0.66; // where the tyres touch

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#9fd3ff');
  sky.addColorStop(1, '#e6f5ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY);

  drawHills(ctx, width, horizonY, worldLeft * scale);

  // Grass
  ctx.fillStyle = '#7fbf5a';
  ctx.fillRect(0, horizonY, width, height - horizonY);
  ctx.fillStyle = '#6aad48';
  ctx.fillRect(0, roadBottom, width, height - roadBottom);

  drawTrees(ctx, width, horizonY, roadTop, worldLeft * scale);

  // Signposts every 50 m, standing behind the road
  for (let m = Math.ceil((worldLeft - 4) / 50) * 50; m <= worldRight + 4; m += 50) {
    if (m <= 0) continue;
    drawSignpost(ctx, sx(m), roadTop, `${text.num(m, 0)} m`, roadH);
  }

  // Road
  ctx.fillStyle = '#4b4e54';
  ctx.fillRect(0, roadTop, width, roadH);
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(0, roadTop + 3, width, 3);
  ctx.fillRect(0, roadBottom - 6, width, 3);

  // Centre dashes: 3 m painted, 3 m gap. They make the speed visible.
  ctx.fillStyle = 'rgb(255 255 255 / 0.75)';
  const dashY = roadTop + roadH * 0.36;
  for (let m = Math.floor(worldLeft / 6) * 6; m < worldRight; m += 6) {
    ctx.fillRect(sx(m), dashY - 1.5, 3 * scale, 3);
  }

  // Kerb with a tick and a label every 10 m
  ctx.fillStyle = '#d9d6cc';
  ctx.fillRect(0, roadBottom, width, 6);
  ctx.font = `${narrow ? 12 : 13}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let m = Math.ceil(worldLeft / 10) * 10; m <= worldRight; m += 10) {
    if (m < 0) continue;
    const x = Math.round(sx(m)) + 0.5;
    const big = m % 50 === 0;
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = big ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, roadBottom - 2);
    ctx.lineTo(x, roadBottom + (big ? 14 : 10));
    ctx.stroke();
    // Every 10 m when there is room, otherwise every 20 m
    if (scale * 10 >= 44 || m % 20 === 0) {
      ctx.fillStyle = '#1b1b1b';
      ctx.font = `${big ? 'bold ' : ''}${narrow ? 12 : 13}px ${FONT}`;
      ctx.fillText(`${text.num(m, 0)} m`, x, roadBottom + 16);
    }
  }

  // Start line
  if (sx(0) > -20 && sx(0) < width + 20) drawChequered(ctx, sx(0), roadTop + 6, roadH - 12);

  if (extras.flag && sx(FLAG) > -40 && sx(FLAG) < width + 40) drawFlag(ctx, sx(FLAG), roadTop, roadH, `${text.num(FLAG, 0)} m`);

  // Strobe ghosts: one every second. Wider gaps = faster.
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  let lastLabelX = Infinity;
  for (let i = state.strobes.length - 1; i >= 1; i--) {
    const m = state.strobes[i]!;
    if (m < worldLeft - 1 || m - CAR_LENGTH > worldRight) continue;
    // Skip a ghost hidden under the car itself
    if (Math.abs(m - state.x) < CAR_LENGTH * 0.6) continue;
    drawCar(ctx, sx(m), laneY, scale, { ghost: true, color: CAR_COLOR });
    const labelX = sx(m - CAR_LENGTH / 2);
    if (Math.abs(labelX - lastLabelX) < 30) continue;
    lastLabelX = labelX;
    ctx.fillStyle = '#1b1b1b';
    ctx.fillText(`${text.num(i * STROBE_INTERVAL, 0)} s`, labelX, laneY - (CAR_H + 0.3) * scale);
  }

  if (extras.cursor) {
    const { x, t } = extras.cursor;
    drawCar(ctx, sx(x), laneY, scale, { ghost: true, color: CURSOR_COLOR });
    ctx.fillStyle = '#7a5b00';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`${text.num(t, 1)} s`, sx(x - CAR_LENGTH / 2), laneY - (CAR_H + 0.3) * scale - (Math.abs(x - state.x) < CAR_LENGTH ? 16 : 0));
  }

  // Speed streaks behind a fast car
  if (state.v > 12) {
    const n = Math.min(4, Math.floor(state.v / 8));
    ctx.strokeStyle = 'rgb(255 255 255 / 0.7)';
    ctx.lineWidth = 2;
    for (let k = 0; k < n; k++) {
      const y = laneY - (0.35 + k * 0.28) * scale;
      const x0 = sx(state.x - CAR_LENGTH) - 6 - (k % 2) * 8;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 - Math.min(60, state.v * 1.4), y);
      ctx.stroke();
    }
  }

  drawCar(ctx, sx(state.x), laneY, scale, {
    color: CAR_COLOR,
    wheelAngle: state.x / WHEEL_R,
    braking: state.pedals.brake > 0,
  });

  const inset = Math.min(132, Math.max(92, width * 0.19));
  drawDice(ctx, 10, 10, inset, state.dice.angle, text.inside);
  drawSpeedometer(ctx, width - inset - 10, 10, inset, state.v, text);
}

function drawHills(ctx: CanvasRenderingContext2D, width: number, horizonY: number, scrollPx: number): void {
  // Far hills drift by at a tenth of the road's speed
  const shift = scrollPx * 0.1;
  ctx.fillStyle = '#b5d9a6';
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let x = 0; x <= width; x += 8) {
    const u = (x + shift) / 140;
    ctx.lineTo(x, horizonY - 26 - 18 * Math.sin(u) - 10 * Math.sin(u * 2.3 + 1));
  }
  ctx.lineTo(width, horizonY);
  ctx.fill();
}

function drawTrees(ctx: CanvasRenderingContext2D, width: number, horizonY: number, roadTop: number, scrollPx: number): void {
  // Trees between the hills and the road, at half the road's speed
  const shift = scrollPx * 0.5;
  const spacing = 70;
  const baseY = horizonY + (roadTop - horizonY) * 0.55;
  for (let i = Math.floor(shift / spacing) - 1; i * spacing - shift < width + spacing; i++) {
    const x = i * spacing - shift + hash(i) * 40;
    const size = 14 + hash(i + 99) * 12;
    const y = baseY + hash(i + 7) * 10;
    ctx.fillStyle = '#7a5532';
    ctx.fillRect(x - 2, y - size * 0.4, 4, size * 0.6);
    ctx.fillStyle = hash(i + 3) > 0.5 ? '#3f8f3a' : '#4e9e3f';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.75, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSignpost(ctx: CanvasRenderingContext2D, x: number, roadTop: number, label: string, roadH: number): void {
  const postH = Math.max(40, roadH * 0.85);
  ctx.fillStyle = '#5b5b5b';
  ctx.fillRect(x - 2, roadTop - postH, 4, postH);
  ctx.font = `bold 15px ${FONT}`;
  const w = ctx.measureText(label).width + 16;
  const top = roadTop - postH - 8;
  ctx.fillStyle = '#0d6b3a';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top - 14, w, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 3, top - 11, w - 6, 20, 3);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, top);
}

function drawChequered(ctx: CanvasRenderingContext2D, x: number, top: number, h: number): void {
  const cell = h / 6;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
      ctx.fillRect(x - cell + c * cell, top + r * cell, cell, cell);
    }
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, roadTop: number, roadH: number, label: string): void {
  // Target line across the road: the front bumper should stop on it
  ctx.strokeStyle = '#ffd400';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, roadTop + 6);
  ctx.lineTo(x, roadTop + roadH - 6);
  ctx.stroke();
  // Pole and flag on the far side
  const poleH = Math.max(56, roadH * 1.1);
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 1.5, roadTop - poleH + 6, 3, poleH);
  ctx.fillStyle = '#e02020';
  ctx.beginPath();
  ctx.moveTo(x + 1.5, roadTop - poleH + 6);
  ctx.lineTo(x + 34, roadTop - poleH + 17);
  ctx.lineTo(x + 1.5, roadTop - poleH + 28);
  ctx.fill();
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a0000';
  ctx.fillText(label, x + 6, roadTop - poleH - 6);
}

/** Side view of the car, facing right, with its front bumper at `front`. */
function drawCar(
  ctx: CanvasRenderingContext2D,
  front: number,
  groundY: number,
  s: number,
  o: { color: string; ghost?: boolean; wheelAngle?: number; braking?: boolean },
): void {
  const rear = front - CAR_LENGTH * s;
  const r = WHEEL_R * s;
  const bodyBottom = groundY - r * 0.9;
  const bodyTop = groundY - 0.95 * s;
  const roof = groundY - CAR_H * s;

  ctx.save();
  if (o.ghost) ctx.globalAlpha = 0.3;

  // Body and cabin as one outline
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.moveTo(rear + 0.1 * s, bodyBottom);
  ctx.lineTo(rear, bodyTop + 0.12 * s);
  ctx.quadraticCurveTo(rear, bodyTop, rear + 0.25 * s, bodyTop);
  ctx.lineTo(rear + 0.95 * s, bodyTop);
  ctx.lineTo(rear + 1.35 * s, roof);
  ctx.lineTo(rear + 2.85 * s, roof);
  ctx.lineTo(rear + 3.45 * s, bodyTop);
  ctx.lineTo(front - 0.2 * s, bodyTop + 0.08 * s);
  ctx.quadraticCurveTo(front, bodyTop + 0.12 * s, front, bodyTop + 0.3 * s);
  ctx.lineTo(front - 0.05 * s, bodyBottom);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = o.ghost ? o.color : 'rgb(0 0 0 / 0.55)';
  ctx.lineWidth = o.ghost ? 2 : 1.5;
  ctx.stroke();
  ctx.restore();

  // Windows
  ctx.fillStyle = o.ghost ? '#fff' : '#cfeaff';
  ctx.beginPath();
  ctx.moveTo(rear + 1.1 * s, bodyTop - 0.03 * s);
  ctx.lineTo(rear + 1.45 * s, roof + 0.08 * s);
  ctx.lineTo(rear + 2.0 * s, roof + 0.08 * s);
  ctx.lineTo(rear + 2.0 * s, bodyTop - 0.03 * s);
  ctx.closePath();
  ctx.moveTo(rear + 2.12 * s, bodyTop - 0.03 * s);
  ctx.lineTo(rear + 2.12 * s, roof + 0.08 * s);
  ctx.lineTo(rear + 2.78 * s, roof + 0.08 * s);
  ctx.lineTo(rear + 3.25 * s, bodyTop - 0.03 * s);
  ctx.closePath();
  ctx.fill();

  // Lights
  ctx.fillStyle = '#ffe680';
  ctx.fillRect(front - 0.18 * s, bodyTop + 0.14 * s, 0.16 * s, 0.14 * s);
  ctx.fillStyle = o.braking ? '#ff1a1a' : '#8a1010';
  ctx.fillRect(rear + 0.02 * s, bodyTop + 0.12 * s, 0.14 * s, 0.16 * s);
  if (o.braking && !o.ghost) {
    ctx.fillStyle = 'rgb(255 40 40 / 0.35)';
    ctx.beginPath();
    ctx.arc(rear + 0.05 * s, bodyTop + 0.2 * s, 0.45 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wheels, turning with the distance driven
  for (const cx of [rear + 0.9 * s, front - 0.85 * s]) {
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(cx, groundY - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9bcc2';
    ctx.beginPath();
    ctx.arc(cx, groundY - r, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (!o.ghost && r > 5) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = Math.max(1, r * 0.12);
      for (let k = 0; k < 3; k++) {
        const ang = (o.wheelAngle ?? 0) + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(cx, groundY - r);
        ctx.lineTo(cx + Math.cos(ang) * r * 0.5, groundY - r + Math.sin(ang) * r * 0.5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function insetCard(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
  ctx.strokeStyle = 'rgb(0 0 0 / 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 12);
  ctx.fill();
  ctx.stroke();
}

/** Fuzzy dice on a string from the rear-view mirror, at `angle` from vertical. */
function drawDice(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, caption: string): void {
  insetCard(ctx, x, y, size);
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = '#52514e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(caption, x + size / 2, y + size - 6);

  // Windscreen edge and mirror
  const cx = x + size / 2;
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(x + 8, y + 10, size - 16, 4);
  ctx.beginPath();
  ctx.roundRect(cx - size * 0.2, y + 15, size * 0.4, size * 0.11, 4);
  ctx.fill();
  ctx.fillStyle = '#a9c9e0';
  ctx.beginPath();
  ctx.roundRect(cx - size * 0.2 + 3, y + 18, size * 0.4 - 6, size * 0.11 - 6, 2);
  ctx.fill();

  // Dashed plumb line: where the dice hang at a steady speed
  const pivotY = y + 15 + size * 0.11;
  const len = size * 0.34;
  ctx.strokeStyle = '#b8b8b2';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, pivotY);
  ctx.lineTo(cx, pivotY + len + size * 0.16);
  ctx.stroke();
  ctx.setLineDash([]);

  // Positive angle = forward = towards the front of the car, on the right
  ctx.save();
  ctx.translate(cx, pivotY);
  ctx.rotate(-angle);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, len);
  ctx.stroke();
  const d = size * 0.16;
  for (const [dx, dy, rot] of [
    [-d * 0.55, len, -0.2],
    [d * 0.55, len + d * 0.2, 0.25],
  ] as const) {
    ctx.save();
    ctx.translate(dx, dy + d / 2);
    ctx.rotate(rot);
    ctx.fillStyle = '#ff5fa2';
    ctx.strokeStyle = '#b8336f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-d / 2, -d / 2, d, d, d * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [px, py] of [
      [-0.25, -0.25],
      [0, 0],
      [0.25, 0.25],
    ] as const) {
      ctx.beginPath();
      ctx.arc(px * d, py * d, d * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Dial in km/h (what cars show) with the exact m/s in the middle. */
function drawSpeedometer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, text: SceneText): void {
  insetCard(ctx, x, y, size);
  const cx = x + size / 2;
  const cy = y + size * 0.58;
  const r = size * 0.4;
  const MAX_KMH = 200;
  const START = Math.PI * 0.8;
  const SWEEP = Math.PI * 1.4;
  const angleOf = (kmh: number) => START + (Math.min(kmh, MAX_KMH) / MAX_KMH) * SWEEP;

  ctx.strokeStyle = '#d9d9d4';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, START, START + SWEEP);
  ctx.stroke();
  const kmh = v * 3.6;
  ctx.strokeStyle = CAR_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, r, START, angleOf(kmh));
  ctx.stroke();

  ctx.fillStyle = '#82817d';
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The end labels (0 and 200) would sit on the digital readout
  for (let k = 50; k < MAX_KMH; k += 50) {
    const a = angleOf(k);
    ctx.fillText(String(k), cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
  }

  // Needle
  const a = angleOf(kmh);
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `bold ${Math.round(size * 0.14)}px ${FONT}`;
  ctx.fillText(`${text.num(v, 1)} m/s`, cx, cy + r * 0.5);
  ctx.font = `${Math.round(size * 0.1)}px ${FONT}`;
  ctx.fillStyle = '#52514e';
  ctx.fillText(`${text.num(kmh, 0)} km/h`, cx, cy + r * 0.88);
}
