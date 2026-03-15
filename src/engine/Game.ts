import * as planck from 'planck';
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
import { GROUND_Y, GRAVITY, COLORS, SCALE } from '../utils/constants';
import { saveScore } from '../ui/Scores';

function getLabel(body: planck.Body): string {
  const ud = body.getUserData() as { label?: string } | null;
  return ud?.label ?? '';
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  world!: planck.World;
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
  private wheelsOnGround = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.seed = Math.floor(Math.random() * 999999);

    this.camera = new Camera(canvas.width, canvas.height);
    this.input = new InputManager();
    this.recorder = new Recorder();
    this.state = new GameState();
    this.particles = new Particles();
    this.hud = new HUD();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Click/tap handling for HUD buttons
    const handleClick = (x: number, y: number) => {
      if (!this.running) return;
      if (this.hitRect(x, y, this.hud.menuButtonRect)) {
        this.goToMenu();
        return;
      }
      if (this.state.gameOver) {
        if (this.hitRect(x, y, this.hud.restartButtonRect)) {
          this.state.gameOver = false;
          this.state.dead = false;
          this.reset();
          return;
        }
        if (this.hitRect(x, y, this.hud.menuButtonGameOverRect)) {
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
    if (this.onMenu) this.onMenu();
  }

  reset() {
    // Create new physics world
    this.world = new planck.World({
      gravity: planck.Vec2(0, GRAVITY),
    });

    // Set up contact listener
    this.world.on('begin-contact', (contact) => this.onContact(contact));

    const startX = 100;
    const startY = GROUND_Y - 80;

    // Create car
    const def = CAR_DEFS[this.carKey];
    this.car = new Car(def, this.world, startX, startY);

    // Create terrain and pre-generate initial chunks
    this.terrain = new TerrainManager(this.world, this.seed);
    this.terrain.update(startX);
    this.birds = new Birds(this.seed);

    this.state.reset(startX, startY);
    this.recorder.reset();
    this.respawnTimer = 0;
    this.airTime = 0;
    this.lastMilestone = 0;

    this.camera.x = startX - this.camera.width * 0.35;
    this.camera.y = startY - this.camera.height * 0.5;
  }

  private accumulator = 0;
  private readonly PHYSICS_DT = 1 / 60;

  private loop = (time: number) => {
    if (!this.running) return;

    const rawDt = (time - this.lastTime) / 1000;
    const dt = Math.min(rawDt, 1 / 15);
    this.lastTime = time;

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

    if (this.state.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      this.world.step(dt);
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

    this.car.engineOn = this.state.engineOn;
    if (input.toggleEngine) {
      this.state.engineOn = !this.state.engineOn;
      this.car.engineOn = this.state.engineOn;
    }
    if (input.reset) {
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

    // Out of fuel and stopped
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

    // Physics step
    this.world.step(dt);

    this.state.updateDistance(this.car.position.x);

    // Milestones
    const milestone = Math.floor(this.state.distance / 500) * 500;
    if (milestone > this.lastMilestone && milestone > 0) {
      this.lastMilestone = milestone;
      this.particles.confetti(this.car.position.x, this.car.position.y - 50);
      this.state.addPopup(`${milestone}m!`, this.car.position.x, this.car.position.y - 80, '#FF00FF');
    }

    // Air time
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

    // Upside down check
    if (this.car.isUpsideDown) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1.5;
    }

    // Fell off world
    if (this.car.position.y > GROUND_Y + 500) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1;
    }

    // Dust
    if (this.wheelsOnGround && this.car.speed > 2) {
      const rwPos = this.car.rearWheel.getPosition();
      this.particles.dust(
        rwPos.x * SCALE,
        rwPos.y * SCALE + this.car.def.wheelRadius,
        '#B8A080'
      );
    }

    this.terrain.update(this.car.position.x);
    this.camera.follow(this.car.position.x, this.car.position.y);
    this.camera.update(dt);
    this.birds.update(dt, this.camera.x, this.camera.y, this.camera.width);
    this.particles.update(dt);
    this.state.updatePopups(dt);
  }

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLORS.sky);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.drawClouds(ctx, w, h);

    this.camera.applyTransform(ctx);

    const bounds = this.camera.visibleBounds;
    this.terrain.draw(ctx, bounds.left, bounds.right);
    this.car.draw(ctx);
    this.birds.draw(ctx);
    this.particles.draw(ctx);
    this.hud.drawPopups(ctx, this.state);

    this.camera.restore(ctx);

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

  private onContact(contact: planck.Contact) {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();
    const labelA = getLabel(bodyA);
    const labelB = getLabel(bodyB);

    // Wheel on ground tracking
    if (
      (labelA.startsWith('wheel') && labelB.startsWith('ground')) ||
      (labelB.startsWith('wheel') && labelA.startsWith('ground'))
    ) {
      this.wheelsOnGround = true;
    }

    // Coin collection
    if (labelA === 'coin' || labelB === 'coin') {
      const coinBody = labelA === 'coin' ? bodyA : bodyB;
      const otherLabel = labelA === 'coin' ? labelB : labelA;
      if (otherLabel.startsWith('wheel') || otherLabel === 'chassis') {
        const p = coinBody.getPosition();
        this.terrain.removeCoin(coinBody);
        this.state.collectCoin(p.x * SCALE, p.y * SCALE);
        this.particles.emit(p.x * SCALE, p.y * SCALE, 8, '#FFD700');
      }
    }

    // Fuel collection
    if (labelA === 'fuel' || labelB === 'fuel') {
      const fuelBody = labelA === 'fuel' ? bodyA : bodyB;
      const otherLabel = labelA === 'fuel' ? labelB : labelA;
      if (otherLabel.startsWith('wheel') || otherLabel === 'chassis') {
        const p = fuelBody.getPosition();
        this.terrain.removeFuel(fuelBody);
        this.state.collectFuel(p.x * SCALE, p.y * SCALE);
        this.particles.emit(p.x * SCALE, p.y * SCALE, 6, '#00CC00');
      }
    }

    // Checkpoint
    if (labelA === 'checkpoint' || labelB === 'checkpoint') {
      const cpBody = labelA === 'checkpoint' ? bodyA : bodyB;
      const otherLabel = labelA === 'checkpoint' ? labelB : labelA;
      if (otherLabel.startsWith('wheel') || otherLabel === 'chassis') {
        const p = cpBody.getPosition();
        this.state.hitCheckpoint(p.x * SCALE, p.y * SCALE);
        this.particles.confetti(p.x * SCALE, p.y * SCALE - 50);
      }
    }

    // Driver head hitting ground
    if (
      (labelA === 'driver' && labelB.startsWith('ground')) ||
      (labelB === 'driver' && labelA.startsWith('ground'))
    ) {
      this.state.die(this.car.position.x, this.car.position.y);
      this.respawnTimer = 1.5;
    }
  }

  private respawn() {
    this.state.dead = false;

    if (!this.state.lastCheckpoint) {
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

    // Destroy old car bodies
    this.world.destroyBody(this.car.chassis);
    this.world.destroyBody(this.car.frontWheel);
    this.world.destroyBody(this.car.rearWheel);
    this.world.destroyBody(this.car.driver);

    // Create new car at checkpoint
    this.car = new Car(CAR_DEFS[this.carKey], this.world, cp.x, cp.y - 80);

    this.state.fuel = cp.fuel;
    this.state.engineOn = true;
    this.car.engineOn = true;

    this.camera.x = cp.x - this.camera.width * 0.35;
    this.camera.y = cp.y - 80 - this.camera.height * 0.5;
  }

  private hitRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
