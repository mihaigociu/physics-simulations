/**
 * Spring-launcher settings in the page URL, for share links:
 * `?world=moon&x=1.2&a=30&k=800&m=1`. Only non-default values are written;
 * anything missing, malformed or out of range falls back to a safe value.
 */

import { isPlanetId } from '../../shared/planets';
import { ANGLE_MAX, ANGLE_MIN, COMPRESSION_MAX, COMPRESSION_MIN, K_MAX, K_MIN, MASS_MAX, MASS_MIN } from './physics';
import { DEFAULT_PARAMS, type SpringParams } from './model';

function num(value: string | null, min: number, max: number, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function paramsFromQuery(search: string): SpringParams {
  const q = new URLSearchParams(search);
  const world = q.get('world');
  return {
    planet: isPlanetId(world) ? world : DEFAULT_PARAMS.planet,
    compression: num(q.get('x'), COMPRESSION_MIN, COMPRESSION_MAX, DEFAULT_PARAMS.compression),
    angle: num(q.get('a'), ANGLE_MIN, ANGLE_MAX, DEFAULT_PARAMS.angle),
    k: num(q.get('k'), K_MIN, K_MAX, DEFAULT_PARAMS.k),
    mass: num(q.get('m'), MASS_MIN, MASS_MAX, DEFAULT_PARAMS.mass),
  };
}

export function queryFromParams(p: SpringParams): string {
  const q = new URLSearchParams();
  if (p.planet !== DEFAULT_PARAMS.planet) q.set('world', p.planet);
  if (p.compression !== DEFAULT_PARAMS.compression) q.set('x', String(p.compression));
  if (p.angle !== DEFAULT_PARAMS.angle) q.set('a', String(p.angle));
  if (p.k !== DEFAULT_PARAMS.k) q.set('k', String(p.k));
  if (p.mass !== DEFAULT_PARAMS.mass) q.set('m', String(p.mass));
  const s = q.toString();
  return s ? `?${s}` : '';
}
