import { describe, expect, it } from 'vitest';
import { MODES } from './model';
import { modeFromQuery, queryFromMode } from './url';

describe('car URL state', () => {
  it.each(MODES)('round-trips %s', (mode) => {
    expect(modeFromQuery(queryFromMode(mode))).toBe(mode);
  });

  it('writes nothing for free driving', () => {
    expect(queryFromMode('free')).toBe('');
    expect(modeFromQuery('')).toBe('free');
  });

  it('ignores junk', () => {
    expect(modeFromQuery('?mode=rocket')).toBe('free');
  });
});
