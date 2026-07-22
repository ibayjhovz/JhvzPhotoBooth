import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

export type GestureType = 'Open_Palm' | 'Thumb_Up' | 'Thumb_Down' | 'None';

export interface RecognizedGesture {
  type: GestureType;
  score: number;
  label: string;
}

let gestureRecognizerInstance: GestureRecognizer | null = null;
let isInitializing = false;
let initPromise: Promise<GestureRecognizer | null> | null = null;

export async function getGestureRecognizer(): Promise<GestureRecognizer | null> {
  if (gestureRecognizerInstance) return gestureRecognizerInstance;
  if (initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('[MediaPipe] Initializing Gesture Recognizer...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      gestureRecognizerInstance = recognizer;
      console.log('[MediaPipe] Gesture Recognizer initialized successfully!');
      return recognizer;
    } catch (err) {
      console.warn('[MediaPipe] Failed to load GestureRecognizer from GPU/WASM, attempting fallback...', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        gestureRecognizerInstance = recognizer;
        return recognizer;
      } catch (fallbackErr) {
        console.error('[MediaPipe] Could not load gesture model:', fallbackErr);
        return null;
      }
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Geometric fallback analysis from 21 hand landmarks
 */
export function analyzeLandmarksGeometry(landmarks: Array<{ x: number; y: number; z: number }>): GestureType {
  if (!landmarks || landmarks.length < 21) return 'None';

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  
  const indexTip = landmarks[8];
  const indexMcp = landmarks[6];
  
  const middleTip = landmarks[12];
  const middleMcp = landmarks[10];
  
  const ringTip = landmarks[16];
  const ringMcp = landmarks[14];
  
  const pinkyTip = landmarks[20];
  const pinkyMcp = landmarks[18];

  // Are index, middle, ring, pinky extended? (y is smaller when higher on screen)
  const isIndexExtended = indexTip.y < indexMcp.y;
  const isMiddleExtended = middleTip.y < middleMcp.y;
  const isRingExtended = ringTip.y < ringMcp.y;
  const isPinkyExtended = pinkyTip.y < pinkyMcp.y;

  // Are all 4 fingers extended?
  const allFingersExtended = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;

  // Are all 4 fingers curled in?
  const allFingersCurled = !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended;

  // 1. Open Palm
  if (allFingersExtended) {
    return 'Open_Palm';
  }

  // 2. Thumbs Up: Thumb tip is significantly higher than MCP and Wrist, 4 fingers curled
  if (allFingersCurled && thumbTip.y < thumbMcp.y - 0.04 && thumbTip.y < wrist.y - 0.08) {
    return 'Thumb_Up';
  }

  // 3. Thumbs Down: Thumb tip is significantly lower than MCP and Wrist, 4 fingers curled
  if (allFingersCurled && thumbTip.y > thumbMcp.y + 0.04 && thumbTip.y > wrist.y + 0.05) {
    return 'Thumb_Down';
  }

  return 'None';
}
