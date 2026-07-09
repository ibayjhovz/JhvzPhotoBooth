import React, { useState } from 'react';
import { Camera, Printer, Settings, Globe, ShieldCheck, Moon, Sun } from 'lucide-react';
import { PhotoboothEvent, CompanionStatus, AppSettings } from '../types';

interface WelcomeScreenProps {
  activeEvent: PhotoboothEvent;
  companionStatus: CompanionStatus;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  onStart: () => void;
  onOpenAdmin: () => void;
}

export default function WelcomeScreen({
  activeEvent,
  companionStatus,
  settings,
  setSettings,
  onStart,
  onOpenAdmin,
}: WelcomeScreenProps) {
  const [pin, setPin] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinError, setPinError] = useState(false);

  const handleAdminClick = () => {
    setShowPinPrompt(true);
    setPinError(false);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      onOpenAdmin();
      setShowPinPrompt(false);
      setPin('');
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const toggleLanguage = () => {
    const nextLang: Record<'en' | 'es' | 'fr' | 'de', 'en' | 'es' | 'fr' | 'de'> = {
      en: 'es',
      es: 'fr',
      fr: 'de',
      de: 'en',
    };
    setSettings({
      ...settings,
      language: nextLang[settings.language],
    });
  };

  const translate = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      welcome: {
        en: 'Welcome to the Photobooth',
        es: 'Bienvenido al Cabina de Fotos',
        fr: 'Bienvenue au Photobooth',
        de: 'Willkommen beim Fotoautomat',
      },
      tapStart: {
        en: 'Tap Screen to Start',
        es: 'Toque la Pantalla para Comenzar',
        fr: 'Appuyez pour Démarrer',
        de: 'Tippen zum Starten',
      },
      enterPin: {
        en: 'Enter Admin PIN',
        es: 'Ingrese PIN de Admin',
        fr: 'Entrer le code Admin',
        de: 'Admin-PIN eingeben',
      },
      submit: {
        en: 'Verify',
        es: 'Verificar',
        fr: 'Vérifier',
        de: 'Verifizieren',
      },
      cancel: {
        en: 'Cancel',
        es: 'Cancelar',
        fr: 'Annuler',
        de: 'Abbrechen',
      },
      invalidPin: {
        en: 'Invalid PIN. Try "1234"',
        es: 'PIN inválido. Intente "1234"',
        fr: 'Code incorrect. Essayer "1234"',
        de: 'Falscher PIN. Versuchen Sie "1234"',
      },
      camera: {
        en: 'Camera',
        es: 'Cámara',
        fr: 'Appareil photo',
        de: 'Kamera',
      },
      printer: {
        en: 'Printer',
        es: 'Impresora',
        fr: 'Imprimante',
        de: 'Drucker',
      },
    };
    return dict[key]?.[settings.language] || key;
  };

  return (
    <div
      className="relative min-h-screen flex flex-col justify-between items-center p-6 md:p-12 overflow-hidden select-none bg-transparent text-white"
      id="welcome-view"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      {/* Top Header Row / Navigation */}
      <div className="w-full max-w-6xl flex justify-between items-center z-10 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl px-6 py-4 shadow-xl">
        {/* Event Logo or Branding */}
        <div className="flex items-center gap-3">
          {activeEvent.logoUrl ? (
            <img
              src={activeEvent.logoUrl}
              alt="Event Logo"
              className="w-11 h-11 rounded-2xl object-cover shadow-lg border border-white/20"
              referrerPolicy="no-referrer"
              id="event-logo"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
              P
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-sm tracking-tight uppercase leading-none text-white">
              {activeEvent.name}
            </h1>
            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mt-1">Photobooth Pro</p>
          </div>
        </div>

        {/* Toolbar (Lang, Dark Mode, Connection status) */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* DSLR Connection Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md shadow-sm border ${
              companionStatus.cameraConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-white/5 text-slate-300 border-white/10'
            }`}
            title={
              companionStatus.cameraConnected
                ? `DSLR Connected: ${companionStatus.cameraModel}`
                : 'DSLR Offline (Webcam Fallback Enabled)'
            }
          >
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">
              {companionStatus.cameraConnected ? companionStatus.cameraModel : translate('camera')}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                companionStatus.cameraConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`}
            ></span>
          </div>

          {/* Printer Connection Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md shadow-sm border ${
              companionStatus.printerConnected
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                : 'bg-white/5 text-slate-300 border-white/10'
            }`}
            title={
              companionStatus.printerConnected
                ? `Printer Ready: ${companionStatus.printerModel}`
                : 'Printer Offline (PDF Download Enabled)'
            }
          >
            <Printer className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">
              {companionStatus.printerConnected ? 'DNP Printer' : translate('printer')}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                companionStatus.printerConnected ? 'bg-blue-400 animate-pulse' : 'bg-slate-400'
              }`}
            ></span>
          </div>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="p-2 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all flex items-center gap-1.5 text-slate-200"
            title="Switch Language"
          >
            <Globe className="w-4 h-4 text-blue-400" />
            <span className="text-xs uppercase font-extrabold">{settings.language}</span>
          </button>

          {/* Light/Dark Toggle */}
          <button
            onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
            className="p-2 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all text-slate-200"
            title="Toggle Light/Dark Theme"
          >
            {settings.darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Kiosk Center Section */}
      <div className="flex flex-col items-center justify-center max-w-3xl text-center my-auto z-10 p-4">
        {/* Event Header Card */}
        <div className="mb-10 animate-fade-in">
          <p className="text-xs font-bold tracking-[0.25em] text-blue-300 uppercase mb-3">
            {translate('welcome')}
          </p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight font-display drop-shadow-lg mb-5 text-white">
            {activeEvent.name}
          </h2>
          <div className="h-1 w-28 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
        </div>

        {/* Big Pulsing Touch Trigger with neon-glow */}
        <div className="group relative">
          {/* Glowing background blur rings */}
          <div className="absolute -inset-2 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full blur-[24px] opacity-40 group-hover:opacity-60 group-hover:blur-[28px] transition-all duration-500"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 animate-ping opacity-25 pointer-events-none duration-1000"></div>

          <button
            onClick={onStart}
            className="relative flex items-center justify-center w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-slate-900/90 dark:bg-slate-950/90 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/20 hover:border-white/40 shadow-2xl select-none cursor-pointer"
            id="btn-start-session"
          >
            <div className="flex flex-col items-center justify-center p-6">
              <Camera className="w-12 sm:w-14 h-12 sm:h-14 mb-4 text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-purple-400 animate-float" style={{ animationDuration: '3s' }} />
              <span className="text-sm sm:text-base font-black tracking-[0.15em] uppercase text-white leading-tight max-w-[150px]">
                {translate('tapStart')}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Footer Area */}
      <div className="w-full max-w-6xl flex justify-between items-center border-t border-white/10 pt-6 z-10">
        <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 backdrop-blur-md px-4 py-2 border border-white/5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="font-semibold tracking-wide uppercase text-[9px]">Kiosk Active • Companion Live Link</span>
        </div>

        {/* Admin padlock trigger */}
        <button
          onClick={handleAdminClick}
          className="p-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all text-white/50 hover:text-indigo-400"
          title="Admin Settings"
          id="btn-admin-panel"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Admin PIN Prompt Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handlePinSubmit}
            className="bg-white/5 dark:bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-scale-up"
          >
            <Settings className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-spin-slow" />
            <h3 className="text-lg font-bold text-white mb-2 font-display">{translate('enterPin')}</h3>
            <p className="text-xs text-white/60 mb-5">Provide PIN to access control dashboard.</p>

            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              placeholder="••••"
              maxLength={4}
              className={`w-full px-4 py-3 text-2xl text-center tracking-[0.5em] bg-black/40 border ${
                pinError ? 'border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'border-white/10 text-white'
              } rounded-xl focus:outline-none focus:border-blue-500 mb-2 font-mono`}
              autoFocus
              id="admin-pin-input"
            />

            {pinError && (
              <p className="text-xs text-rose-400 font-semibold mb-4 animate-shake">
                {translate('invalidPin')}
              </p>
            )}

            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPinPrompt(false);
                  setPin('');
                }}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                {translate('cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
              >
                {translate('submit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
