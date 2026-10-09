import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './model';
import { paramsFromQuery, queryFromParams } from './url';

describe('spring-launcher URL state', () => {
  it('round-trips a setup', () => {
    const p = { planet: 'moon' as const, compression: 1.2, angle: 30, k: 800, mass: 1 };
    expect(queryFromParams(p)).toBe('?world=moon&x=1.2&a=30&k=800&m=1');
    expect(paramsFromQuery(queryFromParams(p))).toEqual(p);
  });

  it('writes nothing for the defaults', () => {
    expect(queryFromParams(DEFAULT_PARAMS)).toBe('');
    expect(paramsFromQuery('')).toEqual(DEFAULT_PARAMS);
  });

  it('ignores junk and clamps out-of-range values', () => {
    expect(paramsFromQuery('?world=venus&x=9&a=-10&k=abc&m=0')).toEqual({
      ...DEFAULT_PARAMS,
      compression: 2,
      angle: 5,
      mass: 0.1,
    });
  });
});
