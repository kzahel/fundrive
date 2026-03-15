import type { InputState } from './InputManager';

export interface InputFrame {
  tick: number;
  state: InputState;
}

export interface ReplayData {
  seed: number;
  carType: string;
  frames: InputFrame[];
  finalDistance: number;
  finalCoins: number;
}

export class Recorder {
  private frames: InputFrame[] = [];
  private lastState: string = '';
  private tick = 0;

  reset() {
    this.frames = [];
    this.lastState = '';
    this.tick = 0;
  }

  record(state: InputState) {
    const serialized = JSON.stringify(state);
    // Only record when input changes to keep replay data small
    if (serialized !== this.lastState) {
      this.frames.push({ tick: this.tick, state: { ...state } });
      this.lastState = serialized;
    }
    this.tick++;
  }

  getFrames(): InputFrame[] {
    return this.frames;
  }
}

export class Replayer {
  private frames: InputFrame[];
  private frameIndex = 0;
  private tick = 0;
  private currentState: InputState = {
    gas: false, brake: false, leanForward: false,
    leanBack: false, boost: false, toggleEngine: false, reset: false, menu: false,
  };

  constructor(frames: InputFrame[]) {
    this.frames = frames;
  }

  next(): InputState {
    while (
      this.frameIndex < this.frames.length &&
      this.frames[this.frameIndex].tick <= this.tick
    ) {
      this.currentState = { ...this.frames[this.frameIndex].state };
      this.frameIndex++;
    }
    this.tick++;
    return { ...this.currentState };
  }

  get done(): boolean {
    return this.frameIndex >= this.frames.length;
  }
}
