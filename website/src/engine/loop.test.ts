import { describe, expect, it } from 'vitest';
import { FixedStepLoop, MAX_SPEED, MIN_SPEED } from './loop';

function makeLoop(opts = {}) {
  const calls = { steps: 0, simTime: 0, renders: [] as number[] };
  const loop = new FixedStepLoop(
    {
      update(dt) {
        calls.steps++;
        calls.simTime += dt;
      },
      render(alpha) {
        calls.renders.push(alpha);
      },
    },
    opts,
  );
  return { loop, calls };
}

describe('FixedStepLoop', () => {
  it('runs a whole number of fixed steps and carries the remainder', () => {
    const { loop, calls } = makeLoop({ stepHz: 100 });
    expect(loop.advance(0.025)).toBe(2); // 2.5 steps due
    expect(calls.renders.at(-1)).toBeCloseTo(0.5);
    expect(loop.advance(0.005)).toBe(1); // the half step completes
    expect(calls.simTime).toBeCloseTo(0.03);
  });

  it('simulated time tracks wall time regardless of frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const { loop, calls } = makeLoop();
      for (let i = 0; i < fps * 2; i++) loop.advance(1 / fps);
      expect(calls.simTime).toBeCloseTo(2, 1);
    }
  });

  it('scales simulated time by speed, within the allowed range', () => {
    const { loop, calls } = makeLoop({ stepHz: 100 });
    loop.speed = 0.5;
    for (let i = 0; i < 60; i++) loop.advance(1 / 60);
    expect(calls.simTime).toBeCloseTo(0.5, 1);
    loop.speed = 1000;
    expect(loop.speed).toBe(MAX_SPEED);
    loop.speed = 0;
    expect(loop.speed).toBe(MIN_SPEED);
  });

  it('does not step while paused but still renders', () => {
    const { loop, calls } = makeLoop();
    loop.paused = true;
    expect(loop.advance(0.05)).toBe(0);
    expect(calls.renders).toEqual([0]);
  });

  it('ignores long gaps (tab switches) beyond maxFrameS', () => {
    const { loop, calls } = makeLoop({ stepHz: 100, maxFrameS: 0.1 });
    loop.advance(30);
    expect(calls.simTime).toBeCloseTo(0.1);
  });

  it('caps steps per frame and drops the backlog', () => {
    const { loop } = makeLoop({ stepHz: 1000, maxFrameS: 1, maxStepsPerFrame: 50 });
    expect(loop.advance(1)).toBe(50);
    expect(loop.advance(0)).toBe(0);
  });

  it('ignores negative frame times', () => {
    const { loop, calls } = makeLoop();
    expect(loop.advance(-1)).toBe(0);
    expect(calls.simTime).toBe(0);
  });
});
