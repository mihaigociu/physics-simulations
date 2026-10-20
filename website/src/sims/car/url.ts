/**
 * The chosen challenge in the page URL, so a teacher can share it:
 * `?mode=park`. Free driving is the default and writes nothing.
 */

import { isMode, type Mode } from './model';

export function modeFromQuery(search: string): Mode {
  const mode = new URLSearchParams(search).get('mode');
  return isMode(mode) ? mode : 'free';
}

export function queryFromMode(mode: Mode): string {
  return mode === 'free' ? '' : `?mode=${mode}`;
}
