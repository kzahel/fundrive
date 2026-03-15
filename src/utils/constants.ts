// Planck.js uses meters; we render in pixels. 1 meter = 30 pixels.
export const SCALE = 30;

// Physics (in meters)
export const GRAVITY = 15; // m/s² (higher than real for fun feel)

// World (in pixels — converted to meters where needed)
export const GROUND_Y = 500;
export const CHUNK_WIDTH = 800;
export const RENDER_AHEAD = 3;
export const CLEANUP_BEHIND = 2;

// Gameplay
export const MAX_FUEL = 100;
export const FUEL_DRAIN_RATE = 2;
export const FUEL_BOOST_MULTIPLIER = 3;
export const BOOST_TORQUE_MULTIPLIER = 2;
export const CHECKPOINT_INTERVAL = 1500;
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
export const COLORS: Record<string, string> = {
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
