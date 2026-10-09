import { describe, expect, it } from 'vitest';
import { getPlanet, isPlanetId, PLANETS } from './planets';

describe('planets', () => {
  it('matches the values used by the Python simulations', () => {
    expect(getPlanet('earth')).toMatchObject({ g: 9.81, airDensity: 1.225 });
    expect(getPlanet('mars')).toMatchObject({ g: 3.72, airDensity: 0.02 });
    expect(getPlanet('moon')).toMatchObject({ g: 1.62, airDensity: 0 });
  });

  it('has unique ids and validates them', () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(PLANETS.length);
    expect(isPlanetId('mars')).toBe(true);
    expect(isPlanetId('pluto')).toBe(false);
  });
});
