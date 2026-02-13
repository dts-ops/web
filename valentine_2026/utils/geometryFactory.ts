import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { PARTICLE_COUNT, FONT_URL } from '../constants';
import { ShapeType } from '../types';

// Helper to get random point on a mesh surface (approximate weighted by face area)
const sampleMesh = (geometry: THREE.BufferGeometry, count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  
  const posAttr = geometry.attributes.position;
  const indexAttr = geometry.index;
  const faces = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
  
  // Calculate face areas to weigh selection for uniform distribution
  const weights: number[] = [];
  let totalArea = 0;
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();

  for (let i = 0; i < faces; i++) {
    let a, b, c;
    if (indexAttr) {
      a = indexAttr.getX(i * 3);
      b = indexAttr.getX(i * 3 + 1);
      c = indexAttr.getX(i * 3 + 2);
    } else {
      a = i * 3;
      b = i * 3 + 1;
      c = i * 3 + 2;
    }
    _v1.fromBufferAttribute(posAttr, a);
    _v2.fromBufferAttribute(posAttr, b);
    _v3.fromBufferAttribute(posAttr, c);
    
    _v1.sub(_v2);
    _v3.sub(_v2);
    const area = 0.5 * _v1.cross(_v3).length();
    weights.push(area);
    totalArea += area;
  }

  // Sample points
  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalArea;
    let faceIndex = 0;
    
    // Select face based on weight
    for (let j = 0; j < weights.length; j++) {
      r -= weights[j];
      if (r <= 0) {
        faceIndex = j;
        break;
      }
    }

    // Get vertices of selected face
    let a, b, c;
    if (indexAttr) {
      a = indexAttr.getX(faceIndex * 3);
      b = indexAttr.getX(faceIndex * 3 + 1);
      c = indexAttr.getX(faceIndex * 3 + 2);
    } else {
      a = faceIndex * 3;
      b = faceIndex * 3 + 1;
      c = faceIndex * 3 + 2;
    }

    _v1.fromBufferAttribute(posAttr, a);
    _v2.fromBufferAttribute(posAttr, b);
    _v3.fromBufferAttribute(posAttr, c);

    // Random barycentric coordinates for point inside triangle
    let r1 = Math.random();
    let r2 = Math.random();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    const r3 = 1 - r1 - r2;

    const x = r1 * _v1.x + r2 * _v2.x + r3 * _v3.x;
    const y = r1 * _v1.y + r2 * _v2.y + r3 * _v3.y;
    const z = r1 * _v1.z + r2 * _v2.z + r3 * _v3.z;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
};

class GeometryFactory {
  private font: any = null;
  private cache: Record<string, Float32Array> = {};

  async loadFont() {
    if (this.font) return;
    return new Promise<void>((resolve, reject) => {
      const loader = new FontLoader();
      loader.load(FONT_URL, (response) => {
        this.font = response;
        resolve();
      }, undefined, reject);
    });
  }

  getHeartPoints(): Float32Array {
    if (this.cache[ShapeType.HEART]) return this.cache[ShapeType.HEART];

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 3D Parametric Heart
      // x = 16sin^3(t)
      // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
      
      const t = Math.random() * Math.PI * 2;
      
      const xBase = 16 * Math.pow(Math.sin(t), 3);
      const yBase = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      
      // Increased scale to match larger text size
      const scale = 0.22; 
      
      // Add volume (Z-depth) tapering towards the bottom of the heart
      // The heart is wider at the top, narrower at the bottom
      const yNorm = (yBase + 17) / 34; // 0 to 1 roughly
      const zDepth = 6 * Math.sqrt(yNorm) * (Math.random() - 0.5);

      // Add internal volume noise
      const r = Math.random();
      // Using r^0.3 pushes points outwards to surface for better definition
      const vol = Math.pow(r, 0.3);

      positions[i * 3] = xBase * scale * vol;
      positions[i * 3 + 1] = yBase * scale * vol;
      positions[i * 3 + 2] = zDepth * scale * vol;
    }

    this.cache[ShapeType.HEART] = positions;
    return positions;
  }

  getTextPoints(text: string): Float32Array {
    if (this.cache[text]) return this.cache[text];
    if (!this.font) return new Float32Array(PARTICLE_COUNT * 3);

    // Create 3D Text Geometry with extrusion for volume
    const geometry = new TextGeometry(text, {
      font: this.font,
      size: 3.5,    // Increased size significantly for better particle separation
      depth: 1.2,   // Increased depth
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.02, // Reduced bevel size to prevent letters from merging
      bevelOffset: 0,
      bevelSegments: 2,
    });

    geometry.center(); 
    const points = sampleMesh(geometry, PARTICLE_COUNT);
    this.cache[text] = points;
    return points;
  }
}

export const geometryFactory = new GeometryFactory();