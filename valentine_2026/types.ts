export enum ShapeType {
  HEART = 'HEART',
  I = 'I',
  LOVE = 'LOVE',
  U = 'U',
}

export interface HandData {
  present: boolean;
  position: { x: number; y: number; z: number }; // Normalized 0-1 (x/y), z is roughly depth
  scale: number; // 0 to 1 based on open/closed
  shape: ShapeType;
}

export interface ParticleConfig {
  count: number;
  color: string;
  spread: number;
}