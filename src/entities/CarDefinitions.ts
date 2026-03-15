export type DriveType = 'fwd' | 'rwd' | 'awd';

export interface CarDef {
  name: string;
  driveType: DriveType;
  color: string;
  chassisWidth: number;
  chassisHeight: number;
  wheelRadius: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionLength: number;
  torque: number;
  maxSpeed: number;
  mass: number;
  description: string;
}

export const CAR_DEFS: Record<string, CarDef> = {
  wagon: {
    name: 'Red Wagon',
    driveType: 'awd',
    color: '#E53935',
    chassisWidth: 110,
    chassisHeight: 25,
    wheelRadius: 18,
    suspensionStiffness: 0.04,
    suspensionDamping: 0.03,
    suspensionLength: 14,
    torque: 0.045,
    maxSpeed: 12,
    mass: 1.2,
    description: 'Balanced AWD — good all-rounder',
  },
  monster: {
    name: 'Monster Truck',
    driveType: 'rwd',
    color: '#1E88E5',
    chassisWidth: 140,
    chassisHeight: 35,
    wheelRadius: 28,
    suspensionStiffness: 0.03,
    suspensionDamping: 0.04,
    suspensionLength: 20,
    torque: 0.06,
    maxSpeed: 10,
    mass: 2.0,
    description: 'Big wheels, big suspension — slow but tough',
  },
  sports: {
    name: 'Sports Car',
    driveType: 'rwd',
    color: '#FFB300',
    chassisWidth: 120,
    chassisHeight: 20,
    wheelRadius: 15,
    suspensionStiffness: 0.08,
    suspensionDamping: 0.02,
    suspensionLength: 8,
    torque: 0.055,
    maxSpeed: 16,
    mass: 0.9,
    description: 'Fast on road — stiff suspension',
  },
  jeep: {
    name: 'Jeep',
    driveType: 'awd',
    color: '#43A047',
    chassisWidth: 115,
    chassisHeight: 30,
    wheelRadius: 22,
    suspensionStiffness: 0.04,
    suspensionDamping: 0.03,
    suspensionLength: 16,
    torque: 0.05,
    maxSpeed: 13,
    mass: 1.5,
    description: '4WD — great offroad grip',
  },
};
