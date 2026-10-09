/**
 * Free-fall experiment state and time stepping. No DOM; driven by the
 * engine loop and read by the renderer and charts.
 *
 * Differences from the Python version, all in the direction of accuracy:
 * - landing time is solved exactly inside the last step instead of being
 *   rounded up to the step that went below ground;
 * - strobe flashes are taken exactly every 0.25 s (steps are split at each
 *   flash) instead of on the first frame after it.
 */

import { getPlanet, type PlanetId } from '../../shared/planets';
import { axisMax } from '../../chart/ticks';
import { acceleration, airFallExact, vacuumFallTime } from './physics';

export const STROBE_INTERVAL = 0.25; // s between "photo flashes"
export const SAMPLE_INTERVAL = 1 / 60; // s between chart points
const MAX_SUBSTEP = 0.002; // s; matches the Python sub-stepping
/** Landing gap below which two balls count as landing together, s. */
export const TIE_GAP = 0.02;

export interface FreeFallParams {
  planet: PlanetId;
  /** Release height, m. */
  height: number;
  /** Ball A (blue) mass, kg. */
  massA: number;
  /** Ball B (red) mass, kg. */
  massB: number;
  /** Air resistance switch. Has no effect where there is no atmosphere. */
  air: boolean;
}

export const DEFAULT_PARAMS: FreeFallParams = {
  planet: 'earth',
  height: 20,
  massA: 1,
  massB: 20,
  air: false,
};

export interface Sample {
  /** Time since release, s. */
  t: number;
  /** Downward speed, m/s. */
  v: number;
  /** Distance fallen, m. */
  d: number;
}

export interface Ball {
  mass: number;
  /** Height of the ball's bottom above the ground, m. */
  y: number;
  /** Downward speed, m/s. */
  v: number;
  landed: boolean;
  landTime: number | null;
  /** Heights at each strobe flash, starting with the release point. */
  strobes: number[];
  samples: Sample[];
}

export type Phase = 'ready' | 'falling' | 'landed';

export interface FreeFallState {
  params: FreeFallParams;
  phase: Phase;
  /** Time since release, s. */
  time: number;
  balls: [Ball, Ball];
  nextStrobe: number;
  nextSample: number;
}

/** Air density actually acting: zero unless the switch is on AND there is an atmosphere. */
export function effectiveAirDensity(params: FreeFallParams): number {
  return params.air ? getPlanet(params.planet).airDensity : 0;
}

export function hasAir(params: FreeFallParams): boolean {
  return effectiveAirDensity(params) > 0;
}

function makeBall(mass: number, height: number): Ball {
  return {
    mass,
    y: height,
    v: 0,
    landed: false,
    landTime: null,
    strobes: [height],
    samples: [{ t: 0, v: 0, d: 0 }],
  };
}

/** A fresh experiment, balls held at the release height. */
export function createState(params: FreeFallParams): FreeFallState {
  return {
    params: { ...params },
    phase: 'ready',
    time: 0,
    balls: [makeBall(params.massA, params.height), makeBall(params.massB, params.height)],
    nextStrobe: STROBE_INTERVAL,
    nextSample: SAMPLE_INTERVAL,
  };
}

/** Release both balls (restarting the experiment if it already ran). */
export function drop(params: FreeFallParams): FreeFallState {
  return { ...createState(params), phase: 'falling' };
}

/**
 * Advance one ball by `h` seconds with a midpoint (RK2) step: drag is
 * evaluated at the half-step speed. With constant acceleration this is
 * exact, so in a vacuum both balls follow h = ½gt² to rounding error.
 * Returns the landing time offset within the step, or null if still falling.
 */
function stepBall(ball: Ball, h: number, g: number, air: number): number | null {
  const a0 = acceleration(ball.mass, ball.v, g, air);
  const a = acceleration(ball.mass, ball.v + 0.5 * a0 * h, g, air);
  const yNext = ball.y - (ball.v + 0.5 * a * h) * h;
  if (yNext > 0) {
    ball.y = yNext;
    ball.v += a * h;
    return null;
  }
  // Solve y − (v·τ + ½·a·τ²) = 0 for the moment of touchdown inside the step
  const tau = a > 1e-12 ? (-ball.v + Math.sqrt(ball.v * ball.v + 2 * a * ball.y)) / a : ball.y / ball.v;
  ball.v += a * tau;
  ball.y = 0;
  ball.landed = true;
  return tau;
}

/** Advance the experiment by `dt` simulated seconds (mutates `state`). */
export function step(state: FreeFallState, dt: number): void {
  if (state.phase !== 'falling') return;
  const { g } = getPlanet(state.params.planet);
  const air = effectiveAirDensity(state.params);
  const height = state.params.height;
  let remaining = dt;

  while (remaining > 1e-12 && state.phase === 'falling') {
    // Never step past a strobe flash, so flashes land exactly on the 0.25 s marks
    const h = Math.min(remaining, MAX_SUBSTEP, state.nextStrobe - state.time);

    for (const ball of state.balls) {
      if (ball.landed) continue;
      const tau = stepBall(ball, h, g, air);
      if (tau !== null) {
        ball.landTime = state.time + tau;
        ball.samples.push({ t: ball.landTime, v: ball.v, d: height });
      }
    }
    state.time += h;
    remaining -= h;

    if (state.time >= state.nextStrobe - 1e-12) {
      for (const ball of state.balls) if (!ball.landed) ball.strobes.push(ball.y);
      state.nextStrobe += STROBE_INTERVAL;
    }

    if (state.time >= state.nextSample) {
      for (const ball of state.balls) {
        if (!ball.landed) ball.samples.push({ t: state.time, v: ball.v, d: height - ball.y });
      }
      state.nextSample = state.time + SAMPLE_INTERVAL;
    }

    if (state.balls.every((b) => b.landed)) {
      state.phase = 'landed';
      // The clock stops at the last landing, not at the end of the step
      state.time = Math.max(...state.balls.map((b) => b.landTime ?? 0));
    }
  }
}

export type Verdict = 'same' | 'almostSame' | 'apart';

/** How the race ended, once both balls are down. */
export function verdict(state: FreeFallState): { kind: Verdict; gap: number } | null {
  const [a, b] = state.balls;
  if (a.landTime === null || b.landTime === null) return null;
  const gap = Math.abs(a.landTime - b.landTime);
  if (gap >= TIE_GAP) return { kind: 'apart', gap };
  return { kind: hasAir(state.params) ? 'almostSame' : 'same', gap };
}

export interface ChartAxes {
  t: { max: number; step: number };
  v: { max: number; step: number };
  d: { max: number; step: number };
}

/**
 * Chart axes fixed before the drop, so they never rescale mid-fall. Both
 * cases have a closed form, so recomputing on every slider move is cheap.
 */
export function chartAxes(params: FreeFallParams): ChartAxes {
  const { g } = getPlanet(params.planet);
  const air = effectiveAirDensity(params);
  const results = [params.massA, params.massB].map((m) => airFallExact(m, g, params.height, air));
  return {
    t: axisMax(Math.max(...results.map((r) => r.t))),
    v: axisMax(Math.max(...results.map((r) => r.v))),
    d: axisMax(params.height),
  };
}

/** The no-air prediction as chart points, shown for comparison when air is on. */
export function vacuumCurve(params: FreeFallParams, points = 40): Sample[] {
  const { g } = getPlanet(params.planet);
  const tEnd = vacuumFallTime(params.height, g);
  return Array.from({ length: points + 1 }, (_, i) => {
    const t = (tEnd * i) / points;
    return { t, v: g * t, d: 0.5 * g * t * t };
  });
}
