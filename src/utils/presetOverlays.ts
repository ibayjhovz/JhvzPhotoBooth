import { OverlayItem } from '../types';

export interface PresetOverlayOption {
  id: string;
  name: string;
  category: 'Stickers' | 'Badges & Stamps' | 'Celebration' | 'Logos & Watermarks';
  imageUrl: string;
  defaultWidth: number;
  defaultHeight: number;
  type: 'sticker' | 'image' | 'logo';
}

// Generate high quality SVG data URLs for preset overlay graphics
const createSvgDataUrl = (svgContent: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
};

export const PRESET_OVERLAY_OPTIONS: PresetOverlayOption[] = [
  {
    id: 'vip-gold-badge',
    name: 'VIP Gold Badge',
    category: 'Badges & Stamps',
    defaultWidth: 22,
    defaultHeight: 18,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
        <defs>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFE066" />
            <stop offset="50%" stop-color="#F59E0B" />
            <stop offset="100%" stop-color="#B45309" />
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="180" height="140" rx="20" fill="url(#gold)" stroke="#FFF" stroke-width="6" />
        <rect x="20" y="20" width="160" height="120" rx="14" fill="#0F172A" />
        <text x="100" y="70" font-family="Arial, sans-serif" font-weight="900" font-size="36" fill="url(#gold)" text-anchor="middle" letter-spacing="4">VIP</text>
        <text x="100" y="105" font-family="Arial, sans-serif" font-weight="700" font-size="14" fill="#FFF" text-anchor="middle" letter-spacing="3">PASS • PHOTOBOOTH</text>
      </svg>
    `),
  },
  {
    id: 'gold-wedding-rings',
    name: 'Golden Wedding Rings',
    category: 'Celebration',
    defaultWidth: 20,
    defaultHeight: 15,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
        <defs>
          <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FEF08A" />
            <stop offset="100%" stop-color="#EAB308" />
          </linearGradient>
        </defs>
        <circle cx="75" cy="75" r="45" fill="none" stroke="url(#goldRing)" stroke-width="16" />
        <circle cx="125" cy="75" r="45" fill="none" stroke="url(#goldRing)" stroke-width="16" />
        <path d="M 75 20 L 80 32 L 70 32 Z" fill="#FFF" />
      </svg>
    `),
  },
  {
    id: 'champagne-toast',
    name: 'Party Champagne Glasses',
    category: 'Celebration',
    defaultWidth: 20,
    defaultHeight: 20,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <path d="M 60 40 L 90 120 L 90 160 M 65 160 L 115 160" stroke="#FBBF24" stroke-width="10" stroke-linecap="round" fill="none" />
        <path d="M 60 40 Q 75 10 90 40 Q 90 90 75 110 Q 60 90 60 40 Z" fill="#FEF08A" opacity="0.8" />
        <path d="M 140 40 L 110 120 L 110 160 M 85 160 L 135 160" stroke="#FBBF24" stroke-width="10" stroke-linecap="round" fill="none" />
        <path d="M 140 40 Q 125 10 110 40 Q 110 90 125 110 Q 140 90 140 40 Z" fill="#FEF08A" opacity="0.8" />
        <circle cx="100" cy="30" r="6" fill="#FFF" />
        <circle cx="95" cy="15" r="4" fill="#FFF" />
        <circle cx="108" cy="22" r="5" fill="#FFF" />
      </svg>
    `),
  },
  {
    id: 'neon-heart',
    name: 'Neon Glow Heart',
    category: 'Stickers',
    defaultWidth: 18,
    defaultHeight: 18,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <path d="M 100 165 C 100 165 20 110 20 60 C 20 25 50 10 75 25 C 90 35 100 50 100 50 C 100 50 110 35 125 25 C 150 10 180 25 180 60 C 180 110 100 165 100 165 Z"
              fill="none" stroke="#EC4899" stroke-width="14" filter="url(#glow)" stroke-linejoin="round" />
        <path d="M 100 165 C 100 165 20 110 20 60 C 20 25 50 10 75 25 C 90 35 100 50 100 50 C 100 50 110 35 125 25 C 150 10 180 25 180 60 C 180 110 100 165 100 165 Z"
              fill="none" stroke="#FFF" stroke-width="5" stroke-linejoin="round" />
      </svg>
    `),
  },
  {
    id: 'happy-birthday-ribbon',
    name: 'Happy Birthday Banner',
    category: 'Celebration',
    defaultWidth: 45,
    defaultHeight: 15,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120">
        <path d="M 20 30 Q 200 10 380 30 L 370 90 Q 200 110 30 90 Z" fill="#3B82F6" stroke="#FFF" stroke-width="6" />
        <text x="200" y="72" font-family="Arial, sans-serif" font-weight="900" font-size="28" fill="#FFF" text-anchor="middle" letter-spacing="2">HAPPY BIRTHDAY!</text>
      </svg>
    `),
  },
  {
    id: 'camera-watermark-logo',
    name: 'Camera Watermark Logo',
    category: 'Logos & Watermarks',
    defaultWidth: 25,
    defaultHeight: 18,
    type: 'logo',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
        <rect x="20" y="40" width="200" height="100" rx="16" fill="#1E293B" stroke="#64748B" stroke-width="4" />
        <path d="M 80 40 L 95 20 L 145 20 L 160 40 Z" fill="#334155" />
        <circle cx="120" cy="90" r="32" fill="#0F172A" stroke="#38BDF8" stroke-width="6" />
        <circle cx="120" cy="90" r="16" fill="#38BDF8" />
        <circle cx="180" cy="60" r="8" fill="#EF4444" />
        <text x="120" y="152" font-family="Arial, sans-serif" font-weight="800" font-size="10" fill="#94A3B8" text-anchor="middle" letter-spacing="2">PHOTOBOOTH PRO</text>
      </svg>
    `),
  },
  {
    id: 'retro-date-stamp',
    name: 'Retro Date Stamp (\'26)',
    category: 'Badges & Stamps',
    defaultWidth: 22,
    defaultHeight: 22,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="85" fill="none" stroke="#F43F5E" stroke-width="8" stroke-dasharray="10 6" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="#F43F5E" stroke-width="4" />
        <text x="100" y="85" font-family="'Courier New', monospace" font-weight="900" font-size="22" fill="#F43F5E" text-anchor="middle">OFFICIAL</text>
        <text x="100" y="115" font-family="'Courier New', monospace" font-weight="900" font-size="28" fill="#F43F5E" text-anchor="middle">2026</text>
        <text x="100" y="140" font-family="'Courier New', monospace" font-weight="900" font-size="16" fill="#F43F5E" text-anchor="middle">MEMORIES</text>
      </svg>
    `),
  },
  {
    id: 'sparkles-burst',
    name: 'Golden Sparkles',
    category: 'Stickers',
    defaultWidth: 18,
    defaultHeight: 18,
    type: 'sticker',
    imageUrl: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <path d="M 100 20 Q 100 100 20 100 Q 100 100 100 180 Q 100 100 180 100 Q 100 100 100 20 Z" fill="#F59E0B" />
        <path d="M 150 40 Q 150 70 120 70 Q 150 70 150 100 Q 150 70 180 70 Q 150 70 150 40 Z" fill="#FBBF24" />
        <path d="M 50 130 Q 50 150 30 150 Q 50 150 50 170 Q 50 150 70 150 Q 50 150 50 130 Z" fill="#FDE047" />
      </svg>
    `),
  },
];

export const CANVAS_BG_PRESETS = [
  { name: 'Pure White', value: '#FFFFFF' },
  { name: 'Dark Slate', value: '#0F172A' },
  { name: 'Vintage Cream', value: '#FEFCE8' },
  { name: 'Blush Pink', value: '#FDF2F8' },
  { name: 'Gold Champagne', value: '#FEF3C7' },
  { name: 'Mint Fresh', value: '#ECFDF5' },
  { name: 'Sky Cyan', value: '#F0F9FF' },
  { name: 'Midnight Cyber', value: '#030712' },
];
