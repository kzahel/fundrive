import Matter from 'matter-js';
import { SeededRandom } from '../utils/random';
import { CHUNK_WIDTH, GROUND_Y, RENDER_AHEAD, CLEANUP_BEHIND, FRICTION, COLORS, CHECKPOINT_INTERVAL, COIN_RADIUS } from '../utils/constants';
import { generateChunk, type TerrainChunk, type TerrainPoint, type Decoration } from './TerrainChunks';

interface PhysicsChunk {
  chunk: TerrainChunk;
  bodies: Matter.Body[];
  coinBodies: Matter.Body[];
  fuelBodies: Matter.Body[];
  checkpointSensor: Matter.Body | null;
}

export class TerrainManager {
  private rng: SeededRandom;
  private chunks: PhysicsChunk[] = [];
  private world: Matter.World;
  private nextIndex = 0;
  private lastEndY = GROUND_Y;

  constructor(world: Matter.World, seed: number) {
    this.world = world;
    this.rng = new SeededRandom(seed);
  }

  update(cameraX: number) {
    const rightEdge = cameraX + CHUNK_WIDTH * RENDER_AHEAD;
    const leftEdge = cameraX - CHUNK_WIDTH * CLEANUP_BEHIND;

    // Generate chunks ahead
    while (this.getLastChunkEnd() < rightEdge) {
      this.addNextChunk();
    }

    // Remove chunks behind
    while (this.chunks.length > 0 && this.chunks[0].chunk.endX < leftEdge) {
      const old = this.chunks.shift()!;
      for (const b of [...old.bodies, ...old.coinBodies, ...old.fuelBodies]) {
        Matter.Composite.remove(this.world, b);
      }
      if (old.checkpointSensor) {
        Matter.Composite.remove(this.world, old.checkpointSensor);
      }
    }
  }

  private getLastChunkEnd(): number {
    if (this.chunks.length === 0) return 0;
    return this.chunks[this.chunks.length - 1].chunk.endX;
  }

  private addNextChunk() {
    const startX = this.getLastChunkEnd();
    const chunk = generateChunk(
      this.nextIndex, startX, this.lastEndY, this.rng, CHECKPOINT_INTERVAL
    );

    // Create ground bodies from terrain points
    const bodies: Matter.Body[] = [];
    const pts = chunk.points;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Thick ground segment
      const thickness = 60;
      const body = Matter.Bodies.rectangle(cx, cy + thickness / 2, len + 1, thickness, {
        isStatic: true,
        angle,
        friction: FRICTION[chunk.groundType] ?? 0.6,
        label: `ground-${chunk.groundType}`,
        render: { fillStyle: COLORS[chunk.groundType] ?? COLORS.grass },
      });

      bodies.push(body);
    }

