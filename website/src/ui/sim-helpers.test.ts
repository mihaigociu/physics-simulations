import { describe, expect, it } from 'vitest';
import { stepSpeed } from './sim-helpers';

describe('stepSpeed', () => {
  const speeds = [0.25, 0.5, 1, 2, 4];
  it('moves one preset at a time and stops at the ends', () => {
    expect(stepSpeed(speeds, 1, 1)).toBe(2);
    expect(stepSpeed(speeds, 1, -1)).toBe(0.5);
    expect(stepSpeed(speeds, 4, 1)).toBe(4);
    expect(stepSpeed(speeds, 0.25, -1)).toBe(0.25);
  });
  it('treats an unknown speed as 1×', () => {
    expect(stepSpeed(speeds, 3, 1)).toBe(2);
  });
});
