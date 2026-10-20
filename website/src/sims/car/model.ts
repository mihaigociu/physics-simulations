/**
 * A car on a straight, frictionless road, driven with two pedals. No DOM;
 * driven by the engine loop and read by the renderer and charts.
 *
 * The pedals set the acceleration directly (gas forward, brake backward), so
 * within one step the acceleration is constant and x += v·h + ½·a·h² is
 * exact. With no friction nothing else acts on the car: let go of both
 * pedals and it keeps its speed forever. Braking stops at 0 m/s; the car
 * never reverses.
 */

import { axisMax, niceStep } from '../../chart/ticks';

/** Acceleration at full gas, m/s². A family car does 0–100 km/h in ~10 s ≈ 2.8 m/s². */
export const GAS_MAX = 4;
/** Deceleration at full brake, m/s². */
export const BRAKE_MAX = 8;
/** Seconds between strobe "ghost" cars. */
export const STROBE_INTERVAL = 1;
/** Seconds between chart points. */
export const SAMPLE_INTERVAL = 1 / 30;
/** Seconds of history the charts show; older samples are dropped. */
export const CHART_WINDOW = 60;
/** Car length, m. Its position `x` is the front bumper. */
export const CAR_LENGTH = 4.5;
const MAX_SUBSTEP = 1 / 120;

/** Hands-off challenge: reach this speed, let go, and coast for this long. */
export const CRUISE_SPEED = 10;
export const COAST_TIME = 5;
/** Park challenge: the flag, and how far the car must get before a stop counts. */
export const FLAG = 100;
export const PARK_MIN_DISTANCE = FLAG / 2;

// Fuzzy dice hanging from the mirror: a damped pendulum, so they swing back
// when the car speeds up and hang straight at any steady speed
const G = 9.81;
const DICE_STRING = 0.12; // m
const DICE_DAMPING = 3; // 1/s

export const MODES = ['free', 'cruise', 'park'] as const;
export type Mode = (typeof MODES)[number];

export function isMode(value: unknown): value is Mode {
  return (MODES as readonly unknown[]).includes(value);
}

export interface Pedals {
  /** How far each pedal is pressed, 0–1. */
  gas: number;
  brake: number;
}

export interface Sample {
  /** Time since the car first moved, s. */
  t: number;
  /** Distance from the start line (front bumper), m. */
  x: number;
  /** Speed, m/s. */
  v: number;
  /** Acceleration, m/s². */
  a: number;
}

/** 'done' only in a challenge, once it is over; the clock stops there. */
export type Phase = 'ready' | 'driving' | 'done';

export interface CarState {
  mode: Mode;
  phase: Phase;
  time: number;
  x: number;
  v: number;
  /** Acceleration actually acting (0 when braking at rest). */
  a: number;
  pedals: Pedals;
  /** Front-bumper positions at t = 0, 1, 2 … s. */
  strobes: number[];
  samples: Sample[];
  nextStrobe: number;
  nextSample: number;
  /** Highest speed so far, m/s. */
  topSpeed: number;
  /** Dice angle from vertical (rad, positive = forward) and its rate. */
  dice: { angle: number; rate: number };
  /** Hands-off: when the current stretch with no pedal began, or null. */
  coastFrom: number | null;
}

export function createState(mode: Mode = 'free'): CarState {
  return {
    mode,
    phase: 'ready',
    time: 0,
    x: 0,
    v: 0,
    a: 0,
    pedals: { gas: 0, brake: 0 },
    strobes: [0],
    samples: [{ t: 0, x: 0, v: 0, a: 0 }],
    nextStrobe: STROBE_INTERVAL,
    nextSample: SAMPLE_INTERVAL,
    topSpeed: 0,
    dice: { angle: 0, rate: 0 },
    coastFrom: null,
  };
}

/** Acceleration the pedals ask for, m/s². */
export function pedalAcceleration(p: Pedals): number {
  return GAS_MAX * p.gas - BRAKE_MAX * p.brake;
}

