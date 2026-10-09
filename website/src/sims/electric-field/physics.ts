/**
 * A charged particle moving among fixed point charges, ported from
 * pygame_electric_field_simulation.py.
 *
 * Each fixed charge makes a field E = k·q/r² pointing away from it (towards
 * it if negative); the fields add up. The particle feels F = q·E and
 * accelerates a = F/m.
 *
 * The Python version moved the particle with fixed 0.05 s Euler steps, which
 * slowly loses or gains energy and goes badly wrong on close passes, where
 * the force changes quickly. This uses velocity Verlet with steps that shrink
 * near charges, so energy stays put.
 */

/** Coulomb's constant, N·m²/C². */
export const K = 8.99e9;
/** Charge of every fixed charge and of the test particle, C (1 nC, as in the Python version). */
export const CHARGE = 1e-9;
/** Test particle mass, kg (as in the Python version). */
export const MASS = 1e-5;
/** Half the width of the square area, m: the area runs from −2 to 2. */
export const BOUND = 2;
/** The particle counts as having hit a charge closer than this, m. */
export const HIT_RADIUS = 0.06;

export interface Charge {
  x: number;
  y: number;
  /** +1 or −1 (in units of CHARGE). */
  sign: 1 | -1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sign: 1 | -1;
}

/** Total electric field at (x, y), N/C. Zero exactly at a charge (as in Python). */
export function field(charges: readonly Charge[], x: number, y: number): { ex: number; ey: number } {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-20) continue;
    const r = Math.sqrt(r2);
    const e = (K * c.sign * CHARGE) / r2;
    ex += (e * dx) / r;
    ey += (e * dy) / r;
  }
  return { ex, ey };
}

/** Electric potential at (x, y), V. */
export function potential(charges: readonly Charge[], x: number, y: number): number {
  let v = 0;
  for (const c of charges) v += (K * c.sign * CHARGE) / Math.max(Math.hypot(x - c.x, y - c.y), 1e-12);
  return v;
}

export function acceleration(charges: readonly Charge[], p: Particle): { ax: number; ay: number } {
  const { ex, ey } = field(charges, p.x, p.y);
  const k = (p.sign * CHARGE) / MASS;
  return { ax: k * ex, ay: k * ey };
}

export function energy(charges: readonly Charge[], p: Particle): { kinetic: number; potential: number; total: number } {
  const kinetic = 0.5 * MASS * (p.vx * p.vx + p.vy * p.vy);
  const pe = p.sign * CHARGE * potential(charges, p.x, p.y);
  return { kinetic, potential: pe, total: kinetic + pe };
}

/** Distance from the particle to the nearest fixed charge, m (Infinity if there are none). */
export function nearestDistance(charges: readonly Charge[], x: number, y: number): number {
  let best = Infinity;
  for (const c of charges) best = Math.min(best, Math.hypot(x - c.x, y - c.y));
  return best;
}

export type Stop = 'hit' | 'out';

/** Why the particle has to stop here, if it does. */
export function stopReason(charges: readonly Charge[], p: Particle): Stop | null {
  if (Math.abs(p.x) > BOUND || Math.abs(p.y) > BOUND) return 'out';
  if (nearestDistance(charges, p.x, p.y) < HIT_RADIUS) return 'hit';
  return null;
}

/**
 * Advance the particle by `dt` seconds with velocity Verlet (mutates `p`).
 * Sub-steps shrink where the motion changes fast: no step moves the particle
 * more than a small fraction of its distance to the nearest charge.
 * Stops early, and says why, if the particle hits a charge or leaves the area.
 */
export function advance(charges: readonly Charge[], p: Particle, dt: number, accuracy = 0.01): { elapsed: number; stop: Stop | null } {
  let remaining = dt;
  let a = acceleration(charges, p);
  while (remaining > 1e-12) {
    const r = Math.max(nearestDistance(charges, p.x, p.y), 1e-6);
    const v = Math.hypot(p.vx, p.vy);
    const acc = Math.hypot(a.ax, a.ay);
    let h = Math.min(remaining, 0.05);
    if (v > 0) h = Math.min(h, (accuracy * r) / v);
    if (acc > 0) h = Math.min(h, Math.sqrt((accuracy * r) / acc));
    h = Math.max(h, 1e-7);

    p.x += p.vx * h + 0.5 * a.ax * h * h;
    p.y += p.vy * h + 0.5 * a.ay * h * h;
    const next = acceleration(charges, p);
    p.vx += 0.5 * (a.ax + next.ax) * h;
    p.vy += 0.5 * (a.ay + next.ay) * h;
    a = next;
    remaining -= h;
    const stop = stopReason(charges, p);
    if (stop) return { elapsed: dt - remaining, stop };
  }
  return { elapsed: dt, stop: null };
}
