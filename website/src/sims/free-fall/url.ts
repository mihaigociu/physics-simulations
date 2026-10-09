/**
 * Free-fall settings in the page URL, so a teacher can share a ready setup:
 * `?world=moon&h=50&m1=0.1&m2=50&air=1`. Only values that differ from the
 * defaults are written; anything missing, malformed or out of range falls
 * back to a safe value.
 */

import { isPlanetId } from '../../shared/planets';
import { HEIGHT_MAX, HEIGHT_MIN, MASS_MAX, MASS_MIN } from './physics';
import { DEFAULT_PARAMS, type FreeFallParams } from './model';

function num(value: string | null, min: number, max: number, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function paramsFromQuery(search: string): FreeFallParams {
  const q = new URLSearchParams(search);
  const world = q.get('world');
  return {
    planet: isPlanetId(world) ? world : DEFAULT_PARAMS.planet,
    height: num(q.get('h'), HEIGHT_MIN, HEIGHT_MAX, DEFAULT_PARAMS.height),
    massA: num(q.get('m1'), MASS_MIN, MASS_MAX, DEFAULT_PARAMS.massA),
    massB: num(q.get('m2'), MASS_MIN, MASS_MAX, DEFAULT_PARAMS.massB),
    air: q.get('air') === '1' || q.get('air') === 'true',
  };
}

export function queryFromParams(p: FreeFallParams): string {
  const q = new URLSearchParams();
  if (p.planet !== DEFAULT_PARAMS.planet) q.set('world', p.planet);
  if (p.height !== DEFAULT_PARAMS.height) q.set('h', String(p.height));
  if (p.massA !== DEFAULT_PARAMS.massA) q.set('m1', String(p.massA));
  if (p.massB !== DEFAULT_PARAMS.massB) q.set('m2', String(p.massB));
  if (p.air) q.set('air', '1');
  const s = q.toString();
  return s ? `?${s}` : '';
}
