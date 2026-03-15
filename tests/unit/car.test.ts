import { describe, it, expect } from 'vitest';
import * as planck from 'planck';
import { Car } from '../../src/entities/Car';
import { CAR_DEFS } from '../../src/entities/CarDefinitions';
import { GRAVITY } from '../../src/utils/constants';

function makeWorld() {
  return new planck.World({ gravity: planck.Vec2(0, GRAVITY) });
}

describe('Car', () => {
  it('creates all body parts', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.wagon, world, 100, 300);
    expect(car.chassis).toBeDefined();
    expect(car.frontWheel).toBeDefined();
    expect(car.rearWheel).toBeDefined();
    expect(car.driver).toBeDefined();
  });

  it('position returns pixel coordinates', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.sports, world, 200, 400);
    expect(car.position.x).toBeCloseTo(200, 0);
    expect(car.position.y).toBeCloseTo(400, 0);
  });

  it('all car definitions create valid cars', () => {
    for (const [_key, def] of Object.entries(CAR_DEFS)) {
      const world = makeWorld();
      const car = new Car(def, world, 100, 300);
      expect(car.def.name).toBe(def.name);
      expect(car.engineOn).toBe(true);
    }
  });

  it('detects upside down state', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.wagon, world, 100, 300);
    expect(car.isUpsideDown).toBe(false);
    car.chassis.setAngle(Math.PI);
    expect(car.isUpsideDown).toBe(true);
  });

  it('wheel joints have motor capability', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.wagon, world, 100, 300);
    // WheelJoint should support motors
    car.frontJoint.setMotorSpeed(5);
    expect(car.frontJoint.getMotorSpeed()).toBe(5);
    car.frontJoint.setMotorSpeed(0);
  });

  it('does not apply motor when engine is off', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.wagon, world, 100, 300);
    car.engineOn = false;
    car.applyInput({
      gas: true, brake: false, leanForward: false,
      leanBack: false, boost: false, toggleEngine: false, reset: false, menu: false,
    });
    expect(car.frontJoint.getMotorSpeed()).toBe(0);
    expect(car.rearJoint.getMotorSpeed()).toBe(0);
  });

  it('physics simulation runs with car on ground', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.jeep, world, 100, 100);

    // Add a floor
    const floor = world.createBody({ type: 'static', position: planck.Vec2(400 / 30, 500 / 30) });
    floor.createFixture(planck.Box(800 / 30, 25 / 30));

    const startY = car.position.y;
    for (let i = 0; i < 60; i++) {
      world.step(1 / 60);
    }

    // Car should have fallen due to gravity
    expect(car.position.y).toBeGreaterThan(startY);
  });

  it('WheelJoint constrains wheel to vertical axis', () => {
    const world = makeWorld();
    const car = new Car(CAR_DEFS.wagon, world, 100, 100);

    // Add a floor
    const floor = world.createBody({ type: 'static', position: planck.Vec2(100 / 30, 500 / 30) });
    floor.createFixture(planck.Box(800 / 30, 25 / 30));

    // Run physics
    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
    }

    // Front wheel should be approximately below its chassis attachment point
    // (not drifted laterally like with Matter.js distance constraints)
    const chassisPos = car.chassis.getPosition();
    const frontPos = car.frontWheel.getPosition();
    const hw = (car.def.chassisWidth / 2) / 30;
    const expectedX = chassisPos.x + hw * 0.7 * Math.cos(car.chassis.getAngle());

    // Should be within a small tolerance
    expect(Math.abs(frontPos.x - expectedX)).toBeLessThan(0.5);
  });
});
