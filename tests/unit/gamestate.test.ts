import { describe, it, expect } from 'vitest';
import { GameState } from '../../src/gameplay/GameState';
import { MAX_FUEL, FUEL_DRAIN_RATE, COIN_SCORE } from '../../src/utils/constants';

describe('GameState', () => {
  it('starts with full fuel', () => {
    const state = new GameState();
    state.reset(0, 0);
    expect(state.fuel).toBe(MAX_FUEL);
  });

  it('drains fuel over time', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.drainFuel(1, false);
    expect(state.fuel).toBe(MAX_FUEL - FUEL_DRAIN_RATE);
  });

  it('drains fuel faster when boosting', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.drainFuel(1, true);
    expect(state.fuel).toBeLessThan(MAX_FUEL - FUEL_DRAIN_RATE);
  });

  it('turns engine off when fuel runs out', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.fuel = 0.1;
    state.drainFuel(1, false);
    expect(state.fuel).toBe(0);
    expect(state.engineOn).toBe(false);
  });

  it('does not drain fuel when engine is off', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.engineOn = false;
    const fuelBefore = state.fuel;
    state.drainFuel(1, false);
    expect(state.fuel).toBe(fuelBefore);
  });

  it('collects coins and updates score', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.collectCoin(100, 100);
    expect(state.coins).toBe(COIN_SCORE);
    expect(state.popups.length).toBe(1);
  });

  it('collects fuel and caps at max', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.fuel = 90;
    state.collectFuel(100, 100);
    expect(state.fuel).toBe(MAX_FUEL);
  });

  it('tracks distance correctly', () => {
    const state = new GameState();
    state.reset(100, 0);
    state.updateDistance(350);
    expect(state.distance).toBe(250);
  });

  it('does not track negative distance', () => {
    const state = new GameState();
    state.reset(100, 0);
    state.updateDistance(50);
    expect(state.distance).toBe(0);
  });

  it('checkpoints refill fuel and save position', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.fuel = 30;
    state.hitCheckpoint(500, 400);
    expect(state.fuel).toBe(MAX_FUEL);
    expect(state.lastCheckpoint?.x).toBe(500);
  });

  it('die sets dead flag only once', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.die(100, 100);
    expect(state.dead).toBe(true);
    const popupCount = state.popups.length;
    state.die(100, 100); // second call should be no-op
    expect(state.popups.length).toBe(popupCount);
  });

  it('popups expire over time', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.addPopup('test', 0, 0, '#FFF');
    expect(state.popups.length).toBe(1);
    state.updatePopups(3); // more than popup lifetime
    expect(state.popups.length).toBe(0);
  });

  it('score combines distance and coins', () => {
    const state = new GameState();
    state.reset(0, 0);
    state.updateDistance(100);
    state.collectCoin(50, 50);
    expect(state.score).toBe(100 + COIN_SCORE);
  });
});
