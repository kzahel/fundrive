import * as planck from 'planck';
import type { CarDef, DriveType } from './CarDefinitions';
import type { InputState } from '../engine/InputManager';
import { SCALE, BOOST_TORQUE_MULTIPLIER } from '../utils/constants';

export class Car {
  chassis: planck.Body;
  frontWheel: planck.Body;
  rearWheel: planck.Body;
  frontJoint: planck.WheelJoint;
  rearJoint: planck.WheelJoint;
  driver: planck.Body;
  driverJoint: planck.Joint;
  def: CarDef;
  engineOn = true;
  boosting = false;
  private flameFlicker = 0;

  constructor(def: CarDef, world: planck.World, px: number, py: number) {
    this.def = def;

    // Convert pixel positions to meters
    const x = px / SCALE;
    const y = py / SCALE;
    const hw = (def.chassisWidth / 2) / SCALE;
    const hh = (def.chassisHeight / 2) / SCALE;
    const wheelR = def.wheelRadius / SCALE;
    const suspLen = def.suspensionLength / SCALE;

    // Chassis
    this.chassis = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
    });
    this.chassis.createFixture(planck.Box(hw, hh), {
      density: def.mass * 2,
      friction: 0.5,
      filterGroupIndex: -1,
    });
    this.chassis.setUserData({ label: 'chassis' });

    // Driver (small circle on top)
    this.driver = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y - hh - 10 / SCALE),
    });
    this.driver.createFixture(planck.Circle(10 / SCALE), {
      density: 0.1,
      friction: 0.5,
      filterGroupIndex: -1,
    });
    this.driver.setUserData({ label: 'driver' });

    // Pin driver to chassis
    this.driverJoint = world.createJoint(planck.WeldJoint({}, this.chassis, this.driver,
      this.driver.getPosition()
    ))!;

    // Front wheel
    const frontX = x + hw * 0.7;
    const wheelY = y + hh + suspLen;

    this.frontWheel = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(frontX, wheelY),
    });
    this.frontWheel.createFixture(planck.Circle(wheelR), {
      density: 1.0,
      friction: 0.9,
      filterGroupIndex: -1,
    });
    this.frontWheel.setUserData({ label: 'wheel-front' });

    // Rear wheel
    const rearX = x - hw * 0.7;

    this.rearWheel = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(rearX, wheelY),
    });
    this.rearWheel.createFixture(planck.Circle(wheelR), {
      density: 1.0,
      friction: 0.9,
      filterGroupIndex: -1,
    });
    this.rearWheel.setUserData({ label: 'wheel-rear' });

    // WheelJoint: spring + prismatic on one axis. Axis Vec2(0,1) = vertical.
    this.frontJoint = world.createJoint(planck.WheelJoint({
      motorSpeed: 0,
      maxMotorTorque: 20,
      enableMotor: true,
      frequencyHz: def.suspensionStiffness,
      dampingRatio: def.suspensionDamping,
    }, this.chassis, this.frontWheel, this.frontWheel.getPosition(),
      planck.Vec2(0, 1)
    ))! as planck.WheelJoint;

    this.rearJoint = world.createJoint(planck.WheelJoint({
      motorSpeed: 0,
      maxMotorTorque: 20,
      enableMotor: true,
      frequencyHz: def.suspensionStiffness,
      dampingRatio: def.suspensionDamping,
    }, this.chassis, this.rearWheel, this.rearWheel.getPosition(),
      planck.Vec2(0, 1)
    ))! as planck.WheelJoint;
  }

  /** Position in pixels */
  get position() {
    const p = this.chassis.getPosition();
    return { x: p.x * SCALE, y: p.y * SCALE };
  }

  get angle() {
    return this.chassis.getAngle();
  }

  get speed() {
    const v = this.chassis.getLinearVelocity();
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  get isUpsideDown(): boolean {
    const angle = Math.abs(this.chassis.getAngle() % (Math.PI * 2));
    return angle > Math.PI * 0.65 && angle < Math.PI * 1.35;
  }

  applyInput(input: InputState) {
    this.boosting = input.boost && input.gas && this.engineOn;
    if (!this.engineOn) {
      this.frontJoint.setMotorSpeed(0);
      this.rearJoint.setMotorSpeed(0);
      return;
    }

    const speed = this.def.maxSpeed * (input.boost ? BOOST_TORQUE_MULTIPLIER : 1);
    const torque = this.def.torque * 2000 * (input.boost ? BOOST_TORQUE_MULTIPLIER : 1);
    const dt = this.def.driveType as DriveType;

    let motorSpeed = 0;
    if (input.gas) motorSpeed = speed;
    if (input.brake) motorSpeed = -speed * 0.7;

    // Apply motor to driven wheels
    if (dt === 'fwd' || dt === 'awd') {
      this.frontJoint.setMotorSpeed(motorSpeed);
      this.frontJoint.setMaxMotorTorque(torque);
    } else {
      this.frontJoint.setMotorSpeed(0);
    }

    if (dt === 'rwd' || dt === 'awd') {
      this.rearJoint.setMotorSpeed(motorSpeed);
      this.rearJoint.setMaxMotorTorque(torque);
    } else {
      this.rearJoint.setMotorSpeed(0);
    }

    // Lean (rotate chassis via torque)
    if (input.leanBack) {
      this.chassis.applyTorque(-this.def.mass * 80);
    }
    if (input.leanForward) {
      this.chassis.applyTorque(this.def.mass * 60);
    }

    if (input.toggleEngine) {
      this.engineOn = !this.engineOn;
    }
  }

  // Helper to get pixel position of a body
  private bodyPx(body: planck.Body) {
    const p = body.getPosition();
    return { x: p.x * SCALE, y: p.y * SCALE };
  }

  draw(ctx: CanvasRenderingContext2D) {
    const chPos = this.bodyPx(this.chassis);
    const chAngle = this.chassis.getAngle();
    const fwPos = this.bodyPx(this.frontWheel);
    const rwPos = this.bodyPx(this.rearWheel);

    // Draw suspension struts first (behind everything)
    this.drawStrut(ctx, chPos, chAngle, fwPos);
    this.drawStrut(ctx, chPos, chAngle, rwPos);

    // Draw chassis
    ctx.save();
    ctx.translate(chPos.x, chPos.y);
    ctx.rotate(chAngle);

    const w = this.def.chassisWidth;
    const h = this.def.chassisHeight;

    // Main body
    ctx.fillStyle = this.def.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    this.roundRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Cabin
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

    // Boost flame
    if (this.boosting) {
      this.flameFlicker += 0.3;
      const flicker1 = Math.sin(this.flameFlicker * 7) * 0.3 + 0.7;
      const flicker2 = Math.cos(this.flameFlicker * 11) * 0.2 + 0.8;

      const flameX = -w / 2 - 5;
      const flameY = 0;
      const flameLen = 20 + flicker1 * 15;
      const flameW = h * 0.6;

      ctx.beginPath();
      ctx.moveTo(flameX, flameY - flameW / 2);
      ctx.quadraticCurveTo(flameX - flameLen * 0.6, flameY - flameW * 0.3 * flicker2, flameX - flameLen, flameY);
      ctx.quadraticCurveTo(flameX - flameLen * 0.6, flameY + flameW * 0.3 * flicker1, flameX, flameY + flameW / 2);
      ctx.closePath();
      ctx.fillStyle = '#FF4400';
      ctx.fill();

      const innerLen = flameLen * 0.6;
      const innerW = flameW * 0.5;
      ctx.beginPath();
      ctx.moveTo(flameX, flameY - innerW / 2);
      ctx.quadraticCurveTo(flameX - innerLen * 0.5, flameY - innerW * 0.2 * flicker1, flameX - innerLen, flameY);
      ctx.quadraticCurveTo(flameX - innerLen * 0.5, flameY + innerW * 0.2 * flicker2, flameX, flameY + innerW / 2);
      ctx.closePath();
      ctx.fillStyle = '#FFDD00';
      ctx.fill();

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

    // Driver head
    const dPos = this.bodyPx(this.driver);
    ctx.save();
    ctx.translate(dPos.x, dPos.y);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD5B4';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(3, -2, 2, 0, Math.PI * 2);
    ctx.arc(-3, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 1, 4, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Wheels
    this.drawWheel(ctx, fwPos, this.frontWheel.getAngle(), this.def.wheelRadius);
    this.drawWheel(ctx, rwPos, this.rearWheel.getAngle(), this.def.wheelRadius);
  }

  private drawStrut(
    ctx: CanvasRenderingContext2D,
    chPos: { x: number; y: number },
    chAngle: number,
    wheelPos: { x: number; y: number }
  ) {
    const cos = Math.cos(chAngle);
    const sin = Math.sin(chAngle);

    // Start from bottom of chassis (approximate)
    const offsetY = this.def.chassisHeight / 2;
    const ax = chPos.x - offsetY * sin;
    const ay = chPos.y + offsetY * cos;

    // Zigzag spring visual
    const dx = wheelPos.x - ax;
    const dy = wheelPos.y - ay;
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
    ctx.lineTo(wheelPos.x, wheelPos.y);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ax, ay, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#666';
    ctx.fill();
  }

  private drawWheel(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, angle: number, radius: number) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();

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

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
