/**
 * Free-fall physics, ported from free_fall_simulation.py.
 *
 * In a vacuum every object falls with acceleration g, so t = √(2h/g) and the
 * mass drops out. With air, quadratic drag on a sphere slows light objects
 * far more than heavy ones; that case also has a closed form, used for the
 * chart axes and checked against the step-by-step integration.
 */

/** Density used to size the balls for drag only (wood-like), kg/m³. */
export const OBJ_DENSITY = 800;
/** Drag coefficient of a sphere. */
export const DRAG_COEFF = 0.47;

export const MASS_MIN = 0.1;
export const MASS_MAX = 50;
export const HEIGHT_MIN = 1;
export const HEIGHT_MAX = 100;

/** Radius (m) of a sphere of this mass at OBJ_DENSITY. */
export function sphereRadius(mass: number): number {
  return Math.cbrt((3 * (mass / OBJ_DENSITY)) / (4 * Math.PI));
}

/** Cross-section area (m²) facing the air. */
export function crossSection(mass: number): number {
  return Math.PI * sphereRadius(mass) ** 2;
}

/** Speed (m/s) at which drag balances weight. Infinite without air. */
export function terminalVelocity(mass: number, g: number, airDensity: number): number {
  if (airDensity <= 0) return Infinity;
  return Math.sqrt((2 * mass * g) / (airDensity * DRAG_COEFF * crossSection(mass)));
}

/** Downward acceleration (m/s²) at downward speed v: m·a = m·g − ½·ρ·Cd·A·v². */
export function acceleration(mass: number, v: number, g: number, airDensity: number): number {
  if (airDensity <= 0) return g;
  const drag = 0.5 * airDensity * DRAG_COEFF * crossSection(mass) * v * v;
  return g - drag / mass;
}

/** Vacuum fall time t = √(2h/g). */
export function vacuumFallTime(height: number, g: number): number {
  return Math.sqrt((2 * height) / g);
}

/** Vacuum impact speed v = √(2gh). */
export function vacuumImpactSpeed(height: number, g: number): number {
  return Math.sqrt(2 * g * height);
}

/**
 * Fall time and impact speed in closed form, with or without air.
 *
 * For quadratic drag on a constant area, v(t) = vt·tanh(g·t/vt), which
 * inverts to an exact fall time. Without air it reduces to the schoolbook
 * result.
 */
export function airFallExact(
  mass: number,
  g: number,
  height: number,
  airDensity: number,
): { t: number; v: number } {
  if (airDensity <= 0) {
    const t = vacuumFallTime(height, g);
    return { t, v: g * t };
  }
  const vt = terminalVelocity(mass, g, airDensity);
  const u = (g * height) / vt ** 2;
  // acosh(exp(u)) overflows for a large u; it tends to u + ln 2 there
  const reduced = u < 20 ? Math.acosh(Math.exp(u)) : u + Math.LN2;
  const t = (vt / g) * reduced;
  return { t, v: vt * Math.tanh((g * t) / vt) };
}
