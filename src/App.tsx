import React, { useState, useEffect } from 'react';
import {
  EventFrame, PhotoboothEvent, CompanionStatus, EmailConfig, PrinterConfig, AppSettings, Session, AppView
} from './types';
import {
  DEFAULT_FRAMES, DEFAULT_EVENTS, DEFAULT_EMAIL_CONFIG, DEFAULT_PRINTER_CONFIG, DEFAULT_SETTINGS, generateMockFrameOverlay
} from './utils/assets';
import { initAuth, db } from './utils/firebaseAuth';
import { getOrCreateFolder, uploadPhotostripToDrive } from './utils/googleDrive';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';

// Subcomponents imports
import WelcomeScreen from './components/WelcomeScreen';
import FrameSelection from './components/FrameSelection';
import EmailCapture from './components/EmailCapture';
import CaptureWorkflow from './components/CaptureWorkflow';
import PhotostripCanvas from './components/PhotostripCanvas';
import FinalPreview from './components/FinalPreview';
import AdminDashboard from './components/AdminDashboard';
import { Sparkles, Heart, Download, Loader2 } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<AppView>('welcome');
  const [frames, setFrames] = useState<EventFrame[]>([]);
  const [events, setEvents] = useState<PhotoboothEvent[]>(() => {
    try {
      const saved = localStorage.getItem('photobooth_events');
      return saved ? JSON.parse(saved) : DEFAULT_EVENTS;
    } catch {
      return DEFAULT_EVENTS;
    }
  });
  const [activeEventId, setActiveEventId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('photobooth_active_event_id');
      return saved || DEFAULT_EVENTS[0].id;
    } catch {
      return DEFAULT_EVENTS[0].id;
    }
  });

  // Guest details state
  const [selectedFrameId, setSelectedFrameId] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [photostripUrl, setPhotostripUrl] = useState<string>('');

  // Config parameters
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    try {
      const saved = localStorage.getItem('photobooth_email_config');
      return saved ? JSON.parse(saved) : DEFAULT_EMAIL_CONFIG;
    } catch {
      return DEFAULT_EMAIL_CONFIG;
    }
  });
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    try {
      const saved = localStorage.getItem('photobooth_printer_config');
      return saved ? JSON.parse(saved) : DEFAULT_PRINTER_CONFIG;
    } catch {
      return DEFAULT_PRINTER_CONFIG;
    }
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('photobooth_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Session records database
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('photobooth_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // WebSocket Server Connection states
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);
  const [reconnectCounter, setReconnectCounter] = useState(0);

  // Companion status state (defaults to dev fallback simulation)
  const [companionStatus, setCompanionStatus] = useState<CompanionStatus>({
    cameraConnected: false,
    cameraModel: 'Webcam Lens Fallback',
    cameraBattery: 92,
    printerConnected: false,
    printerModel: 'DNP DS620',
    printerStatus: 'Idle Ready',
    storageUsage: '1.45 GB of 10.0 GB (14.5% used)',
    totalPrints: 15,
    totalEmails: 12,
    devMode: true,
    defaultSmtpConfigured: false,
  });

  // Helper to safely write to localStorage without crashing
  const safeSaveLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[LOCAL STORAGE WARNING] Quota exceeded or storage full for key: ${key}`, err);
    }
  };

  // Sync state changes to localStorage safely
  useEffect(() => {
    safeSaveLocalStorage('photobooth_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    safeSaveLocalStorage('photobooth_active_event_id', activeEventId);
  }, [activeEventId]);

  useEffect(() => {
    safeSaveLocalStorage('photobooth_email_config', JSON.stringify(emailConfig));
  }, [emailConfig]);

  useEffect(() => {
    safeSaveLocalStorage('photobooth_printer_config', JSON.stringify(printerConfig));
  }, [printerConfig]);

  useEffect(() => {
    safeSaveLocalStorage('photobooth_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Sanitize sessions to strip heavy raw base64 PNG data URLs before caching in local storage.
    // Highly compressed JPEG data URLs are extremely compact (~30KB-80KB) and are preserved
    // permanently in local storage for a seamless instant loading experience.
    const sanitized = sessions.map((s, idx) => {
      // Only sanitize heavy raw PNG images (starts with data:image/png) for sessions beyond the first 5.
      // Do NOT sanitize compressed JPEGs (starts with data:image/jpeg), URLs, or recent sessions.
      if (idx >= 5 && s.photostripUrl && s.photostripUrl.startsWith('data:image/png')) {
        return { ...s, photostripUrl: '' };
      }
      return s;
    });
    safeSaveLocalStorage('photobooth_sessions', JSON.stringify(sanitized));
  }, [sessions]);

  // Test connection and subscribe to Firestore collections for real-time synchronization across devices
  useEffect(() => {
    // 1. Test database connection on boot
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('[FIRESTORE] Connection verified successfully!');
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.warn('[FIRESTORE] Client appears offline or connection failed.');
        }
      }
    };
    testConnection();

    // 2. Subscribe to Frames
    const unsubscribeFrames = onSnapshot(collection(db, 'frames'), (snapshot) => {
      const dbFrames: EventFrame[] = [];
      snapshot.forEach((doc) => {
        dbFrames.push(doc.data() as EventFrame);
      });

      if (dbFrames.length > 0) {
        const hydratedDbFrames = dbFrames.map((frame) => {
          if (!frame.imageUrl || !frame.imageUrl.startsWith('data:image')) {
            let style: 'wedding' | 'birthday' | 'graduation' | 'corporate' | 'neon' | 'film' | 'retro' | 'vintage' = 'wedding';
            let orientation: 'portrait' | 'landscape' | 'square' = 'portrait';

            if (frame.id.includes('wedding')) style = 'wedding';
            else if (frame.id.includes('birthday')) style = 'birthday';
            else if (frame.id.includes('graduation')) style = 'graduation';
            else if (frame.id.includes('corporate')) style = 'corporate';
            else if (frame.id.includes('neon')) style = 'neon';
            else if (frame.id.includes('film')) style = 'film';
            else if (frame.id.includes('retro') || frame.id.includes('polaroid')) style = 'retro';
            else if (frame.id.includes('vintage')) style = 'vintage';

            if (frame.id.includes('portrait')) orientation = 'portrait';
            else if (frame.id.includes('landscape')) orientation = 'landscape';
            else if (frame.id.includes('square')) orientation = 'square';

            return {
              ...frame,
              imageUrl: generateMockFrameOverlay(style, orientation, frame.slots),
            };
          }
          return frame;
        });
        setFrames(hydratedDbFrames);

        // Auto-seed any newly added DEFAULT_FRAMES that do not exist in the database yet
        const missingFrames = DEFAULT_FRAMES.filter((df) => !dbFrames.some((dbf) => dbf.id === df.id));
        if (missingFrames.length > 0) {
          missingFrames.forEach((frame) => {
            let style: 'wedding' | 'birthday' | 'graduation' | 'corporate' | 'neon' | 'film' | 'retro' | 'vintage' = 'wedding';
            let orientation: 'portrait' | 'landscape' | 'square' = 'portrait';

            if (frame.id.includes('wedding')) style = 'wedding';
            else if (frame.id.includes('birthday')) style = 'birthday';
            else if (frame.id.includes('graduation')) style = 'graduation';
            else if (frame.id.includes('corporate')) style = 'corporate';
            else if (frame.id.includes('neon')) style = 'neon';
            else if (frame.id.includes('film')) style = 'film';
            else if (frame.id.includes('retro') || frame.id.includes('polaroid')) style = 'retro';
            else if (frame.id.includes('vintage')) style = 'vintage';

            if (frame.id.includes('portrait')) orientation = 'portrait';
            else if (frame.id.includes('landscape')) orientation = 'landscape';
            else if (frame.id.includes('square')) orientation = 'square';

            const overlay = generateMockFrameOverlay(style, orientation, frame.slots);
            const hydrated = {
              ...frame,
              imageUrl: overlay,
            };

            setDoc(doc(db, 'frames', frame.id), hydrated)
              .catch((err) => console.error('[FIRESTORE] Error seeding missing frame:', frame.id, err));
          });
        }
      } else {
        // Hydrate default frames if Firestore is empty
        const hydrated = DEFAULT_FRAMES.map((frame) => {
          let style: 'wedding' | 'birthday' | 'graduation' | 'corporate' | 'neon' | 'film' | 'retro' | 'vintage' = 'wedding';
          let orientation: 'portrait' | 'landscape' | 'square' = 'portrait';

          if (frame.id.includes('wedding')) style = 'wedding';
          else if (frame.id.includes('birthday')) style = 'birthday';
          else if (frame.id.includes('graduation')) style = 'graduation';
          else if (frame.id.includes('corporate')) style = 'corporate';
          else if (frame.id.includes('neon')) style = 'neon';
          else if (frame.id.includes('film')) style = 'film';
          else if (frame.id.includes('retro') || frame.id.includes('polaroid')) style = 'retro';
          else if (frame.id.includes('vintage')) style = 'vintage';

          if (frame.id.includes('portrait')) orientation = 'portrait';
          else if (frame.id.includes('landscape')) orientation = 'landscape';
          else if (frame.id.includes('square')) orientation = 'square';

          const overlay = generateMockFrameOverlay(style, orientation, frame.slots);
          return {
            ...frame,
            imageUrl: overlay,
          };
        });

        hydrated.forEach((f) => {
          setDoc(doc(db, 'frames', f.id), f).catch(err => console.error('[FIRESTORE] Error seeding frame:', err));
        });
        setFrames(hydrated);
      }
    }, (error) => {
      console.error('[FIRESTORE] Frames subscription error:', error);
    });

    // 3. Subscribe to Events
    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const dbEvents: PhotoboothEvent[] = [];
      snapshot.forEach((doc) => {
        dbEvents.push(doc.data() as PhotoboothEvent);
      });

      if (dbEvents.length > 0) {
        setEvents(dbEvents);
      } else {
        // Seed default events to database
        DEFAULT_EVENTS.forEach((e) => {
          setDoc(doc(db, 'events', e.id), e).catch(err => console.error('[FIRESTORE] Error seeding event:', err));
        });
        setEvents(DEFAULT_EVENTS);
      }
    }, (error) => {
      console.error('[FIRESTORE] Events subscription error:', error);
    });

    // 4. Subscribe to Sessions
    const unsubscribeSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const dbSessions: Session[] = [];
      snapshot.forEach((doc) => {
        dbSessions.push(doc.data() as Session);
      });
      dbSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Load current local sessions directly from localStorage to safely merge
      let localSessions: Session[] = [];
      try {
        const saved = localStorage.getItem('photobooth_sessions');
        localSessions = saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.warn('[FIRESTORE-SYNC] Error loading local sessions for sync:', err);
      }

      // We only ever sync sessions that are explicitly marked as local-only (newly captured but not yet on Firestore)
      const localOnlySessions = localSessions.filter((s) => s.isLocalOnly);

      // Map Firestore sessions and ensure isLocalOnly is removed/false since they are safely on Firestore
      const cleanedDbSessions = dbSessions.map((dbS) => {
        if (dbS.isLocalOnly) {
          const { isLocalOnly, ...rest } = dbS;
          return rest as Session;
        }
        return dbS;
      });

      const merged = [...cleanedDbSessions];
      let hasLocalSyncs = false;

      // Sync local-only sessions to Firestore
      localOnlySessions.forEach((local) => {
        if (!merged.some((dbS) => dbS.id === local.id)) {
          merged.push(local);
          hasLocalSyncs = true;
          // Upload to Firestore, stripping the isLocalOnly flag for the database
          const { isLocalOnly, ...toUpload } = local;
          setDoc(doc(db, 'sessions', local.id), toUpload).catch((err) => {
            console.error('[FIRESTORE-SYNC] Background sync error for session:', local.id, err);
          });
        }
      });

      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(merged);
    }, (error) => {
      console.error('[FIRESTORE] Sessions subscription error:', error);
    });

    // 5. Subscribe to Configs (Saves configurations & active event settings across devices)
    const unsubscribeConfigs = onSnapshot(collection(db, 'configs'), (snapshot) => {
      let hasEmailConfig = false;
      let hasPrinterConfig = false;
      let hasAppSettings = false;
      let hasActiveEventId = false;

      snapshot.forEach((doc) => {
        const id = doc.id;
        const data = doc.data();
        if (id === 'email_config') {
          setEmailConfig(data as EmailConfig);
          hasEmailConfig = true;
        } else if (id === 'printer_config') {
          setPrinterConfig(data as PrinterConfig);
          hasPrinterConfig = true;
        } else if (id === 'app_settings') {
          setSettings(data as AppSettings);
          hasAppSettings = true;
        } else if (id === 'active_event_id') {
          if (data.value) {
            setActiveEventId(data.value);
            hasActiveEventId = true;
          }
        }
      });

      // Seed default configs if they do not exist in Firestore yet (creates them on first boot)
      if (!hasEmailConfig) {
        setDoc(doc(db, 'configs', 'email_config'), emailConfig).catch(err => console.error('[FIRESTORE] Error seeding email config:', err));
      }
      if (!hasPrinterConfig) {
        setDoc(doc(db, 'configs', 'printer_config'), printerConfig).catch(err => console.error('[FIRESTORE] Error seeding printer config:', err));
      }
      if (!hasAppSettings) {
        setDoc(doc(db, 'configs', 'app_settings'), settings).catch(err => console.error('[FIRESTORE] Error seeding app settings:', err));
      }
      if (!hasActiveEventId && activeEventId) {
        setDoc(doc(db, 'configs', 'active_event_id'), { value: activeEventId }).catch(err => console.error('[FIRESTORE] Error seeding active event id:', err));
      }
    }, (error) => {
      console.error('[FIRESTORE] Configs subscription error:', error);
    });

    return () => {
      unsubscribeFrames();
      unsubscribeEvents();
      unsubscribeSessions();
      unsubscribeConfigs();
    };
  }, []);

  // Sync frames locally safely
  useEffect(() => {
    if (frames.length > 0) {
      const sanitized = frames.map((f) => {
        if (f.imageUrl && f.imageUrl.startsWith('data:image')) {
          return { ...f, imageUrl: '' };
        }
        return f;
      });
      safeSaveLocalStorage('photobooth_frames', JSON.stringify(sanitized));
    }
  }, [frames]);

  // Initialize Firebase Auth listener for Google Drive
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setSettings((prev) => ({
          ...prev,
          driveConfig: {
            enabled: prev.driveConfig?.enabled ?? false,
            folderName: prev.driveConfig?.folderName ?? 'Photobooth Kiosk Photos',
            connectedEmail: user.email || '',
            connectedName: user.displayName || '',
            accessToken: token
          }
        }));
      },
      () => {
        setSettings((prev) => ({
          ...prev,
          driveConfig: prev.driveConfig ? {
            ...prev.driveConfig,
            connectedEmail: '',
            connectedName: '',
            accessToken: null
          } : undefined
        }));
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Query parameter detection state for scanning QR codes to download photostrip
  const [downloadStripUrl, setDownloadStripUrl] = useState<string | null>(null);
  const [isLoadingDownload, setIsLoadingDownload] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get('download');
    if (downloadId) {
      setView('download-only');
      setIsLoadingDownload(true);
      fetch(`/api/photostrips/${downloadId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.image) {
            setDownloadStripUrl(data.image);
          }
          setIsLoadingDownload(false);
        })
        .catch((err) => {
          console.error('Failed to fetch scanned photostrip:', err);
          setIsLoadingDownload(false);
        });
    }
  }, []);

  // 2. Align default selected frame with active event's frameId
  const activeEvent = events.find((e) => e.id === activeEventId) || events[0];
  useEffect(() => {
    if (activeEvent) {
      setSelectedFrameId(activeEvent.frameId);
    }
  }, [activeEventId]);

  // 3. Connect to full-stack Express WebSocket companion server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log(`Establishing WS link with Companion Server: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WS Connection succeeded: Companion online!');
      setCompanionStatus((prev) => ({
        ...prev,
        cameraConnected: true,
        cameraModel: 'EOS R5 (USB)',
        printerConnected: true,
        devMode: false,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status:sync') {
          setCompanionStatus(data.status);
        } else if (data.type === 'email:sent') {
          console.log('Companion reports email dispatched successfully!');
        }
      } catch (err) {
        console.error('WS incoming message parse failed:', err);
      }
    };

    ws.onclose = () => {
      console.warn('WS link closed. Utilizing browser simulation mode.');
    };

    setWsSocket(ws);

    return () => {
      ws.close();
    };
  }, [reconnectCounter]);

  const triggerReconnection = () => {
    setReconnectCounter((prev) => prev + 1);
  };

  // State handlers
  const handleStartSession = () => {
    setView('frame-select');
  };

  const handleFrameSelected = (frame: EventFrame) => {
    setSelectedFrameId(frame.id);
    setView('email-capture');
  };

  const handleEmailConfirmed = (email: string, name?: string) => {
    setGuestEmail(email);
    setGuestName(name || '');
    setView('capture');
  };

  const handlePhotosCompleted = (photos: string[]) => {
    setCapturedPhotos(photos);
    setPhotostripUrl(''); // Reset previous strip url to trigger dynamic canvas composition screen
    setView('preview');
  };

  const handleNewSession = () => {
    // Navigate through quick, friendly thank you View before resetting
    setView('thank-you');
  };

  // Reset core states back to Welcome screen
  useEffect(() => {
    if (view === 'thank-you') {
      const timer = setTimeout(() => {
        setGuestEmail('');
        setGuestName('');
        setCapturedPhotos([]);
        setPhotostripUrl('');
        setSelectedFrameId(activeEvent.frameId);
        setView('welcome');
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [view]);

  const handleSaveSessionRecord = async (session: Session) => {
    // Save locally first to be responsive, marked as local-only
    const localSession = { ...session, isLocalOnly: true };
    setSessions((prev) => [localSession, ...prev]);

    // Update companion totals dynamically
    setCompanionStatus((prev) => ({
      ...prev,
      totalPrints: prev.totalPrints + (session.printed ? session.printCount : 0),
      totalEmails: prev.totalEmails + 1,
    }));

    // Save session to Firestore
    try {
      // Strip isLocalOnly flag when saving to Firestore
      const { isLocalOnly, ...toUpload } = localSession;
      await setDoc(doc(db, 'sessions', session.id), toUpload);
    } catch (err) {
      console.error('[FIRESTORE] Error saving session:', err);
    }

    // If Google Drive automatic upload is configured
    const driveConfig = settings.driveConfig;
    const isManualDrive = driveConfig?.authMethod === 'manual';
    const activeDriveToken = isManualDrive ? driveConfig?.manualToken : driveConfig?.accessToken;

    if (driveConfig?.enabled && activeDriveToken && !session.driveFileId) {
      console.log('[DRIVE] Auto-uploading photostrip to Google Drive...');
      try {
        const folderId = await getOrCreateFolder(
          activeDriveToken,
          driveConfig.folderName || 'Photobooth Kiosk Photos'
        );
        const fileName = `Photostrip_${session.id}.png`;
        const result = await uploadPhotostripToDrive(
          activeDriveToken,
          session.photostripUrl,
          fileName,
          folderId
        );
        
        console.log('[DRIVE] Auto-upload succeeded! File ID:', result.id);
        
        // Update the session in state with the Drive info
        const updatedSession = { ...session, driveFileId: result.id, driveViewLink: result.webViewLink };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === session.id
              ? updatedSession
              : s
          )
        );

        // Sync updated Drive info to Firestore
        try {
          await setDoc(doc(db, 'sessions', session.id), updatedSession);
        } catch (fErr) {
          console.error('[FIRESTORE] Error updating Drive info:', fErr);
        }
      } catch (err) {
        console.error('[DRIVE] Auto-upload failed:', err);
      }
    }
  };

  const handleDeleteSessionRecord = async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteDoc(doc(db, 'sessions', id));
    } catch (err) {
      console.error('[FIRESTORE] Error deleting session:', err);
    }
  };

  const handleSaveFrames = async (updatedFrames: EventFrame[]) => {
    setFrames(updatedFrames);
    for (const f of updatedFrames) {
      try {
        await setDoc(doc(db, 'frames', f.id), f);
      } catch (err) {
        console.error('[FIRESTORE] Error saving frame:', err);
      }
    }
  };

  const handleSaveEvents = async (updatedEvents: PhotoboothEvent[]) => {
    setEvents(updatedEvents);
    for (const e of updatedEvents) {
      try {
        await setDoc(doc(db, 'events', e.id), e);
      } catch (err) {
        console.error('[FIRESTORE] Error saving event:', err);
      }
    }
  };

  const handleSaveEmailConfig = async (updated: EmailConfig) => {
    setEmailConfig(updated);
    try {
      await setDoc(doc(db, 'configs', 'email_config'), updated);
    } catch (err) {
      console.error('[FIRESTORE] Error saving email config:', err);
    }
  };

  const handleSavePrinterConfig = async (updated: PrinterConfig) => {
    setPrinterConfig(updated);
    try {
      await setDoc(doc(db, 'configs', 'printer_config'), updated);
    } catch (err) {
      console.error('[FIRESTORE] Error saving printer config:', err);
    }
  };

  const handleSaveSettings = async (updated: AppSettings) => {
    setSettings(updated);
    try {
      await setDoc(doc(db, 'configs', 'app_settings'), updated);
    } catch (err) {
      console.error('[FIRESTORE] Error saving settings:', err);
    }
  };

  const handleSetActiveEventId = async (id: string) => {
    setActiveEventId(id);
    try {
      await setDoc(doc(db, 'configs', 'active_event_id'), { value: id });
    } catch (err) {
      console.error('[FIRESTORE] Error saving active event id:', err);
    }
  };

  const currentSelectedFrame = frames.find((f) => f.id === selectedFrameId) || frames[0];

  return (
    <div className={`min-h-screen ${settings.darkMode ? 'dark bg-slate-950 text-white' : 'bg-white text-slate-900'} transition-colors duration-300 font-sans`}>
      {/* View router switcher */}
      {view === 'welcome' && (
        <WelcomeScreen
          activeEvent={activeEvent}
          companionStatus={companionStatus}
          settings={settings}
          setSettings={handleSaveSettings}
          onStart={handleStartSession}
          onOpenAdmin={() => setView('admin')}
        />
      )}

      {view === 'frame-select' && (
        <FrameSelection
          frames={frames}
          selectedFrameId={selectedFrameId}
          onSelect={handleFrameSelected}
          onBack={() => setView('welcome')}
          themeColor={activeEvent.themeColor}
        />
      )}

      {view === 'email-capture' && (
        <EmailCapture
          onConfirm={handleEmailConfirmed}
          onBack={() => setView('frame-select')}
          privacyPolicy={settings.privacyPolicy}
        />
      )}

      {view === 'capture' && currentSelectedFrame && (
        <CaptureWorkflow
          activeEvent={activeEvent}
          selectedFrame={currentSelectedFrame}
          companionStatus={companionStatus}
          onPhotosComplete={handlePhotosCompleted}
          onBack={() => setView('welcome')}
          wsSocket={wsSocket}
        />
      )}

      {view === 'preview' && currentSelectedFrame && (
        <>
          {photostripUrl ? (
            <FinalPreview
              photostripUrl={photostripUrl}
              guestEmail={guestEmail}
              guestName={guestName}
              activeEvent={activeEvent}
              selectedFrame={currentSelectedFrame}
              companionStatus={companionStatus}
              onNewSession={handleNewSession}
              wsSocket={wsSocket}
              saveSession={handleSaveSessionRecord}
              settings={settings}
              emailConfig={emailConfig}
              onSaveSettings={handleSaveSettings}
            />
          ) : (
            <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 select-none">
              <PhotostripCanvas
                photos={capturedPhotos}
                frame={currentSelectedFrame}
                onGenerated={(url) => setPhotostripUrl(url)}
              />
            </div>
          )}
        </>
      )}

      {view === 'thank-you' && (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in" id="thank-you-view">
          <div className="relative flex items-center justify-center mb-6">
            <Heart className="w-20 h-20 text-rose-500 fill-rose-500/10 animate-beat" />
            <Sparkles className="w-8 h-8 text-indigo-400 absolute animate-pulse" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            Thank You!
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-sm mx-auto leading-relaxed mb-8">
            Your high-resolution memories are being dispatched. Have an amazing time at the event!
          </p>

          <div className="px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-full text-slate-500 text-xs font-bold tracking-widest uppercase animate-pulse">
            Resetting photobooth kiosk in a moment...
          </div>
        </div>
      )}

      {view === 'admin' && (
        <AdminDashboard
          frames={frames}
          onSaveFrames={handleSaveFrames}
          events={events}
          onSaveEvents={handleSaveEvents}
          activeEventId={activeEventId}
          onSetActiveEventId={handleSetActiveEventId}
          companionStatus={companionStatus}
          emailConfig={emailConfig}
          onSaveEmailConfig={handleSaveEmailConfig}
          printerConfig={printerConfig}
          onSavePrinterConfig={handleSavePrinterConfig}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          sessions={sessions}
          onDeleteSession={handleDeleteSessionRecord}
          onClose={() => setView('welcome')}
          wsSocket={wsSocket}
          triggerReconnection={triggerReconnection}
        />
      )}

      {view === 'download-only' && (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center select-none animate-fade-in" id="download-only-view">
          <div className="w-full max-w-sm bg-slate-900/85 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
            <div className="relative flex items-center justify-center mb-4">
              <Sparkles className="w-12 h-12 text-blue-400 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black font-display text-white mb-1">Your Photostrip!</h2>
            <p className="text-xs text-slate-400 mb-6">Long-press on the image below to save it to your phone, or tap Download.</p>

            {isLoadingDownload ? (
              <div className="h-96 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Loading your memories...</span>
              </div>
            ) : downloadStripUrl ? (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2 shadow-inner max-w-[260px]">
                  <img
                    src={downloadStripUrl}
                    alt="Your photostrip"
                    className="max-h-[50vh] rounded-lg shadow-2xl object-contain mx-auto select-text touch-callout-default"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <a
                  href={downloadStripUrl}
                  download={`photostrip_${Date.now()}.png`}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Save to Device
                </a>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-2">
                <p className="text-sm font-bold text-rose-400">Photostrip Not Found</p>
                <p className="text-xs text-slate-500">This download link may have expired or is incorrect.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
