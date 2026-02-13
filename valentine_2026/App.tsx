import React, { useState } from 'react';
import HandTracker from './components/HandTracker';
import ParticleScene from './components/ParticleScene';
import { HandData, ShapeType } from './types';

function App() {
  const [handData, setHandData] = useState<HandData>({
    present: false,
    position: { x: 0.5, y: 0.5, z: 0 },
    scale: 1,
    shape: ShapeType.HEART,
  });

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <ParticleScene handData={handData} />
      </div>

      {/* Camera/Sensor Layer */}
      <HandTracker onHandUpdate={setHandData} />

      {/* Minimalist UI Overlay */}
      <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center pointer-events-none select-none">
        <div className="flex gap-8 items-center text-xs tracking-wider text-white/50 bg-black/20 px-8 py-3 rounded-full backdrop-blur-md border border-white/5">
          <span className={`transition-all duration-500 ${handData.shape === ShapeType.I ? 'text-cyan-400 scale-125 font-bold shadow-cyan-500/50 drop-shadow-md opacity-100' : 'opacity-40'}`}>
            I
          </span>
          <span className={`transition-all duration-500 ${handData.shape === ShapeType.LOVE ? 'text-pink-500 scale-125 font-bold shadow-pink-500/50 drop-shadow-md opacity-100' : 'opacity-40'}`}>
            LOVE
          </span>
          <span className={`transition-all duration-500 ${handData.shape === ShapeType.U ? 'text-yellow-400 scale-125 font-bold shadow-yellow-500/50 drop-shadow-md opacity-100' : 'opacity-40'}`}>
            YOU
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;