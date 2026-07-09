import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, Zap, ShieldAlert, Monitor } from 'lucide-react';
import { CompanionStatus, EventFrame, PhotoboothEvent } from '../types';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Start persistent, flicker-free webcam stream for real-time live preview mapping
  useEffect(() => {
    const initWebcam = async () => {
      try {
        if (streamRef.current) {
          if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Webcam initialization error:', err);
      }
    };

    initWebcam();

    // Safety sync to ensure srcObject binding is correctly established
    const timer = setTimeout(() => {
      if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

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

        // Draw video frame (mirrored for intuitive kiosk feeling)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

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
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      setWorkflowState('preview');
    } else {
      // Completed all 4 photos!
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

  return (
    <div className="relative min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none" id="capture-workflow-view">
      {/* Hidden helper canvas for snaps */}
      <canvas ref={canvasRef} className="hidden"></canvas>

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
          {[1, 2, 3, 4].map((stepNum) => {
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

      {/* Split-Screen Main Workspace: Large Viewfinder (Left) + Real-Time Photostrip Preview (Right) */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center z-10 py-2">
        
        {/* LEFT COLUMN: Large High-Resolution Viewfinder / Review Stage */}
        <div className="flex-1 w-full flex flex-col justify-center items-center">
          <div 
            className="relative w-full aspect-[4/3] sm:aspect-video bg-slate-900/80 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center backdrop-blur-md" 
            id="main-viewfinder-card"
          >
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
                  className="w-full h-full object-cover scale-x-[-1]"
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
                          className="w-full h-full object-cover scale-x-[-1]"
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

            {/* Frame Template Design Overlay */}
            {selectedFrame.imageUrl && (
              <img
                src={selectedFrame.imageUrl}
                alt="Template design frame overlay"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10"
                referrerPolicy="no-referrer"
              />
            )}
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