const pedalsUp = (p: Pedals) => p.gas === 0 && p.brake === 0;

/** Steady dice angle at a constant acceleration: tan θ = −a/g (they lean backwards). */
export function diceRestAngle(a: number): number {
  return Math.atan2(-a, G);
}

function stepDice(state: CarState, a: number, h: number): void {
  const d = state.dice;
  // Pendulum in a frame accelerating at a: θ'' = −(g·sin θ + a·cos θ)/L − c·θ'
  d.rate += (-(G * Math.sin(d.angle) + a * Math.cos(d.angle)) / DICE_STRING - DICE_DAMPING * d.rate) * h;
  d.angle += d.rate * h;
}

/**
 * Advance the car by `h` seconds at the pedals' acceleration. Returns the
 * offset within the step at which it came to a stop, or null.
 */
function stepCar(state: CarState, h: number): number | null {
  let a = pedalAcceleration(state.pedals);
  // Braking at rest holds the car; it doesn't push it backwards
  if (state.v <= 0 && a < 0) a = 0;
  if (a < 0 && state.v + a * h <= 0) {
    const tau = -state.v / a;
    state.x += state.v * tau + 0.5 * a * tau * tau;
    state.v = 0;
    state.a = 0;
    return tau;
  }
  state.x += state.v * h + 0.5 * a * h * h;
  state.v += a * h;
  state.a = a;
  return null;
}

function pushSample(state: CarState): void {
  state.samples.push({ t: state.time, x: state.x, v: state.v, a: state.a });
  // Drop what the charts no longer show, in batches (shift() on every sample is slow)
  const keepFrom = state.time - CHART_WINDOW - 10;
  if (state.samples[0]!.t < keepFrom - 10) {
    const i = state.samples.findIndex((s) => s.t >= keepFrom);
    state.samples.splice(0, i);
  }
}

/** Advance the simulation by `dt` simulated seconds (mutates `state`). */
export function step(state: CarState, dt: number): void {
  if (state.phase === 'done') return;
  if (state.phase === 'ready') {
    // The clock starts when the car first moves
    if (state.pedals.gas <= 0) return;
    state.phase = 'driving';
  }

  let remaining = dt;
  while (remaining > 1e-12 && state.phase === 'driving') {
    // Never step past a strobe flash, so ghosts land exactly on whole seconds
    const h = Math.min(remaining, MAX_SUBSTEP, state.nextStrobe - state.time);
    const wasMoving = state.v > 0;
    const tau = stepCar(state, h);
    stepDice(state, state.a, h);
    state.topSpeed = Math.max(state.topSpeed, state.v);

    if (tau !== null && wasMoving && state.mode === 'park' && state.x >= PARK_MIN_DISTANCE) {
      // Parked: stop the clock at the moment the car stopped, not the end of the step
      state.time += tau;
      state.phase = 'done';
      pushSample(state);
      return;
    }

    state.time += h;
    remaining -= h;

    if (state.time >= state.nextStrobe - 1e-12) {
      state.strobes.push(state.x);
      state.nextStrobe += STROBE_INTERVAL;
    }
    if (state.time >= state.nextSample - 1e-12) {
      pushSample(state);
      state.nextSample = state.time + SAMPLE_INTERVAL;
    }

    if (state.mode === 'cruise') updateCruise(state);
  }
}

function updateCruise(state: CarState): void {
  const coasting = state.topSpeed >= CRUISE_SPEED && pedalsUp(state.pedals) && state.v > 0;
  if (!coasting) {
    state.coastFrom = null;
    return;
  }
  state.coastFrom ??= state.time;
  if (state.time - state.coastFrom >= COAST_TIME - 1e-9) {
    state.phase = 'done';
    pushSample(state);
  }
}

export type CruiseStage = 'speedUp' | 'letGo' | 'coast' | 'done';

