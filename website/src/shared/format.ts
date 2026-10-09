/**
 * Number formatting per locale. Romanian writes 9,81 where English writes
 * 9.81, so every number a student reads must go through here.
 */

import type { Locale } from '../i18n';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale, digits: number): Intl.NumberFormat {
  const key = `${locale}:${digits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    });
    formatters.set(key, f);
  }
  return f;
}

/** `formatNumber('ro', 9.81, 2)` → `"9,81"`. */
export function formatNumber(locale: Locale, value: number, digits = 2): string {
  // Avoid showing "-0,00" for tiny negative values from the integrators
  const v = Object.is(Math.round(value * 10 ** digits), -0) ? 0 : value;
  return formatter(locale, digits).format(v);
}

/** `formatQuantity('en', 9.81, 'm/s²')` → `"9.81 m/s²"` with a no-break space. */
export function formatQuantity(locale: Locale, value: number, unit: string, digits = 2): string {
  return `${formatNumber(locale, value, digits)} ${unit}`;
}
