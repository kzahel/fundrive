import * as planck from 'planck';
import { SeededRandom } from '../utils/random';
import { CHUNK_WIDTH, GROUND_Y, RENDER_AHEAD, CLEANUP_BEHIND, FRICTION, COLORS, CHECKPOINT_INTERVAL, COIN_RADIUS, SCALE } from '../utils/constants';
import { generateChunk, type TerrainChunk, type TerrainPoint, type Decoration } from './TerrainChunks';

interface PhysicsChunk {
  chunk: TerrainChunk;
  bodies: planck.Body[];
  coinBodies: planck.Body[];
  fuelBodies: planck.Body[];
  checkpointSensor: planck.Body | null;
}

export class TerrainManager {
  private rng: SeededRandom;
  private chunks: PhysicsChunk[] = [];
  private world: planck.World;
  private nextIndex = 0;
  private lastEndY = GROUND_Y;

  constructor(world: planck.World, seed: number) {
    this.world = world;
    this.rng = new SeededRandom(seed);
  }

  update(cameraX: number) {
    const rightEdge = cameraX + CHUNK_WIDTH * RENDER_AHEAD;
    const leftEdge = cameraX - CHUNK_WIDTH * CLEANUP_BEHIND;

    while (this.getLastChunkEnd() < rightEdge) {
      this.addNextChunk();
    }

    while (this.chunks.length > 0 && this.chunks[0].chunk.endX < leftEdge) {
      const old = this.chunks.shift()!;
      for (const b of [...old.bodies, ...old.coinBodies, ...old.fuelBodies]) {
        this.world.destroyBody(b);
      }
      if (old.checkpointSensor) {
        this.world.destroyBody(old.checkpointSensor);
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

    const bodies: planck.Body[] = [];
    const pts = chunk.points;
    const groundFriction = FRICTION[chunk.groundType] ?? 0.6;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const thickness = 60;

      const body = this.world.createBody({
        type: 'static',
        position: planck.Vec2(cx / SCALE, (cy + thickness / 2) / SCALE),
        angle,
      });
      body.createFixture(planck.Box((len + 1) / 2 / SCALE, thickness / 2 / SCALE), {
        friction: groundFriction,
      });
      body.setUserData({ label: `ground-${chunk.groundType}` });
      bodies.push(body);
    }

    // Coins (sensors)
    const coinBodies = chunk.coins.map((c) => {
      const body = this.world.createBody({
        type: 'static',
        position: planck.Vec2(c.x / SCALE, c.y / SCALE),
      });
      body.createFixture(planck.Circle(COIN_RADIUS / SCALE), {
        isSensor: true,
      });
      body.setUserData({ label: 'coin' });
      return body;
    });

    // Fuel cans (sensors)
    const fuelBodies = chunk.fuelCans.map((f) => {
      const body = this.world.createBody({
        type: 'static',
        position: planck.Vec2(f.x / SCALE, f.y / SCALE),
      });
      body.createFixture(planck.Box(10 / SCALE, 12.5 / SCALE), {
        isSensor: true,
      });
      body.setUserData({ label: 'fuel' });
      return body;
    });

    // Checkpoint sensor
    let checkpointSensor: planck.Body | null = null;
    if (chunk.hasCheckpoint) {
      const midX = (chunk.startX + chunk.endX) / 2;
      const midIdx = Math.floor(pts.length / 2);
      const midY = pts[midIdx].y;
      checkpointSensor = this.world.createBody({
        type: 'static',
        position: planck.Vec2(midX / SCALE, (midY - 50) / SCALE),
      });
      checkpointSensor.createFixture(planck.Box(5 / SCALE, 50 / SCALE), {
        isSensor: true,
      });
      checkpointSensor.setUserData({ label: 'checkpoint' });
    }

    this.chunks.push({ chunk, bodies, coinBodies, fuelBodies, checkpointSensor });
    this.lastEndY = pts[pts.length - 1].y;
    this.nextIndex++;
  }

  removeCoin(body: planck.Body) {
    for (const pc of this.chunks) {
      const idx = pc.coinBodies.indexOf(body);
      if (idx >= 0) {
        pc.coinBodies.splice(idx, 1);
        pc.chunk.coins.splice(idx, 1);
        this.world.destroyBody(body);
        return;
      }
    }
  }

  removeFuel(body: planck.Body) {
    for (const pc of this.chunks) {
      const idx = pc.fuelBodies.indexOf(body);
      if (idx >= 0) {
        pc.fuelBodies.splice(idx, 1);
        pc.chunk.fuelCans.splice(idx, 1);
        this.world.destroyBody(body);
        return;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, visibleLeft: number, visibleRight: number) {
    for (const pc of this.chunks) {
      const chunk = pc.chunk;
      if (chunk.endX < visibleLeft || chunk.startX > visibleRight) continue;

      const pts = chunk.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y + 200);
      ctx.lineTo(pts[0].x, pts[0].y + 200);
      ctx.closePath();
      ctx.fillStyle = COLORS[chunk.groundType] ?? COLORS.grass;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = this.darken(COLORS[chunk.groundType] ?? COLORS.grass);
      ctx.lineWidth = 3;
      ctx.stroke();

      for (const dec of chunk.decorations) {
        this.drawDecoration(ctx, dec);
      }
      for (const coin of chunk.coins) {
        this.drawCoin(ctx, coin);
      }
      for (const fuel of chunk.fuelCans) {
        this.drawFuelCan(ctx, fuel);
      }
      if (chunk.hasCheckpoint) {
        const midX = (chunk.startX + chunk.endX) / 2;
        const midIdx = Math.floor(pts.length / 2);
        const midY = pts[midIdx].y;
        this.drawCheckpoint(ctx, midX, midY);
      }
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
    ctx.fillStyle = '#00AA00';
    ctx.fillRect(-10, -12, 20, 25);
    ctx.strokeStyle = '#006600';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -12, 20, 25);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 0, 1);
    ctx.restore();
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 80);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 80);
    ctx.lineTo(x + 30, y - 70);
    ctx.lineTo(x, y - 60);
    ctx.closePath();
    ctx.fillStyle = COLORS.checkpoint;
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x + 2, y - 78, 8, 6);
    ctx.fillRect(x + 14, y - 78, 8, 6);
    ctx.fillRect(x + 8, y - 72, 8, 6);
  }

  private drawWarning(ctx: CanvasRenderingContext2D, p: TerrainPoint) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, 0, 6, 40);
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
      case 'tree':
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-4, -35, 8, 35);
        ctx.beginPath();
        ctx.arc(0, -45, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#228B22';
        ctx.fill();
        break;
      case 'flower':
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -18, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FF69B4';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -18, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        break;
      case 'rock':
        ctx.beginPath();
        ctx.ellipse(0, -6, 12, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#999';
        ctx.fill();
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      case 'bush':
        ctx.beginPath();
        ctx.ellipse(0, -8, 15, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2E7D32';
        ctx.fill();
        break;
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
