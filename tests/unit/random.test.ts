import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../src/utils/random';

describe('SeededRandom', () => {
  it('produces deterministic output for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different output for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    // At least one of the first 10 values should differ
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (a.next() !== b.next()) allSame = false;
    }
    expect(allSame).toBe(false);
  });

  it('range() returns values within bounds', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 200; i++) {
      const v = rng.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('int() returns integers within bounds', () => {
    const rng = new SeededRandom(77);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(0, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('pick() returns elements from the array', () => {
    const rng = new SeededRandom(123);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('chance() respects probability bounds', () => {
    const rng = new SeededRandom(555);
    let trueCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.5)) trueCount++;
    }
    // Should be roughly 50% — allow wide margin
    expect(trueCount).toBeGreaterThan(300);
    expect(trueCount).toBeLessThan(700);
  });
});
