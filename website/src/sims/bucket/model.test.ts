import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { getPlanet, type PlanetId } from '../../shared/planets';
import { bucketArea, BUCKET_RADIUS, CD, drain, exitSpeed, flowRate, heightAt, holeArea, timeUntilLeft, volumeAt } from './physics';
import { createState, DEFAULT_PARAMS, readout, start, step } from './model';

const g = 9.81;

describe('matches the Python original (SciPy solve_ivp)', () => {
  it('uses the same bucket', () => {
    expect(BUCKET_RADIUS).toBe(golden.bucketRadius);
    expect(CD).toBe(golden.cd);
    expect(DEFAULT_PARAMS.volume).toBe(golden.volume0 * 1000);
    expect(DEFAULT_PARAMS.hole).toBe(golden.holeRadius * 2000);
  });

  it.each(golden.cases)('$planet: drains in the same time, with the same volumes on the way', (c) => {
    const d = drain(DEFAULT_PARAMS.volume, DEFAULT_PARAMS.hole, getPlanet(c.planet as PlanetId).g);
    // Exactly the Python file's own closed form…
    expect(d.time).toBeCloseTo(c.drainTimeAnalytical, 9);
    // …while SciPy's event detection, near the √h singularity at empty, lands a few hundredths off
    expect(Math.abs(d.time - c.drainTime)).toBeLessThan(0.05);
    for (const s of c.samples) expect(Math.abs(volumeAt(d, s.t) - s.volume * 1000)).toBeLessThan(2e-3);
  });
});

describe("Torricelli's law", () => {
  it('the closed form satisfies dV/dt = −Cd·A·√(2gh)', () => {
    const d = drain(10, 10, g);
    for (const t of [1, 20, 50, 90]) {
      const eps = 1e-4;
      const dVdt = ((volumeAt(d, t + eps) - volumeAt(d, t - eps)) / (2 * eps)) / 1000; // m³/s
      expect(dVdt).toBeCloseTo(-CD * holeArea(10) * Math.sqrt(2 * g * heightAt(d, t)), 9);
    }
  });

  it('exit speed halves when the water drops from 40 cm to 10 cm (quiz Q1)', () => {
    expect(exitSpeed(0.1, g) / exitSpeed(0.4, g)).toBeCloseTo(0.5, 12);
  });

  it('exit speed falls in a straight line with time', () => {
    const d = drain(10, 10, g);
    const v = (t: number) => exitSpeed(heightAt(d, t), g);
    expect(v(d.time / 2)).toBeCloseTo((v(0) + v(d.time)) / 2, 9);
    expect(v(d.time / 4) - v(0)).toBeCloseTo(v(d.time / 2) - v(d.time / 4), 9);
  });

  it('halfway through the time, only a quarter of the water is left', () => {
    const d = drain(10, 10, g);
    expect(volumeAt(d, d.time / 2)).toBeCloseTo(2.5, 9);
    // …and the first half of the water goes in under 30% of the time
    expect(timeUntilLeft(d, 0.5) / d.time).toBeCloseTo(1 - Math.SQRT1_2, 12);
    expect(volumeAt(d, timeUntilLeft(d, 0.5))).toBeCloseTo(5, 9);
  });

  it('twice the hole radius drains 4× faster (quiz Q7)', () => {
    expect(flowRate(0.3, g, 20) / flowRate(0.3, g, 10)).toBeCloseTo(4, 12);
    expect(drain(10, 10, g).time / drain(10, 20, g).time).toBeCloseTo(4, 12);
  });

  it('drains slowest on the Moon, then Mars, then Earth (quiz Q6)', () => {
    const t = (p: PlanetId) => drain(10, 10, getPlanet(p).g).time;
    expect(t('moon')).toBeGreaterThan(t('mars'));
    expect(t('mars')).toBeGreaterThan(t('earth'));
  });

  it('volume and height agree with the bucket size', () => {
    const d = drain(10, 10, g);
    expect(d.h0 * bucketArea() * 1000).toBeCloseTo(10, 12);
    expect(heightAt(d, d.time)).toBe(0);
    expect(heightAt(d, d.time * 2)).toBe(0);
  });
});

describe('stepping', () => {
  it('runs until empty and records samples', () => {
    const state = start(DEFAULT_PARAMS);
    while (state.phase === 'draining') step(state, 0.5);
    expect(state.time).toBe(state.drain.time);
    expect(readout(state).volume).toBe(0);
    expect(readout(state).drained).toBeCloseTo(10, 12);
    expect(state.samples.length).toBeGreaterThan(390);
    expect(state.samples.at(-1)!.hCm).toBe(0);
  });

  it('waits until started', () => {
    const state = createState(DEFAULT_PARAMS);
    step(state, 10);
    expect(state.phase).toBe('ready');
    expect(readout(state).volume).toBeCloseTo(10, 12);
  });
});
