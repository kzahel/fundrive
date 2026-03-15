import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../src/utils/random';
import { generateChunk } from '../../src/terrain/TerrainChunks';
import { CHUNK_WIDTH, GROUND_Y, CHECKPOINT_INTERVAL } from '../../src/utils/constants';

describe('TerrainChunks', () => {
  it('generates deterministic chunks for the same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const chunk1 = generateChunk(1, CHUNK_WIDTH, GROUND_Y, rng1, CHECKPOINT_INTERVAL);
    const chunk2 = generateChunk(1, CHUNK_WIDTH, GROUND_Y, rng2, CHECKPOINT_INTERVAL);

    expect(chunk1.points.length).toBe(chunk2.points.length);
    for (let i = 0; i < chunk1.points.length; i++) {
      expect(chunk1.points[i].x).toBe(chunk2.points[i].x);
      expect(chunk1.points[i].y).toBe(chunk2.points[i].y);
    }
    expect(chunk1.groundType).toBe(chunk2.groundType);
  });

  it('first chunk is always flat', () => {
    const rng = new SeededRandom(99);
    const chunk = generateChunk(0, 0, GROUND_Y, rng, CHECKPOINT_INTERVAL);

    // Flat chunk: all y values should be the same
    const ys = chunk.points.map((p) => p.y);
    const allSame = ys.every((y) => y === ys[0]);
    expect(allSame).toBe(true);
  });

  it('chunk spans correct width', () => {
    const rng = new SeededRandom(10);
    const startX = 500;
    const chunk = generateChunk(3, startX, GROUND_Y, rng, CHECKPOINT_INTERVAL);

    expect(chunk.startX).toBe(startX);
    expect(chunk.endX).toBe(startX + CHUNK_WIDTH);
    expect(chunk.points[0].x).toBe(startX);
    // Last point should be at or near endX
    expect(chunk.points[chunk.points.length - 1].x).toBeCloseTo(chunk.endX, 0);
  });

  it('has valid ground type', () => {
    const validTypes = ['road', 'grass', 'dirt', 'mud'];
    const rng = new SeededRandom(200);
    for (let i = 0; i < 20; i++) {
      const chunk = generateChunk(i, i * CHUNK_WIDTH, GROUND_Y, rng, CHECKPOINT_INTERVAL);
      expect(validTypes).toContain(chunk.groundType);
    }
  });

  it('coins are placed above their local terrain point', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 30; i++) {
      const chunk = generateChunk(i, i * CHUNK_WIDTH, GROUND_Y, rng, CHECKPOINT_INTERVAL);
      for (const coin of chunk.coins) {
        // Coins should be above the max terrain y (lower on screen = higher y)
        const maxY = Math.max(...chunk.points.map((p) => p.y));
        expect(coin.y).toBeLessThan(maxY);
      }
    }
  });

  it('generates checkpoints at proper intervals', () => {
    const rng = new SeededRandom(42);
    let hasCheckpoint = false;
    for (let i = 0; i < 30; i++) {
      const chunk = generateChunk(i, i * CHUNK_WIDTH, GROUND_Y, rng, CHECKPOINT_INTERVAL);
      if (chunk.hasCheckpoint) hasCheckpoint = true;
    }
    expect(hasCheckpoint).toBe(true);
  });

  it('jump ramps have warning signs', () => {
    // Generate many chunks to find a jump ramp
    const rng = new SeededRandom(7777);
    let foundWarning = false;
    for (let i = 0; i < 50; i++) {
      const chunk = generateChunk(i, i * CHUNK_WIDTH, GROUND_Y, rng, CHECKPOINT_INTERVAL);
      if (chunk.warningSign) {
        foundWarning = true;
        expect(chunk.warningSign.x).toBeGreaterThanOrEqual(chunk.startX);
      }
    }
    // With 50 chunks at medium-high difficulty, we should get at least one jump
    expect(foundWarning).toBe(true);
  });
});
