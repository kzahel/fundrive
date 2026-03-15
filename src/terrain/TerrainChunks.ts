import type { SeededRandom } from '../utils/random';
import { CHUNK_WIDTH, GROUND_Y } from '../utils/constants';

export type GroundType = 'road' | 'grass' | 'dirt' | 'mud';

export interface TerrainPoint {
  x: number;
  y: number;
}

export interface TerrainChunk {
  points: TerrainPoint[];
  groundType: GroundType;
  startX: number;
  endX: number;
  hasCheckpoint: boolean;
  coins: TerrainPoint[];
  fuelCans: TerrainPoint[];
  warningSign: TerrainPoint | null; // warning before a jump
  decorations: Decoration[];
}

export interface Decoration {
  type: 'tree' | 'flower' | 'rock' | 'bush';
  x: number;
  y: number;
}

type ChunkGenerator = (
  startX: number,
  startY: number,
  rng: SeededRandom,
  difficulty: number
) => { points: TerrainPoint[]; groundType: GroundType };

const generators: Record<string, ChunkGenerator> = {
  flat(startX, startY, _rng, _diff) {
    const pts: TerrainPoint[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: startX + (CHUNK_WIDTH * i) / steps, y: startY });
    }
    return { points: pts, groundType: 'road' as GroundType };
  },

  gentleHill(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const steps = 10;
    const height = rng.range(30, 60 + diff * 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = startY - Math.sin(t * Math.PI) * height;
      pts.push({ x: startX + CHUNK_WIDTH * t, y });
    }
    const gt = rng.pick<GroundType>(['grass', 'grass', 'dirt']);
    return { points: pts, groundType: gt };
  },

  steepClimb(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const steps = 8;
    const drop = rng.range(40, 80 + diff * 15);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Smooth climb up
      const y = startY - t * drop;
      pts.push({ x: startX + CHUNK_WIDTH * t, y });
    }
    return { points: pts, groundType: rng.pick<GroundType>(['dirt', 'grass']) };
  },

  valley(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const steps = 12;
    const depth = rng.range(40, 70 + diff * 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = startY + Math.sin(t * Math.PI) * depth;
      pts.push({ x: startX + CHUNK_WIDTH * t, y });
    }
    return { points: pts, groundType: rng.pick<GroundType>(['mud', 'dirt']) };
  },

  bumpy(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bump = Math.sin(t * Math.PI * (3 + diff * 0.5)) * rng.range(10, 25);
      pts.push({ x: startX + CHUNK_WIDTH * t, y: startY - bump });
    }
    return { points: pts, groundType: rng.pick<GroundType>(['grass', 'dirt']) };
  },

  jumpRamp(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const rampHeight = rng.range(30, 50 + diff * 10);
    const gapWidth = CHUNK_WIDTH * rng.range(0.15, 0.25);
    const steps = 12;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let y = startY;

      if (t < 0.35) {
        // Ramp up
        y = startY - (t / 0.35) * rampHeight;
      } else if (t < 0.35 + gapWidth / CHUNK_WIDTH) {
        // Gap (drop)
        const gapT = (t - 0.35) / (gapWidth / CHUNK_WIDTH);
        y = startY - rampHeight + gapT * rampHeight * 1.2;
      } else {
        // Landing ramp down
        const landT = (t - 0.35 - gapWidth / CHUNK_WIDTH) / (1 - 0.35 - gapWidth / CHUNK_WIDTH);
        y = startY + rampHeight * 0.2 - landT * rampHeight * 0.2;
      }

      pts.push({ x: startX + CHUNK_WIDTH * t, y });
    }
    return { points: pts, groundType: 'road' as GroundType };
  },

  descent(startX, startY, rng, diff) {
    const pts: TerrainPoint[] = [];
    const steps = 8;
    const drop = rng.range(40, 80 + diff * 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: startX + CHUNK_WIDTH * t, y: startY + t * drop });
    }
    return { points: pts, groundType: rng.pick<GroundType>(['road', 'grass']) };
  },

  bridge(startX, startY, _rng, _diff) {
    const pts: TerrainPoint[] = [];
    const steps = 8;
    // Flat elevated section
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const dip = Math.sin(t * Math.PI) * 5; // Slight sag
      pts.push({ x: startX + CHUNK_WIDTH * t, y: startY - 30 + dip });
    }
    return { points: pts, groundType: 'road' as GroundType };
  },
};

const easyChunks = ['flat', 'gentleHill', 'descent', 'bridge'];
const mediumChunks = ['steepClimb', 'bumpy', 'valley'];
const hardChunks = ['jumpRamp'];

export function generateChunk(
  index: number,
  startX: number,
  startY: number,
  rng: SeededRandom,
  checkpointInterval: number
): TerrainChunk {
  const difficulty = Math.min(index / 20, 1); // ramps from 0-1 over 20 chunks

  // Pick chunk type based on difficulty
  let pool: string[];
  const roll = rng.next();
  if (difficulty < 0.3) {
    pool = roll < 0.8 ? easyChunks : mediumChunks;
  } else if (difficulty < 0.7) {
    pool = roll < 0.5 ? easyChunks : roll < 0.85 ? mediumChunks : hardChunks;
  } else {
    pool = roll < 0.3 ? easyChunks : roll < 0.7 ? mediumChunks : hardChunks;
  }

  // First chunk is always flat
  const chunkType = index === 0 ? 'flat' : rng.pick(pool);
  const gen = generators[chunkType];
  const { points, groundType } = gen(startX, startY, rng, difficulty);

  // Keep y values from going too far from baseline
  const lastPoint = points[points.length - 1];
  const drift = lastPoint.y - GROUND_Y;
  if (Math.abs(drift) > 100) {
    const correction = drift * 0.3;
    for (const p of points) {
      p.y -= correction;
    }
  }

  // Checkpoint every N world units
  const hasCheckpoint =
    index > 0 && Math.floor(startX / checkpointInterval) !== Math.floor((startX + CHUNK_WIDTH) / checkpointInterval);

  // Place coins
  const coins: TerrainPoint[] = [];
  if (rng.chance(0.4)) {
    const numCoins = rng.int(1, 3);
    for (let i = 0; i < numCoins; i++) {
      const t = rng.range(0.2, 0.8);
      const idx = Math.floor(t * (points.length - 1));
      const p = points[idx];
      coins.push({ x: p.x, y: p.y - 40 - rng.range(0, 30) });
    }
  }

  // Place fuel cans (less frequent than coins)
  const fuelCans: TerrainPoint[] = [];
  if (rng.chance(0.15)) {
    const t = rng.range(0.3, 0.7);
    const idx = Math.floor(t * (points.length - 1));
    const p = points[idx];
    fuelCans.push({ x: p.x, y: p.y - 35 });
  }

  // Warning sign before jumps
  const warningSign = chunkType === 'jumpRamp' ? { x: startX + 20, y: startY - 50 } : null;

  // Decorations
  const decorations: Decoration[] = [];
  if (rng.chance(0.5)) {
    const numDecs = rng.int(1, 3);
    for (let i = 0; i < numDecs; i++) {
      const t = rng.range(0.1, 0.9);
      const idx = Math.floor(t * (points.length - 1));
      const p = points[idx];
      decorations.push({
        type: rng.pick(['tree', 'flower', 'rock', 'bush']),
        x: p.x,
        y: p.y,
      });
    }
  }

  return {
    points,
    groundType,
    startX,
    endX: startX + CHUNK_WIDTH,
    hasCheckpoint,
    coins,
    fuelCans,
    warningSign,
    decorations,
  };
}
