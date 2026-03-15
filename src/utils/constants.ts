// Physics
export const GRAVITY = 1;
export const FIXED_TIMESTEP = 1000 / 60; // 60Hz physics

// World
export const GROUND_Y = 500; // base ground level in world coords
export const CHUNK_WIDTH = 800; // width of each terrain chunk
export const RENDER_AHEAD = 3; // chunks to generate ahead of camera
export const CLEANUP_BEHIND = 2; // chunks to keep behind camera

// Car
export const CAR_CHASSIS_WIDTH = 120;
export const CAR_CHASSIS_HEIGHT = 30;
export const CAR_WHEEL_RADIUS = 20;
export const CAR_SUSPENSION_STIFFNESS = 0.05;
export const CAR_SUSPENSION_DAMPING = 0.02;
export const CAR_SUSPENSION_LENGTH = 15;

// Gameplay
export const MAX_FUEL = 100;
export const FUEL_DRAIN_RATE = 2; // per second
export const FUEL_BOOST_MULTIPLIER = 3;
export const BOOST_TORQUE_MULTIPLIER = 2;
export const BASE_TORQUE = 0.05;
export const BRAKE_FORCE = 0.05;
export const CHECKPOINT_INTERVAL = 1500; // world units between checkpoints
export const COIN_SCORE = 10;
export const COIN_RADIUS = 15;

// Ground friction by type
export const FRICTION: Record<string, number> = {
  road: 0.9,
  grass: 0.6,
  dirt: 0.4,
  mud: 0.2,
};

// Colors
export const COLORS = {
  sky: '#87CEEB',
  skyBottom: '#E0F0FF',
  road: '#666666',
  grass: '#4CAF50',
  dirt: '#8B6914',
  mud: '#5C4033',
  coin: '#FFD700',
  checkpoint: '#FF4444',
  fuel: '#00CC00',
  warning: '#FF8800',
};
