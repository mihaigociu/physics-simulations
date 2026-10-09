/**
 * Spring-launcher experiment state and time stepping. No DOM.
 *
 * The flight is exact (closed form), so stepping only moves the clock and
 * records chart samples; the landing happens at exactly the predicted time
 * and place, which the Python version only approximated.
 */

import { getPlanet, type PlanetId } from '../../shared/planets';
import { axisMax } from '../../chart/ticks';
import { energiesAt, flight, launch, pathLengthAt, stateAt, type Flight, type Launch } from './physics';

export const SAMPLE_INTERVAL = 1 / 60; // s between chart points

export interface SpringParams {
  planet: PlanetId;
  /** How far the spring is squeezed, m. */
  compression: number;
  /** Launch angle above the ground, degrees. */
  angle: number;
  /** Spring stiffness, N/m. */
  k: number;
  /** Ball mass, kg. */
  mass: number;
}

export const DEFAULT_PARAMS: SpringParams = {
  planet: 'earth',
  compression: 0.5,
  angle: 45,
  k: 500,
  mass: 0.5,
};

export interface Sample {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  kinetic: number;
  potential: number;
  total: number;
}

export type Phase = 'ready' | 'flying' | 'landed';

export interface SpringState {
  params: SpringParams;
  launch: Launch;
  flight: Flight;
  phase: Phase;
  /** Time since the ball left the spring, s. */
  time: number;
  samples: Sample[];
  nextSample: number;
}

export function prepare(params: SpringParams): { launch: Launch; flight: Flight; g: number } {
  const { g } = getPlanet(params.planet);
  const l = launch(params.k, params.compression, params.angle, params.mass);
  return { launch: l, flight: flight(l, g), g };
}

function sampleAt(state: SpringState, t: number): Sample {
  const { g } = getPlanet(state.params.planet);
  const s = stateAt(state.launch, g, t);
  const e = energiesAt(state.launch, state.params.mass, g, t);
  return { t, ...s, speed: Math.hypot(s.vx, s.vy), ...e };
}

/** The ball sitting on the squeezed spring. */
export function createState(params: SpringParams): SpringState {
  const { launch: l, flight: f } = prepare(params);
  return { params: { ...params }, launch: l, flight: f, phase: 'ready', time: 0, samples: [], nextSample: 0 };
}

/** Release the spring. */
export function fire(params: SpringParams): SpringState {
  const state = createState(params);
  state.phase = 'flying';
  state.samples.push(sampleAt(state, 0));
  state.nextSample = SAMPLE_INTERVAL;
  return state;
}

/** Advance the flight by `dt` simulated seconds (mutates `state`). */
export function step(state: SpringState, dt: number): void {
  if (state.phase !== 'flying') return;
  const end = state.flight.time;
  state.time = Math.min(state.time + dt, end);
  while (state.nextSample < state.time) {
    state.samples.push(sampleAt(state, state.nextSample));
    state.nextSample += SAMPLE_INTERVAL;
  }
  if (state.time >= end) {
    state.samples.push(sampleAt(state, end)); // exact touchdown, y = 0
    state.phase = 'landed';
  }
}

/** Where the ball is now (on the spring before launch). */
export function current(state: SpringState): Sample {
  return sampleAt(state, state.time);
}

/** Highest point reached so far, m. */
export function maxHeightSoFar(state: SpringState): number {
  if (state.phase === 'ready') return 0;
  return state.time >= state.flight.apexTime ? state.flight.maxHeight : current(state).y;
}

export function distanceSoFar(state: SpringState): number {
  return pathLengthAt(state.launch, getPlanet(state.params.planet).g, state.time);
}

export interface ChartAxes {
  t: { max: number; step: number };
  energy: { max: number; step: number };
  v: { max: number; step: number };
}

/** Axes fixed before launch, so the charts never rescale mid-flight. */
export function chartAxes(state: SpringState): ChartAxes {
  return {
    t: axisMax(Math.max(state.flight.time, 0.1)),
    energy: axisMax(state.launch.springEnergy * 1.05),
    v: axisMax(state.launch.v),
  };
}

/** The full predicted path, for the dotted guide line. */
export function predictedPath(state: SpringState, points = 80): { x: number; y: number }[] {
  const { g } = getPlanet(state.params.planet);
  return Array.from({ length: points + 1 }, (_, i) => {
    const s = stateAt(state.launch, g, (state.flight.time * i) / points);
    return { x: s.x, y: Math.max(0, s.y) };
  });
}
