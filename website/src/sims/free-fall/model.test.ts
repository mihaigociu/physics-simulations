import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { getPlanet, type PlanetId } from '../../shared/planets';
import { airFallExact, terminalVelocity, vacuumFallTime } from './physics';
import {
  chartAxes,
  createState,
  DEFAULT_PARAMS,
  drop,
  STROBE_INTERVAL,
  step,
  verdict,
  type FreeFallParams,
  type FreeFallState,
} from './model';

/** Run a drop to the end in 120 Hz steps, like the engine loop does. */
function runToEnd(params: FreeFallParams): FreeFallState {
  const state = drop(params);
  for (let i = 0; i < 120 * 60 && state.phase === 'falling'; i++) step(state, 1 / 120);
  return state;
}

describe('closed form matches the Python original', () => {
  it.each(golden.exact)('$planet air=$air h=$height m=$mass', (c) => {
    const p = getPlanet(c.planet as PlanetId);
    const r = airFallExact(c.mass, p.g, c.height, c.air ? p.airDensity : 0);
    expect(r.t).toBeCloseTo(c.t, 10);
    expect(r.v).toBeCloseTo(c.v, 10);
  });
});

describe('time stepping', () => {
  it.each(golden.integrated)('lands when the Python integrator does: $planet h=$height m=$mass', (c) => {
    const state = runToEnd({ planet: c.planet as PlanetId, height: c.height, massA: c.mass, massB: c.mass, air: true });
    // Python rounds landing up to its 0.5 ms step; ours is solved exactly
    expect(Math.abs(state.balls[0].landTime! - c.t)).toBeLessThan(0.001);
  });

  it('agrees with the closed form with air on', () => {
    const params: FreeFallParams = { planet: 'earth', height: 100, massA: 0.1, massB: 50, air: true };
    const state = runToEnd(params);
    const { g, airDensity } = getPlanet('earth');
    for (const ball of state.balls) {
      const exact = airFallExact(ball.mass, g, 100, airDensity);
      expect(ball.landTime!).toBeCloseTo(exact.t, 4);
      expect(ball.v).toBeCloseTo(exact.v, 3);
    }
  });

  it('in a vacuum, lands at exactly √(2h/g) whatever the masses', () => {
    for (const planet of ['earth', 'mars', 'moon'] as const) {
      const state = runToEnd({ planet, height: 45, massA: 0.1, massB: 50, air: false });
      const t = vacuumFallTime(45, getPlanet(planet).g);
      expect(state.balls[0].landTime!).toBeCloseTo(t, 9);
      expect(state.balls[1].landTime!).toBeCloseTo(t, 9);
      expect(verdict(state)).toEqual({ kind: 'same', gap: 0 });
      expect(state.time).toBeCloseTo(t, 9); // clock stops at touchdown
    }
  });

  it('on the Moon the air switch changes nothing', () => {
    const on = runToEnd({ planet: 'moon', height: 100, massA: 0.1, massB: 50, air: true });
    const off = runToEnd({ planet: 'moon', height: 100, massA: 0.1, massB: 50, air: false });
    expect(on.balls[0].landTime).toBe(off.balls[0].landTime);
    expect(verdict(on)?.kind).toBe('same');
  });

  it('on Earth with air the heavy ball wins by about half a second (as the explainer says)', () => {
    const state = runToEnd({ planet: 'earth', height: 100, massA: 0.1, massB: 50, air: true });
    const v = verdict(state)!;
    expect(v.kind).toBe('apart');
    expect(v.gap).toBeGreaterThan(0.5);
    expect(v.gap).toBeLessThan(0.7);
    expect(state.balls[1].landTime!).toBeLessThan(state.balls[0].landTime!);
  });

  it('on Mars with air the gap is about 1/100 s: "almost the same"', () => {
    const state = runToEnd({ planet: 'mars', height: 100, massA: 0.1, massB: 50, air: true });
    expect(verdict(state)?.kind).toBe('almostSame');
  });

  it('the light ball approaches but never exceeds terminal velocity', () => {
    const state = runToEnd({ planet: 'earth', height: 100, massA: 0.1, massB: 0.1, air: true });
    const vt = terminalVelocity(0.1, 9.81, 1.225);
    const maxV = Math.max(...state.balls[0].samples.map((s) => s.v));
    expect(maxV).toBeLessThan(vt);
    expect(maxV).toBeGreaterThan(0.85 * vt);
  });

  it('takes a strobe flash exactly every 0.25 s, on h = ½gt²', () => {
    const state = runToEnd({ ...DEFAULT_PARAMS, height: 20 });
    const g = 9.81;
    const flashes = state.balls[0].strobes;
    expect(flashes.length).toBe(Math.floor(vacuumFallTime(20, g) / STROBE_INTERVAL) + 1);
    flashes.forEach((y, i) => expect(y).toBeCloseTo(20 - 0.5 * g * (i * STROBE_INTERVAL) ** 2, 9));
  });

  it('records chart samples from release to touchdown', () => {
    const state = runToEnd(DEFAULT_PARAMS);
    const samples = state.balls[0].samples;
    expect(samples[0]).toEqual({ t: 0, v: 0, d: 0 });
    expect(samples.at(-1)!.d).toBe(20);
    expect(samples.length).toBeGreaterThan(100);
    for (let i = 1; i < samples.length; i++) expect(samples[i]!.t).toBeGreaterThan(samples[i - 1]!.t);
  });

  it('gives the same result regardless of how time is chopped up', () => {
    const params: FreeFallParams = { planet: 'earth', height: 60, massA: 0.3, massB: 7, air: true };
    const coarse = drop(params);
    while (coarse.phase === 'falling') step(coarse, 0.1);
    const fine = runToEnd(params);
    expect(coarse.balls[0].landTime!).toBeCloseTo(fine.balls[0].landTime!, 6);
  });

  it('does nothing until dropped', () => {
    const state = createState(DEFAULT_PARAMS);
    step(state, 1);
    expect(state.phase).toBe('ready');
    expect(state.time).toBe(0);
  });
});

describe('chart axes', () => {
  it.each(golden.axes)('axisMax($span) matches Python', async (c) => {
    const { axisMax } = await import('../../chart/ticks');
    expect(axisMax(c.span)).toEqual({ max: c.max, step: c.step });
  });

  it('contain the whole fall', () => {
    const axes = chartAxes({ planet: 'moon', height: 100, massA: 1, massB: 2, air: false });
    expect(axes.t.max).toBeGreaterThanOrEqual(vacuumFallTime(100, 1.62));
    expect(axes.d.max).toBe(100);
  });
});
