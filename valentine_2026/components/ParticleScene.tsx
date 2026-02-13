import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { geometryFactory } from '../utils/geometryFactory';
import { HandData, ShapeType } from '../types';
import { PARTICLE_COUNT } from '../constants';

// Fix for missing JSX types in this environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      ambientLight: any;
    }
  }
}

const particleGeometry = new THREE.BufferGeometry();
// Use a PointsMaterial that looks good for glowing particles
const particleMaterial = new THREE.PointsMaterial({
  color: 0xff69b4,
  size: 0.045, // Slightly reduced size to accommodate higher density
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const Particles = ({ handData }: { handData: HandData }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  
  // Initialize with heart shape
  useEffect(() => {
    const heart = geometryFactory.getHeartPoints();
    targetPositionsRef.current.set(heart);
    // Scatter initial positions
    for(let i=0; i<PARTICLE_COUNT*3; i++) {
        currentPositionsRef.current[i] = (Math.random() - 0.5) * 15;
    }
  }, []);

  // Handle shape changes
  useEffect(() => {
    let newTargets: Float32Array;
    let targetColor = 0xff69b4;

    switch (handData.shape) {
      case ShapeType.I:
        newTargets = geometryFactory.getTextPoints("I");
        targetColor = 0x00ffff; // Cyan
        break;
      case ShapeType.LOVE:
        newTargets = geometryFactory.getTextPoints("LOVE");
        targetColor = 0xff00ff; // Magenta
        break;
      case ShapeType.YOU:
        newTargets = geometryFactory.getTextPoints("YOU");
        targetColor = 0xffff00; // Yellow
        break;
      case ShapeType.HEART:
      default:
        newTargets = geometryFactory.getHeartPoints();
        targetColor = 0xff3366; // Red/Pink
        break;
    }
    
    targetPositionsRef.current.set(newTargets);
    
    // Animate color change smoothly ideally, but direct set is okay for particles
    // We'll just set it.
    if(pointsRef.current) {
        (pointsRef.current.material as THREE.PointsMaterial).color.setHex(targetColor);
    }

  }, [handData.shape]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const current = currentPositionsRef.current;
    const target = targetPositionsRef.current;
    
    // Interpolation speed
    const lerpSpeed = 5.0 * delta; 
    const time = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      // Move particle towards target
      current[ix] += (target[ix] - current[ix]) * lerpSpeed;
      current[iy] += (target[iy] - current[iy]) * lerpSpeed;
      current[iz] += (target[iz] - current[iz]) * lerpSpeed;
      
      // Add "Aliveness" noise
      const noiseAmp = 0.01;
      current[ix] += Math.sin(time * 2 + iy) * noiseAmp;
      current[iy] += Math.cos(time * 3 + iz) * noiseAmp;
    }

    pointsRef.current.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(current, 3)
    );
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Apply Hand Transformations (Position & Scale) to the whole group
    const mesh = pointsRef.current;
    
    // Smooth Lerp for object position to avoid jitter
    mesh.position.lerp(new THREE.Vector3(handData.position.x, handData.position.y, handData.position.z), 0.15);
    
    // Smooth Lerp for scale
    const s = handData.scale;
    mesh.scale.lerp(new THREE.Vector3(s, s, s), 0.15);
    
    // FIXED: Ensure text always faces viewer, removed dynamic rotation
    mesh.rotation.set(0, 0, 0);
  });

  return (
    <points ref={pointsRef} geometry={particleGeometry} material={particleMaterial} />
  );
};

export const ParticleScene = ({ handData }: { handData: HandData }) => {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <Particles handData={handData} />
      </Canvas>
    </div>
  );
};