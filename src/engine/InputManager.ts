export interface InputState {
  gas: boolean;
  brake: boolean;
  leanForward: boolean;
  leanBack: boolean;
  boost: boolean;
  toggleEngine: boolean; // single press
  reset: boolean; // single press
  menu: boolean; // single press
}

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private touchButtons: Record<string, boolean> = {};

  // Accelerometer tilt (gamma = left/right rotation in landscape)
  tiltEnabled = false;
  private tiltLean = 0; // -1 to 1, negative = lean back, positive = lean forward

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

  enableTilt() {
    if (this.tiltEnabled) return;

    const startListening = () => {
      this.tiltEnabled = true;
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma === null) return;
        // In landscape, gamma maps to forward/back tilt
        // gamma ranges from -90 to 90; normalize to -1..1 with a deadzone
        const raw = e.gamma / 45; // -2..2 range, clamp to -1..1
        const deadzone = 0.1;
        if (Math.abs(raw) < deadzone) {
          this.tiltLean = 0;
        } else {
          this.tiltLean = Math.max(-1, Math.min(1, raw));
        }
      });
    };

    // iOS requires permission request
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((perm: string) => {
          if (perm === 'granted') startListening();
        })
        .catch(() => {});
    } else {
      startListening();
    }
  }

  getState(): InputState {
    // Tilt-based lean
    const tiltLeanBack = this.tiltEnabled && this.tiltLean < -0.2;
    const tiltLeanForward = this.tiltEnabled && this.tiltLean > 0.2;

    const state: InputState = {
      gas: this.keys.has('ArrowRight') || this.keys.has('KeyD') || !!this.touchButtons['gas'],
      brake: this.keys.has('ArrowLeft') || this.keys.has('KeyA') || !!this.touchButtons['brake'],
      leanForward: this.keys.has('ArrowDown') || this.keys.has('KeyS') || !!this.touchButtons['leanForward'] || tiltLeanForward,
      leanBack: this.keys.has('ArrowUp') || this.keys.has('KeyW') || !!this.touchButtons['leanBack'] || tiltLeanBack,
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.touchButtons['boost'],
      toggleEngine: this.justPressed.has('Space'),
      reset: this.justPressed.has('KeyR'),
      menu: this.justPressed.has('Escape'),
    };
    this.justPressed.clear();
    return state;
  }

  setTouchButton(name: string, pressed: boolean) {
    this.touchButtons[name] = pressed;
  }
}