/** Where the driver is in the hands-off challenge. */
export function cruiseStage(state: CarState): CruiseStage {
  if (state.phase === 'done') return 'done';
  if (state.topSpeed < CRUISE_SPEED) return 'speedUp';
  return state.coastFrom === null ? 'letGo' : 'coast';
}

/** Seconds of coasting still needed in the hands-off challenge. */
export function coastLeft(state: CarState): number {
  if (state.coastFrom === null) return COAST_TIME;
  return Math.max(0, COAST_TIME - (state.time - state.coastFrom));
}

export interface ParkResult {
  /** Front bumper minus flag, m: negative = short of it, positive = past it. */
  miss: number;
  /** 0–3. */
  stars: number;
}

export function parkResult(state: CarState): ParkResult | null {
  if (state.mode !== 'park' || state.phase !== 'done') return null;
  const miss = state.x - FLAG;
  const off = Math.abs(miss);
  const stars = off < 0.5 ? 3 : off < 2 ? 2 : off < 5 ? 1 : 0;
  return { miss, stars };
}

/**
 * The car's motion at time `t`, between recorded samples. Assumes a constant
 * acceleration between neighbouring samples (1/30 s apart), which is exact
 * except across the instant a pedal moved.
 */
export function sampleAt(state: CarState, t: number): Sample {
  const s = state.samples;
  if (t >= state.time) return { t: state.time, x: state.x, v: state.v, a: state.a };
  if (t <= s[0]!.t) return { ...s[0]! };
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const p = s[lo]!;
  const q = s[hi]!;
  const h = q.t - p.t;
  if (h <= 0) return { ...p };
  const tau = t - p.t;
  const a = (q.v - p.v) / h;
  return { t, x: p.x + p.v * tau + 0.5 * a * tau * tau, v: p.v + a * tau, a: q.a };
}

export interface Rates {
  /** Interval actually used, s (shorter than asked for near the start). */
  dt: number;
  dx: number;
  dv: number;
}

/** Change in distance and speed over the `span` seconds before `t`. */
export function ratesBefore(state: CarState, t: number, span: number): Rates | null {
  const t0 = Math.max(state.samples[0]!.t, t - span);
  const dt = t - t0;
  if (dt < 0.05) return null;
  const [p, q] = [sampleAt(state, t0), sampleAt(state, t)];
  return { dt, dx: q.x - p.x, dv: q.v - p.v };
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export interface ChartAxes {
  t: Range;
  x: Range;
  v: Range;
  a: Range;
}

/** Clean bounds containing [lo, hi], at least `minSpan` wide. */
function fit(lo: number, raw: number, minSpan: number): Range {
  const hi = Math.max(raw, lo + minSpan);
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.max(Math.ceil(hi / step - 1e-9) * step, min + step);
  return { min, max, step };
}

/**
 * Chart axes for what has happened so far. Time grows in clean steps for the
 * first minute, then a 60 s window moves along in 10 s jumps, so the labels
 * never crawl.
 */
export function chartAxes(state: CarState, extra: { x?: number; v?: number } = {}): ChartAxes {
  let t: Range;
  if (state.time <= CHART_WINDOW) {
    t = { min: 0, ...axisMax(Math.max(10, state.time)) };
  } else {
    const min = Math.ceil((state.time - CHART_WINDOW) / 10) * 10;
    t = { min, max: min + CHART_WINDOW, step: 10 };
  }
  let [xLo, xHi, vHi] = [Infinity, -Infinity, 0];
  for (const s of state.samples) {
    if (s.t < t.min) continue;
    xLo = Math.min(xLo, s.x);
    xHi = Math.max(xHi, s.x);
    vHi = Math.max(vHi, s.v);
  }
  // Start the distance axis at 0 until the drive is long enough to need a window
  if (t.min === 0) xLo = 0;
  return {
    t,
    x: fit(xLo, Math.max(xHi, extra.x ?? 0), 10),
    v: fit(0, Math.max(vHi, extra.v ?? 0), 5),
    a: { min: -BRAKE_MAX, max: GAS_MAX, step: 2 },
  };
}
