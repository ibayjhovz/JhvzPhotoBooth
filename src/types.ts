export interface PhotoSlot {
  id: number;
  x: number; // percentage-based or absolute pixel based? Let's use percentage (0-100) for responsive drag-and-drop scaling!
  y: number;
  width: number;
  height: number;
  angle?: number;
}

export interface EventFrame {
  id: string;
  name: string;
  category: string;
  imageUrl: string; // Background frame overlay with transparent regions
  slots: PhotoSlot[];
  active: boolean;
  isCustom?: boolean;
}

export interface PhotoboothEvent {
  id: string;
  name: string;
  logoUrl?: string;
  frameId: string;
  themeColor: string; // HEX color or tailwind class
  countdownDuration: number; // 3, 5, 10
  countdownStyle: 'classic' | 'modern' | 'neon' | 'playful';
  emailSubject: string;
  emailBody: string;
  printCopies: number;
  autoPrint: boolean;
}

export interface Session {
  id: string;
  date: string; // ISO string
  guestEmail: string;
  guestName?: string;
  frameId: string;
  photos: string[]; // Base64 data urls of the 4 captured raw photos
  photostripUrl: string; // Base64 or local URL of combined photostrip
  printed: boolean;
  emailed: boolean;
  printCount: number;
  duration: number; // in seconds
  driveFileId?: string;
  driveViewLink?: string;
}

export interface CompanionStatus {
  cameraConnected: boolean;
  cameraModel?: string;
  cameraBattery?: number;
  printerConnected: boolean;
  printerModel?: string;
  printerStatus?: string;
  storageUsage: string;
  totalPrints: number;
  totalEmails: number;
  devMode: boolean;
}

export interface EmailConfig {
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  messageTemplate: string;
  logoUrl?: string;
}

export interface PrinterConfig {
  selectedPrinter: string;
  paperSize: '4x6' | '2x6' | '8x10' | 'square';
  quality: 'Standard' | 'High' | 'Fine';
  borderless: boolean;
  copies: number;
  autoPrint: boolean;
}

export interface GoogleDriveConfig {
  enabled: boolean;
  folderName: string;
  connectedEmail?: string;
  connectedName?: string;
  accessToken?: string | null;
}

export interface AppSettings {
  darkMode: boolean;
  language: 'en' | 'es' | 'fr' | 'de';
  maxRetakes: number;
  storagePath: string;
  autoCleanup: boolean;
  privacyPolicy: string;
  termsOfUse: string;
  customSharingUrl?: string;
  driveConfig?: GoogleDriveConfig;
}

export type AppView =
  | 'welcome'
  | 'frame-select'
  | 'email-capture'
  | 'capture'
  | 'preview'
  | 'thank-you'
  | 'admin'
  | 'download-only';
