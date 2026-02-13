import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HandData, ShapeType } from '../types';
import { shapeGenerator, PARTICLE_COUNT_EXPORT } from '../services/shapeGenerator';

interface ParticlesProps {
  handData: HandData;
}

const SHAPE_COUNT = PARTICLE_COUNT_EXPORT;
const AMBIENT_COUNT = 5000; // Increased to ensure density over larger area
const TOTAL_COUNT = SHAPE_COUNT + AMBIENT_COUNT;

const Particles: React.FC<ParticlesProps> = ({ handData }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Data Buffers
  const [positions, setPositions] = useState<Float32Array>(new Float32Array(TOTAL_COUNT * 3));
  const [targetPositions, setTargetPositions] = useState<Float32Array>(new Float32Array(TOTAL_COUNT * 3));
  const [ambientOffsets] = useState<Float32Array>(() => {
    const arr = new Float32Array(AMBIENT_COUNT * 3);
    // Significantly increased spread (150) to cover wide background area even when scaled down
    for(let i=0; i<AMBIENT_COUNT * 3; i++) arr[i] = (Math.random() - 0.5) * 150; 
    return arr;
  });
  
  // Color Buffers
  const [currentColors, setCurrentColors] = useState<Float32Array>(new Float32Array(TOTAL_COUNT * 3));
  const [targetColors, setTargetColors] = useState<Float32Array>(new Float32Array(TOTAL_COUNT * 3));

  const [fontLoaded, setFontLoaded] = useState(false);

  // Helper to generate diverse colors
  const getColorForShape = (type: ShapeType, index: number) => {
    const r = Math.random();
    const c = new THREE.Color();
    
    // Ambient colors - BRIGHT and COLORFUL
    if (index >= SHAPE_COUNT) {
        // Full hue spectrum, High Saturation (0.7-1.0), High Lightness (0.5-0.9)
        // This ensures they are visible against black
        c.setHSL(r, 0.7 + r * 0.3, 0.5 + r * 0.4);
        return c;
    }

    // Shape Colors - Neon style
    switch (type) {
      case ShapeType.I:
        // Bright Cyans / Electric Blues
        c.setHSL(0.5 + r * 0.1, 1.0, 0.6 + r * 0.3); 
        break;
      case ShapeType.LOVE:
        // Hot Pinks / Magentas
        c.setHSL(0.85 + r * 0.1, 1.0, 0.6 + r * 0.3);
        break;
      case ShapeType.U:
        // Bright Gold / Yellow / Orange
        c.setHSL(0.08 + r * 0.1, 1.0, 0.6 + r * 0.3);
        break;
      case ShapeType.HEART:
      default:
        // Ruby Red / Bright Red
        c.setHSL(0.98 + r * 0.05, 1.0, 0.5 + r * 0.3);
        break;
    }
    return c;
  };

  // Initialize
  useEffect(() => {
    shapeGenerator.loadFont().then(() => {
      setFontLoaded(true);
      
      const fullPositions = new Float32Array(TOTAL_COUNT * 3);
      const initialShapePoints = shapeGenerator.getPointsForShape(ShapeType.HEART);
      
      // Set Shape Initial Positions
      fullPositions.set(initialShapePoints, 0);
      
      // Set Ambient Initial Positions
      for(let i=0; i<AMBIENT_COUNT; i++) {
        const offset = SHAPE_COUNT * 3 + i * 3;
        fullPositions[offset] = ambientOffsets[i*3];
        fullPositions[offset+1] = ambientOffsets[i*3+1];
        fullPositions[offset+2] = ambientOffsets[i*3+2];
      }

      setPositions(fullPositions.slice());
      setTargetPositions(fullPositions.slice());
      
      // Initialize Colors
      const cArr = new Float32Array(TOTAL_COUNT * 3);
      for(let i=0; i<TOTAL_COUNT; i++) {
        const col = getColorForShape(ShapeType.HEART, i);
        cArr[i*3] = col.r;
        cArr[i*3+1] = col.g;
        cArr[i*3+2] = col.b;
      }
      setCurrentColors(cArr);
      setTargetColors(cArr.slice());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once

  // Handle Shape Changes
  useEffect(() => {
    if (!fontLoaded) return;
    
    // Shape Targets
    const shapePoints = shapeGenerator.getPointsForShape(handData.shape);
    
    setTargetPositions(prev => {
        const next = new Float32Array(prev); 
        next.set(shapePoints, 0); 
        return next;
    });

    // Color Targets
    const newColors = new Float32Array(TOTAL_COUNT * 3);
    for(let i=0; i<TOTAL_COUNT; i++) {
      const col = getColorForShape(handData.shape, i);
      newColors[i*3] = col.r;
      newColors[i*3+1] = col.g;
      newColors[i*3+2] = col.b;
    }
    setTargetColors(newColors);

  }, [handData.shape, fontLoaded]);

  // Animation Loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const dampSpeed = 3.0 * delta; 
    const time = state.clock.getElapsedTime();

    // Global Movement Smoothing (Reduced Sensitivity)
    let groupX = 0;
    let groupY = 0;
    let groupZ = 0;
    let groupScale = 1;

    if (handData.present) {
        // Dampened movement factors
        groupX = -(handData.position.x - 0.5) * 8; 
        groupY = -(handData.position.y - 0.5) * 5;
        groupScale = handData.scale;
    }

    // Smooth Lerp for group
    meshRef.current.position.lerp(new THREE.Vector3(groupX, groupY, groupZ), 0.05);
    
    // Manual Lerp for Scale
    const currentScale = meshRef.current.scale.x;
    const nextScale = THREE.MathUtils.lerp(currentScale, groupScale, 0.05);
    meshRef.current.scale.setScalar(nextScale);

    // Particle Animation
    for (let i = 0; i < TOTAL_COUNT; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        if (i < SHAPE_COUNT) {
            // Shape Particle Logic
            positions[ix] += (targetPositions[ix] - positions[ix]) * dampSpeed;
            positions[iy] += (targetPositions[iy] - positions[iy]) * dampSpeed;
            positions[iz] += (targetPositions[iz] - positions[iz]) * dampSpeed;
            
            // Jitter for energy
            const noise = 0.03;
            positions[ix] += (Math.random() - 0.5) * noise;
            positions[iy] += (Math.random() - 0.5) * noise;
            positions[iz] += (Math.random() - 0.5) * noise;

        } else {
            // Ambient Particle Logic
            const speed = 0.15;
            const xBase = ambientOffsets[(i - SHAPE_COUNT)*3];
            const yBase = ambientOffsets[(i - SHAPE_COUNT)*3 + 1];
            const zBase = ambientOffsets[(i - SHAPE_COUNT)*3 + 2];
            
            // Flowing movement
            const tx = Math.sin(time * speed + i) * 2;
            const ty = Math.cos(time * speed * 0.9 + i) * 2;
            const tz = Math.sin(time * speed * 0.6 + i) * 2;

            const targetX = xBase + tx;
            const targetY = yBase + ty;
            const targetZ = zBase + tz;

            positions[ix] += (targetX - positions[ix]) * dampSpeed * 0.5;
            positions[iy] += (targetY - positions[iy]) * dampSpeed * 0.5;
            positions[iz] += (targetZ - positions[iz]) * dampSpeed * 0.5;
        }

        // Color Lerp
        currentColors[ix] += (targetColors[ix] - currentColors[ix]) * dampSpeed;
        currentColors[iy] += (targetColors[iy] - currentColors[iy]) * dampSpeed;
        currentColors[iz] += (targetColors[iz] - currentColors[iz]) * dampSpeed;

        // Matrix Update
        dummy.position.set(positions[ix], positions[iy], positions[iz]);
        
        // Randomize sizes
        let pScale = 0.25; 
        if (i >= SHAPE_COUNT) pScale = 0.1 + Math.random() * 0.2; // Ambient size variance

        dummy.scale.setScalar(pScale);
        dummy.updateMatrix();
        
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, new THREE.Color(currentColors[ix], currentColors[iy], currentColors[iz]));
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      {/* 
         Low Metalness (0.1) prevents the "black metal" look in a dark scene.
         High Emissive Intensity ensures they glow.
      */}
      <meshStandardMaterial 
        roughness={0.4} 
        metalness={0.1}
        emissive="#444444"
        emissiveIntensity={0.8}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

const ParticleScene: React.FC<{ handData: HandData }> = ({ handData }) => {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 40], fov: 35 }} gl={{ antialias: true }} shadows>
        {/* High intensity lights to ensure colors pop against black */}
        <ambientLight intensity={1.5} />
        <pointLight position={[20, 20, 20]} intensity={2.5} color="#ffffff" distance={100} />
        <pointLight position={[-20, -20, 20]} intensity={2.0} color="#88ddff" distance={100} />
        <pointLight position={[0, 15, -10]} intensity={2.0} color="#ffaa88" distance={100} />
        <Particles handData={handData} />
      </Canvas>
    </div>
  );
};

export default ParticleScene;