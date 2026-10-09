import { describe, expect, it } from 'vitest';
import { WorldTransform } from './transform';

describe('WorldTransform', () => {
  // A 10 m x 20 m world in a wide 800 x 400 px viewport: height-limited
  const tf = new WorldTransform({ xMin: 0, xMax: 10, yMin: 0, yMax: 20 }, { x: 0, y: 0, width: 800, height: 400 });

  it('uses one scale on both axes, fitted to the tighter side', () => {
    expect(tf.scale).toBe(20);
    expect(tf.length(2)).toBe(40);
  });

  it('puts y = 0 at the bottom and y up the screen', () => {
    expect(tf.toScreen(0, 0).y).toBe(400);
    expect(tf.toScreen(0, 20).y).toBe(0);
  });

  it('centres the world in the spare width', () => {
    expect(tf.toScreen(0, 0).x).toBe(300);
    expect(tf.toScreen(10, 0).x).toBe(500);
  });

  it('round-trips between world and screen', () => {
    const p = tf.toScreen(3.3, 7.7);
    const w = tf.toWorld(p.x, p.y);
    expect(w.x).toBeCloseTo(3.3);
    expect(w.y).toBeCloseTo(7.7);
  });

  it('respects a viewport offset and negative world coordinates', () => {
    const t2 = new WorldTransform({ xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, { x: 10, y: 20, width: 100, height: 100 });
    expect(t2.toScreen(0, 0)).toEqual({ x: 60, y: 70 });
    expect(t2.toScreen(-2, 2)).toEqual({ x: 10, y: 20 });
  });

  it('rejects empty worlds', () => {
    expect(() => new WorldTransform({ xMin: 0, xMax: 0, yMin: 0, yMax: 1 }, { x: 0, y: 0, width: 1, height: 1 })).toThrow();
  });
});
