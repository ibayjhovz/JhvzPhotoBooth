import React, { useEffect, useState } from 'react';
import { Layers, Loader2, Sparkles } from 'lucide-react';
import { EventFrame } from '../types';

interface PhotostripCanvasProps {
  photos: string[];
  frame: EventFrame;
  onGenerated: (photostripDataUrl: string) => void;
}

export default function PhotostripCanvas({
  photos,
  frame,
  onGenerated,
}: PhotostripCanvasProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initiating composition...');

  useEffect(() => {
    let active = true;

    const composePhotostrip = async () => {
      try {
        // Step 1: Establish Canvas size based on category layout
        const isStrip = frame.slots[0] && frame.slots[0].width < 90 && frame.slots[0].height < 25;
        const isLandscape = frame.slots[0] && frame.slots[0].width < 50 && frame.slots[0].height < 50 && !isStrip;

        const canvas = document.createElement('canvas');
        if (isStrip) {
          canvas.width = 1200; // high-res vertical strip
          canvas.height = 3600;
        } else if (isLandscape) {
          canvas.width = 1800; // high-res landscape
          canvas.height = 1200;
        } else {
          canvas.width = 1500; // square
          canvas.height = 1500;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context could not be created');

        const w = canvas.width;
        const h = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Helper to load image promise
        const loadImage = (src: string): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error('Image failed to load: ' + src.slice(0, 40)));
            img.src = src;
          });
        };

        if (active) {
          setProgress(25);
          setStatus('Loading high-resolution snapshots...');
        }

        // Load 4 photos
        const loadedPhotos = await Promise.all(photos.map(p => loadImage(p)));

        if (active) {
          setProgress(55);
          setStatus('Composing layouts and filters...');
        }

        // Draw each photo inside its designated slot coordinates
        for (let i = 0; i < frame.slots.length; i++) {
          const slot = frame.slots[i];
          const photoImg = loadedPhotos[i];
          if (!photoImg) continue;

          // Convert slot percentages to actual canvas pixels
          const px = (slot.x / 100) * w;
          const py = (slot.y / 100) * h;
          const pw = (slot.width / 100) * w;
          const ph = (slot.height / 100) * h;

          // Crop and scale photo to fit perfectly inside the designated slot (aspect-ratio fit)
          const slotRatio = pw / ph;
          const imgRatio = photoImg.width / photoImg.height;

          let sx = 0, sy = 0, sw = photoImg.width, sh = photoImg.height;

          if (imgRatio > slotRatio) {
            // Photo is wider than slot: crop horizontal sides
            sw = photoImg.height * slotRatio;
            sx = (photoImg.width - sw) / 2;
          } else {
            // Photo is taller than slot: crop vertical sides
            sh = photoImg.width / slotRatio;
            sy = (photoImg.height - sh) / 2;
          }

          // Save context before slot drawing in case we rotate
          ctx.save();
          
          // Draw image
          ctx.drawImage(photoImg, sx, sy, sw, sh, px, py, pw, ph);
          ctx.restore();
        }

        if (active) {
          setProgress(75);
          setStatus('Overlaying transparent decorative frame...');
        }

        // Load and draw the frame overlay on top
        if (frame.imageUrl) {
          try {
            const frameOverlayImg = await loadImage(frame.imageUrl);
            ctx.drawImage(frameOverlayImg, 0, 0, w, h);
          } catch (overlayErr) {
            console.warn('Frame overlay failed to load, falling back to basic borders:', overlayErr);
            // Fallback border
            ctx.lineWidth = 20;
            ctx.strokeStyle = '#FFFFFF';
            ctx.strokeRect(10, 10, w - 20, h - 20);
          }
        }

        if (active) {
          setProgress(95);
          setStatus('Finishing high-res render...');
        }

        // Generate high resolution PNG URL
        const finalUrl = canvas.toDataURL('image/png', 1.0);

        if (active) {
          setProgress(100);
          setStatus('Composition complete!');
          setTimeout(() => {
            if (active) onGenerated(finalUrl);
          }, 300);
        }

      } catch (err) {
        console.error('Photostrip generation failed:', err);
        if (active) {
          setStatus('Failed to compose strip. Retrying fallback...');
          // Return raw first photo on extreme failures
          setTimeout(() => {
            if (active) onGenerated(photos[0]);
          }, 1000);
        }
      }
    };

    composePhotostrip();

    return () => {
      active = false;
    };
  }, [photos, frame, onGenerated]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm mx-auto shadow-2xl text-center">
      <div className="relative flex items-center justify-center mb-5">
        <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
        <Sparkles className="w-6 h-6 text-pink-500 absolute animate-pulse" />
      </div>

      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5 justify-center mb-1">
        <Layers className="w-4 h-4 text-indigo-400" /> Photostrip Generator
      </h3>
      <p className="text-xs text-slate-400 mb-6">{status}</p>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
        <div
          className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mt-2 select-none">
        {progress}% Composed
      </span>
    </div>
  );
}
