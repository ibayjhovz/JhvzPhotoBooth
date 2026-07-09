import React, { useState } from 'react';
import { EventFrame } from '../types';
import { Grid, Layers, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface FrameSelectionProps {
  frames: EventFrame[];
  onSelect: (frame: EventFrame) => void;
  onBack: () => void;
  selectedFrameId?: string;
  themeColor?: string;
}

export default function FrameSelection({
  frames,
  onSelect,
  onBack,
  selectedFrameId,
  themeColor = '#4F46E5', // Default Indigo
}: FrameSelectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Wedding', 'Birthday', 'Graduation', 'Corporate', 'Modern'];

  const filteredFrames = frames.filter((frame) => {
    if (!frame.active) return false;
    if (activeCategory === 'All') return true;
    return frame.category.toLowerCase() === activeCategory.toLowerCase();
  });

  const getLayoutTag = (frame: EventFrame) => {
    const slotCount = frame.slots.length;
    // Guess based on slot positions or aspect ratios
    const firstSlot = frame.slots[0];
    if (!firstSlot) return `${slotCount}-Photo Layout`;

    // Traditional vertical strip
    if (firstSlot.width < 90 && firstSlot.height < 25) {
      return 'Classic 2x6 Strip';
    } else if (firstSlot.width < 50 && firstSlot.height < 50) {
      return 'Standard 4x6 Grid';
    } else {
      return 'Square 2x2 Grid';
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 select-none" id="frame-select-view">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between mb-6 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl active:scale-95 transition-all text-xs font-bold uppercase tracking-wider text-slate-200"
          id="btn-back-to-welcome"
        >
          <ArrowLeft className="w-4 h-4 text-blue-400" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">Choose Your Frame</h2>
          <p className="text-xs sm:text-sm text-blue-300 font-medium mt-1">Select an overlay design for your photostrip</p>
        </div>
        <div className="w-20"></div> {/* Spacer for balancing */}
      </div>

      {/* Category Tabs */}
      <div className="w-full max-w-4xl mx-auto flex gap-1.5 overflow-x-auto pb-3 border-b border-white/10 z-10 scrollbar-none justify-start sm:justify-center">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
              activeCategory === category
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 border-blue-400/30'
                : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:border-white/10 backdrop-blur-md'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Grid of Frames */}
      <div className="w-full max-w-6xl mx-auto flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-8 overflow-y-auto max-h-[55vh] z-10 px-2" id="frames-grid">
        {filteredFrames.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-12 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
            <Layers className="w-12 h-12 mb-3 text-blue-400/60 animate-pulse" />
            <p className="text-sm font-semibold">No active frames found in this category.</p>
          </div>
        ) : (
          filteredFrames.map((frame) => {
            const isSelected = selectedFrameId === frame.id;
            const layoutTag = getLayoutTag(frame);
            const isStrip = layoutTag.includes('Strip');

            return (
              <div
                key={frame.id}
                onClick={() => onSelect(frame)}
                className={`group relative bg-white/5 backdrop-blur-md border ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/10 hover:border-white/20'
                } rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all flex flex-col shadow-xl`}
                id={`frame-card-${frame.id}`}
              >
                {/* Visual Thumbnail Frame Box */}
                <div className="relative bg-black/40 flex items-center justify-center p-4 h-56 overflow-hidden border-b border-white/10">
                  {frame.imageUrl ? (
                    <img
                      src={frame.imageUrl}
                      alt={frame.name}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-2xl group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    // Fallback visual representations
                    <div className={`relative ${isStrip ? 'w-24 h-48' : 'w-44 h-32'} border border-white/10 rounded-xl bg-slate-950 flex flex-col justify-between p-2 shadow-inner`}>
                      {/* Drawing photo slots */}
                      {frame.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="border border-white/10 bg-white/5 rounded-lg flex items-center justify-center text-[8px] font-mono text-slate-400"
                          style={{
                            position: 'absolute',
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.width}%`,
                            height: `${slot.height}%`,
                          }}
                        >
                          {slot.id}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active selected overlay mark */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-gradient-to-tr from-blue-500 to-purple-600 text-white p-1.5 rounded-full shadow-lg border border-white/20">
                      <CheckCircle className="w-5 h-5 fill-none" />
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[10px] font-black tracking-widest text-blue-300 border border-white/10">
                    {layoutTag}
                  </div>
                </div>

                {/* Info Bar */}
                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-white transition-colors">
                      {frame.name}
                    </h4>
                    <p className="text-[10px] text-blue-300 mt-1 uppercase font-mono font-bold tracking-wider">
                      Category: {frame.category}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Action Indicator */}
      <div className="w-full max-w-md mx-auto z-10 flex flex-col items-center">
        {selectedFrameId ? (
          <button
            onClick={() => {
              const selectedFrame = frames.find(f => f.id === selectedFrameId);
              if (selectedFrame) onSelect(selectedFrame);
            }}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95 transition-all animate-bounce"
            id="btn-confirm-frame"
          >
            Continue to Guest Info <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <p className="text-[10px] text-blue-300 font-extrabold tracking-widest uppercase bg-white/5 border border-white/5 backdrop-blur-md px-5 py-2.5 rounded-full">
            Please tap any frame layout to continue
          </p>
        )}
      </div>
    </div>
  );
}
