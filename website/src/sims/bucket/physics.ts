/**
 * Draining bucket (Torricelli's law), ported from bucket_drip_simulation.py.
 *
 * Water leaves a hole at depth h with speed v = √(2gh), so the volume falls
 * at dV/dt = −Cd·A_hole·√(2gh). With a straight-sided bucket (V = A_bucket·h)
 * that equation solves exactly: √h falls in a straight line,
 *
 *   √h(t) = √h₀ − c·t,  c = (A_hole / A_bucket) · Cd · √(g/2),
 *
 * and the bucket is empty at T = √h₀ / c. The Python version integrated the
 * same equation with SciPy; the closed form needs no solver.
 */

/** Bucket inner radius, m (as in the Python version). */
export const BUCKET_RADIUS = 0.1;
/** Bucket height, m: holds about 12.6 L. */
export const BUCKET_HEIGHT = 0.4;
/** Discharge coefficient (1 = ideal hole, as in the Python version). */
export const CD = 1;

export const VOLUME_MIN = 1; // L
export const VOLUME_MAX = 12; // L
export const HOLE_MIN = 4; // mm diameter
export const HOLE_MAX = 20; // mm diameter

export const bucketArea = () => Math.PI * BUCKET_RADIUS ** 2;
export const holeArea = (diameterMm: number) => Math.PI * (diameterMm / 2000) ** 2;

/** Water height (m) for a volume in litres. */
export const heightOf = (litres: number) => litres / 1000 / bucketArea();

export interface Drain {
  /** Starting water height above the hole, m. */
  h0: number;
  /** Rate at which √h falls, √m per s. */
  c: number;
  /** Time to empty, s. */
  time: number;
}

export function drain(litres: number, holeDiameterMm: number, g: number): Drain {
  const h0 = heightOf(litres);
  const c = (holeArea(holeDiameterMm) / bucketArea()) * CD * Math.sqrt(g / 2);
  return { h0, c, time: Math.sqrt(h0) / c };
}

/** Water height at time t, m. */
export function heightAt(d: Drain, t: number): number {
  if (t >= d.time) return 0;
  return (Math.sqrt(d.h0) - d.c * Math.max(0, t)) ** 2;
}

/** Water left at time t, litres. */
export const volumeAt = (d: Drain, t: number) => heightAt(d, t) * bucketArea() * 1000;

/** Torricelli: speed of the water leaving the hole, m/s. */
export const exitSpeed = (h: number, g: number) => Math.sqrt(2 * g * Math.max(0, h));

/** Water leaving per second, litres/s. */
export const flowRate = (h: number, g: number, holeDiameterMm: number) => CD * holeArea(holeDiameterMm) * exitSpeed(h, g) * 1000;

/** Time until a fraction of the starting volume is left, s. */
export function timeUntilLeft(d: Drain, fraction: number): number {
  return d.time * (1 - Math.sqrt(Math.min(1, Math.max(0, fraction))));
}
