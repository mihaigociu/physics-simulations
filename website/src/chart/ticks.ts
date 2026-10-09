/**
 * Human-friendly chart axes, ported from free_fall_simulation.py
 * (`nice_step` / `axis_max`).
 */

/** Round a raw axis span up to a friendly tick step (1, 2, 2.5, 5 × 10ⁿ). */
export function niceStep(span: number, targetTicks = 5): number {
  if (span <= 0) return 1;
  const raw = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const candidate of [1, 2, 2.5, 5, 10]) {
    const step = candidate * magnitude;
    if (step >= raw * 0.95) return step;
  }
  return 10 * magnitude;
}

/** Smallest clean multiple of a nice step that still contains the data. */
export function axisMax(span: number, targetTicks = 5): { max: number; step: number } {
  const step = niceStep(span, targetTicks);
  return { max: Math.ceil(span / step - 1e-9) * step, step };
}

/** Tick values min, min + step … up to max, without float drift (0.30000000000000004). */
export function ticks(max: number, step: number, min = 0): number[] {
  const out: number[] = [];
  const first = Math.round(min / step);
  const last = Math.round(max / step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let i = first; i <= last; i++) out.push(Number((i * step).toFixed(decimals)) || 0);
  return out;
}

/** Clean axis bounds that contain [lo, hi], e.g. for data that goes negative. Always includes 0. */
export function axisRange(lo: number, hi: number, targetTicks = 5): { min: number; max: number; step: number } {
  const a = Math.min(lo, 0);
  const b = Math.max(hi, 0);
  const step = niceStep(b - a || 1, targetTicks);
  const min = Math.floor(a / step + 1e-9) * step || 0;
  const max = Math.ceil(b / step - 1e-9) * step || 0;
  return { min, max: max > min ? max : min + step, step };
}
