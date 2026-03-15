import { SeededRandom } from '../utils/random';

interface Bird {
  x: number;
  y: number;
  vx: number;
  wingPhase: number;
  poopTimer: number;
  pooped: boolean;
}

interface Splat {
  x: number;
  y: number;
  time: number;
}

export class Birds {
  private birds: Bird[] = [];
  private splats: Splat[] = [];
  private spawnTimer = 0;
  private rng: SeededRandom;

  constructor(seed: number) {
    this.rng = new SeededRandom(seed + 999);
  }

  update(dt: number, cameraX: number, cameraY: number, cameraW: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.rng.range(4, 10);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      this.birds.push({
        x: dir > 0 ? cameraX - 50 : cameraX + cameraW + 50,
        y: cameraY + this.rng.range(20, 120),
        vx: dir * this.rng.range(80, 150),
        wingPhase: this.rng.range(0, Math.PI * 2),
        poopTimer: this.rng.range(1, 3),
        pooped: false,
      });
    }

    for (const bird of this.birds) {
      bird.x += bird.vx * dt;
      bird.wingPhase += dt * 8;
      bird.poopTimer -= dt;

      // Poop!
      if (bird.poopTimer <= 0 && !bird.pooped && this.rng.chance(0.3)) {
        bird.pooped = true;
        this.splats.push({
          x: bird.x,
          y: bird.y + 10,
          time: 3,
        });
      }
    }

    // Update splats (they fall then stick)
    for (const splat of this.splats) {
      if (splat.time > 2.5) {
        splat.y += 200 * dt; // falling
      }
      splat.time -= dt;
    }

    // Cleanup
    this.birds = this.birds.filter(
      (b) => b.x > cameraX - 100 && b.x < cameraX + cameraW + 100
    );
    this.splats = this.splats.filter((s) => s.time > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw birds
    for (const bird of this.birds) {
      ctx.save();
      ctx.translate(bird.x, bird.y);

      // Body
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wings
      const wingY = Math.sin(bird.wingPhase) * 6;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.quadraticCurveTo(-12, wingY - 8, -18, wingY);
      ctx.moveTo(3, 0);
      ctx.quadraticCurveTo(12, wingY - 8, 18, wingY);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(bird.vx > 0 ? 5 : -5, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(bird.vx > 0 ? 5.5 : -5.5, -2, 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw splats
    for (const splat of this.splats) {
      ctx.save();
      ctx.translate(splat.x, splat.y);
      ctx.globalAlpha = Math.min(1, splat.time);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(3, 4, 3, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
