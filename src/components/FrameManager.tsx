import React, { useState, useRef } from 'react';
import { EventFrame, PhotoSlot, OverlayItem } from '../types';
import {
  Trash2,
  Plus,
  Edit,
  Check,
  X,
  Layers,
  Move,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Type,
  Copy,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Palette,
  Sliders,
  CheckCircle,
  FolderPlus,
} from 'lucide-react';
import { generateMockFrameOverlay, getStyleAndOrientationForFrame } from '../utils/assets';
import { PRESET_OVERLAY_OPTIONS, CANVAS_BG_PRESETS } from '../utils/presetOverlays';

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop',
];

interface FrameManagerProps {
  frames: EventFrame[];
  onSaveFrames: (updated: EventFrame[]) => void;
}

export default function FrameManager({ frames, onSaveFrames }: FrameManagerProps) {
  const [editingFrame, setEditingFrame] = useState<EventFrame | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'slots' | 'overlays' | 'canvas'>('slots');
  const [showSamplePhotos, setShowSamplePhotos] = useState(true);

  // Selection on Stage
  const [selectedType, setSelectedType] = useState<'slot' | 'overlay'>('slot');
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(1);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // New Frame Form
  const [newFrameName, setNewFrameName] = useState('');
  const [newFrameCategory, setNewFrameCategory] = useState('Wedding');
  const [newFrameOrientation, setNewFrameOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [newFrameImageUrl, setNewFrameImageUrl] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom Text Overlay Input state
  const [customText, setCustomText] = useState('MEMORIES 2026');
  const [customTextColor, setCustomTextColor] = useState('#FFFFFF');
  const [customTextSize, setCustomTextSize] = useState(24);

  // Dragging state on visual stage
  const stageRef = useRef<HTMLDivElement>(null);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG with transparency is recommended).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewFrameImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Open Visual Editor
  const handleEditFrame = (frame: EventFrame) => {
    const copy: EventFrame = JSON.parse(JSON.stringify(frame));
    if (!copy.overlays) copy.overlays = [];
    if (!copy.backgroundColor) copy.backgroundColor = '#FFFFFF';
    setEditingFrame(copy);
    setSelectedType('slot');
    setSelectedSlotId(copy.slots[0]?.id || 1);
    setSelectedOverlayId(null);
    setShowEditor(true);
  };

  const handleDuplicateFrame = (frame: EventFrame) => {
    const copy: EventFrame = JSON.parse(JSON.stringify(frame));
    copy.id = `frame-${Date.now()}`;
    copy.name = `${frame.name} (Copy)`;
    copy.isCustom = true;
    if (!copy.overlays) copy.overlays = [];
    
    onSaveFrames([copy, ...frames]);
    handleEditFrame(copy);
  };

  const handleDeleteFrame = (id: string) => {
    if (confirm('Are you sure you want to delete this frame design?')) {
      const updated = frames.filter((f) => f.id !== id);
      onSaveFrames(updated);
    }
  };

  const handleToggleFrameActive = (id: string) => {
    const updated = frames.map((f) => (f.id === id ? { ...f, active: !f.active } : f));
    onSaveFrames(updated);
  };

  const handleCreateFrame = () => {
    if (!newFrameName.trim()) return;

    const defaultSlots: PhotoSlot[] =
      newFrameOrientation === 'portrait'
        ? [
            { id: 1, x: 10, y: 5, width: 80, height: 18 },
            { id: 2, x: 10, y: 26, width: 80, height: 18 },
            { id: 3, x: 10, y: 47, width: 80, height: 18 },
            { id: 4, x: 10, y: 68, width: 80, height: 18 },
          ]
        : [
            { id: 1, x: 5, y: 5, width: 42, height: 40 },
            { id: 2, x: 53, y: 5, width: 42, height: 40 },
            { id: 3, x: 5, y: 50, width: 42, height: 40 },
            { id: 4, x: 53, y: 50, width: 42, height: 40 },
          ];

    const { style } = getStyleAndOrientationForFrame({ category: newFrameCategory, name: newFrameName });

    const mockOverlay = generateMockFrameOverlay(
      style,
      newFrameOrientation,
      defaultSlots
    );

    const newFrame: EventFrame = {
      id: `frame-${Date.now()}`,
      name: newFrameName,
      category: newFrameCategory,
      imageUrl: newFrameImageUrl || mockOverlay,
      backgroundColor: '#FFFFFF',
      slots: defaultSlots,
      overlays: [],
      active: true,
      isCustom: true,
    };

    onSaveFrames([newFrame, ...frames]);
    setNewFrameName('');
    setNewFrameImageUrl('');
    handleEditFrame(newFrame);
  };

  // Add Preset Overlay
  const handleAddPresetOverlay = (option: (typeof PRESET_OVERLAY_OPTIONS)[0]) => {
    if (!editingFrame) return;

    const newOverlay: OverlayItem = {
      id: `overlay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: option.name,
      imageUrl: option.imageUrl,
      x: 35,
      y: 75,
      width: option.defaultWidth,
      height: option.defaultHeight,
      rotation: 0,
      opacity: 1,
      zIndex: (editingFrame.overlays?.length || 0) + 1,
      type: option.type,
    };

    const updatedOverlays = [...(editingFrame.overlays || []), newOverlay];
    setEditingFrame({ ...editingFrame, overlays: updatedOverlays });
    setSelectedType('overlay');
    setSelectedOverlayId(newOverlay.id);
  };

  // Add Custom Image Overlay Photo
  const handleUploadOverlayFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFrame) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG with transparent background recommended).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newOverlay: OverlayItem = {
          id: `overlay-${Date.now()}`,
          name: file.name || 'Custom Overlay',
          imageUrl: reader.result,
          x: 30,
          y: 40,
          width: 30,
          height: 25,
          rotation: 0,
          opacity: 1,
          zIndex: (editingFrame.overlays?.length || 0) + 1,
          type: 'image',
        };

        setEditingFrame({
          ...editingFrame,
          overlays: [...(editingFrame.overlays || []), newOverlay],
        });
        setSelectedType('overlay');
        setSelectedOverlayId(newOverlay.id);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Text Overlay
  const handleAddTextOverlay = () => {
    if (!editingFrame || !customText.trim()) return;

    const newOverlay: OverlayItem = {
      id: `text-${Date.now()}`,
      name: `Text: "${customText.slice(0, 12)}"`,
      imageUrl: '',
      x: 25,
      y: 85,
      width: 50,
      height: 10,
      rotation: 0,
      opacity: 1,
      zIndex: (editingFrame.overlays?.length || 0) + 1,
      type: 'text',
      text: customText.trim(),
      textColor: customTextColor,
      fontSize: customTextSize,
    };

    setEditingFrame({
      ...editingFrame,
      overlays: [...(editingFrame.overlays || []), newOverlay],
    });
    setSelectedType('overlay');
    setSelectedOverlayId(newOverlay.id);
  };

  // Delete Overlay
  const handleDeleteOverlay = (overlayId: string) => {
    if (!editingFrame) return;
    const updated = (editingFrame.overlays || []).filter((o) => o.id !== overlayId);
    setEditingFrame({ ...editingFrame, overlays: updated });
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null);
    }
  };

  // Move Overlay zIndex
  const handleMoveOverlayLayer = (overlayId: string, direction: 'up' | 'down') => {
    if (!editingFrame || !editingFrame.overlays) return;
    const list = [...editingFrame.overlays];
    const idx = list.findIndex((o) => o.id === overlayId);
    if (idx === -1) return;

    if (direction === 'up' && idx < list.length - 1) {
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
    } else if (direction === 'down' && idx > 0) {
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
    }

    // Re-index
    list.forEach((item, i) => {
      item.zIndex = i + 1;
    });

    setEditingFrame({ ...editingFrame, overlays: list });
  };

  // Duplicate Overlay
  const handleDuplicateOverlay = (overlayId: string) => {
    if (!editingFrame || !editingFrame.overlays) return;
    const item = editingFrame.overlays.find((o) => o.id === overlayId);
    if (!item) return;

    const dup: OverlayItem = {
      ...item,
      id: `overlay-dup-${Date.now()}`,
      x: Math.min(80, item.x + 5),
      y: Math.min(80, item.y + 5),
      zIndex: editingFrame.overlays.length + 1,
    };

    setEditingFrame({
      ...editingFrame,
      overlays: [...editingFrame.overlays, dup],
    });
    setSelectedType('overlay');
    setSelectedOverlayId(dup.id);
  };

  // Apply Photo Slot Presets
  const handleApplySlotPreset = (preset: 'strip-3' | 'strip-4' | 'grid-2x2' | 'single-hero' | 'polaroid-2' | 'polaroid-3') => {
    if (!editingFrame) return;
    let newSlots: PhotoSlot[] = [];
    if (preset === 'strip-3') {
      newSlots = [
        { id: 1, x: 10, y: 6, width: 80, height: 26 },
        { id: 2, x: 10, y: 36, width: 80, height: 26 },
        { id: 3, x: 10, y: 66, width: 80, height: 26 },
      ];
    } else if (preset === 'strip-4') {
      newSlots = [
        { id: 1, x: 10, y: 4, width: 80, height: 20 },
        { id: 2, x: 10, y: 27, width: 80, height: 20 },
        { id: 3, x: 10, y: 50, width: 80, height: 20 },
        { id: 4, x: 10, y: 73, width: 80, height: 20 },
      ];
    } else if (preset === 'grid-2x2') {
      newSlots = [
        { id: 1, x: 6, y: 6, width: 42, height: 42 },
        { id: 2, x: 52, y: 6, width: 42, height: 42 },
        { id: 3, x: 6, y: 52, width: 42, height: 42 },
        { id: 4, x: 52, y: 52, width: 42, height: 42 },
      ];
    } else if (preset === 'single-hero') {
      newSlots = [
        { id: 1, x: 8, y: 8, width: 84, height: 75 },
      ];
    } else if (preset === 'polaroid-2') {
      newSlots = [
        { id: 1, x: 10, y: 8, width: 80, height: 38 },
        { id: 2, x: 10, y: 52, width: 80, height: 38 },
      ];
    } else if (preset === 'polaroid-3') {
      newSlots = [
        { id: 1, x: 12, y: 5, width: 76, height: 25 },
        { id: 2, x: 12, y: 34, width: 76, height: 25 },
        { id: 3, x: 12, y: 63, width: 76, height: 25 },
      ];
    }
    setEditingFrame({ ...editingFrame, slots: newSlots });
    setSelectedSlotId(1);
    setSelectedType('slot');
  };

  const handleCenterSlotHorizontally = () => {
    if (!editingFrame || selectedSlotId === null) return;
    const updated = editingFrame.slots.map((s) => {
      if (s.id !== selectedSlotId) return s;
      const newX = Math.round(((100 - s.width) / 2) * 10) / 10;
      return { ...s, x: newX };
    });
    setEditingFrame({ ...editingFrame, slots: updated });
  };

  const handleCenterSlotVertically = () => {
    if (!editingFrame || selectedSlotId === null) return;
    const updated = editingFrame.slots.map((s) => {
      if (s.id !== selectedSlotId) return s;
      const newY = Math.round(((100 - s.height) / 2) * 10) / 10;
      return { ...s, y: newY };
    });
    setEditingFrame({ ...editingFrame, slots: updated });
  };

  const handleDistributeSlotsVertically = () => {
    if (!editingFrame || editingFrame.slots.length < 2) return;
    const count = editingFrame.slots.length;
    const sorted = [...editingFrame.slots].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((sum, s) => sum + s.height, 0);
    const availableSpace = Math.max(0, 100 - totalHeight);
    const gap = availableSpace / (count + 1);

    let currentY = gap;
    const updated = sorted.map((slot) => {
      const newY = Math.round(currentY * 10) / 10;
      currentY += slot.height + gap;
      return { ...slot, y: newY };
    });

    setEditingFrame({ ...editingFrame, slots: updated });
  };

  // Add Photo Slot
  const handleAddSlot = () => {
    if (!editingFrame) return;
    const nextId = Math.max(0, ...editingFrame.slots.map((s) => s.id)) + 1;
    const newSlot: PhotoSlot = {
      id: nextId,
      x: 10,
      y: Math.min(75, 10 + (nextId - 1) * 20),
      width: 80,
      height: 20,
    };

    setEditingFrame({
      ...editingFrame,
      slots: [...editingFrame.slots, newSlot],
    });
    setSelectedType('slot');
    setSelectedSlotId(nextId);
  };

  // Delete Photo Slot
  const handleDeleteSlot = (slotId: number) => {
    if (!editingFrame || editingFrame.slots.length <= 1) {
      alert('Photo strip must have at least 1 photo slot!');
      return;
    }
    const updated = editingFrame.slots.filter((s) => s.id !== slotId);
    setEditingFrame({ ...editingFrame, slots: updated });
    if (selectedSlotId === slotId) {
      setSelectedSlotId(updated[0]?.id || null);
    }
  };

  // Stage mouse events for dragging slots or overlays
  const handleStageMouseDown = (
    e: React.MouseEvent,
    type: 'slot' | 'overlay',
    id: number | string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedType(type);
    if (type === 'slot') {
      setSelectedSlotId(id as number);
      setSelectedOverlayId(null);
    } else {
      setSelectedOverlayId(id as string);
      setSelectedSlotId(null);
    }

    setIsDraggingStage(true);

    if (!stageRef.current || !editingFrame) return;
    const stageRect = stageRef.current.getBoundingClientRect();

    let targetX = 0;
    let targetY = 0;

    if (type === 'slot') {
      const slot = editingFrame.slots.find((s) => s.id === id);
      if (slot) {
        targetX = (slot.x / 100) * stageRect.width;
        targetY = (slot.y / 100) * stageRect.height;
      }
    } else {
      const item = editingFrame.overlays?.find((o) => o.id === id);
      if (item) {
        targetX = (item.x / 100) * stageRect.width;
        targetY = (item.y / 100) * stageRect.height;
      }
    }

    const cursorX = e.clientX - stageRect.left;
    const cursorY = e.clientY - stageRect.top;

    setDragOffset({
      x: cursorX - targetX,
      y: cursorY - targetY,
    });
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingStage || !editingFrame || !stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const cursorX = e.clientX - stageRect.left;
    const cursorY = e.clientY - stageRect.top;

    const targetX = cursorX - dragOffset.x;
    const targetY = cursorY - dragOffset.y;

    const percentX = (targetX / stageRect.width) * 100;
    const percentY = (targetY / stageRect.height) * 100;

    if (selectedType === 'slot' && selectedSlotId !== null) {
      const updatedSlots = editingFrame.slots.map((s) => {
        if (s.id !== selectedSlotId) return s;
        const boundedX = Math.max(0, Math.min(100 - s.width, percentX));
        const boundedY = Math.max(0, Math.min(100 - s.height, percentY));
        return {
          ...s,
          x: Math.round(boundedX * 10) / 10,
          y: Math.round(boundedY * 10) / 10,
        };
      });
      setEditingFrame({ ...editingFrame, slots: updatedSlots });
    } else if (selectedType === 'overlay' && selectedOverlayId !== null) {
      const updatedOverlays = (editingFrame.overlays || []).map((o) => {
        if (o.id !== selectedOverlayId) return o;
        const boundedX = Math.max(-20, Math.min(110 - o.width, percentX));
        const boundedY = Math.max(-20, Math.min(110 - o.height, percentY));
        return {
          ...o,
          x: Math.round(boundedX * 10) / 10,
          y: Math.round(boundedY * 10) / 10,
        };
      });
      setEditingFrame({ ...editingFrame, overlays: updatedOverlays });
    }
  };

  const handleStageMouseUp = () => {
    setIsDraggingStage(false);
  };

  const handleSaveEditorChanges = () => {
    if (!editingFrame) return;

    const { style, orientation } = getStyleAndOrientationForFrame(editingFrame);
    
    // Always generate updated base overlay image with exact cutouts for current editingFrame.slots
    const updatedOverlayImage = generateMockFrameOverlay(style, orientation, editingFrame.slots);

    const frameToSave: EventFrame = {
      ...editingFrame,
      imageUrl: updatedOverlayImage,
    };

    const updated = frames.map((f) => (f.id === frameToSave.id ? frameToSave : f));
    onSaveFrames(updated);
    setShowEditor(false);
    setEditingFrame(null);
  };

  const getEditorLayoutOrientation = () => {
    if (!editingFrame) return 'portrait';
    const first = editingFrame.slots[0];
    if (first && first.width < 90 && first.height < 25) return 'portrait';
    if (first && first.width < 50 && first.height < 50) return 'landscape';
    return 'square';
  };

  const orientation = getEditorLayoutOrientation();
  const selectedOverlay = editingFrame?.overlays?.find((o) => o.id === selectedOverlayId);
  const selectedSlot = editingFrame?.slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="flex flex-col gap-6" id="frame-manager-panel">
      {/* Full Photo Strip Design & Overlay Editor Modal */}
      {showEditor && editingFrame && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header Bar */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-display">Photo Strip Design & Overlay Editor</h3>
                  <p className="text-[11px] text-slate-400">Custom design layout, canvas background, photo slots, and graphic overlays</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingFrame(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditorChanges}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-xs uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Save Design
                </button>
              </div>
            </div>

            {/* Modal Main Content Workspace */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* LEFT: Visual Interactive Canvas Stage */}
              <div className="flex-1 bg-slate-950/60 p-6 flex flex-col items-center justify-center overflow-auto relative border-b md:border-b-0 md:border-r border-slate-800">
                
                {/* Visual Stage Controls & Banner */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 w-full max-w-lg px-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-[11px] font-semibold">
                    <Move className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Click & drag photo frames or graphics to position
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSamplePhotos(!showSamplePhotos)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        showSamplePhotos
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Toggle realistic sample photos inside photo frames"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Sample Photos: <span className="uppercase">{showSamplePhotos ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>

                {/* Stage Container */}
                <div
                  ref={stageRef}
                  onMouseMove={handleStageMouseMove}
                  onMouseUp={handleStageMouseUp}
                  onMouseLeave={handleStageMouseUp}
                  className={`relative rounded-2xl shadow-2xl select-none transition-all overflow-hidden border border-white/10 ${
                    orientation === 'portrait'
                      ? 'w-[240px] h-[540px]'
                      : orientation === 'landscape'
                      ? 'w-[480px] h-[320px]'
                      : 'w-[360px] h-[360px]'
                  }`}
                  style={{ backgroundColor: editingFrame.backgroundColor || '#FFFFFF' }}
                  id="visual-editor-stage"
                >
                  {/* Layer 1: Background Base Frame Overlay Image (Masked to cut out photo slots) */}
                  {editingFrame.imageUrl && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <mask id={`stage-frame-mask-${editingFrame.id}`}>
                          <rect x="0" y="0" width="100" height="100" fill="white" />
                          {editingFrame.slots.map((slot) => (
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
                        href={editingFrame.imageUrl}
                        x="0"
                        y="0"
                        width="100"
                        height="100"
                        preserveAspectRatio="none"
                        mask={`url(#stage-frame-mask-${editingFrame.id})`}
                      />
                    </svg>
                  )}

                  {/* Layer 2: Draggable Photo Slots / Photo Frames */}
                  {editingFrame.slots.map((slot, index) => {
                    const isSelected = selectedType === 'slot' && selectedSlotId === slot.id;

                    return (
                      <div
                        key={slot.id}
                        onMouseDown={(e) => handleStageMouseDown(e, 'slot', slot.id)}
                        className={`absolute rounded-xl border-2 cursor-move flex flex-col items-center justify-center p-1 transition-all z-20 overflow-hidden ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-600/30 ring-4 ring-indigo-500/30 shadow-xl'
                            : 'border-slate-400/80 bg-slate-900/60 hover:border-white hover:bg-slate-900/80'
                        }`}
                        style={{
                          left: `${slot.x}%`,
                          top: `${slot.y}%`,
                          width: `${slot.width}%`,
                          height: `${slot.height}%`,
                        }}
                      >
                        {showSamplePhotos ? (
                          <img
                            src={SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length]}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none select-none"
                          />
                        ) : null}
                        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-black tracking-wider text-white drop-shadow-md flex items-center gap-1 select-none font-sans bg-black/60 px-2 py-0.5 rounded-md">
                            <Move className="w-3 h-3 text-indigo-300" /> Photo #{slot.id} Frame
                          </span>
                          <span className="text-[9px] text-slate-200 font-mono select-none drop-shadow bg-black/40 px-1 rounded mt-0.5">
                            {slot.width}% × {slot.height}%
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Layer 3: Interactive Overlay Photos & Graphics */}
                  {editingFrame.overlays?.map((overlay) => {
                    const isSelected = selectedType === 'overlay' && selectedOverlayId === overlay.id;

                    return (
                      <div
                        key={overlay.id}
                        onMouseDown={(e) => handleStageMouseDown(e, 'overlay', overlay.id)}
                        className={`absolute cursor-move flex items-center justify-center transition-all z-30 group ${
                          isSelected
                            ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black/50 border border-purple-400 bg-purple-500/10 rounded-lg'
                            : 'hover:ring-1 hover:ring-white/40'
                        }`}
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
                              color: overlay.textColor || '#FFFFFF',
                              fontSize: `${overlay.fontSize || 18}px`,
                              fontWeight: 'bold',
                            }}
                            className="text-center font-display drop-shadow select-none whitespace-nowrap"
                          >
                            {overlay.text}
                          </span>
                        ) : overlay.imageUrl ? (
                          <img
                            src={overlay.imageUrl}
                            alt=""
                            className="w-full h-full object-contain pointer-events-none select-none drop-shadow-md"
                          />
                        ) : null}

                        {/* Selected overlay label badge */}
                        {isSelected && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow pointer-events-none whitespace-nowrap">
                            {overlay.name || 'Overlay'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Editor Control Panel */}
              <div className="w-full md:w-[420px] bg-slate-900 flex flex-col h-full overflow-hidden shrink-0">
                
                {/* Navigation Editor Tabs */}
                <div className="grid grid-cols-3 bg-slate-950 p-1.5 border-b border-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setEditorTab('overlays')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      editorTab === 'overlays'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Overlays ({editingFrame.overlays?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('slots')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      editorTab === 'slots'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Slots ({editingFrame.slots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('canvas')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      editorTab === 'canvas'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" /> Canvas
                  </button>
                </div>

                {/* Tab Scrollable Workspace */}
                <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-5">
                  
                  {/* TAB 1: OVERLAY PHOTOS & GRAPHICS */}
                  {editorTab === 'overlays' && (
                    <div className="flex flex-col gap-5">
                      
                      {/* Action 1: Upload Custom Overlay Photo */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                          <Upload className="w-4 h-4" /> Upload Overlay Image
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          Upload custom stickers, logos, watermarks, frame borders, or transparent PNG graphics.
                        </p>
                        
                        <label className="py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-extrabold text-xs rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-2">
                          <ImageIcon className="w-4 h-4" /> Browse PNG / Image File
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUploadOverlayFile}
                          />
                        </label>
                      </div>

                      {/* Action 2: Add Preset Overlay Stickers */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> Preset Stickers & Badges
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {PRESET_OVERLAY_OPTIONS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleAddPresetOverlay(preset)}
                              className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 rounded-xl flex items-center gap-2.5 text-left transition-all group cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-950 p-1 flex items-center justify-center shrink-0 border border-slate-800 group-hover:scale-110 transition-transform">
                                <img src={preset.imageUrl} alt="" className="w-full h-full object-contain" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-[11px] font-bold text-slate-200 block truncate group-hover:text-purple-300">
                                  {preset.name}
                                </span>
                                <span className="text-[9px] text-slate-500 block truncate">{preset.category}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action 3: Add Custom Text Overlay */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                          <Type className="w-4 h-4" /> Add Text Overlay
                        </h4>
                        
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="e.g. WEDDING DAY 2026"
                            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTextColor}
                              onChange={(e) => setCustomTextColor(e.target.value)}
                              className="w-8 h-8 rounded-lg bg-transparent border border-slate-800 cursor-pointer shrink-0"
                              title="Choose text color"
                            />
                            <div className="flex-1 flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Size:</span>
                              <input
                                type="range"
                                min="12"
                                max="48"
                                value={customTextSize}
                                onChange={(e) => setCustomTextSize(parseInt(e.target.value))}
                                className="flex-1 accent-purple-500"
                              />
                              <span className="text-xs font-mono text-purple-300">{customTextSize}px</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddTextOverlay}
                              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                            >
                              Add Text
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Selected Overlay Fine-Tuning Panel */}
                      {selectedOverlay && (
                        <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex flex-col gap-3.5 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-purple-300 flex items-center gap-1.5">
                              <Sliders className="w-4 h-4" /> Selected Overlay Controls
                            </h4>
                            <button
                              type="button"
                              onClick={() => handleDeleteOverlay(selectedOverlay.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1"
                              title="Delete selected overlay"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>

                          {/* Width & Height Sliders */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Width <span>{selectedOverlay.width}%</span>
                              </span>
                              <input
                                type="range"
                                min="5"
                                max="90"
                                value={selectedOverlay.width}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = (editingFrame.overlays || []).map((o) =>
                                    o.id === selectedOverlay.id ? { ...o, width: val } : o
                                  );
                                  setEditingFrame({ ...editingFrame, overlays: updated });
                                }}
                                className="accent-purple-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Height <span>{selectedOverlay.height}%</span>
                              </span>
                              <input
                                type="range"
                                min="5"
                                max="90"
                                value={selectedOverlay.height}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = (editingFrame.overlays || []).map((o) =>
                                    o.id === selectedOverlay.id ? { ...o, height: val } : o
                                  );
                                  setEditingFrame({ ...editingFrame, overlays: updated });
                                }}
                                className="accent-purple-500"
                              />
                            </div>
                          </div>

                          {/* Rotation & Opacity Sliders */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Rotation <span>{selectedOverlay.rotation || 0}°</span>
                              </span>
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                value={selectedOverlay.rotation || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = (editingFrame.overlays || []).map((o) =>
                                    o.id === selectedOverlay.id ? { ...o, rotation: val } : o
                                  );
                                  setEditingFrame({ ...editingFrame, overlays: updated });
                                }}
                                className="accent-purple-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Opacity <span>{Math.round((selectedOverlay.opacity ?? 1) * 100)}%</span>
                              </span>
                              <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={selectedOverlay.opacity ?? 1}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const updated = (editingFrame.overlays || []).map((o) =>
                                    o.id === selectedOverlay.id ? { ...o, opacity: val } : o
                                  );
                                  setEditingFrame({ ...editingFrame, overlays: updated });
                                }}
                                className="accent-purple-500"
                              />
                            </div>
                          </div>

                          {/* Layer order & Duplicate buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-purple-500/20">
                            <button
                              type="button"
                              onClick={() => handleMoveOverlayLayer(selectedOverlay.id, 'up')}
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 border border-slate-800"
                            >
                              <ArrowUp className="w-3 h-3 text-purple-400" /> Layer Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOverlayLayer(selectedOverlay.id, 'down')}
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 border border-slate-800"
                            >
                              <ArrowDown className="w-3 h-3 text-purple-400" /> Layer Down
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateOverlay(selectedOverlay.id)}
                              className="py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-bold text-[10px] rounded-xl flex items-center gap-1 border border-purple-500/30"
                            >
                              <Copy className="w-3 h-3" /> Duplicate
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Active Overlays Layer List */}
                      {editingFrame.overlays && editingFrame.overlays.length > 0 && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-2">
                          <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Active Layer Stack ({editingFrame.overlays.length})
                          </h5>
                          <div className="flex flex-col gap-1.5">
                            {editingFrame.overlays.map((item, idx) => (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setSelectedType('overlay');
                                  setSelectedOverlayId(item.id);
                                }}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                  selectedOverlayId === item.id
                                    ? 'bg-purple-600/20 border-purple-500 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[9px] font-mono text-purple-400 font-bold">#{idx + 1}</span>
                                  <span className="text-xs font-bold truncate">{item.name || item.text || 'Overlay'}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOverlay(item.id);
                                    }}
                                    className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB 2: PHOTO SLOTS (PHOTO FRAMES) LAYOUT */}
                  {editorTab === 'slots' && (
                    <div className="flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                            Photo Frames & Slots ({editingFrame.slots.length})
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">Define where captured guest photos are placed on your custom frame</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSlot}
                          className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Frame Slot
                        </button>
                      </div>

                      {/* Quick Layout Presets */}
                      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          ⚡ Quick Photo Frame Presets
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('strip-4')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            4-Photo Strip
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('strip-3')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            3-Photo Strip
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('grid-2x2')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            2x2 Grid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('single-hero')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            1 Big Frame
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('polaroid-2')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            2 Stacked
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySlotPreset('polaroid-3')}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
                          >
                            Polaroid Style
                          </button>
                        </div>
                      </div>

                      {/* Align & Auto-Space Tools */}
                      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-indigo-300">Align:</span>
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <button
                            type="button"
                            onClick={handleCenterSlotHorizontally}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Center selected photo frame horizontally"
                          >
                            Center X
                          </button>
                          <button
                            type="button"
                            onClick={handleCenterSlotVertically}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Center selected photo frame vertically"
                          >
                            Center Y
                          </button>
                          <button
                            type="button"
                            onClick={handleDistributeSlotsVertically}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Space photo frames evenly from top to bottom"
                          >
                            Space Evenly
                          </button>
                        </div>
                      </div>

                      {/* Slot selector chips */}
                      <div className="grid grid-cols-4 gap-2">
                        {editingFrame.slots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedType('slot');
                              setSelectedSlotId(s.id);
                              setSelectedOverlayId(null);
                            }}
                            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                              selectedSlotId === s.id && selectedType === 'slot'
                                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                                : 'bg-slate-950 text-slate-400 hover:bg-slate-850'
                            }`}
                          >
                            Frame #{s.id}
                          </button>
                        ))}
                      </div>

                      {/* Selected Slot Fine-Tuning */}
                      {selectedSlot && selectedType === 'slot' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black uppercase text-indigo-300">
                              Fine-Tune Slot #{selectedSlot.id}
                            </h5>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(selectedSlot.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove Slot
                            </button>
                          </div>

                          {/* Position Controls */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Position X <span>{selectedSlot.x}%</span>
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="90"
                                value={selectedSlot.x}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = editingFrame.slots.map((s) =>
                                    s.id === selectedSlot.id ? { ...s, x: val } : s
                                  );
                                  setEditingFrame({ ...editingFrame, slots: updated });
                                }}
                                className="accent-indigo-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Position Y <span>{selectedSlot.y}%</span>
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="90"
                                value={selectedSlot.y}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = editingFrame.slots.map((s) =>
                                    s.id === selectedSlot.id ? { ...s, y: val } : s
                                  );
                                  setEditingFrame({ ...editingFrame, slots: updated });
                                }}
                                className="accent-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Width & Height */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Width <span>{selectedSlot.width}%</span>
                              </span>
                              <input
                                type="range"
                                min="10"
                                max="95"
                                value={selectedSlot.width}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = editingFrame.slots.map((s) =>
                                    s.id === selectedSlot.id ? { ...s, width: val } : s
                                  );
                                  setEditingFrame({ ...editingFrame, slots: updated });
                                }}
                                className="accent-indigo-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                Height <span>{selectedSlot.height}%</span>
                              </span>
                              <input
                                type="range"
                                min="5"
                                max="95"
                                value={selectedSlot.height}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = editingFrame.slots.map((s) =>
                                    s.id === selectedSlot.id ? { ...s, height: val } : s
                                  );
                                  setEditingFrame({ ...editingFrame, slots: updated });
                                }}
                                className="accent-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CANVAS & FRAME BASE SETTINGS */}
                  {editorTab === 'canvas' && (
                    <div className="flex flex-col gap-5">
                      
                      {/* Frame Title */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-2.5">
                        <label className="text-xs font-black uppercase text-blue-400 tracking-wider">
                          Design Name
                        </label>
                        <input
                          type="text"
                          value={editingFrame.name}
                          onChange={(e) => setEditingFrame({ ...editingFrame, name: e.target.value })}
                          className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                        />
                      </div>

                      {/* Canvas Fill Background Color */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <label className="text-xs font-black uppercase text-blue-400 tracking-wider">
                          Canvas Fill Background Color
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {CANVAS_BG_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setEditingFrame({ ...editingFrame, backgroundColor: preset.value })}
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                                editingFrame.backgroundColor === preset.value
                                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                                  : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className="w-6 h-6 rounded-lg border border-white/20 shadow-inner"
                                style={{ backgroundColor: preset.value }}
                              />
                              <span className="text-[9px] font-bold text-slate-300 truncate">{preset.name}</span>
                            </button>
                          ))}
                        </div>

                        {/* Custom Hex Picker */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Custom Hex:</span>
                          <input
                            type="color"
                            value={editingFrame.backgroundColor || '#FFFFFF'}
                            onChange={(e) => setEditingFrame({ ...editingFrame, backgroundColor: e.target.value })}
                            className="w-8 h-8 rounded-lg bg-transparent border border-slate-800 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-300 uppercase">
                            {editingFrame.backgroundColor || '#FFFFFF'}
                          </span>
                        </div>
                      </div>

                      {/* Base Overlay Frame PNG */}
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <label className="text-xs font-black uppercase text-blue-400 tracking-wider">
                          Base Frame Overlay PNG
                        </label>

                        {editingFrame.imageUrl && (
                          <div className="relative w-full h-28 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-2 group">
                            <img
                              src={editingFrame.imageUrl}
                              alt="Base frame PNG"
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingFrame({ ...editingFrame, imageUrl: '' })}
                              className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow"
                              title="Clear base PNG"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <label className="py-2.5 px-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 text-slate-300 font-bold text-xs rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4 text-blue-400" />
                          {editingFrame.imageUrl ? 'Replace Base Overlay PNG' : 'Upload Base Overlay PNG'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    setEditingFrame({ ...editingFrame, imageUrl: reader.result });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>

                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Design New Photo Strip Frame Section */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 flex items-center gap-1.5 mb-4">
          <FolderPlus className="w-4 h-4 text-indigo-400" /> Create & Design New Photo Strip
        </h3>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-semibold">Frame Title</label>
              <input
                type="text"
                value={newFrameName}
                onChange={(e) => setNewFrameName(e.target.value)}
                placeholder="e.g. Vintage Floral Celebration"
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-semibold">Category</label>
              <select
                value={newFrameCategory}
                onChange={(e) => setNewFrameCategory(e.target.value)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none"
              >
                <option value="Wedding">Wedding</option>
                <option value="Birthday">Birthday</option>
                <option value="Graduation">Graduation</option>
                <option value="Corporate">Corporate</option>
                <option value="Modern">Modern</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-semibold">Layout Orientation</label>
              <select
                value={newFrameOrientation}
                onChange={(e) => setNewFrameOrientation(e.target.value as any)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none"
              >
                <option value="portrait">Traditional 2x6 Strip (Portrait)</option>
                <option value="landscape">Classic 4x6 Grid (Landscape)</option>
                <option value="square">Modern 2x2 Grid (Square)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-semibold">Frame Base Image (Optional - PNG with transparency)</label>
            
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 hover:border-slate-700'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-indigo-400 animate-pulse" />
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-300">
                    Drag & Drop PNG overlay or <span className="text-indigo-400 underline">browse files</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, WebP</p>
                </div>
              </div>

              {newFrameImageUrl && (
                <div className="w-full sm:w-48 bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col items-center justify-between gap-2.5 relative group">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Preview</span>
                  <div className="w-full h-24 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-1.5 border border-slate-800">
                    <img
                      src={newFrameImageUrl}
                      alt="Uploaded overlay preview"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewFrameImageUrl('');
                    }}
                    className="absolute top-2 right-2 p-1 bg-rose-600 text-white rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800/50">
            <button
              onClick={handleCreateFrame}
              disabled={!newFrameName.trim()}
              className="py-2.5 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create & Open Design Editor
            </button>
          </div>
        </div>
      </div>

      {/* Active Photo Strips Directory */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 mb-4 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-400" /> Photo Strip Designs Directory ({frames.length})
        </h3>

        <div className="flex flex-col gap-3">
          {frames.map((frame) => {
            const isStrip = frame.slots[0] && frame.slots[0].width < 90 && frame.slots[0].height < 25;
            const styleLabel = isStrip ? '2x6 Portrait Strip' : '4x6 Landscape Grid';
            const overlayCount = frame.overlays?.length || 0;

            return (
              <div
                key={frame.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-850 hover:border-slate-800 transition-all gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl border border-slate-800 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden relative shadow-inner"
                    style={{ backgroundColor: frame.backgroundColor || '#0f172a' }}
                  >
                    {frame.imageUrl ? (
                      <img src={frame.imageUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-indigo-400 font-mono">GRID</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-sm text-slate-100 truncate">{frame.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{frame.category}</span> • <span>{styleLabel}</span> • <span>{frame.slots.length} photo slots</span>
                      {overlayCount > 0 && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full font-bold text-[9px]">
                          {overlayCount} overlays
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleFrameActive(frame.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      frame.active
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 hover:bg-slate-750'
                    }`}
                  >
                    {frame.active ? <Check className="w-3.5 h-3.5" /> : null}
                    {frame.active ? 'Active' : 'Disabled'}
                  </button>

                  {/* Edit Design */}
                  <button
                    onClick={() => handleEditFrame(frame)}
                    className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Edit Photo Strip Design & Overlays"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Design
                  </button>

                  {/* Duplicate Design */}
                  <button
                    onClick={() => handleDuplicateFrame(frame)}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    title="Duplicate Design Variant"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteFrame(frame.id)}
                    className="p-2 bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-900/40 text-rose-400 rounded-xl transition-all cursor-pointer"
                    title="Delete Frame Design"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
