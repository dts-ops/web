import { ShapeType } from '../types';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;

const INDEX_PIP = 6;
const MIDDLE_PIP = 10;
const RING_PIP = 14;
const PINKY_PIP = 18;

const WRIST = 0;

export class GestureService {
  private hands: any;
  private camera: any;
  private onResultsCallback: (data: any) => void;

  constructor(onResults: (data: any) => void) {
    this.onResultsCallback = onResults;
  }

  async start(videoElement: HTMLVideoElement) {
    if (!window.Hands) {
      console.error("MediaPipe Hands not loaded");
      return;
    }

    this.hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults(this.processResults.bind(this));

    this.camera = new window.Camera(videoElement, {
      onFrame: async () => {
        await this.hands.send({ image: videoElement });
      },
      width: 1280,
      height: 720,
    });

    await this.camera.start();
  }

  private processResults(results: any) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const shape = this.detectGesture(landmarks);
      const position = this.detectPosition(landmarks);
      const scale = this.detectScale(landmarks);

      this.onResultsCallback({
        detected: true,
        shape,
        position,
        scale,
      });
    } else {
      this.onResultsCallback({
        detected: false,
        shape: ShapeType.HEART,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
      });
    }
  }

  // Determines if a finger is "extended" by comparing tip distance to wrist vs PIP distance to wrist
  private isFingerExtended(landmarks: any, tipIdx: number, pipIdx: number): boolean {
    const wrist = landmarks[WRIST];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];

    const distTip = (tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2;
    const distPip = (pip.x - wrist.x) ** 2 + (pip.y - wrist.y) ** 2;

    return distTip > distPip;
  }

  private detectGesture(landmarks: any): ShapeType {
    const index = this.isFingerExtended(landmarks, INDEX_TIP, INDEX_PIP);
    const middle = this.isFingerExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP);
    const ring = this.isFingerExtended(landmarks, RING_TIP, RING_PIP);
    const pinky = this.isFingerExtended(landmarks, PINKY_TIP, PINKY_PIP);

    // 1 Finger: Index only -> "I"
    if (index && !middle && !ring && !pinky) return ShapeType.I;

    // 2 Fingers: Index + Middle -> "LOVE"
    if (index && middle && !ring && !pinky) return ShapeType.LOVE;

    // 3 Fingers: Index + Middle + Ring -> "YOU"
    if (index && middle && ring && !pinky) return ShapeType.YOU;

    return ShapeType.HEART;
  }

  private detectPosition(landmarks: any) {
    // Use landmark 9 (Middle MCP) as hand center anchor
    const p = landmarks[9]; 
    
    // Map screen coordinates (0..1) to 3D space
    // x: Invert to mirror movement (move hand right -> object moves right on screen/mirror)
    const x = (p.x - 0.5) * -12; 
    const y = -(p.y - 0.5) * 8; 
    // z: MP gives relative Z, usually negative is closer to camera
    const z = p.z * 10; 

    return { x, y, z };
  }

  private detectScale(landmarks: any): number {
    // Distance from wrist to tips to determine "openness"
    const wrist = landmarks[WRIST];
    let maxDist = 0;
    
    [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].forEach(tip => {
       const d = Math.sqrt((landmarks[tip].x - wrist.x)**2 + (landmarks[tip].y - wrist.y)**2);
       if (d > maxDist) maxDist = d;
    });

    // Heuristic: Closed fist ~0.1-0.2, Open hand ~0.4-0.5
    // Map to scale factor 0.5 (small) to 2.0 (large)
    const normalized = Math.max(0, Math.min(1, (maxDist - 0.15) / 0.3));
    return 0.5 + normalized * 1.5;
  }

  stop() {
    if (this.camera) this.camera.stop();
  }
}
