import Matter from 'matter-js';
import type { CarDef, DriveType } from './CarDefinitions';
import type { InputState } from '../engine/InputManager';
import { BOOST_TORQUE_MULTIPLIER } from '../utils/constants';

export class Car {
  chassis: Matter.Body;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
  // One spring per wheel for vertical bounce
  frontSpring: Matter.Constraint;
  rearSpring: Matter.Constraint;
  def: CarDef;
  engineOn = true;
  boosting = false;
  private flameFlicker = 0;
  composite: Matter.Composite;

  // Chassis-local X positions of wheel attachment points
  private frontAttachX: number;
  private rearAttachX: number;

  // Driver head hitbox (for death detection)
  driver: Matter.Body;
  driverConstraint: Matter.Constraint;

  constructor(def: CarDef, x: number, y: number) {
    this.def = def;

    const hw = def.chassisWidth / 2;
    const wheelY = y + def.suspensionLength;

    this.frontAttachX = hw * 0.7;
    this.rearAttachX = -hw * 0.7;

    // Chassis
    this.chassis = Matter.Bodies.rectangle(x, y, def.chassisWidth, def.chassisHeight, {
      label: 'chassis',
      render: { fillStyle: def.color },
      density: def.mass * 0.001,
      friction: 0.5,
      collisionFilter: { group: -1 },
    });

    // Driver (small circle on top of chassis)
    this.driver = Matter.Bodies.circle(x, y - def.chassisHeight / 2 - 10, 10, {
      label: 'driver',
      density: 0.0001,
      friction: 0.5,
      render: { fillStyle: '#FFD5B4' },
      collisionFilter: { group: -1 },
    });

    this.driverConstraint = Matter.Constraint.create({
      bodyA: this.chassis,
      bodyB: this.driver,
      pointA: { x: 0, y: -def.chassisHeight / 2 - 10 },
      length: 0,
      stiffness: 0.8,
      damping: 0.1,
    });

    // Wheels
    this.frontWheel = Matter.Bodies.circle(x + this.frontAttachX, wheelY, def.wheelRadius, {
      label: 'wheel-front',
      friction: 0.9,
      density: 0.001,
      render: { fillStyle: '#333' },
      collisionFilter: { group: -1 },
    });

    this.rearWheel = Matter.Bodies.circle(x + this.rearAttachX, wheelY, def.wheelRadius, {
      label: 'wheel-rear',
      friction: 0.9,
      density: 0.001,
      render: { fillStyle: '#333' },
      collisionFilter: { group: -1 },
    });

    // One simple spring per wheel from the bottom of the chassis
    // straight down to the wheel center. This provides the bounce.
    // Lateral constraint is enforced manually in constrainWheels().
    this.frontSpring = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: this.frontAttachX, y: def.chassisHeight / 2 },
      bodyB: this.frontWheel,
      length: def.suspensionLength,
      stiffness: def.suspensionStiffness,
      damping: def.suspensionDamping,
    });

    this.rearSpring = Matter.Constraint.create({
      bodyA: this.chassis,
      pointA: { x: this.rearAttachX, y: def.chassisHeight / 2 },
      bodyB: this.rearWheel,
      length: def.suspensionLength,
      stiffness: def.suspensionStiffness,
      damping: def.suspensionDamping,
    });

    this.composite = Matter.Composite.create();
    Matter.Composite.add(this.composite, [
      this.chassis, this.frontWheel, this.rearWheel, this.driver,
      this.frontSpring, this.rearSpring,
      this.driverConstraint,
    ]);
  }

  /**
   * Call after each physics step. Constrains each wheel to move only
   * along the chassis-local vertical axis (like a slider/prismatic joint).
   * The spring constraint handles the vertical bounce; this handles lateral lockout.
   */
  constrainWheels() {
    this.constrainWheel(this.frontWheel, this.frontAttachX);
    this.constrainWheel(this.rearWheel, this.rearAttachX);
  }

  private constrainWheel(wheel: Matter.Body, attachX: number) {
    const ch = this.chassis;
    const cos = Math.cos(ch.angle);
    const sin = Math.sin(ch.angle);

    // World position of the attachment point on the chassis bottom
    const attachWorldX = ch.position.x + attachX * cos - (this.def.chassisHeight / 2) * sin;
    const attachWorldY = ch.position.y + attachX * sin + (this.def.chassisHeight / 2) * cos;

    // Vector from attachment to wheel in world coords
    const dx = wheel.position.x - attachWorldX;
    const dy = wheel.position.y - attachWorldY;

    // Project onto chassis-local axes:
    // "along" = chassis-local X (the lateral axis we want to zero out)
    // "down" = chassis-local Y (the vertical axis we want to keep)
    const along = dx * cos + dy * sin;   // lateral displacement
    // const down = -dx * sin + dy * cos; // vertical displacement (we keep this)

    // Remove the lateral component — snap wheel to directly below attachment
    if (Math.abs(along) > 0.1) {
      Matter.Body.setPosition(wheel, {
        x: wheel.position.x - along * cos,
        y: wheel.position.y - along * sin,
      });

      // Also remove lateral velocity component
      const vx = wheel.velocity.x;
      const vy = wheel.velocity.y;
      const lateralVel = vx * cos + vy * sin;
      Matter.Body.setVelocity(wheel, {
        x: vx - lateralVel * cos,
        y: vy - lateralVel * sin,
      });
    }
  }

  get position() {
    return this.chassis.position;
  }

  get angle() {
    return this.chassis.angle;
  }

  get speed() {
    return Math.sqrt(
      this.chassis.velocity.x ** 2 + this.chassis.velocity.y ** 2
    );
  }

  get isUpsideDown(): boolean {
    const angle = Math.abs(this.chassis.angle % (Math.PI * 2));
    return angle > Math.PI * 0.65 && angle < Math.PI * 1.35;
  }

  applyInput(input: InputState) {
    this.boosting = input.boost && input.gas && this.engineOn;
    if (!this.engineOn) return;

    const torque = input.boost
      ? this.def.torque * BOOST_TORQUE_MULTIPLIER
      : this.def.torque;

    if (input.gas) {
      this.applyDrive(torque);
    }
    if (input.brake) {
      this.applyDrive(-torque * 0.7);
    }

    // Lean (rotate chassis)
    if (input.leanBack) {
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: 0, y: -0.005 * this.def.mass,
      });
      Matter.Body.setAngularVelocity(
        this.chassis,
        this.chassis.angularVelocity - 0.01
      );
    }
    if (input.leanForward) {
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: 0, y: -0.003 * this.def.mass,
      });
      Matter.Body.setAngularVelocity(
        this.chassis,
        this.chassis.angularVelocity + 0.01
      );
    }

    if (input.toggleEngine) {
      this.engineOn = !this.engineOn;
    }
  }

  private applyDrive(torque: number) {
    const dt = this.def.driveType as DriveType;
    const maxAngVel = this.def.maxSpeed;

    if (dt === 'fwd' || dt === 'awd') {
      if (Math.abs(this.frontWheel.angularVelocity) < maxAngVel) {
        this.frontWheel.torque += torque;
      }
    }
    if (dt === 'rwd' || dt === 'awd') {
      if (Math.abs(this.rearWheel.angularVelocity) < maxAngVel) {
        this.rearWheel.torque += torque;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw suspension struts first (behind everything)
    this.drawStrut(ctx, this.frontWheel, this.frontAttachX);
    this.drawStrut(ctx, this.rearWheel, this.rearAttachX);

    // Draw chassis
    const ch = this.chassis;
    ctx.save();
    ctx.translate(ch.position.x, ch.position.y);
    ctx.rotate(ch.angle);

    // Main body
    ctx.fillStyle = this.def.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const w = this.def.chassisWidth;
    const h = this.def.chassisHeight;
    this.roundRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Cabin (top part)
    ctx.fillStyle = this.adjustColor(this.def.color, -20);
    const cabW = w * 0.5;
    const cabH = h * 0.8;
    this.roundRect(ctx, -cabW / 2 + 5, -h / 2 - cabH, cabW, cabH, 4);
    ctx.fill();
    ctx.stroke();

    // Window
    ctx.fillStyle = '#B3E5FC';
    const winW = cabW * 0.7;
    const winH = cabH * 0.6;
    this.roundRect(ctx, -winW / 2 + 5, -h / 2 - cabH + 4, winW, winH, 3);
    ctx.fill();

    // Boost flame (drawn in chassis-local coords)
    if (this.boosting) {
      this.flameFlicker += 0.3;
      const flicker1 = Math.sin(this.flameFlicker * 7) * 0.3 + 0.7;
      const flicker2 = Math.cos(this.flameFlicker * 11) * 0.2 + 0.8;

      const flameX = -w / 2 - 5;
      const flameY = 0;
      const flameLen = 20 + flicker1 * 15;
      const flameW = h * 0.6;

      // Outer flame (orange/red)
      ctx.beginPath();
      ctx.moveTo(flameX, flameY - flameW / 2);
      ctx.quadraticCurveTo(
        flameX - flameLen * 0.6, flameY - flameW * 0.3 * flicker2,
        flameX - flameLen, flameY
      );
      ctx.quadraticCurveTo(
        flameX - flameLen * 0.6, flameY + flameW * 0.3 * flicker1,
        flameX, flameY + flameW / 2
      );
      ctx.closePath();
      ctx.fillStyle = '#FF4400';
      ctx.fill();

      // Inner flame (yellow)
      const innerLen = flameLen * 0.6;
      const innerW = flameW * 0.5;
      ctx.beginPath();
      ctx.moveTo(flameX, flameY - innerW / 2);
      ctx.quadraticCurveTo(
        flameX - innerLen * 0.5, flameY - innerW * 0.2 * flicker1,
        flameX - innerLen, flameY
      );
      ctx.quadraticCurveTo(
        flameX - innerLen * 0.5, flameY + innerW * 0.2 * flicker2,
        flameX, flameY + innerW / 2
      );
      ctx.closePath();
      ctx.fillStyle = '#FFDD00';
      ctx.fill();

      // Core (white-hot)
      const coreLen = innerLen * 0.4;
      const coreW = innerW * 0.4;
      ctx.beginPath();
      ctx.moveTo(flameX, flameY - coreW / 2);
      ctx.quadraticCurveTo(flameX - coreLen * 0.5, flameY, flameX - coreLen, flameY);
      ctx.quadraticCurveTo(flameX - coreLen * 0.5, flameY, flameX, flameY + coreW / 2);
      ctx.closePath();
      ctx.fillStyle = '#FFFFCC';
      ctx.fill();
    }

    ctx.restore();

    // Draw driver head
    const d = this.driver;
    ctx.save();
    ctx.translate(d.position.x, d.position.y);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD5B4';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(3, -2, 2, 0, Math.PI * 2);
    ctx.arc(-3, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.beginPath();
    ctx.arc(0, 1, 4, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Draw wheels
    this.drawWheel(ctx, this.frontWheel, this.def.wheelRadius);
    this.drawWheel(ctx, this.rearWheel, this.def.wheelRadius);
  }

  private drawStrut(ctx: CanvasRenderingContext2D, wheel: Matter.Body, attachX: number) {
    const ch = this.chassis;
    const cos = Math.cos(ch.angle);
    const sin = Math.sin(ch.angle);

    // Attachment point on chassis bottom
    const ax = ch.position.x + attachX * cos - (this.def.chassisHeight / 2) * sin;
    const ay = ch.position.y + attachX * sin + (this.def.chassisHeight / 2) * cos;

    // Draw a spring zigzag from attachment to wheel
    const wx = wheel.position.x;
    const wy = wheel.position.y;
    const dx = wx - ax;
    const dy = wy - ay;
    const steps = 6;
    const amp = 4;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = ax + dx * t + (i % 2 === 0 ? -amp : amp);
      const py = ay + dy * t;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(wx, wy);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pivot circles
    ctx.beginPath();
    ctx.arc(ax, ay, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#666';
    ctx.fill();
  }

  private drawWheel(ctx: CanvasRenderingContext2D, wheel: Matter.Body, radius: number) {
    ctx.save();
    ctx.translate(wheel.position.x, wheel.position.y);
    ctx.rotate(wheel.angle);

    // Tire
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
