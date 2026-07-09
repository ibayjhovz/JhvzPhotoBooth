import { EventFrame, PhotoboothEvent, EmailConfig, PrinterConfig, AppSettings } from '../types';

// Helper to generate a styled transparent PNG frame overlay as a base64 Data URL
export function generateMockFrameOverlay(
  style: 'wedding' | 'birthday' | 'graduation' | 'corporate' | 'neon',
  orientation: 'portrait' | 'landscape' | 'square'
): string {
  const canvas = document.createElement('canvas');
  if (orientation === 'portrait') {
    canvas.width = 600;
    canvas.height = 1800;
  } else if (orientation === 'landscape') {
    canvas.width = 1200;
    canvas.height = 800;
  } else {
    canvas.width = 1000;
    canvas.height = 1000;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const w = canvas.width;
  const h = canvas.height;

  // Clear background (fully transparent holes for photos)
  ctx.clearRect(0, 0, w, h);

  // Draw background border/frame
  ctx.lineWidth = orientation === 'portrait' ? 16 : 24;

  if (style === 'wedding') {
    // Elegant Wedding: Creamy border, gold line, floral corner ornaments
    ctx.fillStyle = '#FCFBF7';
    ctx.fillRect(0, 0, w, h);

    // Gold inner border
    ctx.strokeStyle = '#D4AF37';
    ctx.strokeRect(15, 15, w - 30, h - 30);

    // Text Banner area (usually bottom or center depending on layout)
    ctx.fillStyle = '#4A3B32';
    ctx.textAlign = 'center';
    
    if (orientation === 'portrait') {
      // Bottom text
      ctx.font = 'italic 32px "Playfair Display", serif';
      ctx.fillText('Our Wedding', w / 2, h - 120);
      ctx.font = '20px "Inter", sans-serif';
      ctx.fillText('Sarah & Michael • July 8, 2026', w / 2, h - 70);
    } else {
      // Bottom text
      ctx.font = 'italic 38px "Playfair Display", serif';
      ctx.fillText('Sarah & Michael', w / 2, h - 60);
      ctx.font = '18px "Inter", sans-serif';
      ctx.fillText('July 8, 2026', w / 2, h - 25);
    }

    // Draw floral corner indicators
    ctx.fillStyle = '#D4AF37';
    const corners = [[25, 25], [w - 25, 25], [25, h - 25], [w - 25, h - 25]];
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
    });

  } else if (style === 'birthday') {
    // Retro Birthday: Vibrant coral/teal, confetti dots
    ctx.fillStyle = '#1A1B2F'; // Dark neon theme
    ctx.fillRect(0, 0, w, h);

    // Confetti dots
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8E53', '#A061FF'];
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 8 + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Border line
    ctx.strokeStyle = '#4ECDC4';
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    if (orientation === 'portrait') {
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText('PARTY TIME!', w / 2, h - 110);
      ctx.font = '22px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFE66D';
      ctx.fillText('LETS CELEBRATE • 2026', w / 2, h - 65);
    } else {
      ctx.font = 'bold 42px "Space Grotesk", sans-serif';
      ctx.fillText('LETS PARTY!', w / 2, h - 55);
    }

  } else if (style === 'graduation') {
    // Classic Graduation: Navy blue with gold accent cap
    ctx.fillStyle = '#0B132B';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#6FFFE6';
    ctx.strokeRect(18, 18, w - 36, h - 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    if (orientation === 'portrait') {
      ctx.font = 'bold 32px "Inter", sans-serif';
      ctx.fillText('CLASS OF 2026', w / 2, h - 120);
      ctx.font = 'italic 20px "Playfair Display", serif';
      ctx.fillStyle = '#6FFFE6';
      ctx.fillText('Congratulations Graduates!', w / 2, h - 75);
    } else {
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.fillText('CONGRATS GRADUATES!', w / 2, h - 55);
    }

  } else if (style === 'neon') {
    // Cyberpunk Neon
    ctx.fillStyle = '#05050A';
    ctx.fillRect(0, 0, w, h);

    // Glowing border
    ctx.shadowColor = '#FF007F';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#FF007F';
    ctx.strokeRect(15, 15, w - 30, h - 30);

    ctx.shadowColor = '#00F0FF';
    ctx.strokeStyle = '#00F0FF';
    ctx.strokeRect(25, 25, w - 50, h - 50);

    ctx.shadowBlur = 0; // reset
    ctx.fillStyle = '#00F0FF';
    ctx.textAlign = 'center';
    if (orientation === 'portrait') {
      ctx.font = 'bold 34px "Space Grotesk", sans-serif';
      ctx.fillText('P H O T O B O O T H', w / 2, h - 110);
      ctx.font = '18px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FF007F';
      ctx.fillText('[ SYS_ONLINE_2026 ]', w / 2, h - 65);
    } else {
      ctx.font = 'bold 38px "Space Grotesk", sans-serif';
      ctx.fillText('N E O N   V I B E S', w / 2, h - 55);
    }
  } else {
    // Corporate: Clean white, dark grey text, modern branding
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    if (orientation === 'portrait') {
      ctx.font = 'bold 32px "Inter", sans-serif';
      ctx.fillText('ANNUAL SUMMIT 2026', w / 2, h - 115);
      ctx.font = '18px "Inter", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Innovate & Accelerate', w / 2, h - 70);
    } else {
      ctx.font = 'bold 34px "Inter", sans-serif';
      ctx.fillText('ANNUAL CONFERENCE', w / 2, h - 55);
    }
  }

  // VERY IMPORTANT: Draw transparent transparent holes where photos will sit!
  // To make a PNG transparent hole in our mock base64 canvas overlay:
  // We use globalCompositeOperation = 'destination-out' and fill the photo slots!
  ctx.globalCompositeOperation = 'destination-out';

  const slots = getSlotsForOrientation(orientation);
  slots.forEach(slot => {
    // Convert percentages back to actual pixels
    const px = (slot.x / 100) * w;
    const py = (slot.y / 100) * h;
    const pw = (slot.width / 100) * w;
    const ph = (slot.height / 100) * h;

    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    // Draw rounded rect or standard rect for slots
    ctx.beginPath();
    const radius = 10; // small rounded corners for photos
    ctx.roundRect ? ctx.roundRect(px, py, pw, ph, radius) : ctx.rect(px, py, pw, ph);
    ctx.fill();
  });

  // Restore composite operation
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toDataURL('image/png');
}

