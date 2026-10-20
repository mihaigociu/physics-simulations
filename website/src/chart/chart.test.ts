import { describe, expect, it } from 'vitest';
import { chartXAt, type ChartSpec } from './chart';

const spec: ChartSpec = {
  x: { min: 10, max: 70, step: 10, label: '' },
  y: { max: 1, step: 1, label: '' },
  series: [],
  formatTick: String,
};

describe('chartXAt', () => {
  // Plot spans 46 px (left padding) to width − 18 px
  it('maps pixels inside the plot to x values', () => {
    expect(chartXAt(664, spec, 46)).toBe(10);
    expect(chartXAt(664, spec, 646)).toBe(70);
    expect(chartXAt(664, spec, 346)).toBe(40);
  });

  it('clamps outside the plot', () => {
    expect(chartXAt(664, spec, 0)).toBe(10);
    expect(chartXAt(664, spec, 900)).toBe(70);
  });
});
