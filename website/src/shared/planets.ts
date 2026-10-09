/**
 * The three worlds every simulation can switch between.
 *
 * Single source of truth for gravity, air density and colours - the Python
 * versions each kept their own copy. Values follow free_fall_simulation.py.
 *
 * Air density is per world, which matters for the free-fall air switch: the
 * Moon has no atmosphere (so air changes nothing there) and Mars has an
 * atmosphere about 60x thinner than Earth's.
 */

export type PlanetId = 'earth' | 'mars' | 'moon';

export interface Planet {
  id: PlanetId;
  /** Gravitational acceleration at the surface, m/s². */
  g: number;
  /** Air density near the surface, kg/m³. */
  airDensity: number;
  /** Background colour of the simulation scene. */
  sky: string;
  /** Ground strip in the scene. */
  ground: string;
  /** Accent colour: selected planet button, gravity label. */
  accent: string;
  /** Text colour that stays readable on `sky`. */
  ink: string;
}

export const PLANETS: readonly Planet[] = [
  { id: 'earth', g: 9.81, airDensity: 1.225, sky: '#cde4ff', ground: '#5a9650', accent: '#1e64c8', ink: '#141414' },
  { id: 'mars', g: 3.72, airDensity: 0.02, sky: '#f0cdaf', ground: '#a05532', accent: '#b43c14', ink: '#141414' },
  { id: 'moon', g: 1.62, airDensity: 0, sky: '#282837', ground: '#787882', accent: '#46465f', ink: '#e1e1eb' },
];

export const DEFAULT_PLANET: PlanetId = 'earth';

export function getPlanet(id: PlanetId): Planet {
  const planet = PLANETS.find((p) => p.id === id);
  if (!planet) throw new Error(`Unknown planet: ${id}`);
  return planet;
}

export function isPlanetId(value: unknown): value is PlanetId {
  return PLANETS.some((p) => p.id === value);
}