function getSlotsForOrientation(orientation: 'portrait' | 'landscape' | 'square') {
  if (orientation === 'portrait') {
    // 2x6 Portrait strip: 4 stacked photos
    // Height total 1800. Photos take width 88% (x: 6), height 19.5% each
    return [
      { id: 1, x: 7, y: 4, width: 86, height: 19.5 },
      { id: 2, x: 7, y: 25.5, width: 86, height: 19.5 },
      { id: 3, x: 7, y: 47, width: 86, height: 19.5 },
      { id: 4, x: 7, y: 68.5, width: 86, height: 19.5 },
    ];
  } else if (orientation === 'landscape') {
    // 4x6 Landscape grid: 2x2 grid
    // Width 1200, height 800. 4 photos
    return [
      { id: 1, x: 5, y: 5, width: 43, height: 40 },
      { id: 2, x: 52, y: 5, width: 43, height: 40 },
      { id: 3, x: 5, y: 48, width: 43, height: 40 },
      { id: 4, x: 52, y: 48, width: 43, height: 40 },
    ];
  } else {
    // Square 2x2 grid
    // Width 1000, height 1000.
    return [
      { id: 1, x: 6, y: 6, width: 41, height: 41 },
      { id: 2, x: 53, y: 6, width: 41, height: 41 },
      { id: 3, x: 6, y: 53, width: 41, height: 41 },
      { id: 4, x: 53, y: 53, width: 41, height: 41 },
    ];
  }
}

