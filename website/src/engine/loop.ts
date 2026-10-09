/**
 * Fixed-timestep simulation loop.
 *
 * Physics always advances in steps of exactly `1 / stepHz` simulated seconds,
 * however fast the screen refreshes (the Python versions assumed a steady
 * 60 fps). Rendering happens once per animation frame. `speed` scales
 * simulated time against wall time, for slow motion and fast-forward.
 *
 * `advance()` holds all the timing logic and takes plain numbers, so it is
 * unit-testable without a browser; `start()` just feeds it from
 * requestAnimationFrame.
 */

export interface LoopCallbacks {
  /** Advance the physics by `dt` simulated seconds. */
  update(dt: number): void;
  /**
   * Draw the current state. `alpha` (0..1) is how far wall time has moved
   * into the next, not yet simulated, step - for optional interpolation.
   */
  render(alpha: number): void;
}

export interface LoopOptions {
  /** Physics steps per simulated second. */
  stepHz?: number;
  /** Longest wall-clock gap counted for one frame, in seconds (tab switches, breakpoints). */
  maxFrameS?: number;
  /** Upper bound on physics steps in one frame, so a slow device can't spiral. */
  maxStepsPerFrame?: number;
}

export const MIN_SPEED = 0.1;
export const MAX_SPEED = 10;

export class FixedStepLoop {
  readonly dt: number;
  paused = false;

  private readonly maxFrameS: number;
  private readonly maxSteps: number;
  private _speed = 1;
  private accumulator = 0;
  private lastTimeMs: number | null = null;
  private rafId: number | null = null;

  constructor(
    private readonly callbacks: LoopCallbacks,
    { stepHz = 120, maxFrameS = 0.1, maxStepsPerFrame = 240 }: LoopOptions = {},
  ) {
    this.dt = 1 / stepHz;
    this.maxFrameS = maxFrameS;
    this.maxSteps = maxStepsPerFrame;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    this._speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
  }

  /**
   * Account for `frameS` seconds of wall time: run however many physics
   * steps are due, then render. Returns the number of steps run.
   */
  advance(frameS: number): number {
    let steps = 0;
    if (!this.paused) {
      this.accumulator += Math.min(Math.max(frameS, 0), this.maxFrameS) * this._speed;
      // Small tolerance so float error doesn't drop a step that is due
      const due = this.dt - 1e-12;
      while (this.accumulator >= due && steps < this.maxSteps) {
        this.callbacks.update(this.dt);
        this.accumulator -= this.dt;
        steps++;
      }
      if (steps === this.maxSteps) this.accumulator = 0; // drop the backlog
      this.accumulator = Math.max(this.accumulator, 0);
    }
    this.callbacks.render(this.paused ? 0 : this.accumulator / this.dt);
    return steps;
  }

  /** Forget any partial step, e.g. after a reset. */
  clearAccumulator(): void {
    this.accumulator = 0;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastTimeMs = null;
    const frame = (nowMs: number) => {
      const frameS = this.lastTimeMs === null ? 0 : (nowMs - this.lastTimeMs) / 1000;
      this.lastTimeMs = nowMs;
      this.advance(frameS);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  // Coming back to a hidden tab must not count the time it was away
  private onVisibility = () => {
    this.lastTimeMs = null;
  };
}
