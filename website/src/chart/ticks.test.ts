import { describe, expect, it } from 'vitest';
import { axisRange, ticks } from './ticks';

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

describe('axisRange', () => {
  it('covers data on both sides of zero with clean steps', () => {
    expect(axisRange(-3.2, 7.9)).toEqual({ min: -5, max: 10, step: 2.5 });
    expect(axisRange(0.3, 4.6)).toEqual({ min: 0, max: 5, step: 1 });
    expect(axisRange(-0.9, -0.1)).toEqual({ min: -1, max: 0, step: 0.2 });
    expect(axisRange(0, 0)).toEqual({ min: 0, max: 0.2, step: 0.2 });
  });
});
