/**
 * Translations. Romanian is the reference language: its file defines the set
 * of keys, and a unit test checks that English has exactly the same ones.
 */

import ro from './ro.json';
import en from './en.json';

export const LOCALES = ['ro', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ro';

export const LOCALE_NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' };

type Dict = typeof ro;
const DICTS: Record<Locale, Dict> = { ro, en };

/** Dot-separated paths to every string in the dictionary, e.g. "sim.open". */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];
export type TKey = Paths<Dict>;

function lookup(dict: unknown, key: string): string | undefined {
  let node = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(locale: Locale, key: TKey): string {
  return lookup(DICTS[locale], key) ?? lookup(DICTS[DEFAULT_LOCALE], key) ?? key;
}

/** `t` with `{name}` placeholders filled in: `tf('en', 'quiz.score', { score: 3, total: 10 })`. */
export function tf(locale: Locale, key: TKey, vars: Record<string, string | number>): string {
  return t(locale, key).replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Bind `t` to one locale, for use inside a page: `const tr = useT(lang)`. */
export function useT(locale: Locale): (key: TKey) => string {
  return (key) => t(locale, key);
}

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/**
 * Pick the locale from the browser's language list: the first language we
 * support wins; anything else falls back to Romanian.
 */
export function pickLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** `getStaticPaths` result for pages under `src/pages/[lang]/`. */
export function localeStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

/** Join the site base path with a site-relative path, keeping trailing slashes. */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  const rel = path.replace(/^\/+/, '');
  const split = rel.search(/[?#]/);
  const pathname = split === -1 ? rel : rel.slice(0, split);
  const suffix = split === -1 ? '' : rel.slice(split);
  // Pages need a trailing slash (`trailingSlash: 'always'`); files must not get one
  const needsSlash = pathname !== '' && !pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname);
  return root + pathname + (needsSlash ? '/' : '') + suffix;
}

/** URL of a page in a given language, e.g. `localePath('en', 'free-fall')`. */
export function localePath(locale: Locale, path = '', base?: string): string {
  return withBase(`${locale}/${path.replace(/^\/+/, '')}`, base);
}