    // Coin bodies (sensors)
    const coinBodies = chunk.coins.map((c) =>
      Matter.Bodies.circle(c.x, c.y, COIN_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: 'coin',
        render: { fillStyle: COLORS.coin },
      })
    );

    // Fuel can bodies (sensors)
    const fuelBodies = chunk.fuelCans.map((f) =>
      Matter.Bodies.rectangle(f.x, f.y, 20, 25, {
        isStatic: true,
        isSensor: true,
        label: 'fuel',
        render: { fillStyle: COLORS.fuel },
      })
    );

    // Checkpoint sensor
    let checkpointSensor: Matter.Body | null = null;
    if (chunk.hasCheckpoint) {
      const midX = (chunk.startX + chunk.endX) / 2;
      const midIdx = Math.floor(pts.length / 2);
      const midY = pts[midIdx].y;
      checkpointSensor = Matter.Bodies.rectangle(midX, midY - 50, 10, 100, {
        isStatic: true,
        isSensor: true,
        label: 'checkpoint',
      });
    }

    const allBodies = [
      ...bodies, ...coinBodies, ...fuelBodies,
      ...(checkpointSensor ? [checkpointSensor] : []),
    ];
    Matter.Composite.add(this.world, allBodies);

    const physChunk: PhysicsChunk = {
      chunk,
      bodies,
      coinBodies,
      fuelBodies,
      checkpointSensor,
    };

    this.chunks.push(physChunk);
    this.lastEndY = pts[pts.length - 1].y;
    this.nextIndex++;
  }

  removeCoin(body: Matter.Body) {
    for (const pc of this.chunks) {
      const idx = pc.coinBodies.indexOf(body);
      if (idx >= 0) {
        pc.coinBodies.splice(idx, 1);
        pc.chunk.coins.splice(idx, 1);
        Matter.Composite.remove(this.world, body);
        return;
      }
    }
  }

  removeFuel(body: Matter.Body) {
    for (const pc of this.chunks) {
      const idx = pc.fuelBodies.indexOf(body);
      if (idx >= 0) {
        pc.fuelBodies.splice(idx, 1);
        pc.chunk.fuelCans.splice(idx, 1);
        Matter.Composite.remove(this.world, body);
        return;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, visibleLeft: number, visibleRight: number) {
    for (const pc of this.chunks) {
      const chunk = pc.chunk;
      if (chunk.endX < visibleLeft || chunk.startX > visibleRight) continue;

      // Draw filled ground
      const pts = chunk.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      // Close by going down and back
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y + 200);
      ctx.lineTo(pts[0].x, pts[0].y + 200);
      ctx.closePath();

      ctx.fillStyle = COLORS[chunk.groundType] ?? COLORS.grass;
      ctx.fill();

      // Ground surface line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = this.darken(COLORS[chunk.groundType] ?? COLORS.grass);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw decorations
      for (const dec of chunk.decorations) {
        this.drawDecoration(ctx, dec);
      }

      // Draw coins
      for (const coin of chunk.coins) {
        this.drawCoin(ctx, coin);
      }

      // Draw fuel cans
      for (const fuel of chunk.fuelCans) {
        this.drawFuelCan(ctx, fuel);
      }

      // Draw checkpoint
      if (chunk.hasCheckpoint) {
        const midX = (chunk.startX + chunk.endX) / 2;
        const midIdx = Math.floor(pts.length / 2);
        const midY = pts[midIdx].y;
        this.drawCheckpoint(ctx, midX, midY);
      }

      // Draw warning sign
      if (chunk.warningSign) {
        this.drawWarning(ctx, chunk.warningSign);
      }
    }
  }

  private drawCoin(ctx: CanvasRenderingContext2D, p: TerrainPoint) {
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.coin;
    ctx.fill();
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }

  private drawFuelCan(ctx: CanvasRenderingContext2D, p: TerrainPoint) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Can body
    ctx.fillStyle = '#00AA00';
    ctx.fillRect(-10, -12, 20, 25);
    ctx.strokeStyle = '#006600';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -12, 20, 25);

    // Label
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 0, 1);

    ctx.restore();
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Flag pole
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 80);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Flag
    ctx.beginPath();
    ctx.moveTo(x, y - 80);
    ctx.lineTo(x + 30, y - 70);
    ctx.lineTo(x, y - 60);
    ctx.closePath();
    ctx.fillStyle = COLORS.checkpoint;
    ctx.fill();

    // Checkered pattern on flag
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x + 2, y - 78, 8, 6);
    ctx.fillRect(x + 14, y - 78, 8, 6);
    ctx.fillRect(x + 8, y - 72, 8, 6);
  }

  private drawWarning(ctx: CanvasRenderingContext2D, p: TerrainPoint) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Post
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, 0, 6, 40);

    // Sign
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(18, 10);
    ctx.lineTo(-18, 10);
    ctx.closePath();
    ctx.fillStyle = COLORS.warning;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Exclamation
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 2);

    ctx.restore();
  }

  private drawDecoration(ctx: CanvasRenderingContext2D, dec: Decoration) {
    ctx.save();
    ctx.translate(dec.x, dec.y);

    switch (dec.type) {
      case 'tree': {
        // Trunk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-4, -35, 8, 35);
        // Foliage
        ctx.beginPath();
        ctx.arc(0, -45, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#228B22';
        ctx.fill();
        break;
      }
      case 'flower': {
        // Stem
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.stroke();
        // Petals
        ctx.beginPath();
        ctx.arc(0, -18, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FF69B4';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -18, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        break;
      }
      case 'rock': {
        ctx.beginPath();
        ctx.ellipse(0, -6, 12, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#999';
        ctx.fill();
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'bush': {
        ctx.beginPath();
        ctx.ellipse(0, -8, 15, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2E7D32';
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  private darken(hex: string): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - 40);
    const g = Math.max(0, ((num >> 8) & 0xff) - 40);
    const b = Math.max(0, (num & 0xff) - 40);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
