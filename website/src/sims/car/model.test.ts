import { describe, expect, it } from 'vitest';
import {
  BRAKE_MAX,
  chartAxes,
  COAST_TIME,
  coastLeft,
  createState,
  CRUISE_SPEED,
  cruiseStage,
  diceRestAngle,
  FLAG,
  GAS_MAX,
  parkResult,
  ratesBefore,
  sampleAt,
  step,
  type CarState,
} from './model';

const DT = 1 / 120;

/** Run the loop's fixed steps for `seconds` of simulated time. */
function run(state: CarState, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(state, DT);
}

function launch(gas: number, seconds: number, mode: CarState['mode'] = 'free') {
  const s = createState(mode);
  s.pedals.gas = gas;
  run(s, seconds);
  return s;
}

describe('constant acceleration', () => {
  it('full gas from rest follows x = ½at² and v = at exactly', () => {
    const s = launch(1, 5);
    expect(s.time).toBeCloseTo(5, 9);
    expect(s.v).toBeCloseTo(GAS_MAX * 5, 9);
    expect(s.x).toBeCloseTo(0.5 * GAS_MAX * 25, 9);
  });

  it('half gas gives half the acceleration', () => {
    const s = launch(0.5, 4);
    expect(s.a).toBe(GAS_MAX / 2);
    expect(s.v).toBeCloseTo(GAS_MAX * 2, 9);
  });

  it('nothing happens, and the clock waits, until the gas is pressed', () => {
    const s = createState();
    s.pedals.brake = 1;
    run(s, 3);
    expect(s.phase).toBe('ready');
    expect(s.time).toBe(0);
    expect(s.x).toBe(0);
  });
});

describe('no friction', () => {
  it('with both pedals up the speed never changes and distance grows in a straight line', () => {
    const s = launch(1, 3);
    s.pedals.gas = 0;
    const [v0, x0] = [s.v, s.x];
    run(s, 20);
    expect(s.v).toBe(v0);
    expect(s.a).toBe(0);
    expect(s.x).toBeCloseTo(x0 + v0 * 20, 9);
  });
});

describe('brake', () => {
  it('stops exactly at 0 m/s after v² / 2a, and never reverses', () => {
    const s = launch(1, 5); // 20 m/s
    const [v0, x0] = [s.v, s.x];
    s.pedals = { gas: 0, brake: 1 };
    run(s, 10);
    expect(s.v).toBe(0);
    expect(s.a).toBe(0);
    expect(s.x).toBeCloseTo(x0 + (v0 * v0) / (2 * BRAKE_MAX), 9);
  });

  it('twice the speed needs four times the braking distance', () => {
    const distance = (seconds: number) => {
      const s = launch(1, seconds);
      const x0 = s.x;
      s.pedals = { gas: 0, brake: 1 };
      run(s, 10);
      return s.x - x0;
    };
    expect(distance(4) / distance(2)).toBeCloseTo(4, 9);
  });

  it('gas and brake together add up', () => {
    const s = launch(1, 2);
    s.pedals = { gas: 1, brake: 0.25 };
    step(s, DT);
    expect(s.a).toBe(GAS_MAX - BRAKE_MAX / 4);
  });
});

describe('strobe and samples', () => {
  it('leaves a ghost exactly on every whole second', () => {
    const s = launch(1, 3.5);
    expect(s.strobes).toHaveLength(4);
    s.strobes.forEach((x, i) => expect(x).toBeCloseTo(0.5 * GAS_MAX * i * i, 9));
  });

  it('keeps only the last minute or so of samples on a long drive', () => {
    const s = launch(0.01, 300);
    expect(s.samples[0]!.t).toBeGreaterThan(300 - 90);
    expect(s.samples.at(-1)!.t).toBeCloseTo(300, 6);
  });

  it('reads the motion between samples exactly at constant acceleration', () => {
    const s = launch(1, 4);
    const m = sampleAt(s, 2.71);
    expect(m.x).toBeCloseTo(0.5 * GAS_MAX * 2.71 ** 2, 9);
    expect(m.v).toBeCloseTo(GAS_MAX * 2.71, 9);
  });

  it('Δx/Δt over the last second is the average speed, and closes in on v as Δt shrinks', () => {
    const s = launch(1, 6);
    const v = s.v;
    const one = ratesBefore(s, s.time, 1)!;
    const tenth = ratesBefore(s, s.time, 0.1)!;
    // At constant a the average over Δt is the speed at its midpoint: v − a·Δt/2
    expect(one.dx / one.dt).toBeCloseTo(v - GAS_MAX * 0.5, 9);
    expect(tenth.dx / tenth.dt).toBeCloseTo(v - GAS_MAX * 0.05, 9);
    expect(one.dv / one.dt).toBeCloseTo(GAS_MAX, 9);
  });

  it('uses the time there is near the start', () => {
    const s = launch(1, 0.5);
    expect(ratesBefore(s, s.time, 1)!.dt).toBeCloseTo(0.5, 9);
    expect(ratesBefore(createState(), 0, 1)).toBeNull();
  });
});

