import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { Car } from '../../src/entities/Car';
import { CAR_DEFS } from '../../src/entities/CarDefinitions';

describe('Car', () => {
  it('creates all body parts', () => {
    const car = new Car(CAR_DEFS.wagon, 100, 300);
    expect(car.chassis).toBeDefined();
    expect(car.frontWheel).toBeDefined();
    expect(car.rearWheel).toBeDefined();
    expect(car.driver).toBeDefined();
  });

  it('composite contains all bodies and constraints', () => {
    const car = new Car(CAR_DEFS.monster, 100, 300);
    const bodies = Matter.Composite.allBodies(car.composite);
    expect(bodies.length).toBe(4); // chassis, front wheel, rear wheel, driver
    const constraints = Matter.Composite.allConstraints(car.composite);
    // front spring, rear spring, front strut, rear strut, driver
    expect(constraints.length).toBe(5);
  });

  it('position returns chassis position', () => {
    const car = new Car(CAR_DEFS.sports, 200, 400);
    expect(car.position.x).toBe(200);
    expect(car.position.y).toBe(400);
  });

  it('all car definitions create valid cars', () => {
    for (const [key, def] of Object.entries(CAR_DEFS)) {
      const car = new Car(def, 0, 0);
      expect(car.def.name).toBe(def.name);
      expect(car.engineOn).toBe(true);
      // Verify the composite can be added to a world
      const engine = Matter.Engine.create();
      Matter.Composite.add(engine.world, car.composite);
      const allBodies = Matter.Composite.allBodies(engine.world);
      expect(allBodies.length).toBeGreaterThan(0);
    }
  });

  it('detects upside down state', () => {
    const car = new Car(CAR_DEFS.wagon, 100, 300);
    expect(car.isUpsideDown).toBe(false);
    // Rotate chassis to be upside down
    Matter.Body.setAngle(car.chassis, Math.PI);
    expect(car.isUpsideDown).toBe(true);
  });

  it('applies torque to correct wheels based on drive type', () => {
    // Test RWD
    const rwd = new Car(CAR_DEFS.sports, 100, 300);
    rwd.applyInput({
      gas: true, brake: false, leanForward: false,
      leanBack: false, boost: false, toggleEngine: false, reset: false,
    });
    // RWD should apply torque to rear wheel
    expect(rwd.rearWheel.torque).not.toBe(0);

    // Test AWD
    const awd = new Car(CAR_DEFS.wagon, 100, 300);
    awd.applyInput({
      gas: true, brake: false, leanForward: false,
      leanBack: false, boost: false, toggleEngine: false, reset: false,
    });
    expect(awd.frontWheel.torque).not.toBe(0);
    expect(awd.rearWheel.torque).not.toBe(0);
  });

  it('does not apply torque when engine is off', () => {
    const car = new Car(CAR_DEFS.wagon, 100, 300);
    car.engineOn = false;
    car.applyInput({
      gas: true, brake: false, leanForward: false,
      leanBack: false, boost: false, toggleEngine: false, reset: false,
    });
    expect(car.frontWheel.torque).toBe(0);
    expect(car.rearWheel.torque).toBe(0);
  });

  it('physics simulation runs with car', () => {
    const engine = Matter.Engine.create();
    const car = new Car(CAR_DEFS.jeep, 100, 100);
    Matter.Composite.add(engine.world, car.composite);

    // Add a floor
    const floor = Matter.Bodies.rectangle(400, 500, 800, 50, { isStatic: true });
    Matter.Composite.add(engine.world, floor);

    // Run a few physics steps
    for (let i = 0; i < 60; i++) {
      Matter.Engine.update(engine, 1000 / 60);
    }

    // Car should have fallen due to gravity
    expect(car.position.y).toBeGreaterThan(100);
  });
});
