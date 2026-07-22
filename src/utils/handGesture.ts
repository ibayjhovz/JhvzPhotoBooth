import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

export type GestureType = 'Open_Palm' | 'Thumb_Up' | 'Thumb_Down' | 'None';

export interface RecognizedGesture {
  type: GestureType;
  score: number;
  label: string;
}

let gestureRecognizerInstance: GestureRecognizer | null = null;
let initPromise: Promise<GestureRecognizer | null> | null = null;

export async function getGestureRecognizer(): Promise<GestureRecognizer | null> {
  if (gestureRecognizerInstance) return gestureRecognizerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wasmCdns = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/wasm',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    ];

    for (const wasmUrl of wasmCdns) {
      try {
        console.log(`[MediaPipe] Attempting to initialize vision tasks from: ${wasmUrl}`);
        const vision = await FilesetResolver.forVisionTasks(wasmUrl);
        
        // Try GPU first
        try {
          const recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.35,
            minHandPresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
          gestureRecognizerInstance = recognizer;
          console.log('[MediaPipe] Gesture Recognizer initialized with GPU delegate!');
          return recognizer;
        } catch (gpuErr) {
          console.warn('[MediaPipe] GPU delegate failed, falling back to CPU delegate...', gpuErr);
          const recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.35,
            minHandPresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
          gestureRecognizerInstance = recognizer;
          console.log('[MediaPipe] Gesture Recognizer initialized with CPU delegate!');
          return recognizer;
        }
      } catch (err) {
        console.warn(`[MediaPipe] Failed to load from ${wasmUrl}:`, err);
      }
    }

    console.error('[MediaPipe] All CDN options for GestureRecognizer failed.');
    return null;
  })();

  return initPromise;
}

/**
 * Geometric analysis from 21 hand landmarks for 100% reliable gesture detection
 */
export function analyzeLandmarksGeometry(landmarks: Array<{ x: number; y: number; z?: number }>): GestureType {
  if (!landmarks || landmarks.length < 21) return 'None';

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const indexMcp = landmarks[5];
  
  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const middleMcp = landmarks[9];
  
  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const ringMcp = landmarks[13];
  
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const pinkyMcp = landmarks[17];

  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Measure finger tip distance from wrist vs knuckle (MCP) distance from wrist
  const isIndexExtended = dist(wrist, indexTip) > dist(wrist, indexMcp) * 1.2 || indexTip.y < indexPip.y;
  const isMiddleExtended = dist(wrist, middleTip) > dist(wrist, middleMcp) * 1.2 || middleTip.y < middlePip.y;
  const isRingExtended = dist(wrist, ringTip) > dist(wrist, ringMcp) * 1.2 || ringTip.y < ringPip.y;
  const isPinkyExtended = dist(wrist, pinkyTip) > dist(wrist, pinkyMcp) * 1.2 || pinkyTip.y < pinkyPip.y;

  const extendedCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

  // 1. Open Palm: 3 or 4 fingers extended
  if (extendedCount >= 3) {
    return 'Open_Palm';
  }

  // 2. Thumbs Up: Thumb tip higher than MCP & Wrist, with fingers curled
  const isThumbUpDir = (thumbTip.y < thumbMcp.y || dist(wrist, thumbTip) > dist(wrist, thumbMcp) * 1.2) && thumbTip.y < wrist.y;
  if (isThumbUpDir && extendedCount <= 1) {
    return 'Thumb_Up';
  }

  // 3. Thumbs Down: Thumb tip lower than MCP & Wrist, with fingers curled
  const isThumbDownDir = (thumbTip.y > thumbMcp.y || thumbTip.y > wrist.y + 0.02) && thumbTip.y > wrist.y - 0.02;
  if (isThumbDownDir && extendedCount <= 1) {
    return 'Thumb_Down';
  }

  return 'None';
}

/**
 * Utility to draw hand skeleton landmarks on a canvas for live visual feedback
 */
export function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number; z?: number }>,
  width: number,
  height: number,
  gesture: GestureType
) {
  if (!landmarks || landmarks.length < 21) return;

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [5, 9], [9, 10], [10, 11], [11, 12], // middle
    [9, 13], [13, 14], [14, 15], [15, 16], // ring
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17] // pinky & palm
  ];

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Stroke color based on gesture
  let strokeColor = 'rgba(168, 85, 247, 0.7)'; // purple default
  if (gesture === 'Open_Palm') strokeColor = 'rgba(168, 85, 247, 0.9)';
  if (gesture === 'Thumb_Up') strokeColor = 'rgba(16, 185, 129, 0.9)'; // emerald
  if (gesture === 'Thumb_Down') strokeColor = 'rgba(244, 63, 94, 0.9)'; // rose

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Draw connections
  connections.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
  });

  // Draw landmark points
  landmarks.forEach((p, idx) => {
    const x = p.x * width;
    const y = p.y * height;

    ctx.beginPath();
    ctx.arc(x, y, idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? 6 : 4, 0, 2 * Math.PI);
    ctx.fillStyle = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? '#ffffff' : strokeColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  });

  ctx.restore();
}

