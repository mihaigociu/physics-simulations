/** Small browser helpers shared by the simulation components. */

let urlTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Put a simulation's settings in the address bar (e.g. "?world=moon"), so the
 * page URL is always a share link. Debounced: a slider drag fires many
 * changes, and Safari throws if replaceState is called too often.
 */
export function replaceQuery(query: string, delayMs = 300): void {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    history.replaceState(null, '', location.pathname + query + location.hash);
  }, delayMs);
}

/**
 * Whether a keydown should be left alone by simulation shortcuts: modifier
 * combos (browser shortcuts) and Space/Enter on a focused button or link,
 * which already "clicks" it.
 */
export function ignoreShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input[type="text"], textarea, select, [contenteditable]')) return true;
  const activation = e.key === ' ' || e.key === 'Enter';
  return activation && Boolean(target?.closest('button, a, summary, [role="switch"], [role="radio"], [role="tab"]'));
}

/** Next/previous entry in a list of preset speeds, clamped at the ends. */
export function stepSpeed(speeds: readonly number[], current: number, direction: 1 | -1): number {
  const i = speeds.indexOf(current);
  const next = Math.min(speeds.length - 1, Math.max(0, (i === -1 ? speeds.indexOf(1) : i) + direction));
  return speeds[next]!;
}
