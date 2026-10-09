/**
 * Electric-field experiment: fixed charges you can move, add and remove, and
 * a test particle you place and release. No DOM.
 */

import { advance, BOUND, energy, stopReason, type Charge, type Particle, type Stop } from './physics';

export const LAYOUTS = {
  /** The Python version's layout. */
  original: {
    charges: [
      { x: 0, y: 0, sign: 1 },
      { x: 1, y: 1, sign: -1 },
      { x: -1, y: -1, sign: 1 },
    ],
    start: { x: 1.5, y: 0 },
  },
  /** Two equal positives: halfway between them the forces cancel (quiz Q13). */
  pair: {
    charges: [
      { x: -1, y: 0, sign: 1 },
      { x: 1, y: 0, sign: 1 },
    ],
    start: { x: 0, y: 0.5 },
  },
  /** A plus and a minus: the particle follows a curved path from one to the other. */
  dipole: {
    charges: [
      { x: -0.8, y: 0, sign: 1 },
      { x: 0.8, y: 0, sign: -1 },
    ],
    start: { x: -0.4, y: 0.6 },
  },
  single: {
    charges: [{ x: 0, y: 0, sign: 1 }],
    start: { x: 0.5, y: 0.2 },
  },
  empty: {
    charges: [],
    start: { x: 0, y: 0 },
  },
} as const satisfies Record<string, { charges: readonly Charge[]; start: { x: number; y: number } }>;

export type LayoutId = keyof typeof LAYOUTS;
export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];
export const MAX_CHARGES = 8;
/** Grid that dragged charges and placed particles snap to, m. */
export const CHARGE_SNAP = 0.1;
export const PARTICLE_SNAP = 0.05;

const SAMPLE_INTERVAL = 1 / 10; // simulated s between trail / chart points
const MAX_SAMPLES = 4000;

export interface Sample {
  t: number;
  x: number;
  y: number;
  speed: number;
  kinetic: number;
  potential: number;
  total: number;
}

export type Phase = 'ready' | 'running' | 'stopped';

export interface FieldState {
  charges: Charge[];
  particle: Particle;
  /** Where the particle starts (and returns on reset). */
  start: { x: number; y: number };
  phase: Phase;
  stop: Stop | null;
  time: number;
  samples: Sample[];
  nextSample: number;
}

export const snap = (v: number, grid: number) => Math.round(v / grid) * grid;
const clamp = (v: number) => Math.min(BOUND, Math.max(-BOUND, v));
const tidy = (v: number) => Number(v.toFixed(6)) || 0;

export function layoutCharges(id: LayoutId): Charge[] {
  return LAYOUTS[id].charges.map((c) => ({ ...c }));
}

export function createState(charges: Charge[], start: { x: number; y: number }, sign: 1 | -1 = 1): FieldState {
  const state: FieldState = {
    charges: charges.map((c) => ({ ...c })),
    particle: { x: start.x, y: start.y, vx: 0, vy: 0, sign },
    start: { ...start },
    phase: 'ready',
    stop: null,
    time: 0,
    samples: [],
    nextSample: 0,
  };
  state.stop = stopReason(state.charges, state.particle);
  return state;
}

function record(state: FieldState): void {
  const p = state.particle;
  const e = energy(state.charges, p);
  state.samples.push({ t: state.time, x: p.x, y: p.y, speed: Math.hypot(p.vx, p.vy), ...e });
  if (state.samples.length > MAX_SAMPLES) {
    // Keep long runs light: drop every other old point
    state.samples = state.samples.filter((_, i) => i % 2 === 0 || i === state.samples.length - 1);
  }
}

/** Let the particle go from where it is, at rest. */
export function release(state: FieldState): void {
  state.phase = 'running';
  state.time = 0;
  state.samples = [];
  state.stop = stopReason(state.charges, state.particle);
  record(state);
  state.nextSample = SAMPLE_INTERVAL;
  if (state.stop) state.phase = 'stopped';
}

/** Back to the start position, at rest. */
export function resetParticle(state: FieldState): void {
  Object.assign(state.particle, { x: state.start.x, y: state.start.y, vx: 0, vy: 0 });
  state.phase = 'ready';
  state.time = 0;
  state.samples = [];
  state.stop = stopReason(state.charges, state.particle);
}

/** Put the particle somewhere new (snapped to the grid); it becomes the new start. */
export function placeParticle(state: FieldState, x: number, y: number): void {
  state.start = { x: tidy(clamp(snap(x, PARTICLE_SNAP))), y: tidy(clamp(snap(y, PARTICLE_SNAP))) };
  const wasRunning = state.phase === 'running';
  resetParticle(state);
  if (wasRunning) release(state);
}

export function moveCharge(state: FieldState, index: number, x: number, y: number): void {
  const c = state.charges[index];
  if (!c) return;
  c.x = tidy(clamp(snap(x, CHARGE_SNAP)));
  c.y = tidy(clamp(snap(y, CHARGE_SNAP)));
}

/** Add a charge at the first free grid spot near the centre. Returns its index, or -1 if full. */
export function addCharge(state: FieldState, sign: 1 | -1): number {
  if (state.charges.length >= MAX_CHARGES) return -1;
  const taken = (x: number, y: number) =>
    state.charges.some((c) => Math.hypot(c.x - x, c.y - y) < 0.35) || Math.hypot(state.particle.x - x, state.particle.y - y) < 0.35;
  for (let ring = 0; ring <= 4; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [x, y] of [[i * 0.5, -ring * 0.5], [i * 0.5, ring * 0.5], [-ring * 0.5, i * 0.5], [ring * 0.5, i * 0.5]] as const) {
        if (!taken(x, y)) {
          state.charges.push({ x, y, sign });
          return state.charges.length - 1;
        }
      }
    }
  }
  state.charges.push({ x: 0, y: 0, sign });
  return state.charges.length - 1;
}

export function removeCharge(state: FieldState, index: number): void {
  state.charges.splice(index, 1);
}

export function flipCharge(state: FieldState, index: number): void {
  const c = state.charges[index];
  if (c) c.sign = c.sign === 1 ? -1 : 1;
}

/** Advance by `dt` simulated seconds (mutates `state`). */
export function step(state: FieldState, dt: number): void {
  if (state.phase !== 'running') return;
  const { elapsed, stop } = advance(state.charges, state.particle, dt);
  state.time += elapsed;
  while (state.nextSample <= state.time) {
    record(state);
    state.nextSample += SAMPLE_INTERVAL;
  }
  if (stop) {
    record(state);
    state.stop = stop;
    state.phase = 'stopped';
  }
}

/** Does the layout still match a preset? (For short share links.) */
export function matchingLayout(charges: readonly Charge[]): LayoutId | null {
  for (const id of LAYOUT_IDS) {
    const preset = LAYOUTS[id].charges;
    if (preset.length === charges.length && preset.every((p, i) => p.x === charges[i]!.x && p.y === charges[i]!.y && p.sign === charges[i]!.sign)) {
      return id;
    }
  }
  return null;
}
