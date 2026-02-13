import React, { useEffect, useRef, useState } from 'react';
import { ParticleScene } from './components/ParticleScene';
import { GestureService } from './services/gestureService';
import { geometryFactory } from './utils/geometryFactory';
import { HandData, ShapeType } from './types';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handData, setHandData] = useState<HandData>({
    shape: ShapeType.HEART,
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    detected: false,
  });

  useEffect(() => {
    // Preload font before starting
    geometryFactory.loadFont()
      .then(() => setLoading(false))
      .catch((err) => {
        console.error("Failed to load font", err);
        setError("Failed to load 3D resources. Please check your connection.");
      });
  }, []);

  useEffect(() => {
    if (loading || error) return;

    let gestureService: GestureService;

    const startCamera = async () => {
      try {
        gestureService = new GestureService((data) => {
          setHandData(data);
        });
        
        if (videoRef.current) {
           await gestureService.start(videoRef.current);
        }
      } catch (e) {
        console.error(e);
        setError("Camera permission denied. Please allow camera access.");
      }
    };

    startCamera();

    return () => {
      if (gestureService) gestureService.stop();
    };
  }, [loading, error]);

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden font-sans">
      
      {/* 3D Scene Layer */}
      {!loading && !error && <ParticleScene handData={handData} />}

      {/* UI Overlay Layer */}
      <div className="absolute top-0 left-0 p-6 z-30 text-white pointer-events-none w-full h-full flex flex-col justify-between">
        
        {/* Header & Instructions */}
        <div>
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 drop-shadow-2xl">
              GESTURE LOVE
            </h1>
            
            {loading && <div className="text-xl animate-pulse text-blue-400 font-mono">INITIALIZING SYSTEM...</div>}
            {error && <div className="text-xl text-red-500 font-bold bg-black/80 p-6 rounded border border-red-500 max-w-md">{error}</div>}
            
            {!loading && !error && (
            <div className="space-y-4 bg-gray-900/60 p-6 rounded-2xl backdrop-blur-md max-w-sm border border-white/10 shadow-2xl transition-all duration-300">
                <div className="flex items-center space-x-3 pb-2 border-b border-white/10">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${handData.detected ? 'bg-green-400 text-green-400' : 'bg-red-500 text-red-500 animate-ping'}`}></div>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                    {handData.detected ? 'Tracking Active' : 'Show Hand to Start'}
                </span>
                </div>
                
                <div className="space-y-3 text-sm text-gray-300 font-mono">
                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span>1 Finger</span>
                    <span className="text-cyan-400 font-bold text-lg">"I"</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span>2 Fingers</span>
                    <span className="text-pink-500 font-bold text-lg">"LOVE"</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span>3 Fingers</span>
                    <span className="text-yellow-400 font-bold text-lg">"YOU"</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    <div className="bg-black/20 p-2 rounded text-center">Open Hand = Scale Up</div>
                    <div className="bg-black/20 p-2 rounded text-center">Fist = Scale Down</div>
                </div>
                </div>
            </div>
            )}
        </div>

        {/* Video Feed (Bottom Right) */}
        {!loading && !error && (
            <div className="self-end pointer-events-auto">
                 <div className="relative w-40 h-32 md:w-56 md:h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                     <video
                        ref={videoRef}
                        className="w-full h-full object-cover transform -scale-x-100 opacity-80"
                        playsInline
                        muted
                     />
                     <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/50 bg-black/50 px-2 py-0.5 rounded">
                        SENSOR FEED
                     </div>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
