import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './model';
import { paramsFromQuery, queryFromParams } from './url';

describe('free-fall URL state', () => {
  it('round-trips a setup', () => {
    const p = { planet: 'moon' as const, height: 50, massA: 0.1, massB: 50, air: true };
    expect(queryFromParams(p)).toBe('?world=moon&h=50&m1=0.1&m2=50&air=1');
    expect(paramsFromQuery(queryFromParams(p))).toEqual(p);
  });

  it('writes nothing for the defaults', () => {
    expect(queryFromParams(DEFAULT_PARAMS)).toBe('');
    expect(paramsFromQuery('')).toEqual(DEFAULT_PARAMS);
  });

  it('ignores junk and clamps out-of-range values', () => {
    expect(paramsFromQuery('?world=pluto&h=abc&m1=-5&m2=9999&air=maybe')).toEqual({
      ...DEFAULT_PARAMS,
      massA: 0.1,
      massB: 50,
    });
    expect(paramsFromQuery('?h=1e9').height).toBe(100);
  });
});