describe('fuzzy dice', () => {
  it('lean back while speeding up and hang straight when coasting', () => {
    const s = launch(1, 4);
    expect(s.dice.angle).toBeCloseTo(diceRestAngle(GAS_MAX), 2);
    expect(s.dice.angle).toBeLessThan(0);
    s.pedals.gas = 0;
    run(s, 6);
    expect(Math.abs(s.dice.angle)).toBeLessThan(1e-3);
  });

  it('swing forward when braking', () => {
    const s = launch(1, 6);
    s.pedals = { gas: 0, brake: 0.5 };
    run(s, 4);
    expect(s.dice.angle).toBeCloseTo(diceRestAngle(-BRAKE_MAX / 2), 2);
    expect(s.dice.angle).toBeGreaterThan(0);
  });
});

describe('hands-off challenge', () => {
  it('walks through speed up → let go → coast → done', () => {
    const s = createState('cruise');
    s.pedals.gas = 1;
    run(s, 1);
    expect(cruiseStage(s)).toBe('speedUp');
    run(s, CRUISE_SPEED / GAS_MAX);
    expect(cruiseStage(s)).toBe('letGo');
    s.pedals.gas = 0;
    run(s, 2);
    expect(cruiseStage(s)).toBe('coast');
    expect(coastLeft(s)).toBeCloseTo(COAST_TIME - 2, 1);
    const v = s.v;
    run(s, COAST_TIME);
    expect(cruiseStage(s)).toBe('done');
    expect(s.v).toBe(v);
  });

  it('touching a pedal restarts the count', () => {
    const s = launch(1, 3, 'cruise');
    s.pedals.gas = 0;
    run(s, 3);
    s.pedals.gas = 0.2;
    step(s, DT);
    expect(s.coastFrom).toBeNull();
    expect(coastLeft(s)).toBe(COAST_TIME);
  });
});

describe('park challenge', () => {
  /** Accelerate, coast, then brake fully at the point that stops the car `miss` m past the flag. */
  function park(miss: number) {
    const s = launch(1, 4, 'park'); // 16 m/s at 32 m
    s.pedals.gas = 0;
    const brakeAt = FLAG + miss - (s.v * s.v) / (2 * BRAKE_MAX);
    while (s.x + s.v * DT < brakeAt) step(s, DT);
    // Coast the last part of a step exactly onto the braking point
    const h = (brakeAt - s.x) / s.v;
    step(s, h);
    s.pedals.brake = 1;
    run(s, 5);
    return s;
  }

  it.each([
    [0.2, 3],
    [-1.5, 2],
    [4, 1],
    [-8, 0],
  ])('stopping %s m from the flag scores %i stars', (miss, stars) => {
    const s = park(miss);
    expect(s.phase).toBe('done');
    const r = parkResult(s)!;
    expect(r.miss).toBeCloseTo(miss, 6);
    expect(r.stars).toBe(stars);
  });

  it('stops the clock when the car stops', () => {
    const s = park(0);
    const t = s.time;
    run(s, 2);
    expect(s.time).toBe(t);
    expect(s.samples.at(-1)!.v).toBe(0);
  });

  it('a stop near the start line does not count', () => {
    const s = launch(1, 1, 'park');
    s.pedals = { gas: 0, brake: 1 };
    run(s, 2);
    expect(s.phase).toBe('driving');
    expect(parkResult(s)).toBeNull();
  });
});

describe('chart axes', () => {
  it('start at 10 s and grow in clean steps', () => {
    expect(chartAxes(createState()).t).toEqual({ min: 0, max: 10, step: 2 });
    expect(chartAxes(launch(0.1, 23)).t.max).toBe(25);
  });

  it('slide along in 10 s jumps after a minute', () => {
    const s = launch(0.01, 75);
    const { t } = chartAxes(s);
    expect(t).toEqual({ min: 20, max: 80, step: 10 });
    expect(t.min).toBeLessThanOrEqual(s.time - 50);
  });

  it('fit the data, and leave room for a target', () => {
    const s = launch(1, 5); // 50 m, 20 m/s
    const axes = chartAxes(s, { x: FLAG });
    expect(axes.x.min).toBe(0);
    expect(axes.x.max).toBeGreaterThanOrEqual(FLAG);
    expect(axes.v.max).toBeGreaterThanOrEqual(20);
    expect(axes.a).toEqual({ min: -BRAKE_MAX, max: GAS_MAX, step: 2 });
  });
});

describe('chart axes at the start', () => {
  it('show at least 10 m and 5 m/s, so the first metres are not zoomed in', () => {
    const axes = chartAxes(launch(1, 1)); // 2 m, 4 m/s
    expect(axes.x).toEqual({ min: 0, max: 10, step: 2 });
    expect(axes.v).toEqual({ min: 0, max: 5, step: 1 });
  });
});
