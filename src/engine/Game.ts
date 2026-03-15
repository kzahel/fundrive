import Matter from 'matter-js';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { Recorder } from './Recorder';
import { Car } from '../entities/Car';
import { CAR_DEFS } from '../entities/CarDefinitions';
import { TerrainManager } from '../terrain/TerrainManager';
import { GameState } from '../gameplay/GameState';
import { Birds } from '../gameplay/Birds';
import { Particles } from '../gameplay/Particles';
import { HUD } from '../ui/HUD';
import { GROUND_Y, GRAVITY, COLORS } from '../utils/constants';
import { saveScore } from '../ui/Scores';

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  engine: Matter.Engine;
  camera: Camera;
  input: InputManager;
  recorder: Recorder;
  terrain!: TerrainManager;
  car!: Car;
  state: GameState;
  birds!: Birds;
  particles: Particles;
  hud: HUD;

  seed: number;
  carKey = 'wagon';
  running = false;
  onMenu: (() => void) | null = null;
  private lastTime = 0;
  private respawnTimer = 0;
  private airTime = 0;
  private lastMilestone = 0;
  // Track if any wheel is on ground
  private wheelsOnGround = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.seed = Math.floor(Math.random() * 999999);

    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: GRAVITY, scale: 0.001 },
    });

    this.camera = new Camera(canvas.width, canvas.height);
    this.input = new InputManager();
    this.recorder = new Recorder();
    this.state = new GameState();
    this.particles = new Particles();
    this.hud = new HUD();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Collision detection
    Matter.Events.on(this.engine, 'collisionStart', (e) => this.onCollision(e));
    Matter.Events.on(this.engine, 'collisionActive', (e) => this.onCollisionActive(e));

    // Click/tap handling for HUD buttons
    const handleClick = (x: number, y: number) => {
      if (!this.running) return;
      const hb = this.hud;

      // Menu button during gameplay
      if (this.hitRect(x, y, hb.menuButtonRect)) {
        this.goToMenu();
        return;
      }

      // Game over buttons
      if (this.state.gameOver) {
        if (this.hitRect(x, y, hb.restartButtonRect)) {
          this.state.gameOver = false;
          this.state.dead = false;
          this.reset();
          return;
        }
        if (this.hitRect(x, y, hb.menuButtonGameOverRect)) {
          this.goToMenu();
          return;
        }
      }
    };

    canvas.addEventListener('click', (e) => handleClick(e.offsetX, e.offsetY));
    canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const t = e.changedTouches[0];
        handleClick(t.clientX - rect.left, t.clientY - rect.top);
      }
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.width = this.canvas.width;
    this.camera.height = this.canvas.height;
  }

  startGame(carKey: string) {
    this.carKey = carKey;
    this.seed = Math.floor(Math.random() * 999999);
    this.reset();
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  goToMenu() {
    this.running = false;
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    if (this.onMenu) this.onMenu();
  }

  reset() {
    // Clear physics world
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.engine.gravity.y = GRAVITY;

    const startX = 100;
    const startY = GROUND_Y - 80;

    // Create car
    const def = CAR_DEFS[this.carKey];
    this.car = new Car(def, startX, startY);
    Matter.Composite.add(this.engine.world, this.car.composite);

    // Create terrain and pre-generate initial chunks
    this.terrain = new TerrainManager(this.engine.world, this.seed);
    this.terrain.update(startX);
    this.birds = new Birds(this.seed);

    // Reset game state
    this.state.reset(startX, startY);
    this.recorder.reset();
    this.respawnTimer = 0;
    this.airTime = 0;
    this.lastMilestone = 0;

    // Initial camera position
    this.camera.x = startX - this.camera.width * 0.35;
    this.camera.y = startY - this.camera.height * 0.5;
  }

  private accumulator = 0;
  private readonly PHYSICS_DT = 1 / 60;

  private loop = (time: number) => {
    if (!this.running) return;

    const rawDt = (time - this.lastTime) / 1000;
    // Cap dt to prevent spiral of death
    const dt = Math.min(rawDt, 1 / 15);
    this.lastTime = time;

    // Fixed timestep accumulator for frame-rate independent physics
    this.accumulator += dt;
    while (this.accumulator >= this.PHYSICS_DT) {
      this.update(this.PHYSICS_DT);
      this.accumulator -= this.PHYSICS_DT;
    }

    this.render();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state.gameOver) {
      const input = this.input.getState();
      if (input.menu) {
        this.goToMenu();
        return;
      }
      if (input.toggleEngine || input.gas) {
        this.state.gameOver = false;
        this.state.dead = false;
        this.reset();
      }
      return;
    }

    // Handle respawn timer
    if (this.state.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      // Still update physics while dead (briefly)
      Matter.Engine.update(this.engine, dt * 1000);
      this.camera.follow(this.car.position.x, this.car.position.y);
      this.camera.update(dt);
      this.state.updatePopups(dt);
      this.particles.update(dt);
      return;
    }

    const input = this.input.getState();
    if (input.menu) {
      this.goToMenu();
      return;
    }
    this.recorder.record(input);

    // Apply car input
    this.car.engineOn = this.state.engineOn;
    if (input.toggleEngine) {
      this.state.engineOn = !this.state.engineOn;
      this.car.engineOn = this.state.engineOn;
    }
    if (input.reset) {
      this.respawnTimer = 0;
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1;
      return;
    }

    this.car.applyInput(input);

    // Fuel
    if (this.state.engineOn && (input.gas || input.brake)) {
      this.state.drainFuel(dt, input.boost);
    }
    this.car.engineOn = this.state.engineOn;

    // Check if out of fuel and stopped
    if (this.state.fuel <= 0 && this.car.speed < 0.5) {
      this.state.gameOver = true;
      saveScore({
        distance: this.state.distance,
        coins: this.state.coins,
        score: this.state.score,
        car: this.carKey,
        seed: this.seed,
        date: new Date().toISOString(),
      });
    }

    // Physics
    Matter.Engine.update(this.engine, dt * 1000);

    // Update distance
    this.state.updateDistance(this.car.position.x);

    // Milestones
    const milestone = Math.floor(this.state.distance / 500) * 500;
    if (milestone > this.lastMilestone && milestone > 0) {
      this.lastMilestone = milestone;
      this.particles.confetti(this.car.position.x, this.car.position.y - 50);
      this.state.addPopup(`${milestone}m!`, this.car.position.x, this.car.position.y - 80, '#FF00FF');
    }

    // Air time detection
    if (!this.wheelsOnGround) {
      this.airTime += dt;
    } else {
      if (this.airTime > 0.8) {
        this.state.addPopup(
          this.airTime > 2 ? 'HUGE AIR!' : 'NICE JUMP!',
          this.car.position.x, this.car.position.y - 60,
          '#00DDFF'
        );
        this.particles.emit(this.car.position.x, this.car.position.y, 10, '#FFD700');
      }
      this.airTime = 0;
    }
    this.wheelsOnGround = false;

    // Death check — driver head touches ground
    if (this.car.isUpsideDown) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1.5;
    }

    // Fell off the world
    if (this.car.position.y > GROUND_Y + 500) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1;
    }

    // Dust particles when driving on ground
    if (this.wheelsOnGround && this.car.speed > 2) {
      this.particles.dust(
        this.car.rearWheel.position.x,
        this.car.rearWheel.position.y + this.car.def.wheelRadius,
        '#B8A080'
      );
    }

    // Update systems
    this.terrain.update(this.car.position.x);
    this.camera.follow(this.car.position.x, this.car.position.y);
    this.camera.update(dt);
    this.birds.update(
      dt,
      this.camera.x,
      this.camera.y,
      this.camera.width
    );
    this.particles.update(dt);
    this.state.updatePopups(dt);
  }

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLORS.sky);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Background clouds (parallax)
    this.drawClouds(ctx, w, h);

    // World-space rendering
    this.camera.applyTransform(ctx);

    const bounds = this.camera.visibleBounds;
    this.terrain.draw(ctx, bounds.left, bounds.right);
    this.car.draw(ctx);
    this.birds.draw(ctx);
    this.particles.draw(ctx);
    this.hud.drawPopups(ctx, this.state);

    this.camera.restore(ctx);

    // Screen-space UI
    this.hud.draw(ctx, this.state, w, h);

    if (this.state.dead && !this.state.gameOver) {
      this.hud.drawDead(ctx, w, h);
    }
    if (this.state.gameOver) {
      this.hud.drawGameOver(ctx, this.state, w, h);
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const parallax = this.camera.x * 0.1;
    for (let i = 0; i < 8; i++) {
      const cx = (i * 250 + 100 - parallax) % (w + 200) - 100;
      const cy = 40 + (i * 37) % 100;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 50 + (i * 13) % 30, 20 + (i * 7) % 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 30, cy - 5, 35, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private onCollision(event: Matter.IEventCollision<Matter.Engine>) {
    for (const pair of event.pairs) {
      this.handleCollisionPair(pair.bodyA, pair.bodyB);
    }
  }

  private onCollisionActive(event: Matter.IEventCollision<Matter.Engine>) {
    for (const pair of event.pairs) {
      // Track wheels on ground
      const a = pair.bodyA.label;
      const b = pair.bodyB.label;
      if (
        (a.startsWith('wheel') && b.startsWith('ground')) ||
        (b.startsWith('wheel') && a.startsWith('ground'))
      ) {
        this.wheelsOnGround = true;
      }
    }
  }

  private handleCollisionPair(a: Matter.Body, b: Matter.Body) {
    // Coin collection
    if (a.label === 'coin' || b.label === 'coin') {
      const coin = a.label === 'coin' ? a : b;
      const other = a.label === 'coin' ? b : a;
      if (other.label.startsWith('wheel') || other.label === 'chassis') {
        this.terrain.removeCoin(coin);
        this.state.collectCoin(coin.position.x, coin.position.y);
        this.particles.emit(coin.position.x, coin.position.y, 8, '#FFD700');
      }
    }

    // Fuel collection
    if (a.label === 'fuel' || b.label === 'fuel') {
      const fuel = a.label === 'fuel' ? a : b;
      const other = a.label === 'fuel' ? b : a;
      if (other.label.startsWith('wheel') || other.label === 'chassis') {
        this.terrain.removeFuel(fuel);
        this.state.collectFuel(fuel.position.x, fuel.position.y);
        this.particles.emit(fuel.position.x, fuel.position.y, 6, '#00CC00');
      }
    }

    // Checkpoint
    if (a.label === 'checkpoint' || b.label === 'checkpoint') {
      const cp = a.label === 'checkpoint' ? a : b;
      const other = a.label === 'checkpoint' ? b : a;
      if (other.label.startsWith('wheel') || other.label === 'chassis') {
        this.state.hitCheckpoint(cp.position.x, cp.position.y);
        this.particles.confetti(cp.position.x, cp.position.y - 50);
      }
    }

    // Driver head hitting ground = death
    if (
      (a.label === 'driver' && b.label.startsWith('ground')) ||
      (b.label === 'driver' && a.label.startsWith('ground'))
    ) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1.5;
    }
  }

  private respawn() {
    this.state.dead = false;

    if (!this.state.lastCheckpoint) {
      // No checkpoint — game over
      this.state.gameOver = true;
      saveScore({
        distance: this.state.distance,
        coins: this.state.coins,
        score: this.state.score,
        car: this.carKey,
        seed: this.seed,
        date: new Date().toISOString(),
      });
      return;
    }

    const cp = this.state.lastCheckpoint;

    // Remove old car
    Matter.Composite.remove(this.engine.world, this.car.composite);

    // Create new car at checkpoint
    this.car = new Car(CAR_DEFS[this.carKey], cp.x, cp.y - 80);
    Matter.Composite.add(this.engine.world, this.car.composite);

    this.state.fuel = cp.fuel;
    this.state.engineOn = true;
    this.car.engineOn = true;

    // Snap camera
    this.camera.x = cp.x - this.camera.width * 0.35;
    this.camera.y = cp.y - 80 - this.camera.height * 0.5;
  }

  private hitRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