// Generate the frames statically so they are available instantly
export const DEFAULT_FRAMES: EventFrame[] = [
  {
    id: 'frame-wedding-portrait',
    name: 'Elegant Gold Wedding (Strip)',
    category: 'Wedding',
    imageUrl: '', // Will be hydrated at runtime in App.tsx
    slots: getSlotsForOrientation('portrait'),
    active: true,
  },
  {
    id: 'frame-birthday-portrait',
    name: 'Retro Neon Celebration (Strip)',
    category: 'Birthday',
    imageUrl: '', // Will be hydrated at runtime
    slots: getSlotsForOrientation('portrait'),
    active: true,
  },
  {
    id: 'frame-graduation-landscape',
    name: 'Class of 2026 (Grid)',
    category: 'Graduation',
    imageUrl: '', // Will be hydrated at runtime
    slots: getSlotsForOrientation('landscape'),
    active: true,
  },
  {
    id: 'frame-corporate-square',
    name: 'Tech Summit Modern (Square)',
    category: 'Corporate',
    imageUrl: '', // Will be hydrated at runtime
    slots: getSlotsForOrientation('square'),
    active: true,
  },
  {
    id: 'frame-neon-landscape',
    name: 'Cyberpunk Electro (Grid)',
    category: 'Modern',
    imageUrl: '', // Will be hydrated at runtime
    slots: getSlotsForOrientation('landscape'),
    active: true,
  }
];

export const DEFAULT_EVENTS: PhotoboothEvent[] = [
  {
    id: 'event-wedding',
    name: 'Sarah & Michael Wedding',
    logoUrl: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    frameId: 'frame-wedding-portrait',
    themeColor: '#D4AF37',
    countdownDuration: 5,
    countdownStyle: 'classic',
    emailSubject: 'Your Sarah & Michael Wedding Photostrip 🌸',
    emailBody: 'Thank you for celebrating our special day with us! Here is your high-resolution photostrip from the booth. Feel free to share it with friends and family!',
    printCopies: 1,
    autoPrint: false,
  },
  {
    id: 'event-birthday',
    name: 'Retro Confetti 21st Birthday',
    logoUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    frameId: 'frame-birthday-portrait',
    themeColor: '#FF6B6B',
    countdownDuration: 3,
    countdownStyle: 'neon',
    emailSubject: 'Happy 21st Birthday Photobooth Memories 🎉',
    emailBody: 'What an amazing night! Attached is your photostrip from the party. Keep rocking and sharing the vibes!',
    printCopies: 2,
    autoPrint: true,
  }
];

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  senderName: 'Photobooth Pro Companion',
  senderEmail: 'booth@photoboothpro.local',
  smtpHost: 'localhost',
  smtpPort: 1025,
  smtpUser: '',
  smtpPass: '',
  messageTemplate: 'Hi there!\n\nAttached is your professional photostrip from our photobooth. Thank you for joining us!\n\nBest regards,\nThe Event Team',
  logoUrl: '',
};

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  selectedPrinter: 'DNP DS620 (USB)',
  paperSize: '4x6',
  quality: 'High',
  borderless: true,
  copies: 1,
  autoPrint: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  language: 'en',
  maxRetakes: 3,
  storagePath: './captured',
  autoCleanup: false,
  privacyPolicy: 'We respect your privacy. Emails are collected solely for delivering your photostrips and will not be shared with third parties or used for unsolicited marketing.',
  termsOfUse: 'By using this photobooth, you agree to allow the event host to capture images for event gallery display. No commercial usage will occur without consent.',
  customSharingUrl: '',
  driveConfig: {
    enabled: false,
    folderName: 'https://drive.google.com/drive/folders/1sssc9TkaI3XlgdNvk3ImhBfYHXJyYzV0?usp=sharing',
    connectedEmail: '',
    connectedName: '',
    accessToken: null,
  },
};
