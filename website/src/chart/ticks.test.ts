import { describe, expect, it } from 'vitest';
import { ticks } from './ticks';

describe('ticks', () => {
  it('lists clean values without float drift', () => {
    expect(ticks(0.5, 0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(ticks(2.5, 0.5)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(ticks(100, 25)).toEqual([0, 25, 50, 75, 100]);
  });

  it('can start below zero', () => {
    expect(ticks(20, 10, -20)).toEqual([-20, -10, 0, 10, 20]);
    expect(Object.is(ticks(1, 0.5, -1)[2], 0)).toBe(true); // 0, not -0
  });
});
