import { describe, expect, it } from 'vitest';
import { layoutCharges, LAYOUTS } from './model';
import { queryFromSetup, setupFromQuery } from './url';

describe('electric-field URL state', () => {
  it('writes nothing for the original layout', () => {
    const setup = { charges: layoutCharges('original'), start: { ...LAYOUTS.original.start }, sign: 1 as const };
    expect(queryFromSetup(setup)).toBe('');
    expect(setupFromQuery('')).toEqual(setup);
  });

  it('names an untouched preset, with a moved particle', () => {
    const setup = { charges: layoutCharges('pair'), start: { x: 0, y: 0 }, sign: -1 as const };
    expect(queryFromSetup(setup)).toBe('?layout=pair&p=0,0&qs=-');
    expect(setupFromQuery('?layout=pair&p=0,0&qs=-')).toEqual(setup);
  });

  it('spells out an edited layout and reads it back', () => {
    const charges = [
      { x: 0.5, y: -1.2, sign: 1 as const },
      { x: -0.3, y: 0.7, sign: -1 as const },
    ];
    const setup = { charges, start: { x: 1, y: 1 }, sign: 1 as const };
    const query = queryFromSetup(setup);
    expect(query).toBe('?c=0.5,-1.2,%2B;-0.3,0.7,-&p=1,1');
    expect(setupFromQuery(query)).toEqual(setup);
    // A hand-typed '+' (which a URL reads as a space) also works
    expect(setupFromQuery('?c=0.5,-1.2,+;-0.3,0.7,-&p=1,1')).toEqual(setup);
  });

  it('falls back to the original layout on junk', () => {
    expect(setupFromQuery('?c=9,9,+&p=abc').charges).toEqual(layoutCharges('original'));
    expect(setupFromQuery('?layout=nonsense').charges).toEqual(layoutCharges('original'));
  });

  it('an empty custom layout is allowed', () => {
    const setup = setupFromQuery('?layout=empty');
    expect(setup.charges).toEqual([]);
    expect(setup.start).toEqual({ x: 0, y: 0 });
  });
});
