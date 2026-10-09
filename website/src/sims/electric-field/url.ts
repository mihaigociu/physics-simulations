/**
 * Electric-field setup in the page URL, for share links. A preset layout is
 * written by name (`?layout=pair`); an edited one charge by charge
 * (`?c=0,0,+;1,1,-`). The particle's start (`p=1.5,0`) and sign (`qs=-`)
 * are written only when they differ from the layout's defaults.
 */

import { BOUND, type Charge } from './physics';
import { LAYOUTS, LAYOUT_IDS, layoutCharges, matchingLayout, MAX_CHARGES, type LayoutId } from './model';

export interface FieldSetup {
  charges: Charge[];
  start: { x: number; y: number };
  sign: 1 | -1;
}

const inBounds = (v: number) => Number.isFinite(v) && Math.abs(v) <= BOUND;
const short = (v: number) => String(Number(v.toFixed(2)));

function parseCharges(text: string): Charge[] | null {
  const out: Charge[] = [];
  for (const part of text.split(';').slice(0, MAX_CHARGES)) {
    const [xs, ys, s] = part.split(',');
    const x = Number(xs);
    const y = Number(ys);
    if (!inBounds(x) || !inBounds(y) || (s !== '+' && s !== '-' && s !== ' ')) return null;
    out.push({ x, y, sign: s === '-' ? -1 : 1 }); // '+' arrives as ' ' if not escaped
  }
  return out;
}

export function setupFromQuery(search: string): FieldSetup {
  const q = new URLSearchParams(search);
  const layout = q.get('layout');
  const id: LayoutId = LAYOUT_IDS.includes(layout as LayoutId) ? (layout as LayoutId) : 'original';
  const custom = q.get('c');
  const charges = (custom !== null && parseCharges(custom)) || layoutCharges(id);
  const [px, py] = (q.get('p') ?? '').split(',').map(Number);
  const start = px !== undefined && py !== undefined && inBounds(px) && inBounds(py) ? { x: px, y: py } : { ...LAYOUTS[custom !== null ? 'original' : id].start };
  return { charges, start, sign: q.get('qs') === '-' ? -1 : 1 };
}

export function queryFromSetup(s: FieldSetup): string {
  const q = new URLSearchParams();
  const id = matchingLayout(s.charges);
  if (id && id !== 'original') q.set('layout', id);
  if (!id) q.set('c', s.charges.map((c) => `${short(c.x)},${short(c.y)},${c.sign > 0 ? '+' : '-'}`).join(';'));
  const defaultStart = LAYOUTS[id ?? 'original'].start;
  if (s.start.x !== defaultStart.x || s.start.y !== defaultStart.y) q.set('p', `${short(s.start.x)},${short(s.start.y)}`);
  if (s.sign < 0) q.set('qs', '-');
  // Keep the separators readable: URLSearchParams would escape them
  const str = q.toString().replace(/%2C/g, ',').replace(/%3B/g, ';');
  return str ? `?${str}` : '';
}
