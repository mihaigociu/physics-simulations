/**
 * Registry of the simulations on the site. Titles and blurbs live in the
 * i18n files under `sims.<id>`; this file only holds what is not text.
 */

export type SimId = 'free-fall' | 'spring-launcher' | 'bucket' | 'electric-field';

export interface SimInfo {
  id: SimId;
  /** Card accent colour on the home page. */
  accent: string;
  /** False until the simulation is ported; the page shows "coming soon". */
  ready: boolean;
  /** The original Python script, linked from the placeholder page. */
  pythonFile: string;
}

export const SIMS: readonly SimInfo[] = [
  { id: 'free-fall', accent: '#1e64c8', ready: true, pythonFile: 'free_fall_simulation.py' },
  { id: 'spring-launcher', accent: '#0a8f4a', ready: true, pythonFile: 'spring_launcher_simulation.py' },
  { id: 'bucket', accent: '#1f8fd6', ready: true, pythonFile: 'bucket_drip_simulation.py' },
  { id: 'electric-field', accent: '#c8323c', ready: false, pythonFile: 'pygame_electric_field_simulation.py' },
];

export const REPO_URL = 'https://github.com/mihaigociu/physics-simulations';
