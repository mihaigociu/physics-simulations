import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './model';
import { paramsFromQuery, queryFromParams } from './url';

describe('bucket URL state', () => {
  it('round-trips a setup', () => {
    const p = { planet: 'mars' as const, volume: 5, hole: 20 };
    expect(queryFromParams(p)).toBe('?world=mars&v=5&d=20');
    expect(paramsFromQuery(queryFromParams(p))).toEqual(p);
  });

  it('writes nothing for the defaults', () => {
    expect(queryFromParams(DEFAULT_PARAMS)).toBe('');
    expect(paramsFromQuery('')).toEqual(DEFAULT_PARAMS);
  });

  it('ignores junk and clamps out-of-range values', () => {
    expect(paramsFromQuery('?world=x&v=100&d=0')).toEqual({ ...DEFAULT_PARAMS, volume: 12, hole: 4 });
  });
});
