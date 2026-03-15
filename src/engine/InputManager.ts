export interface InputState {
  gas: boolean;
  brake: boolean;
  leanForward: boolean;
  leanBack: boolean;
  boost: boolean;
  toggleEngine: boolean; // single press
  reset: boolean; // single press
}

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private touchButtons: Record<string, boolean> = {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  getState(): InputState {
    const state: InputState = {
      gas: this.keys.has('ArrowRight') || this.keys.has('KeyD') || !!this.touchButtons['gas'],
      brake: this.keys.has('ArrowLeft') || this.keys.has('KeyA') || !!this.touchButtons['brake'],
      leanForward: this.keys.has('ArrowDown') || this.keys.has('KeyS') || !!this.touchButtons['leanForward'],
      leanBack: this.keys.has('ArrowUp') || this.keys.has('KeyW') || !!this.touchButtons['leanBack'],
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.touchButtons['boost'],
      toggleEngine: this.justPressed.has('Space'),
      reset: this.justPressed.has('KeyR'),
    };
    this.justPressed.clear();
    return state;
  }

  setTouchButton(name: string, pressed: boolean) {
    this.touchButtons[name] = pressed;
  }
}
