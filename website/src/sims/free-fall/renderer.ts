/**
 * Draws the drop scene: sky, ground, height ruler, release line, and the two
 * balls with their strobe trails. Reads the state, never changes it.
 */

import type { Planet } from '../../shared/planets';
import { MASS_MAX, MASS_MIN } from './physics';
import { STROBE_INTERVAL, type Ball, type FreeFallState } from './model';

export const BALL_COLORS = ['#1e64c8', '#c82828'] as const;

export interface SceneText {
  /** Number formatter for the current locale. */
  num: (value: number, digits: number) => string;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

/** Ball size on screen: exaggerated so the mass difference is easy to see. */
function drawRadius(mass: number, sceneHeight: number): number {
  const ratio = (mass - MASS_MIN) / (MASS_MAX - MASS_MIN);
  const k = Math.min(1, Math.max(0.6, sceneHeight / 700));
  return (10 + 26 * Math.cbrt(ratio)) * k;
}

/** Ruler tick spacing that gives at most ten labels. */
function rulerStep(height: number): number {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100]) if (height / step <= 10) return step;
  return 100;
}

/** Lighten a #rrggbb colour towards white, for the strobe "ghosts". */
function ghost(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FreeFallState,
  planet: Planet,
  text: SceneText,
): void {
  const groundH = Math.max(36, Math.min(56, height * 0.08));
  const groundY = height - groundH;
  // Leave room above the release line for the result banner (HTML, ~60 px)
  const topY = Math.max(100, height * 0.16);
  const dropH = state.params.height;
  const scale = (groundY - topY) / dropH;
  const screenY = (m: number) => groundY - m * scale;
  const narrow = width < 520;

  const rulerX = Math.round(width * (narrow ? 0.17 : 0.14)) + 0.5;
  const lanes = [width * (narrow ? 0.46 : 0.42), width * (narrow ? 0.74 : 0.7)];

  // Sky and ground
  ctx.fillStyle = planet.sky;
  ctx.fillRect(0, 0, width, groundY);
  ctx.fillStyle = planet.ground;
  ctx.fillRect(0, groundY, width, groundH);
  ctx.fillStyle = 'rgb(0 0 0 / 0.55)';
  ctx.fillRect(0, groundY - 1, width, 3);

  // Ruler
  ctx.strokeStyle = planet.ink;
  ctx.fillStyle = planet.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rulerX, screenY(dropH));
  ctx.lineTo(rulerX, groundY);
  ctx.stroke();
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const step = rulerStep(dropH);
  const top = Math.round(screenY(dropH)) + 0.5;
  for (let mark = 0; mark <= dropH + 1e-9; mark += step) {
    const y = Math.round(screenY(mark));
    ctx.beginPath();
    ctx.moveTo(rulerX - 7, y);
    ctx.lineTo(rulerX + 7, y);
    ctx.stroke();
    // The release height gets its own label below; skip a tick label it would cover
    if (mark > 0 && Math.abs(y - top) < 16) continue;
    // Lift the ground label so it does not straddle the ground line
    ctx.fillText(`${text.num(mark, 0)} m`, rulerX - 12, mark === 0 ? y - 10 : y);
  }
  // Release height in bold on the ruler, whatever the tick spacing
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(`${text.num(dropH, Number.isInteger(dropH) ? 0 : 1)} m`, rulerX - 12, top);

  // Dashed release line across both lanes
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(rulerX, top);
  ctx.lineTo(width - 16, top);
  ctx.stroke();
  ctx.setLineDash([]);

  // Balls: strobe labels go on the outer side of each lane, so the two
  // lanes' labels never collide on a narrow screen
  state.balls.forEach((ball, i) => {
    drawBall(ctx, ball, lanes[i]!, BALL_COLORS[i]!, i === 0 ? 'left' : 'right', {
      screenY,
      sceneH: height,
      ink: planet.ink,
      showSpeed: !narrow && state.phase === 'falling' && !ball.landed,
      text,
    });
  });

  // Mass labels on the ground strip
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.balls.forEach((ball, i) => {
    const label = `${text.num(ball.mass, 1)} kg`;
    const w = ctx.measureText(label).width + 16;
    const x = lanes[i]!;
    const y = groundY + groundH / 2;
    ctx.fillStyle = 'rgb(255 255 255 / 0.92)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 12, w, 24, 12);
    ctx.fill();
    ctx.fillStyle = BALL_COLORS[i]!;
    ctx.fillText(label, x, y + 1);
  });
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  laneX: number,
  color: string,
  labelSide: 'left' | 'right',
  o: { screenY: (m: number) => number; sceneH: number; ink: string; showSpeed: boolean; text: SceneText },
): void {
  const r = drawRadius(ball.mass, o.sceneH);
  // The ball's bottom sits at its height, so it rests on the ground at y = 0
  const centreY = (m: number) => o.screenY(m) - r;

  // Strobe trail: one outline per flash. Widening gaps = speeding up.
  ctx.font = `12px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = labelSide === 'left' ? 'right' : 'left';
  let lastLabelY: number | null = null;
  ball.strobes.forEach((h, i) => {
    const y = centreY(h);
    ctx.strokeStyle = ghost(color);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(laneX, y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (i === 0) return;
    // Skip a timestamp that would sit on the previous one (early flashes are close)
    if (lastLabelY !== null && Math.abs(y - lastLabelY) < 15) return;
    lastLabelY = y;
    ctx.fillStyle = o.ink;
    const x = labelSide === 'left' ? laneX - r - 8 : laneX + r + 8;
    ctx.fillText(`${o.text.num(i * STROBE_INTERVAL, 2)} s`, x, y);
  });

  const y = centreY(ball.y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(laneX, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Live speed on the inner side of the lane while in the air
  if (o.showSpeed) {
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = o.ink;
    ctx.textAlign = labelSide === 'left' ? 'left' : 'right';
    const x = labelSide === 'left' ? laneX + r + 10 : laneX - r - 10;
    ctx.fillText(`${o.text.num(ball.v, 1)} m/s`, x, y);
  }
}
