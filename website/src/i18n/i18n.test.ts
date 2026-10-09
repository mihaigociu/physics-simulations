import { describe, expect, it } from 'vitest';
import ro from './ro.json';
import en from './en.json';
import { localePath, pickLocale, t, withBase } from '.';
import { SIMS } from '../shared/sims';
import { PLANETS } from '../shared/planets';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('translations', () => {
  it('English and Romanian have exactly the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(ro).sort());
  });

  it('has no empty strings', () => {
    for (const dict of [ro, en]) {
      for (const key of keys(dict)) expect(t(dict === ro ? 'ro' : 'en', key as never)).not.toBe('');
    }
  });

  it('has a title for every simulation and a name for every planet', () => {
    for (const sim of SIMS) {
      expect(ro.sims).toHaveProperty(sim.id);
      expect(en.sims).toHaveProperty(sim.id);
    }
    for (const planet of PLANETS) {
      expect(ro.planets).toHaveProperty(planet.id);
      expect(en.planets).toHaveProperty(planet.id);
    }
  });
});

describe('pickLocale', () => {
  it('takes the first supported browser language', () => {
    expect(pickLocale(['en-GB', 'ro'])).toBe('en');
    expect(pickLocale(['de-DE', 'ro-RO', 'en'])).toBe('ro');
  });

  it('falls back to Romanian', () => {
    expect(pickLocale(['fr-FR'])).toBe('ro');
    expect(pickLocale([])).toBe('ro');
  });
});

describe('withBase / localePath', () => {
  const base = '/physics-simulations/';

  it('adds trailing slashes to pages but not to files', () => {
    expect(withBase('', base)).toBe('/physics-simulations/');
    expect(withBase('/en', base)).toBe('/physics-simulations/en/');
    expect(withBase('favicon.svg', base)).toBe('/physics-simulations/favicon.svg');
  });

  it('keeps query strings after the slash', () => {
    expect(localePath('en', 'free-fall?world=moon', base)).toBe('/physics-simulations/en/free-fall/?world=moon');
  });

  it('works with a base that has no trailing slash', () => {
    expect(localePath('ro', 'bucket', '/physics-simulations')).toBe('/physics-simulations/ro/bucket/');
  });
});
