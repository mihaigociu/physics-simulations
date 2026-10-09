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

/** Tick values 0, step, 2·step … up to max, without float drift (0.30000000000000004). */
export function ticks(max: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.round(max / step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let i = 0; i <= n; i++) out.push(Number((i * step).toFixed(decimals)));
  return out;
}
