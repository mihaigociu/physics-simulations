/**
 * Bucket settings in the page URL, for share links: `?world=moon&v=5&d=20`
 * (litres, hole diameter in mm). Only non-default values are written;
 * anything missing, malformed or out of range falls back to a safe value.
 */

import { isPlanetId } from '../../shared/planets';
import { HOLE_MAX, HOLE_MIN, VOLUME_MAX, VOLUME_MIN } from './physics';
import { DEFAULT_PARAMS, type BucketParams } from './model';

function num(value: string | null, min: number, max: number, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function paramsFromQuery(search: string): BucketParams {
  const q = new URLSearchParams(search);
  const world = q.get('world');
  return {
    planet: isPlanetId(world) ? world : DEFAULT_PARAMS.planet,
    volume: num(q.get('v'), VOLUME_MIN, VOLUME_MAX, DEFAULT_PARAMS.volume),
    hole: num(q.get('d'), HOLE_MIN, HOLE_MAX, DEFAULT_PARAMS.hole),
  };
}

export function queryFromParams(p: BucketParams): string {
  const q = new URLSearchParams();
  if (p.planet !== DEFAULT_PARAMS.planet) q.set('world', p.planet);
  if (p.volume !== DEFAULT_PARAMS.volume) q.set('v', String(p.volume));
  if (p.hole !== DEFAULT_PARAMS.hole) q.set('d', String(p.hole));
  const s = q.toString();
  return s ? `?${s}` : '';
}
