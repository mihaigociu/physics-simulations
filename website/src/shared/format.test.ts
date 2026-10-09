import { describe, expect, it } from 'vitest';
import { formatNumber, formatQuantity } from './format';

describe('formatNumber', () => {
  it('uses a decimal comma in Romanian and a point in English', () => {
    expect(formatNumber('ro', 9.81)).toBe('9,81');
    expect(formatNumber('en', 9.81)).toBe('9.81');
  });

  it('pads to a fixed number of digits and never groups thousands', () => {
    expect(formatNumber('en', 1234.5, 1)).toBe('1234.5');
    expect(formatNumber('ro', 2, 2)).toBe('2,00');
  });

  it('never shows negative zero', () => {
    expect(formatNumber('en', -0.001, 2)).toBe('0.00');
    expect(formatNumber('en', -0.02, 2)).toBe('-0.02');
  });
});

describe('formatQuantity', () => {
  it('joins value and unit with a no-break space', () => {
    expect(formatQuantity('ro', 1.62, 'm/s²')).toBe('1,62 m/s²');
  });
});
