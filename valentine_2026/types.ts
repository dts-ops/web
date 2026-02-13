export enum ShapeType {
  HEART = 'HEART',
  I = 'I',
  LOVE = 'LOVE',
  YOU = 'YOU'
}

export interface HandData {
  shape: ShapeType;
  position: { x: number; y: number; z: number };
  scale: number;
  detected: boolean;
}
