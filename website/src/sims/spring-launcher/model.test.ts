import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { getPlanet, type PlanetId } from '../../shared/planets';
import { energiesAt, flight, launch, pathLengthAt, stateAt } from './physics';
import { createState, current, DEFAULT_PARAMS, distanceSoFar, fire, maxHeightSoFar, step, type SpringParams } from './model';

const g = 9.81;

function fly(params: SpringParams, dt = 1 / 120) {
  const state = fire(params);
  for (let i = 0; i < 1e6 && state.phase === 'flying'; i++) step(state, dt);
  return state;
}

describe('matches the Python original', () => {
  it.each(golden.cases)('$planet k=$k x=$compression θ=$angle', (c) => {
    const l = launch(c.k, c.compression, c.angle, c.mass);
    expect(l.springEnergy).toBeCloseTo(c.springEnergy, 10);
    expect(l.v).toBeCloseTo(c.v, 10);
    expect(l.vx).toBeCloseTo(c.vx, 10);
    expect(l.vy).toBeCloseTo(c.vy, 10);
    // Python steps 1/60 s and stops at the first step below ground, so it
    // lands up to one frame early; ours is exact
    const f = flight(l, getPlanet(c.planet as PlanetId).g);
    expect(f.time - c.pythonFlightTime).toBeGreaterThanOrEqual(-1e-9);
    expect(f.time - c.pythonFlightTime).toBeLessThan(1 / 60 + 1e-9);
    expect(Math.abs(f.range - c.pythonRange)).toBeLessThan(l.vx / 60 + 1e-6);
  });
});

describe('physics', () => {
  it('reproduces the quiz numbers: 62.5 J and about 15.8 m/s', () => {
    const l = launch(500, 0.5, 45, 0.5);
    expect(l.springEnergy).toBe(62.5);
    expect(l.v).toBeCloseTo(15.81, 2);
  });

  it('range is v²·sin(2θ)/g, greatest at 45°, equal for 30° and 60°', () => {
    const range = (angle: number) => flight(launch(500, 0.5, angle, 0.5), g).range;
    expect(range(45)).toBeCloseTo((250 * 1) / g, 9);
    expect(range(30)).toBeCloseTo(range(60), 9);
    for (const a of [10, 30, 44, 46, 60, 80]) expect(range(a)).toBeLessThan(range(45));
  });

  it('conserves total energy and horizontal speed throughout the flight', () => {
    const l = launch(700, 1.1, 63, 0.8);
    const f = flight(l, g);
    for (let i = 0; i <= 20; i++) {
      const t = (f.time * i) / 20;
      expect(energiesAt(l, 0.8, g, t).total).toBeCloseTo(l.springEnergy, 9);
      expect(stateAt(l, g, t).vx).toBe(l.vx);
    }
  });

  it('at the top, kinetic energy is not zero: it is ½·m·vx²', () => {
    const l = launch(500, 0.5, 45, 0.5);
    const top = energiesAt(l, 0.5, g, flight(l, g).apexTime);
    expect(top.kinetic).toBeCloseTo(0.5 * 0.5 * l.vx ** 2, 9);
    expect(top.kinetic).toBeGreaterThan(0);
  });

  it('flies higher and further on the Moon', () => {
    const l = launch(500, 0.5, 45, 0.5);
    expect(flight(l, 1.62).maxHeight).toBeGreaterThan(flight(l, g).maxHeight);
    expect(flight(l, 1.62).range).toBeGreaterThan(flight(l, g).range);
  });

  it('a heavier ball leaves slower: v ∝ 1/√m', () => {
    expect(launch(500, 0.5, 45, 2).v).toBeCloseTo(launch(500, 0.5, 45, 0.5).v / 2, 9);
  });

  it('path length matches a numerical integration, and is 2H straight up', () => {
    const l = launch(400, 0.8, 35, 0.5);
    const f = flight(l, g);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const s = stateAt(l, g, ((i + 0.5) * f.time) / n);
      sum += Math.hypot(s.vx, s.vy) * (f.time / n);
    }
    expect(f.pathLength).toBeCloseTo(sum, 6);
    const up = launch(400, 0.8, 90, 0.5);
    expect(flight(up, g).pathLength).toBeCloseTo(2 * flight(up, g).maxHeight, 9);
    expect(pathLengthAt(up, g, 0)).toBe(0);
  });
});

describe('stepping', () => {
  it('lands exactly at the predicted time and place', () => {
    const state = fly(DEFAULT_PARAMS);
    expect(state.phase).toBe('landed');
    expect(state.time).toBe(state.flight.time);
    const last = state.samples.at(-1)!;
    expect(last.x).toBeCloseTo(state.flight.range, 9);
    expect(last.y).toBeCloseTo(0, 9);
    expect(maxHeightSoFar(state)).toBe(state.flight.maxHeight);
    expect(distanceSoFar(state)).toBeCloseTo(state.flight.pathLength, 9);
  });

  it('records chart samples in time order', () => {
    const state = fly(DEFAULT_PARAMS, 0.1);
    const t = state.samples.map((s) => s.t);
    expect(t[0]).toBe(0);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    expect(state.samples.length).toBeGreaterThan(state.flight.time * 60 - 2);
  });

  it('waits on the spring until fired', () => {
    const state = createState(DEFAULT_PARAMS);
    step(state, 1);
    expect(state.phase).toBe('ready');
    expect(current(state)).toMatchObject({ x: 0, y: 0 });
  });
});
