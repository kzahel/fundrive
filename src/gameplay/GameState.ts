import { MAX_FUEL, FUEL_DRAIN_RATE, FUEL_BOOST_MULTIPLIER, COIN_SCORE } from '../utils/constants';

export interface CheckpointData {
  x: number;
  y: number;
  fuel: number;
  distance: number;
}

export class GameState {
  fuel = MAX_FUEL;
  coins = 0;
  distance = 0;
  startX = 0;
  engineOn = true;
  dead = false;
  gameOver = false;
  lastCheckpoint: CheckpointData | null = null;
  // Popup messages
  popups: { text: string; x: number; y: number; time: number; color: string }[] = [];

  reset(startX: number, startY: number) {
    this.fuel = MAX_FUEL;
    this.coins = 0;
    this.distance = 0;
    this.startX = startX;
    this.engineOn = true;
    this.dead = false;
    this.gameOver = false;
    this.lastCheckpoint = { x: startX, y: startY, fuel: MAX_FUEL, distance: 0 };
    this.popups = [];
  }

  updateDistance(carX: number) {
    const d = Math.max(0, carX - this.startX);
    this.distance = Math.round(d);
  }

  drainFuel(dt: number, boosting: boolean) {
    if (!this.engineOn) return;
    const rate = boosting ? FUEL_DRAIN_RATE * FUEL_BOOST_MULTIPLIER : FUEL_DRAIN_RATE;
    this.fuel = Math.max(0, this.fuel - rate * dt);
    if (this.fuel <= 0) {
      this.engineOn = false;
    }
  }

  collectCoin(x: number, y: number) {
    this.coins += COIN_SCORE;
    this.addPopup(`+${COIN_SCORE}`, x, y - 20, '#FFD700');
  }

  collectFuel(x: number, y: number) {
    const amount = 25;
    this.fuel = Math.min(MAX_FUEL, this.fuel + amount);
    this.addPopup(`+FUEL`, x, y - 20, '#00CC00');
  }

  hitCheckpoint(x: number, y: number) {
    this.fuel = MAX_FUEL;
    this.lastCheckpoint = {
      x, y,
      fuel: MAX_FUEL,
      distance: this.distance,
    };
    this.addPopup('CHECKPOINT!', x, y - 60, '#FF4444');
  }

  die(x: number, y: number) {
    if (this.dead) return;
    this.dead = true;
    this.addPopup('CRASH!', x, y - 40, '#FF0000');
  }

  get score(): number {
    return this.distance + this.coins;
  }

  addPopup(text: string, x: number, y: number, color: string) {
    this.popups.push({ text, x, y, time: 2, color });
  }

  updatePopups(dt: number) {
    for (const p of this.popups) {
      p.time -= dt;
      p.y -= 30 * dt; // float up
    }
    this.popups = this.popups.filter((p) => p.time > 0);
  }
}
