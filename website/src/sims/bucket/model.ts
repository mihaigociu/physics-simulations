/**
 * Bucket experiment state and time stepping. No DOM.
 * The drain is exact (closed form): stepping moves the clock and records
 * chart samples.
 */

import { getPlanet, type PlanetId } from '../../shared/planets';
import { axisMax } from '../../chart/ticks';
import { drain, exitSpeed, flowRate, heightAt, volumeAt, type Drain } from './physics';

export interface BucketParams {
  planet: PlanetId;
  /** Starting water, litres. */
  volume: number;
  /** Hole diameter, mm. */
  hole: number;
}

/** Defaults match the Python version: 10 L, a 5 mm-radius hole. */
export const DEFAULT_PARAMS: BucketParams = { planet: 'earth', volume: 10, hole: 10 };

export interface Sample {
  t: number;
  /** Water height, cm (charts and readouts use cm). */
  hCm: number;
  volume: number;
  /** Exit speed, m/s. */
  v: number;
}

export type Phase = 'ready' | 'draining' | 'empty';

export interface BucketState {
  params: BucketParams;
  drain: Drain;
  phase: Phase;
  time: number;
  samples: Sample[];
  sampleEvery: number;
  nextSample: number;
}

/** About 400 chart points per run, however long it takes. */
const SAMPLES_PER_RUN = 400;

export function sampleAt(state: BucketState, t: number): Sample {
  const { g } = getPlanet(state.params.planet);
  const h = heightAt(state.drain, t);
  return { t, hCm: h * 100, volume: volumeAt(state.drain, t), v: exitSpeed(h, g) };
}

export function createState(params: BucketParams): BucketState {
  const d = drain(params.volume, params.hole, getPlanet(params.planet).g);
  return {
    params: { ...params },
    drain: d,
    phase: 'ready',
    time: 0,
    samples: [],
    sampleEvery: d.time / SAMPLES_PER_RUN,
    nextSample: 0,
  };
}

/** Pull the plug. */
export function start(params: BucketParams): BucketState {
  const state = createState(params);
  state.phase = 'draining';
  state.samples.push(sampleAt(state, 0));
  state.nextSample = state.sampleEvery;
  return state;
}

/** Advance by `dt` simulated seconds (mutates `state`). */
export function step(state: BucketState, dt: number): void {
  if (state.phase !== 'draining') return;
  state.time = Math.min(state.time + dt, state.drain.time);
  while (state.nextSample < state.time) {
    state.samples.push(sampleAt(state, state.nextSample));
    state.nextSample += state.sampleEvery;
  }
  if (state.time >= state.drain.time) {
    state.samples.push(sampleAt(state, state.drain.time));
    state.phase = 'empty';
  }
}

export interface Readout {
  hCm: number;
  volume: number;
  v: number;
  /** litres/s */
  flow: number;
  /** litres drained so far */
  drained: number;
}

export function readout(state: BucketState): Readout {
  const { g } = getPlanet(state.params.planet);
  const h = heightAt(state.drain, state.time);
  const volume = volumeAt(state.drain, state.time);
  return { hCm: h * 100, volume, v: exitSpeed(h, g), flow: flowRate(h, g, state.params.hole), drained: state.params.volume - volume };
}

export interface ChartAxes {
  t: { max: number; step: number };
  h: { max: number; step: number };
  v: { max: number; step: number };
}

export function chartAxes(state: BucketState, previous: BucketState | null): ChartAxes {
  const states = previous ? [state, previous] : [state];
  const g = (s: BucketState) => getPlanet(s.params.planet).g;
  return {
    t: axisMax(Math.max(...states.map((s) => s.drain.time))),
    h: axisMax(Math.max(...states.map((s) => s.drain.h0 * 100))),
    v: axisMax(Math.max(...states.map((s) => exitSpeed(s.drain.h0, g(s))))),
  };
}
