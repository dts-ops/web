import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler';
import { ShapeType } from '../types';

const FONT_URL = 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json';

// Configuration for "Voxel" look
const VOXEL_SIZE = 0.5; // Slightly larger grid for larger text
const PARTICLE_COUNT = 4000; // Increased count for larger text coverage

// Singleton to manage font loading and geometry generation
class ShapeGenerator {
  private font: Font | null = null;
  private particleCount: number = PARTICLE_COUNT;
  private cache: Record<string, Float32Array> = {};

  async loadFont(): Promise<void> {
    if (this.font) return;
    const loader = new FontLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        FONT_URL,
        (loadedFont) => {
          this.font = loadedFont;
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  getPointsForShape(type: ShapeType): Float32Array {
    if (this.cache[type]) return this.cache[type];
    
    if (!this.font && type !== ShapeType.HEART) {
        return new Float32Array(this.particleCount * 3);
    }

    let points: Float32Array;

    switch (type) {
      case ShapeType.HEART:
        points = this.generateHeartPoints();
        break;
      case ShapeType.I:
        points = this.generateTextPoints("I");
        break;
      case ShapeType.LOVE:
        points = this.generateTextPoints("LOVE");
        break;
      case ShapeType.U:
        points = this.generateTextPoints("U");
        break;
      default:
        points = this.generateHeartPoints();
    }

    this.cache[type] = points;
    return points;
  }

  private quantizePoint(vector: THREE.Vector3): string {
    const q = VOXEL_SIZE;
    vector.x = Math.round(vector.x / q) * q;
    vector.y = Math.round(vector.y / q) * q;
    vector.z = Math.round(vector.z / q) * q;
    return `${vector.x},${vector.y},${vector.z}`;
  }

  private generateTextPoints(text: string): Float32Array {
    if (!this.font) return new Float32Array(this.particleCount * 3);

    // Custom adjustment for "LOVE" to make it larger and more spaced out
    const isLove = text === "LOVE";
    const displayText = isLove ? "L O V E" : text;
    const size = isLove ? 12 : 8;
    const depth = isLove ? 5 : 4;

    const geometry = new TextGeometry(displayText, {
      font: this.font,
      size: size,
      depth: depth,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.8,
      bevelSize: 0.3,
      bevelOffset: 0,
      bevelSegments: 2
    });

    geometry.center();

    const mesh = new THREE.Mesh(geometry);
    const sampler = new MeshSurfaceSampler(mesh).build();
    const points = new Float32Array(this.particleCount * 3);
    const tempVec = new THREE.Vector3();
    const occupied = new Set<string>();

    let index = 0;
    let attempts = 0;
    const maxAttempts = this.particleCount * 20;

    while (index < this.particleCount && attempts < maxAttempts) {
      attempts++;
      sampler.sample(tempVec);
      
      const key = this.quantizePoint(tempVec);
      
      if (!occupied.has(key)) {
        occupied.add(key);
        points[index * 3] = tempVec.x;
        points[index * 3 + 1] = tempVec.y;
        points[index * 3 + 2] = tempVec.z;
        index++;
      }
    }

    while (index < this.particleCount) {
        sampler.sample(tempVec);
        this.quantizePoint(tempVec);
        points[index * 3] = tempVec.x;
        points[index * 3 + 1] = tempVec.y;
        points[index * 3 + 2] = tempVec.z;
        index++;
    }

    return points;
  }

  private generateHeartPoints(): Float32Array {
    const points = new Float32Array(this.particleCount * 3);
    const occupied = new Set<string>();
    const tempVec = new THREE.Vector3();
    
    let index = 0;
    let attempts = 0;
    const maxAttempts = this.particleCount * 20;

    while (index < this.particleCount && attempts < maxAttempts) {
      attempts++;
      const t = Math.random() * Math.PI * 2;
      
      let x = 16 * Math.pow(Math.sin(t), 3);
      let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      
      const scale = 0.65; // Increased scale
      x *= scale;
      y *= scale;

      const fill = Math.pow(Math.random(), 0.3);
      x *= fill;
      y *= fill;

      const thickness = 6;
      let z = (Math.random() - 0.5) * thickness;

      tempVec.set(x, y, z);
      const key = this.quantizePoint(tempVec);

      if (!occupied.has(key)) {
        occupied.add(key);
        points[index * 3] = tempVec.x;
        points[index * 3 + 1] = tempVec.y;
        points[index * 3 + 2] = tempVec.z;
        index++;
      }
    }
    
    while (index < this.particleCount) {
        points[index * 3] = 0;
        points[index * 3 + 1] = 0;
        points[index * 3 + 2] = 0;
        index++;
    }
    
    return points;
  }
}

export const shapeGenerator = new ShapeGenerator();
export const PARTICLE_COUNT_EXPORT = PARTICLE_COUNT;