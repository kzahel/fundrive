import { describe, it, expect } from 'vitest';
import { Recorder, Replayer } from '../../src/engine/Recorder';
import type { InputState } from '../../src/engine/InputManager';

const emptyInput: InputState = {
  gas: false, brake: false, leanForward: false,
  leanBack: false, boost: false, toggleEngine: false, reset: false, menu: false,
};

describe('Recorder', () => {
  it('records input changes', () => {
    const rec = new Recorder();
    rec.record(emptyInput);
    rec.record({ ...emptyInput, gas: true });
    rec.record({ ...emptyInput, gas: true }); // duplicate, should not be recorded
    rec.record(emptyInput);

    const frames = rec.getFrames();
    expect(frames.length).toBe(3); // initial, gas on, gas off
  });

  it('resets cleanly', () => {
    const rec = new Recorder();
    rec.record({ ...emptyInput, gas: true });
    rec.reset();
    expect(rec.getFrames().length).toBe(0);
  });
});

describe('Replayer', () => {
  it('replays recorded input', () => {
    const rec = new Recorder();
    rec.record(emptyInput);
    rec.record(emptyInput);
    rec.record({ ...emptyInput, gas: true });
    rec.record({ ...emptyInput, gas: true });
    rec.record(emptyInput);

    const replayer = new Replayer(rec.getFrames());

    const s0 = replayer.next(); // tick 0
    expect(s0.gas).toBe(false);
    const s1 = replayer.next(); // tick 1
    expect(s1.gas).toBe(false);
    const s2 = replayer.next(); // tick 2
    expect(s2.gas).toBe(true);
    const s3 = replayer.next(); // tick 3
    expect(s3.gas).toBe(true);
    const s4 = replayer.next(); // tick 4
    expect(s4.gas).toBe(false);
  });

  it('reports done when all frames consumed', () => {
    const replayer = new Replayer([
      { tick: 0, state: emptyInput },
    ]);
    expect(replayer.done).toBe(false);
    replayer.next(); // consumes the frame
    expect(replayer.done).toBe(true);
  });
});
