import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, Zap, ShieldAlert, Monitor, Sparkles } from 'lucide-react';
import { CompanionStatus, EventFrame, PhotoboothEvent } from '../types';
import { getGestureRecognizer, analyzeLandmarksGeometry, drawHandLandmarks, GestureType } from '../utils/handGesture';

interface CaptureWorkflowProps {
  activeEvent: PhotoboothEvent;
  selectedFrame: EventFrame;
  companionStatus: CompanionStatus;
  onPhotosComplete: (photos: string[]) => void;
  onBack: () => void;
  wsSocket: WebSocket | null;
}

export default function CaptureWorkflow({
  activeEvent,
  selectedFrame,
  companionStatus,
  onPhotosComplete,
  onBack,
  wsSocket,
}: CaptureWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<number>(1); // Photo 1 to 4
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]); // Base64 raw photos
  const [workflowState, setWorkflowState] = useState<'preview' | 'countdown' | 'shutter' | 'review'>('preview');

  const [countdown, setCountdown] = useState<number>(activeEvent.countdownDuration);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [retakeCount, setRetakeCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // DSLR Webcam selection states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem('photobooth_selected_camera') || '';
  });
  const [mirrorPreview, setMirrorPreview] = useState<boolean>(() => {
    const saved = localStorage.getItem('photobooth_mirror_preview');
    return saved === null ? true : saved === 'true';
  });

  // Hand Gesture Control States
  const [gestureEnabled, setGestureEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('photobooth_gesture_control');
    return saved === null ? true : saved === 'true';
  });
  const [currentGesture, setCurrentGesture] = useState<GestureType>('None');
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100
  const [gestureStatusText, setGestureStatusText] = useState<string>('Initializing Hand AI...');
  const [isRecognizerReady, setIsRecognizerReady] = useState<boolean>(false);
  const cooldownUntilRef = useRef<number>(0);

  // Sound Synth Synthesizer using Web Audio API
  const playBeep = (freq: number, duration: number) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      console.warn('Synth error:', err);
    }
  };

  const playGestureChime = () => {
    try {
      playBeep(880, 0.12);
      setTimeout(() => playBeep(1320, 0.18), 90);
    } catch (e) {
      console.warn('Chime error:', e);
    }
  };

  const playShutterSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();

      // Make high pitch synth tone mixed with some noise
      const bufferSize = audioCtx.sampleRate * 0.15;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      noise.start();

      // High pitched beep
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.frequency.value = 1800;
      oscGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);

    } catch (err) {
      console.warn('Shutter sound error:', err);
    }
  };

  // Enumerate active video devices (DSLRs, external capture cards, webcams)
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Prompt for permissions so that actual device labels are retrieved
        await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter((device) => device.kind === 'videoinput');
        setVideoDevices(videoDevs);
        
        const stored = localStorage.getItem('photobooth_selected_camera');
        if (stored && videoDevs.some(d => d.deviceId === stored)) {
          setSelectedDeviceId(stored);
        } else if (videoDevs.length > 0) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Error enumerating video devices:', err);
      }
    };
    getDevices();
  }, []);

  // Start persistent, flicker-free webcam stream for real-time live preview mapping
  useEffect(() => {
    let active = true;
    const initWebcam = async () => {
      try {
        if (streamRef.current) {
          if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
          return;
        }

        let stream;
        try {
          const videoConstraints: MediaTrackConstraints = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };
          if (selectedDeviceId) {
            videoConstraints.deviceId = { exact: selectedDeviceId };
          } else {
            videoConstraints.facingMode = 'user';
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch (deviceErr) {
          console.warn('Could not launch selected device, falling back to default:', deviceErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
            audio: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          hiddenVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Webcam initialization error:', err);
      }
    };

    initWebcam();

    // Safety sync to ensure srcObject binding is correctly established
    const timer = setTimeout(() => {
      if (streamRef.current) {
        if (videoRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
        }
        if (hiddenVideoRef.current && !hiddenVideoRef.current.srcObject) {
          hiddenVideoRef.current.srcObject = streamRef.current;
          hiddenVideoRef.current.play().catch(() => {});
        }
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [selectedDeviceId]);

  // Handle countdown intervals
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (workflowState === 'countdown') {
      if (countdown > 0) {
        // Play beep sound for numbers
        playBeep(600, 0.1);
        timer = setTimeout(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        // Reached 0: Shoot!
        triggerCapture();
      }
    }
    return () => clearTimeout(timer);
  }, [workflowState, countdown]);

  // Listen to incoming photos from the local Companion App via WS
  useEffect(() => {
    if (!wsSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'dslr:captured' && data.imageUrl) {
          // Received high resolution capture from DSLR companion!
          onPhotoAcquired(data.imageUrl);
        }
      } catch (err) {
        console.error('WS Capture handler error:', err);
      }
    };

    wsSocket.addEventListener('message', handleMessage);
    return () => {
      wsSocket.removeEventListener('message', handleMessage);
    };
  }, [wsSocket, currentStep]);

  const handleStartCountdown = () => {
    setCountdown(activeEvent.countdownDuration);
    setWorkflowState('countdown');
  };

  const triggerCapture = async () => {
    setWorkflowState('shutter');
    setFlashActive(true);
    playShutterSound();

    // Fade out flash
    setTimeout(() => {
      setFlashActive(false);
    }, 250);

    // If DSLR is connected via WebSocket, trigger it!
    if (companionStatus.cameraConnected && wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(JSON.stringify({
        type: 'shutter:trigger',
        step: currentStep,
        event: activeEvent.id
      }));
      // Wait for the WS 'dslr:captured' event.
      // We also add a local safety timeout in case the hardware hangs, which takes a simulated picture!
      setTimeout(() => {
        if (workflowState === 'shutter') {
          captureLocalWebcam();
        }
      }, 4000);
    } else {
      // Local fallback using Webcam API
      setTimeout(() => {
        captureLocalWebcam();
      }, 300);
    }
  };

  const captureLocalWebcam = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Set canvas to match aspect ratio
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        // Draw video frame (mirrored for intuitive kiosk feeling if mirrorPreview is enabled)
        if (mirrorPreview) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (mirrorPreview) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        onPhotoAcquired(dataUrl);
      }
    }
  };

  const onPhotoAcquired = (imageUrl: string) => {
    // Add photo to temp position and move to review state
    setCapturedPhotos((prev) => {
      const updated = [...prev];
      updated[currentStep - 1] = imageUrl;
      return updated;
    });
    setWorkflowState('review');
  };

  const handleAcceptPhoto = () => {
    if (currentStep < selectedFrame.slots.length) {
      setCurrentStep((prev) => prev + 1);
      setWorkflowState('preview');
    } else {
      // Completed all photos!
      onPhotosComplete(capturedPhotos);
    }
  };

  const handleRetakePhoto = () => {
    setRetakeCount((prev) => prev + 1);
    setCapturedPhotos((prev) => {
      const updated = [...prev];
      updated[currentStep - 1] = ''; // erase this step
      return updated;
    });
    setCountdown(activeEvent.countdownDuration);
    setWorkflowState('countdown'); // Restart immediately for interactive speed
  };

  // Manual trigger shortcut for gesture actions (also useful for click testing)
  const handleTriggerGestureManual = (gesture: GestureType) => {
    playGestureChime();
    cooldownUntilRef.current = Date.now() + 2000;
    setHoldProgress(100);
    setTimeout(() => setHoldProgress(0), 400);

    if (gesture === 'Open_Palm' && workflowState === 'preview') {
      handleStartCountdown();
    } else if (gesture === 'Thumb_Up' && workflowState === 'review') {
      handleAcceptPhoto();
    } else if (gesture === 'Thumb_Down' && workflowState === 'review') {
      handleRetakePhoto();
    }
  };

  // Keep fresh references for callbacks inside setInterval
  const latestHandlersRef = useRef({
    handleStartCountdown,
    handleAcceptPhoto,
    handleRetakePhoto,
    workflowState,
    currentStep,
  });

  useEffect(() => {
    latestHandlersRef.current = {
      handleStartCountdown,
      handleAcceptPhoto,
      handleRetakePhoto,
      workflowState,
      currentStep,
    };
  });

  // Hand Gesture Recognition Loop using MediaPipe Tasks Vision
  useEffect(() => {
    if (!gestureEnabled) return;

    let active = true;
    let recognizer: any = null;
    let frameInterval: NodeJS.Timeout | null = null;
    let currentHold = 0;
    let lastTimestampMs = 0;

    const initRecognizer = async () => {
      setGestureStatusText('Loading Hand AI...');
      recognizer = await getGestureRecognizer();
      if (!active) return;
      if (recognizer) {
        setIsRecognizerReady(true);
        setGestureStatusText('Hand AI Active! Wave Palm / Thumbs');
      } else {
        setIsRecognizerReady(false);
        setGestureStatusText('Hand AI Active (Landmark Engine)');
      }
    };

    initRecognizer();

    frameInterval = setInterval(() => {
      if (!active || !gestureEnabled) return;
      if (Date.now() < cooldownUntilRef.current) {
        setHoldProgress(0);
        return;
      }

      // Select active video stream element (prefer visible videoRef, or fallback to hiddenVideoRef)
      const videoEl = (videoRef.current && videoRef.current.readyState >= 2)
        ? videoRef.current
        : hiddenVideoRef.current;

      if (!videoEl || videoEl.readyState < 2) return;

      try {
        let detected: GestureType = 'None';
        let handLandmarks: any = null;

        if (recognizer) {
          let nowMs = Math.round(performance.now());
          if (nowMs <= lastTimestampMs) {
            nowMs = lastTimestampMs + 1;
          }
          lastTimestampMs = nowMs;

          const results = recognizer.recognizeForVideo(videoEl, nowMs);

          if (results?.gestures?.length > 0 && results.gestures[0]?.length > 0) {
            const topGesture = results.gestures[0][0];
            if (topGesture.score > 0.25) {
              const catRaw = (topGesture.categoryName || '').toLowerCase().replace(/[^a-z]/g, '');
              if (catRaw.includes('palm')) {
                detected = 'Open_Palm';
              } else if (catRaw.includes('thumbup') || catRaw.includes('thumbsup')) {
                detected = 'Thumb_Up';
              } else if (catRaw.includes('thumbdown') || catRaw.includes('thumbsdown')) {
                detected = 'Thumb_Down';
              }
            }
          }

          if (results?.landmarks?.length > 0) {
            handLandmarks = results.landmarks[0];
            // If category wasn't explicitly returned by model, analyze landmark geometry
            if (detected === 'None') {
              detected = analyzeLandmarksGeometry(handLandmarks);
            }
          }
        }

        setCurrentGesture(detected);

        // Draw skeleton overlay on main viewfinder if canvas is present
        const gCanvas = gestureCanvasRef.current;
        if (gCanvas) {
          if (gCanvas.width !== videoEl.videoWidth || gCanvas.height !== videoEl.videoHeight) {
            gCanvas.width = videoEl.videoWidth || 640;
            gCanvas.height = videoEl.videoHeight || 480;
          }
          const ctx = gCanvas.getContext('2d');
          if (ctx) {
            if (handLandmarks) {
              drawHandLandmarks(ctx, handLandmarks, gCanvas.width, gCanvas.height, detected);
            } else {
              ctx.clearRect(0, 0, gCanvas.width, gCanvas.height);
            }
          }
        }

        const {
          handleStartCountdown: triggerStart,
          handleAcceptPhoto: triggerAccept,
          handleRetakePhoto: triggerRetake,
          workflowState: curState,
        } = latestHandlersRef.current;

        // State machine action triggers
        if (curState === 'preview') {
          if (detected === 'Open_Palm') {
            currentHold += 35; // 3 ticks (~300ms hold) to trigger
            const prog = Math.min(100, currentHold);
            setHoldProgress(prog);
            setGestureStatusText('🖐️ Open Palm Detected — Hold to Take Photo!');
            if (currentHold >= 100) {
              cooldownUntilRef.current = Date.now() + 2500;
              currentHold = 0;
              setHoldProgress(0);
              playGestureChime();
              triggerStart();
            }
          } else {
            currentHold = Math.max(0, currentHold - 15);
            setHoldProgress(currentHold);
            if (detected === 'Thumb_Up' || detected === 'Thumb_Down') {
              setGestureStatusText('Show Open Palm 🖐️ to trigger photo countdown');
            } else {
              setGestureStatusText(handLandmarks ? 'Hand Detected! Wave Palm 🖐️ to Take Photo' : 'Wave Open Palm 🖐️ to Take Photo');
            }
          }
        } else if (curState === 'review') {
          if (detected === 'Thumb_Up') {
            currentHold += 35;
            const prog = Math.min(100, currentHold);
            setHoldProgress(prog);
            setGestureStatusText('👍 Thumbs Up — Hold to Use Photo!');
            if (currentHold >= 100) {
              cooldownUntilRef.current = Date.now() + 2500;
              currentHold = 0;
              setHoldProgress(0);
              playGestureChime();
              triggerAccept();
            }
          } else if (detected === 'Thumb_Down') {
            currentHold += 35;
            const prog = Math.min(100, currentHold);
            setHoldProgress(prog);
            setGestureStatusText('👎 Thumbs Down — Hold to Retake!');
            if (currentHold >= 100) {
              cooldownUntilRef.current = Date.now() + 2500;
              currentHold = 0;
              setHoldProgress(0);
              playGestureChime();
              triggerRetake();
            }
          } else {
            currentHold = Math.max(0, currentHold - 15);
            setHoldProgress(currentHold);
            setGestureStatusText('Show 👍 Thumbs Up (Accept) or 👎 Thumbs Down (Retake)');
          }
        } else {
          // countdown or shutter mode
          currentHold = 0;
          setHoldProgress(0);
          setGestureStatusText('Capturing photo sequence...');
        }
      } catch (err) {
        console.warn('Gesture tick error:', err);
      }
    }, 100);

    return () => {
      active = false;
      if (frameInterval) clearInterval(frameInterval);
    };
  }, [gestureEnabled]);

  return (
    <div className="relative min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none" id="capture-workflow-view">
      {/* Hidden helper canvas for snaps */}
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* Offscreen video element for continuous gesture processing */}
      <video
        ref={(el) => {
          (hiddenVideoRef as any).current = el;
          if (el && streamRef.current && el.srcObject !== streamRef.current) {
            el.srcObject = streamRef.current;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '320px',
          height: '240px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Screen flash overlay */}
      <div
        className={`fixed inset-0 bg-white transition-opacity duration-200 z-50 pointer-events-none ${
          flashActive ? 'opacity-100' : 'opacity-0'
        }`}
      ></div>

      {/* Header Info */}
      <div className="w-full max-w-5xl mx-auto flex justify-between items-center z-10 mb-2">
        <button
          onClick={onBack}
          disabled={workflowState === 'countdown' || workflowState === 'shutter'}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5"
          id="btn-back-to-details"
        >
          Cancel Session
        </button>

        {/* Capturing Indicators */}
        <div className="flex gap-2">
          {Array.from({ length: selectedFrame.slots.length }, (_, i) => i + 1).map((stepNum) => {
            const isCompleted = capturedPhotos[stepNum - 1] !== undefined && capturedPhotos[stepNum - 1] !== '';
            const isActive = currentStep === stepNum;

            return (
              <div
                key={stepNum}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-blue-400/30 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                <span>Photo {stepNum}</span>
                {isCompleted && <CheckCircle className="w-3.5 h-3.5 fill-none text-emerald-400" />}
              </div>
            );
          })}
        </div>

        {/* Source Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
          <Zap className={`w-3.5 h-3.5 ${companionStatus.cameraConnected ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="font-bold uppercase tracking-wide text-[9px]">
            {companionStatus.cameraConnected ? 'DSLR Engine Active' : 'Webcam Lens Fallback'}
          </span>
        </div>
      </div>

      {/* Camera Selection Toolbar (Supports DSLR as Webcams, USB Capture, Virtual Cameras, Gesture AI) */}
      <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between px-5 py-3 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md z-10 mb-2">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
            Active Lens:
          </span>
          {videoDevices.length > 0 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedDeviceId(id);
                localStorage.setItem('photobooth_selected_camera', id);
              }}
              className="bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
            >
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const val = !gestureEnabled;
              setGestureEnabled(val);
              localStorage.setItem('photobooth_gesture_control', String(val));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              gestureEnabled
                ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-md shadow-purple-500/10'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Toggle AI Hand Gesture Controls"
            id="btn-toggle-gesture-control"
          >
            <Sparkles className={`w-3.5 h-3.5 ${gestureEnabled ? 'text-purple-400 animate-pulse' : 'text-slate-400'}`} />
            <span>Gesture AI {gestureEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <label className="flex items-center gap-2 text-xs text-slate-400 font-bold select-none cursor-pointer">
            <input
              type="checkbox"
              checked={mirrorPreview}
              onChange={(e) => {
                const val = e.target.checked;
                setMirrorPreview(val);
                localStorage.setItem('photobooth_mirror_preview', String(val));
              }}
              className="rounded border-white/20 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            Mirror
          </label>
        </div>
      </div>

      {/* Split-Screen Main Workspace: Large Viewfinder (Left) + Real-Time Photostrip Preview (Right) */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center z-10 py-2">
        
        {/* LEFT COLUMN: Large High-Resolution Viewfinder / Review Stage */}
        <div className="flex-1 w-full flex flex-col justify-center items-center">
          <div 
            className="relative w-full aspect-[4/3] sm:aspect-video bg-slate-900/80 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center backdrop-blur-md" 
            id="main-viewfinder-card"
          >
            {/* Real-time Hand Skeleton Overlay Canvas */}
            {gestureEnabled && (
              <canvas
                ref={gestureCanvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none z-20 ${mirrorPreview ? 'scale-x-[-1]' : ''}`}
              />
            )}

            {/* Top-Right Gesture Recognition HUD Badge */}
            {gestureEnabled && (
              <div className="absolute top-4 right-4 z-30 flex items-center gap-2.5 px-3 py-2 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-purple-500/30 shadow-xl animate-fade-in pointer-events-none">
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-black border border-purple-500/40">
                    {currentGesture === 'Open_Palm' ? '🖐️' : currentGesture === 'Thumb_Up' ? '👍' : currentGesture === 'Thumb_Down' ? '👎' : '✋'}
                  </div>
                  {holdProgress > 0 && (
                    <div 
                      className="absolute inset-0 rounded-full border-2 border-purple-400 animate-spin-slow"
                      style={{
                        clipPath: `inset(0 ${100 - holdProgress}% 0 0)`
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                    <span>Hand Gesture AI</span>
                    {holdProgress > 0 && <span className="text-emerald-400 font-extrabold">{holdProgress}%</span>}
                  </span>
                  <span className="text-[10px] font-bold text-slate-200">
                    {gestureStatusText}
                  </span>
                </div>
              </div>
            )}
            {/* Live Camera Viewport (Active capture states) */}
            {workflowState !== 'review' ? (
              <div className="relative w-full h-full">
                <video
                  ref={(el) => {
                    // Sync primary viewfinder video element to stream ref
                    (videoRef as any).current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${mirrorPreview ? 'scale-x-[-1]' : ''}`}
                />
                
                {/* Rule of thirds grid overlay for alignment */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                  <div className="border-r border-b border-white"></div>
                  <div className="border-r border-b border-white"></div>
                  <div className="border-b border-white"></div>
                  <div className="border-r border-b border-white"></div>
                  <div className="border-r border-b border-white"></div>
                  <div className="border-b border-white"></div>
                  <div className="border-r border-white"></div>
                  <div className="border-r border-white"></div>
                  <div></div>
                </div>

                {/* Local camera capture flash */}
                {workflowState === 'shutter' && (
                  <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-30"></div>
                )}
              </div>
            ) : (
              /* Review Captured Photo Mode - LARGE and CRYSTAL CLEAR preview */
              capturedPhotos[currentStep - 1] && (
                <div className="relative w-full h-full flex items-center justify-center bg-black/60">
                  <img
                    src={capturedPhotos[currentStep - 1]}
                    alt={`Captured snapshot ${currentStep} preview`}
                    className="w-full h-full object-cover animate-fade-in"
                    referrerPolicy="no-referrer"
                    id="large-photo-review"
                  />

                  {/* Top-left review state badge */}
                  <div className="absolute top-4 left-4 px-3 py-2 bg-black/75 backdrop-blur-md rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1.5 z-20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse animate-duration-1000"></span>
                    <span className="text-white font-extrabold uppercase tracking-wide text-[10px]">Review Capture #{currentStep}</span>
                  </div>
                </div>
              )
            )}

            {/* Big Countdown Numbers HUD Overlay */}
            {workflowState === 'countdown' && (
              <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-center justify-center z-30 pointer-events-none">
                <div className="text-center animate-pulse">
                  <div className="text-8xl sm:text-9xl font-black font-display text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-none select-none">
                    {countdown}
                  </div>
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-blue-300 mt-4 select-none drop-shadow-md">
                    Get Ready!
                  </p>
                </div>
              </div>
            )}

            {/* Processing Camera Overlay */}
            {workflowState === 'shutter' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                <div className="text-center">
                  <Camera className="w-10 h-10 mx-auto text-blue-400 animate-spin" />
                  <p className="text-xs font-bold text-white mt-3 uppercase tracking-widest px-4">Processing Capture...</p>
                </div>
              </div>
            )}
          </div>

          {/* Onscreen Gesture Shortcuts Legend */}
          {gestureEnabled && (
            <div className="w-full mt-3 px-4 py-2.5 bg-purple-950/40 border border-purple-500/20 rounded-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-purple-300 font-extrabold text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Gesture Shortcuts:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-300">
                <button
                  onClick={() => handleTriggerGestureManual('Open_Palm')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    workflowState === 'preview' ? 'bg-purple-500/30 border-purple-400 text-white font-black shadow-md shadow-purple-500/20' : 'bg-white/5 border-white/5 text-slate-400 opacity-60'
                  }`}
                  title="Click or wave Open Palm to take photo"
                  id="btn-gesture-palm"
                >
                  <span>🖐️ Palm Open</span>
                  <span className="text-[9px] uppercase tracking-wider text-purple-300 font-extrabold">= Take Photo</span>
                </button>

                <button
                  onClick={() => handleTriggerGestureManual('Thumb_Up')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    workflowState === 'review' ? 'bg-emerald-500/30 border-emerald-400 text-white font-black shadow-md shadow-emerald-500/20' : 'bg-white/5 border-white/5 text-slate-400 opacity-60'
                  }`}
                  title="Click or show Thumbs Up to proceed"
                  id="btn-gesture-thumb-up"
                >
                  <span>👍 Thumbs Up</span>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-extrabold">= Next / Use</span>
                </button>

                <button
                  onClick={() => handleTriggerGestureManual('Thumb_Down')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    workflowState === 'review' ? 'bg-rose-500/30 border-rose-400 text-white font-black shadow-md shadow-rose-500/20' : 'bg-white/5 border-white/5 text-slate-400 opacity-60'
                  }`}
                  title="Click or show Thumbs Down to retake"
                  id="btn-gesture-thumb-down"
                >
                  <span>👎 Thumbs Down</span>
                  <span className="text-[9px] uppercase tracking-wider text-rose-300 font-extrabold">= Retake</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Real-Time Photostrip Preview */}
        <div className="w-full lg:w-[320px] xl:w-[340px] flex flex-col items-center justify-center shrink-0">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 block text-center">
            Live Photostrip Design Preview
          </span>

          {/* Precise Frame Dimension / Aspect Wrapper */}
          <div
            className={`relative bg-black/50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center backdrop-blur-md transition-all duration-300 ${
              selectedFrame.slots[0] && selectedFrame.slots[0].width < 90 && selectedFrame.slots[0].height < 25
                ? 'aspect-[1/3] h-[55vh] max-h-[480px]'
                : selectedFrame.slots[0] && selectedFrame.slots[0].width < 50 && selectedFrame.slots[0].height < 50
                ? 'aspect-[3/2] w-full max-w-sm'
                : 'aspect-square h-[45vh] max-h-[380px]'
            }`}
            id="exact-capture-preview-wrapper"
          >
            {/* Slot Grid Behind the Frame Overlay */}
            <div className="absolute inset-0 w-full h-full">
              {selectedFrame.slots.map((slot, index) => {
                const photoUrl = capturedPhotos[index];
                const isActiveSlot = index === currentStep - 1;
                const isCaptured = !!photoUrl;

                return (
                  <div
                    key={slot.id}
                    className="absolute overflow-hidden bg-zinc-950/60 border border-white/5 flex items-center justify-center transition-all duration-300"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                    id={`slot-preview-${index}`}
                  >
                    {/* Render logic depending on status */}
                    {isCaptured && (!isActiveSlot || workflowState === 'review') ? (
                      /* Display the captured photo inside the slot */
                      <img
                        src={photoUrl}
                        alt={`Captured snapshot ${index + 1}`}
                        className="w-full h-full object-cover animate-fade-in"
                        referrerPolicy="no-referrer"
                      />
                    ) : isActiveSlot && workflowState !== 'review' ? (
                      /* Active taking state: Display real-time stream direct-mapping inside the photo slot on the strip! */
                      <div className="relative w-full h-full">
                        <video
                          ref={(el) => {
                            // Secondary live strip video feed binding
                            if (el && streamRef.current && el.srcObject !== streamRef.current) {
                              el.srcObject = streamRef.current;
                            }
                          }}
                          autoPlay
                          playsInline
                          className={`w-full h-full object-cover ${mirrorPreview ? 'scale-x-[-1]' : ''}`}
                        />
                        {/* Active Slot HUD Highlight */}
                        <div className="absolute inset-0 border-2 border-blue-500 animate-pulse pointer-events-none z-10"></div>
                      </div>
                    ) : (
                      /* Empty slot placeholder */
                      <div className="flex flex-col items-center justify-center text-slate-700 gap-1 select-none animate-pulse">
                        <Camera className="w-4 h-4 opacity-30" />
                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-30">Slot {index + 1}</span>
                      </div>
                    )}

                    {/* Emerald active-review border for newly captured snapshot on the strip */}
                    {isActiveSlot && workflowState === 'review' && (
                      <div className="absolute inset-0 border-2 border-emerald-400 pointer-events-none z-10 shadow-[inset_0_0_12px_rgba(52,211,153,0.5)] animate-pulse"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Frame Template Design Overlay (Masked to leave photo slots transparent so frame artwork never covers photos) */}
            {selectedFrame.imageUrl && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <mask id={`live-frame-mask-${selectedFrame.id}`}>
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    {selectedFrame.slots.map((slot) => (
                      <rect
                        key={slot.id}
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill="black"
                      />
                    ))}
                  </mask>
                </defs>
                <image
                  href={selectedFrame.imageUrl}
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  preserveAspectRatio="none"
                  mask={`url(#live-frame-mask-${selectedFrame.id})`}
                />
              </svg>
            )}

            {/* Custom Graphic Overlays (Stickers, Text, Logos) */}
            {selectedFrame.overlays?.map((overlay) => (
              <div
                key={overlay.id}
                className="absolute pointer-events-none z-20 flex items-center justify-center"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  width: `${overlay.width}%`,
                  height: `${overlay.height}%`,
                  transform: overlay.rotation ? `rotate(${overlay.rotation}deg)` : undefined,
                  opacity: overlay.opacity ?? 1,
                }}
              >
                {overlay.type === 'text' && overlay.text ? (
                  <span
                    style={{
                      color: overlay.textColor || '#ffffff',
                      fontSize: `${Math.max(9, (overlay.fontSize || 20) / 2.5)}px`,
                      fontWeight: 'bold',
                    }}
                    className="truncate font-display drop-shadow select-none whitespace-nowrap"
                  >
                    {overlay.text}
                  </span>
                ) : overlay.imageUrl ? (
                  <img src={overlay.imageUrl} alt="" className="w-full h-full object-contain drop-shadow" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Control Actions */}
      <div className="w-full max-w-lg mx-auto z-10 flex flex-col items-center">
        {workflowState === 'preview' && (
          <button
            onClick={handleStartCountdown}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
            id="btn-shoot-photo"
          >
            <Camera className="w-5 h-5" /> Take Photo #{currentStep}
          </button>
        )}

        {workflowState === 'countdown' && (
          <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-slate-300 text-[10px] font-black tracking-widest uppercase animate-pulse">
            Shutter trigger in {countdown}s...
          </div>
        )}

        {workflowState === 'shutter' && (
          <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-blue-400 text-[10px] font-black tracking-widest uppercase animate-pulse flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-ping"></span>
            Processing Image Data...
          </div>
        )}

        {workflowState === 'review' && (
          <div className="w-full flex gap-3 animate-fade-in">
            <button
              onClick={handleRetakePhoto}
              className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs font-black uppercase tracking-wider"
              id="btn-retake-photo"
            >
              <RefreshCw className="w-4 h-4 text-blue-400" /> Retake Photo
            </button>
            <button
              onClick={handleAcceptPhoto}
              className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs font-black uppercase tracking-wider"
              id="btn-use-photo"
            >
              <CheckCircle className="w-4 h-4" /> Use Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
