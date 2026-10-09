import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { advance, CHARGE, energy, field, K, MASS, type Charge, type Particle } from './physics';
import {
  addCharge,
  createState,
  layoutCharges,
  LAYOUTS,
  matchingLayout,
  MAX_CHARGES,
  moveCharge,
  placeParticle,
  release,
  step,
} from './model';

const original = layoutCharges('original');
const startParticle = (): Particle => ({ x: 1.5, y: 0, vx: 0, vy: 0, sign: 1 });

function run(state: ReturnType<typeof createState>, seconds: number, dt = 1 / 12) {
  release(state);
  for (let t = 0; t < seconds && state.phase === 'running'; t += dt) step(state, dt);
  return state;
}

describe('matches the Python original', () => {
  it('uses the same constants and layout', () => {
    expect(K).toBe(golden.k);
    expect(CHARGE).toBe(golden.particle.q);
    expect(MASS).toBe(golden.particle.m);
    expect(original.map((c) => ({ x: c.x, y: c.y, q: c.sign * CHARGE }))).toEqual(golden.charges);
    expect(LAYOUTS.original.start).toEqual({ x: golden.particle.x, y: golden.particle.y });
  });

  it.each(golden.fields)('field at ($x, $y)', (f) => {
    const { ex, ey } = field(original, f.x, f.y);
    expect(ex).toBeCloseTo(f.ex, 6);
    expect(ey).toBeCloseTo(f.ey, 6);
  });

  it('follows the same path as the Python update loop run with fine steps', () => {
    const p = startParticle();
    let t = 0;
    for (const ref of golden.pythonFine.slice(1)) {
      advance(original, p, ref.t - t);
      t = ref.t;
      expect(Math.abs(p.x - ref.x)).toBeLessThan(5e-5);
      expect(Math.abs(p.y - ref.y)).toBeLessThan(5e-5);
    }
  });

  it('keeps energy far better than the Python default 0.05 s Euler step', () => {
    const p = startParticle();
    const e0 = energy(original, p).total;
    advance(original, p, 20);
    const ours = Math.abs(energy(original, p).total - e0) / e0;
    const py = golden.pythonDefault;
    const python = Math.abs(py.at(-1)!.energy - py[0]!.energy) / py[0]!.energy;
    expect(python).toBeGreaterThan(1e-3);
    expect(ours).toBeLessThan(1e-6); // thousands of times better
  });
});

describe('physics', () => {
  const one: Charge[] = [{ x: 0, y: 0, sign: 1 }];

  it('Coulomb: double the distance, a quarter of the field; half, four times (Q8, Q14)', () => {
    const e = (r: number) => field(one, r, 0).ex;
    expect(e(1) / e(2)).toBeCloseTo(4, 12);
    expect(e(0.5) / e(1)).toBeCloseTo(4, 12);
    expect(e(1)).toBeCloseTo(K * CHARGE, 6);
  });

  it('field points away from + and towards − charges', () => {
    expect(field(one, 1, 0).ex).toBeGreaterThan(0);
    expect(field([{ x: 0, y: 0, sign: -1 }], 1, 0).ex).toBeLessThan(0);
  });

  it('halfway between two equal positives the force is zero and the particle stays (Q13)', () => {
    const pair = layoutCharges('pair');
    const f = field(pair, 0, 0);
    expect(Math.hypot(f.ex, f.ey)).toBe(0);
    const state = run(createState(pair, { x: 0, y: 0 }), 100);
    expect(state.particle.x).toBe(0);
    expect(state.particle.y).toBe(0);
  });

  it('conserves energy on a close pass between a plus and a minus', () => {
    // Off-centre start: exactly between them the total energy is 0
    const state = createState(layoutCharges('dipole'), { x: -0.3, y: 1 }, 1);
    const e0 = energy(state.charges, state.particle).total;
    run(state, 400);
    const after = energy(state.charges, state.particle);
    // Measured against the energy being swapped, which grows huge near the charge
    const drift = Math.abs(after.total - e0) / Math.max(Math.abs(after.kinetic), Math.abs(e0));
    expect(state.samples.length).toBeGreaterThan(10);
    expect(drift).toBeLessThan(1e-4);
  });

  it('a positive particle near a positive charge is pushed out of the area (Q12)', () => {
    const state = run(createState(one.map((c) => ({ ...c })), { x: 0.3, y: 0 }), 600);
    expect(state.stop).toBe('out');
    expect(state.particle.x).toBeGreaterThan(2);
  });

  it('a negative particle is pulled into a positive charge and stops there', () => {
    const state = run(createState(one.map((c) => ({ ...c })), { x: 0.6, y: 0 }, -1), 600);
    expect(state.stop).toBe('hit');
    expect(Math.hypot(state.particle.x, state.particle.y)).toBeLessThan(0.07);
  });

  it('gives the same path however time is chopped up', () => {
    const a = startParticle();
    const b = startParticle();
    advance(original, a, 30);
    for (let i = 0; i < 300; i++) advance(original, b, 0.1);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('editing the layout', () => {
  it('snaps placed particles and moved charges to the grid', () => {
    const state = createState(original, LAYOUTS.original.start);
    placeParticle(state, 0.512, -0.987);
    expect(state.start).toEqual({ x: 0.5, y: -1 });
    moveCharge(state, 0, 0.26, 3);
    expect(state.charges[0]).toMatchObject({ x: 0.3, y: 2 });
  });

  it('adds charges on free spots, up to the limit', () => {
    const state = createState([], { x: 0, y: 0 });
    for (let i = 0; i < MAX_CHARGES; i++) expect(addCharge(state, 1)).toBe(i);
    expect(addCharge(state, 1)).toBe(-1);
    const spots = state.charges.map((c) => `${c.x},${c.y}`);
    expect(new Set(spots).size).toBe(MAX_CHARGES);
    expect(spots).not.toContain('0,0'); // the particle is there
  });

  it('recognises an untouched preset', () => {
    expect(matchingLayout(layoutCharges('pair'))).toBe('pair');
    const moved = layoutCharges('pair');
    moved[0]!.x = -0.5;
    expect(matchingLayout(moved)).toBeNull();
  });
});
