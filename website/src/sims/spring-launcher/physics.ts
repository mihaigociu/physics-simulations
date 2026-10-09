/**
 * Spring launcher physics, ported from spring_launcher_simulation.py.
 *
 * The compressed spring stores E = ½kx². All of it becomes kinetic energy,
 * ½mv² = E, so v = √(2E/m). The ball then flies as a projectile with no air:
 * the horizontal speed never changes and gravity only changes the vertical
 * speed. Everything has a closed form, so the flight is computed exactly
 * rather than stepped (the Python version used 1/60 s Euler steps).
 */

export const COMPRESSION_MIN = 0.1;
export const COMPRESSION_MAX = 2;
export const ANGLE_MIN = 5;
export const ANGLE_MAX = 90;
export const K_MIN = 100;
export const K_MAX = 1000;
export const MASS_MIN = 0.1;
export const MASS_MAX = 2;

export interface Launch {
  /** Elastic energy stored in the spring, J. */
  springEnergy: number;
  /** Launch speed, m/s. */
  v: number;
  /** Horizontal and vertical launch velocity, m/s. */
  vx: number;
  vy: number;
}

export interface Flight {
  /** Time in the air until it lands back at launch height, s. */
  time: number;
  /** Horizontal distance to the landing point, m. */
  range: number;
  maxHeight: number;
  /** Time of the highest point, s. */
  apexTime: number;
  /** Length of the curved path, m. */
  pathLength: number;
}

/** E = ½kx². */
export function springEnergy(k: number, compression: number): number {
  return 0.5 * k * compression ** 2;
}

export function launch(k: number, compression: number, angleDeg: number, mass: number): Launch {
  const E = springEnergy(k, compression);
  const v = Math.sqrt((2 * E) / mass);
  const rad = (angleDeg * Math.PI) / 180;
  return { springEnergy: E, v, vx: v * Math.cos(rad), vy: v * Math.sin(rad) };
}

/** Position and velocity t seconds after launch (y up, launch point at the origin). */
export function stateAt(l: Launch, g: number, t: number): { x: number; y: number; vx: number; vy: number } {
  return { x: l.vx * t, y: l.vy * t - 0.5 * g * t * t, vx: l.vx, vy: l.vy - g * t };
}

/**
 * Distance travelled along the curve during the first t seconds.
 * ∫ √(vx² + vy(t)²) dt, done in closed form with u = vy0 − g·t.
 */
export function pathLengthAt(l: Launch, g: number, t: number): number {
  const F = (u: number) => {
    const s = Math.sqrt(l.vx * l.vx + u * u);
    // vx² · asinh(u/vx) → 0 as vx → 0 (straight up), so guard the division
    return 0.5 * (u * s + (l.vx > 1e-12 ? l.vx * l.vx * Math.asinh(u / l.vx) : 0));
  };
  return (F(l.vy) - F(l.vy - g * t)) / g;
}

export function flight(l: Launch, g: number): Flight {
  const time = (2 * l.vy) / g;
  return {
    time,
    range: l.vx * time,
    maxHeight: (l.vy * l.vy) / (2 * g),
    apexTime: l.vy / g,
    pathLength: pathLengthAt(l, g, time),
  };
}

/** Kinetic, potential (from launch height) and total energy t seconds after launch, J. */
export function energiesAt(l: Launch, mass: number, g: number, t: number): { kinetic: number; potential: number; total: number } {
  const s = stateAt(l, g, t);
  const kinetic = 0.5 * mass * (s.vx * s.vx + s.vy * s.vy);
  const potential = mass * g * s.y;
  return { kinetic, potential, total: kinetic + potential };
}
