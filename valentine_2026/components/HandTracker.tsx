import React, { useEffect, useRef, useState } from 'react';
import { HandData, ShapeType } from '../types';

// Declare globals loaded via script tags
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!window.Hands || !window.Camera) {
      setPermissionError("MediaPipe libraries failed to load.");
      setIsLoading(false);
      return;
    }

    const hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    let camera: any = null;

    const startCamera = async () => {
      if (videoRef.current) {
        try {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });
          await camera.start();
          setIsLoading(false);
        } catch (err) {
          console.error("Camera error:", err);
          setPermissionError("Camera access denied or unavailable.");
          setIsLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      // Cleanup attempt
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResults = (results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      onHandUpdate({
        present: false,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        shape: ShapeType.HEART
      });
      return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // 1. Detect Shape based on fingers
    const isThumbExtended = !isFolded(landmarks, 1, 4); 
    const isIndexExtended = !isFingerFolded(landmarks, 8, 6);
    const isMiddleExtended = !isFingerFolded(landmarks, 12, 10);
    const isRingExtended = !isFingerFolded(landmarks, 16, 14);
    const isPinkyExtended = !isFingerFolded(landmarks, 20, 18);

    // Gestures Logic: 
    // 1 Finger (Index) -> I
    // 2 Fingers (Index + Middle) -> LOVE
    // 3 Fingers (Index + Middle + Ring) -> U
    // Else -> HEART

    let shape = ShapeType.HEART;

    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      shape = ShapeType.I;
    } else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      shape = ShapeType.LOVE;
    } else if (isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) {
      shape = ShapeType.U;
    } else {
      shape = ShapeType.HEART;
    }

    // 2. Position
    // Use average of wrist(0) and middle MCP(9).
    const x = (landmarks[0].x + landmarks[9].x) / 2;
    const y = (landmarks[0].y + landmarks[9].y) / 2;
    
    // 3. Scaling (Openness)
    // Measure average distance of fingertips from Wrist (0).
    const tips = [4, 8, 12, 16, 20];
    let totalDist = 0;
    tips.forEach(idx => {
      const dx = landmarks[idx].x - landmarks[0].x;
      const dy = landmarks[idx].y - landmarks[0].y;
      totalDist += Math.sqrt(dx*dx + dy*dy);
    });
    const avgDist = totalDist / 5;
    
    // Normalize roughly to 0-1 scale factor.
    const normalizedScale = Math.max(0.2, Math.min(2.0, (avgDist - 0.1) * 4));

    onHandUpdate({
      present: true,
      position: { x, y, z: 0 },
      scale: normalizedScale,
      shape
    });
  };

  const isFingerFolded = (landmarks: any[], tipIdx: number, pipIdx: number) => {
    const wrist = landmarks[0];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    
    const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const distPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    
    return distTip < distPip; 
  };
  
  const isFolded = (landmarks: any[], tipIdx: number, ipIdx: number) => {
      const wrist = landmarks[0];
      const tip = landmarks[tipIdx];
      const ip = landmarks[ipIdx];
      const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const distIp = Math.hypot(ip.x - wrist.x, ip.y - wrist.y);
      return distTip < distIp;
  }

  return (
    <div className="absolute top-4 right-4 z-50 w-32 h-24 bg-black/50 rounded-lg overflow-hidden border border-white/20">
      <video
        ref={videoRef}
        className="w-full h-full object-cover opacity-50 transform -scale-x-100" 
        playsInline
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white">
          Loading AI...
        </div>
      )}
      {permissionError && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 p-1 text-center leading-tight bg-black">
          {permissionError}
        </div>
      )}
    </div>
  );
};

export default HandTracker;