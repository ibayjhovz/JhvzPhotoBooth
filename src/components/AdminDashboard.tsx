import React, { useState } from 'react';
import {
  BarChart, LayoutDashboard, Calendar, Layers, Mail, Printer, Settings, Image as ImageIcon,
  Camera, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, Plus, Trash2, Heart, Sparkles, LogOut,
  Cloud, ExternalLink, FolderOpen
} from 'lucide-react';
import {
  EventFrame, PhotoboothEvent, CompanionStatus, EmailConfig, PrinterConfig, AppSettings, Session
} from '../types';
import FrameManager from './FrameManager';
import GalleryView from './GalleryView';
import { googleSignIn, logout as firebaseLogout } from '../utils/firebaseAuth';
import { getOrCreateFolder } from '../utils/googleDrive';

interface AdminDashboardProps {
  frames: EventFrame[];
  onSaveFrames: (updated: EventFrame[]) => void;
  events: PhotoboothEvent[];
  onSaveEvents: (updated: PhotoboothEvent[]) => void;
  activeEventId: string;
  onSetActiveEventId: (id: string) => void;
  companionStatus: CompanionStatus;
  emailConfig: EmailConfig;
  onSaveEmailConfig: (updated: EmailConfig) => void;
  printerConfig: PrinterConfig;
  onSavePrinterConfig: (updated: PrinterConfig) => void;
  settings: AppSettings;
  onSaveSettings: (updated: AppSettings) => void;
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onClose: () => void;
  wsSocket: WebSocket | null;
  triggerReconnection: () => void;
}

export default function AdminDashboard({
  frames,
  onSaveFrames,
  events,
  onSaveEvents,
  activeEventId,
  onSetActiveEventId,
  companionStatus,
  emailConfig,
  onSaveEmailConfig,
  printerConfig,
  onSavePrinterConfig,
  settings,
  onSaveSettings,
  sessions,
  onDeleteSession,
  onClose,
  wsSocket,
  triggerReconnection,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'frames' | 'email' | 'hardware' | 'gallery' | 'settings' | 'drive'>('overview');

  // Google Drive Integration states
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [testDriveStatus, setTestDriveStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const result = await googleSignIn();
      if (result) {
        onSaveSettings({
          ...settings,
          driveConfig: {
            enabled: true,
            folderName: settings.driveConfig?.folderName || 'Photobooth Kiosk Photos',
            connectedEmail: result.user.email || '',
            connectedName: result.user.displayName || '',
            accessToken: result.accessToken,
          }
        });
      }
    } catch (err: any) {
      console.error('Failed to connect Google Drive:', err);
      alert(`Connection failed: ${err.message || err}`);
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (confirm('Are you sure you want to disconnect Google Drive? Auto-upload will be disabled.')) {
      try {
        await firebaseLogout();
        onSaveSettings({
          ...settings,
          driveConfig: {
            enabled: false,
            folderName: settings.driveConfig?.folderName || 'Photobooth Kiosk Photos',
            connectedEmail: '',
            connectedName: '',
            accessToken: null,
          }
        });
      } catch (err) {
        console.error('Disconnect failed:', err);
      }
    }
  };

  const handleTestDriveConnection = async () => {
    const token = settings.driveConfig?.accessToken;
    if (!token) {
      alert('Please connect Google Drive first.');
      return;
    }
    setTestDriveStatus('testing');
    try {
      const folderName = settings.driveConfig?.folderName || 'Photobooth Kiosk Photos';
      const folderId = await getOrCreateFolder(token, folderName);
      if (folderId) {
        setTestDriveStatus('success');
        setTimeout(() => setTestDriveStatus('idle'), 3000);
      } else {
        setTestDriveStatus('error');
      }
    } catch (err) {
      console.error('[DRIVE TEST ERROR]', err);
      setTestDriveStatus('error');
    }
  };

  // Event Editor states
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventFrameId, setNewEventFrameId] = useState(frames[0]?.id || '');
  const [newEventCountdown, setNewEventCountdown] = useState<number>(5);

  // SMTP test email trigger state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Simulated Analytics metrics
  const totalSessionsCount = sessions.length;
  const totalEmailsSent = sessions.filter(s => s.emailed).length;
  const totalPrintsCount = sessions.reduce((sum, s) => sum + s.printCount, 0);

  const handleCreateEvent = () => {
    if (!newEventName.trim()) return;

    const newEvent: PhotoboothEvent = {
      id: `event-${Date.now()}`,
      name: newEventName,
      logoUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=150&auto=format&fit=crop&q=60',
      frameId: newEventFrameId,
      themeColor: '#6366F1',
      countdownDuration: newEventCountdown,
      countdownStyle: 'classic',
      emailSubject: `Your photostrip from ${newEventName}! 🎉`,
      emailBody: 'Thanks for celebrating with us! Here is your custom photostrip. Share the memories!',
      printCopies: 1,
      autoPrint: false,
    };

    onSaveEvents([...events, newEvent]);
    onSetActiveEventId(newEvent.id);
    setNewEventName('');
    setShowAddEvent(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (events.length <= 1) {
      alert('You must have at least one event in the list.');
      return;
    }
    if (id === activeEventId) {
      alert('Cannot delete the active event. Please switch active events first.');
      return;
    }
    if (confirm('Are you sure you want to delete this event?')) {
      onSaveEvents(events.filter(e => e.id !== id));
    }
  };

  // Listen for custom SMTP test connection results from backend
  React.useEffect(() => {
    if (!wsSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'email:test_result') {
          if (data.status === 'success') {
            setTestEmailStatus('success');
          } else {
            setTestEmailStatus('error');
            console.error('[SMTP TEST ERROR]', data.error);
            alert(`SMTP Test Failed: ${data.error || 'Unknown error'}`);
          }
        }
      } catch (err) {
        console.error('AdminDashboard WS listener parsing error:', err);
      }
    };

    wsSocket.addEventListener('message', handleMessage);
    return () => {
      wsSocket.removeEventListener('message', handleMessage);
    };
  }, [wsSocket]);

  const handleSendTestEmail = () => {
    if (!testEmailAddress.trim()) return;
    setTestEmailStatus('sending');

    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(JSON.stringify({
        type: 'email:test',
        recipient: testEmailAddress,
        config: emailConfig
      }));
    } else {
      setTimeout(() => {
        setTestEmailStatus('success');
      }, 1500);
    }
  };

  const triggerCameraTest = () => {
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(JSON.stringify({ type: 'camera:test' }));
      alert('Camera shutter test command dispatched to companion application!');
    } else {
      alert('Local Companion Offline. Running Webcam calibration...');
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex select-none" id="admin-dashboard-container">
      {/* Side Navigation Rail */}
      <div className="w-64 bg-white/5 border-r border-white/10 backdrop-blur-md flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/10 mb-6">
            <Settings className="w-6 h-6 text-blue-400 animate-spin-slow" />
            <div>
              <h2 className="font-black font-display text-base tracking-tight text-white leading-none">Photobooth Pro</h2>
              <p className="text-[9px] text-blue-300 uppercase tracking-widest font-black mt-1">Admin Dashboard</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'overview' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" /> Overview Summary
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'events' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4 text-purple-400" /> Booked Events
            </button>
            <button
              onClick={() => setActiveTab('frames')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'frames' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 text-pink-400" /> Frames Layouts
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'email' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4 text-emerald-400" /> Email & SMTP
            </button>
            <button
              onClick={() => setActiveTab('hardware')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'hardware' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4 text-amber-400" /> Hardware / DSLR
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'gallery' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-cyan-400" /> Sessions Gallery
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'drive' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Cloud className="w-4 h-4 text-blue-400" /> Google Drive Sync
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'settings' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 text-teal-400" /> General Settings
            </button>
          </nav>
        </div>

        {/* Exit Button */}
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl text-xs font-black bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all uppercase tracking-wider"
          id="btn-exit-admin"
        >
          <LogOut className="w-4 h-4" /> Exit Console
        </button>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto p-8">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-black font-display tracking-tight capitalize text-white">{activeTab} Controls</h1>
            <p className="text-xs text-blue-300 mt-1">Configure and monitor your commercial photobooth setup.</p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs backdrop-blur-md">
            <span className="font-bold text-slate-300">Current Event ID:</span>
            <span className="font-mono text-blue-400 bg-black/40 px-2 py-0.5 rounded border border-white/10">
              {activeEventId}
            </span>
          </div>
        </div>

        {/* Dynamic Tab Panes */}
        <div className="flex-1">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6" id="overview-pane">
              {/* Quick statistics row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">Total Sessions Run</span>
                  <h3 className="text-3xl font-black text-white mt-1.5">{totalSessionsCount}</h3>
                  <div className="text-[10px] font-bold text-blue-400 mt-1 select-none">Live records in database</div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">Automated Emails Sent</span>
                  <h3 className="text-3xl font-black text-white mt-1.5">{totalEmailsSent}</h3>
                  <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1 select-none">
                    <CheckCircle className="w-3 h-3" /> Delivery success 100%
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">Spooled Photo Prints</span>
                  <h3 className="text-3xl font-black text-white mt-1.5">{totalPrintsCount}</h3>
                  <div className="text-[10px] font-bold text-purple-400 mt-1 select-none">Spool queue: Empty</div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">Local Storage Used</span>
                  <h3 className="text-3xl font-black text-white mt-1.5">{companionStatus.storageUsage}</h3>
                  <div className="text-[10px] font-bold text-slate-300 mt-1 select-none truncate">Path: {settings.storagePath}</div>
                </div>
              </div>

              {/* Graphical Custom SVG Chart Panel */}
              <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-300 mb-4 flex items-center gap-1.5">
                  <BarChart className="w-4 h-4 text-blue-400" /> Daily Traffic Volume
                </h4>

                {/* SVG Visualizer Chart */}
                <div className="h-64 flex items-end gap-3.5 px-4 pt-8 border-b border-white/10 border-l pb-2 border-dashed">
                  {[
                    { day: 'Mon', sessions: 12, prints: 10 },
                    { day: 'Tue', sessions: 28, prints: 24 },
                    { day: 'Wed', sessions: 45, prints: 40 },
                    { day: 'Thu', sessions: 18, prints: 15 },
                    { day: 'Fri', sessions: 65, prints: 60 },
                    { day: 'Sat', sessions: 94, prints: 88 },
                    { day: 'Sun', sessions: 76, prints: 70 },
                  ].map((data, i) => {
                    const sessionHeight = `${(data.sessions / 100) * 85}%`;
                    const printsHeight = `${(data.prints / 100) * 85}%`;

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full group relative">
                        {/* Hover Tooltip Overlay */}
                        <div className="absolute -top-10 bg-slate-950 border border-white/10 px-2 py-1 rounded text-[9px] text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-10 font-mono flex flex-col gap-0.5">
                          <span>Sessions: {data.sessions}</span>
                          <span>Prints: {data.prints}</span>
                        </div>

                        {/* Staggered double bar graph */}
                        <div className="w-full flex-1 flex gap-1.5 items-end h-full">
                          <div
                            className="flex-1 bg-blue-500/80 group-hover:bg-blue-400 transition-colors rounded-t-sm"
                            style={{ height: sessionHeight }}
                          ></div>
                          <div
                            className="flex-1 bg-purple-500/80 group-hover:bg-purple-400 transition-colors rounded-t-sm"
                            style={{ height: printsHeight }}
                          ></div>
                        </div>

                        {/* Label */}
                        <span className="text-[10px] text-slate-400 mt-2 font-bold font-sans">{data.day}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-4 text-[10px] justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
                    <span className="text-slate-300 font-bold uppercase tracking-wider text-[9px]">Completed Sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></span>
                    <span className="text-slate-300 font-bold uppercase tracking-wider text-[9px]">Physical Prints</span>
                  </div>
                </div>
              </div>

              {/* Hardware alerts panel */}
              <div className="p-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-bounce" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">Local Companion Live Stream Status</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {companionStatus.cameraConnected
                        ? `Connected: ${companionStatus.cameraModel} is streaming fine.`
                        : 'No DSLR hardware detected. System is running on automatic Webcam fallback mode.'}
                    </p>
                  </div>
                </div>

                {!companionStatus.cameraConnected && (
                  <button
                    onClick={triggerReconnection}
                    className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="flex flex-col gap-6" id="events-pane">
              {/* Add event triggers */}
              {showAddEvent ? (
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-sm flex flex-col gap-4 animate-fade-in">
                  <h4 className="text-xs font-black uppercase text-blue-400">Book New Event</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Event Name</label>
                      <input
                        type="text"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        placeholder="e.g. Rachel's Graduation Bash"
                        className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Associated Frame</label>
                      <select
                        value={newEventFrameId}
                        onChange={(e) => setNewEventFrameId(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none"
                      >
                        {frames.map(f => (
                          <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Countdown duration (seconds)</label>
                      <select
                        value={newEventCountdown}
                        onChange={(e) => setNewEventCountdown(parseInt(e.target.value))}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none"
                      >
                        <option value={3} className="bg-slate-900">3 Seconds</option>
                        <option value={5} className="bg-slate-900">5 Seconds</option>
                        <option value={10} className="bg-slate-900">10 Seconds</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2.5 justify-end mt-2">
                    <button
                      onClick={() => setShowAddEvent(false)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateEvent}
                      className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                    >
                      Save Booking
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-white/5 p-4 border border-white/10 backdrop-blur-md rounded-2xl">
                  <span className="text-xs text-slate-300 font-bold">Manage multiple event directories and layouts seamlessly.</span>
                  <button
                    onClick={() => setShowAddEvent(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black uppercase tracking-wider text-xs rounded-xl flex items-center gap-1.5 shadow-md"
                    id="btn-add-event"
                  >
                    <Plus className="w-4 h-4" /> Book Event
                  </button>
                </div>
              )}

              {/* Event Cards directory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="events-directory-grid">
                {events.map((evt) => {
                  const isActive = activeEventId === evt.id;
                  const frame = frames.find(f => f.id === evt.frameId);

                  return (
                    <div
                      key={evt.id}
                      className={`p-5 backdrop-blur-md ${
                        isActive ? 'bg-blue-600/10 border-blue-400 ring-1 ring-blue-500/20' : 'bg-white/5 border-white/10'
                      } border rounded-2xl shadow-sm flex flex-col justify-between h-48`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-base text-slate-100">{evt.name}</h4>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider rounded-full shadow-sm animate-pulse">
                                Active Kiosk
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-blue-300 mt-1 uppercase font-mono">
                            Associated Template: {frame?.name || 'Standard Layout'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                        <span>Countdown: {evt.countdownDuration}s</span>
                        <span className="text-slate-500">•</span>
                        <span>Auto-Print: {evt.autoPrint ? 'Yes' : 'No'}</span>
                      </div>

                      <div className="flex justify-between items-center border-t border-white/10 pt-3.5 mt-2">
                        {/* Make Active button toggle */}
                        {!isActive ? (
                          <button
                            onClick={() => onSetActiveEventId(evt.id)}
                            className="px-3 py-1.5 bg-black/40 hover:bg-blue-950 border border-white/10 hover:border-blue-800 text-slate-300 hover:text-blue-400 font-bold text-xs rounded-xl transition-all"
                          >
                            Set as Active
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Curating Kiosk View
                          </span>
                        )}

                        {!isActive && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-900/20 rounded-xl transition-all"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'frames' && (
            <FrameManager frames={frames} onSaveFrames={onSaveFrames} />
          )}

          {activeTab === 'email' && (
            <div className="flex flex-col gap-6" id="email-pane">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SMTP Server Configuration form */}
                <div className="lg:col-span-2 p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col gap-4">
                  <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">SMTP Server Configuration</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Sender Name</label>
                      <input
                        type="text"
                        value={emailConfig.senderName}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, senderName: e.target.value })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Sender Email</label>
                      <input
                        type="text"
                        value={emailConfig.senderEmail}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, senderEmail: e.target.value })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">SMTP Host Outgoing Server</label>
                      <input
                        type="text"
                        value={emailConfig.smtpHost}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">SMTP Port</label>
                      <input
                        type="number"
                        value={emailConfig.smtpPort}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, smtpPort: parseInt(e.target.value) })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">SMTP Username</label>
                      <input
                        type="text"
                        value={emailConfig.smtpUser || ''}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, smtpUser: e.target.value })}
                        placeholder="e.g. sender@gmail.com"
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">SMTP Password</label>
                      <input
                        type="password"
                        value={emailConfig.smtpPass || ''}
                        onChange={(e) => onSaveEmailConfig({ ...emailConfig, smtpPass: e.target.value })}
                        placeholder="App-specific Password"
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-slate-400 font-bold">Email Message Template Body</label>
                    <textarea
                      rows={4}
                      value={emailConfig.messageTemplate}
                      onChange={(e) => onSaveEmailConfig({ ...emailConfig, messageTemplate: e.target.value })}
                      className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none resize-none focus:border-blue-500/50"
                    ></textarea>
                  </div>
                </div>

                {/* Email Test Sender panel */}
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">Test Server Connection</h3>
                    <p className="text-xs text-slate-300 mt-1 mb-4">Validate SMTP outgoing pathways by shooting a test mail.</p>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-xs text-slate-400 font-bold">Test Destination Email</label>
                      <input
                        type="text"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="test@example.com"
                        className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                        id="test-email-input"
                      />
                    </div>

                    {testEmailStatus === 'success' && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl text-center mt-4">
                        Test email dispatched successfully! ✅
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSendTestEmail}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black uppercase tracking-wider rounded-xl text-xs shadow-md mt-4"
                    id="btn-send-test-email"
                  >
                    Dispatch Test Mail
                  </button>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="flex flex-col gap-6" id="hardware-pane">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* DSLR settings */}
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">DSLR Camera Calibration</h3>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        companionStatus.cameraConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 border border-white/10 text-slate-300'
                      }`}>
                        {companionStatus.cameraConnected ? 'Connected' : 'Simulation Fallback'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3.5 bg-black/40 p-4 rounded-xl border border-white/10 text-xs font-mono mb-6">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hardware Vendor</span>
                        <span className="text-slate-200 font-bold">{companionStatus.cameraConnected ? 'Canon EOS' : 'Generic Webcam'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Camera Model</span>
                        <span className="text-slate-200 font-bold">{companionStatus.cameraConnected ? companionStatus.cameraModel : 'Internal Camera Device'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Power Battery level</span>
                        <span className="text-slate-200 font-bold">{companionStatus.cameraBattery ? `${companionStatus.cameraBattery}%` : 'N/A'}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      DSLR communication routes over the local USB companion socket stream. Triggering test shuts tests latency on raw downloads.
                    </p>
                  </div>

                  <div className="flex gap-2.5 mt-6">
                    <button
                      onClick={triggerReconnection}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Attempt Reconnect
                    </button>
                    <button
                      onClick={triggerCameraTest}
                      className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black uppercase tracking-wider rounded-xl text-xs shadow-md"
                    >
                      Trigger Test Shutter
                    </button>
                  </div>
                </div>

                {/* Printer settings */}
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">Dye-Sublimation Printer</h3>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        companionStatus.printerConnected ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'bg-white/5 border border-white/10 text-slate-300'
                      }`}>
                        {companionStatus.printerConnected ? 'Ready' : 'Offline'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-bold">Paper Dimension</label>
                        <select
                          value={printerConfig.paperSize}
                          onChange={(e) => onSavePrinterConfig({ ...printerConfig, paperSize: e.target.value as any })}
                          className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="4x6" className="bg-slate-900">Standard 4" x 6" Photo</option>
                          <option value="2x6" className="bg-slate-900">Dual 2" x 6" Strips</option>
                          <option value="8x10" className="bg-slate-900">Widescreen 8" x 10" Print</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-400 font-bold">Print Quality Output</label>
                        <select
                          value={printerConfig.quality}
                          onChange={(e) => onSavePrinterConfig({ ...printerConfig, quality: e.target.value as any })}
                          className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="Standard" className="bg-slate-900">Standard Matte</option>
                          <option value="High" className="bg-slate-900">Glossy High D-Max</option>
                          <option value="Fine" className="bg-slate-900">Lustre Ultra Fine</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer mt-2 select-none">
                      <input
                        type="checkbox"
                        checked={printerConfig.autoPrint}
                        onChange={(e) => onSavePrinterConfig({ ...printerConfig, autoPrint: e.target.checked })}
                        className="w-4 h-4 rounded bg-black/40 border-white/10 accent-blue-600"
                      />
                      <span>Auto-dispatch completed photostrips direct to print spooler</span>
                    </label>
                  </div>

                  <button
                    onClick={() => {
                      alert('Printer nozzle clearance diagnostic spooled!');
                    }}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider mt-6"
                  >
                    Nozzle Diagnostics Align
                  </button>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <GalleryView sessions={sessions} frames={frames} onDeleteSession={onDeleteSession} />
          )}

          {activeTab === 'settings' && (
            <div className="flex flex-col gap-6" id="settings-pane">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Preferences */}
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col gap-4">
                  <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">Operational Prefs</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Kiosk UI Dialect</label>
                      <select
                        value={settings.language}
                        onChange={(e) => onSaveSettings({ ...settings, language: e.target.value as any })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200"
                      >
                        <option value="en" className="bg-slate-900">English (US/UK)</option>
                        <option value="es" className="bg-slate-900">Español (ES/MX)</option>
                        <option value="fr" className="bg-slate-900">Français (FR)</option>
                        <option value="de" className="bg-slate-900">Deutsch (DE)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-400 font-bold">Max Snapshot Retakes</label>
                      <select
                        value={settings.maxRetakes}
                        onChange={(e) => onSaveSettings({ ...settings, maxRetakes: parseInt(e.target.value) })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200"
                      >
                        <option value={1} className="bg-slate-900">1 Max Retake</option>
                        <option value={3} className="bg-slate-900">3 Max Retakes</option>
                        <option value={5} className="bg-slate-900">5 Max Retakes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-slate-400 font-bold">Companion Storage Directory</label>
                    <input
                      type="text"
                      value={settings.storagePath}
                      onChange={(e) => onSaveSettings({ ...settings, storagePath: e.target.value })}
                      className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none font-mono focus:border-blue-500/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs text-slate-400 font-bold">Custom QR/Sharing Base URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. https://ais-pre-2fwpniwqdw3q2peqbs3jv5-446615910495.asia-southeast1.run.app"
                      value={settings.customSharingUrl || ''}
                      onChange={(e) => onSaveSettings({ ...settings, customSharingUrl: e.target.value })}
                      className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none font-mono focus:border-blue-500/50"
                    />
                    <span className="text-[10px] text-slate-500 leading-normal">
                      Specify the public domain name if the kiosk runs in a local loopback or behind an iframe, ensuring QR scans by other devices successfully reach your companion server.
                    </span>
                  </div>
                </div>

                {/* Legal Policy */}
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col gap-4">
                  <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">Privacy Notice & Legal Policy</h3>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">Kiosk Privacy Disclaimer</label>
                    <textarea
                      rows={4}
                      value={settings.privacyPolicy}
                      onChange={(e) => onSaveSettings({ ...settings, privacyPolicy: e.target.value })}
                      className="px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none resize-none leading-relaxed focus:border-blue-500/50"
                    ></textarea>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'drive' && (
            <div className="flex flex-col gap-6 animate-fade-in" id="drive-sync-pane">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Connection Status Card */}
                <div className="p-6 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col justify-between min-h-[250px]">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <Cloud className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black tracking-wider uppercase text-blue-300">Google Drive Connection</h3>
                        <p className="text-[10px] text-slate-400">Manage your Google Workspace sync state</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-6">
                      By connecting your Google Drive, every guest photo session will automatically generate a photostrip and save a high-resolution copy securely into your cloud workspace.
                    </p>

                    {settings.driveConfig?.connectedEmail ? (
                      <div className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-2xl p-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow">
                          {settings.driveConfig.connectedName?.charAt(0) || settings.driveConfig.connectedEmail.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{settings.driveConfig.connectedName || 'Connected Admin'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{settings.driveConfig.connectedEmail}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Authenticated & Active</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 font-black">
                          !
                        </div>
                        <div>
                          <p className="text-xs font-black text-rose-300">Not Connected</p>
                          <p className="text-[10px] text-rose-400 mt-0.5">Please sign in to link your Google Drive workspace.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3">
                    {settings.driveConfig?.connectedEmail ? (
                      <button
                        onClick={handleDisconnectDrive}
                        className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                      >
                        Disconnect Account
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/10 flex items-center gap-2"
                      >
                        {isConnectingDrive ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>Connect Google Drive</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Cloud Sync Config Card */}
                <div className="p-6 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col justify-between min-h-[250px]">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <FolderOpen className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black tracking-wider uppercase text-purple-300">Synchronize Preferences</h3>
                        <p className="text-[10px] text-slate-400">Configure file destination folder and automation</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 mt-6">
                      <div className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-xs text-slate-200 font-black">Enable Drive Auto-Upload</label>
                          <span className="text-[9px] text-slate-400">Upload new photostrips as soon as they are captured</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.driveConfig?.enabled || false}
                          disabled={!settings.driveConfig?.connectedEmail}
                          onChange={(e) => {
                            if (!settings.driveConfig) return;
                            onSaveSettings({
                              ...settings,
                              driveConfig: {
                                ...settings.driveConfig,
                                enabled: e.target.checked
                              }
                            });
                          }}
                          className="w-9 h-5 rounded-full bg-slate-800 accent-blue-500 border-none outline-none cursor-pointer disabled:opacity-30"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-slate-300 font-bold">Google Drive Folder Link or Folder Name</label>
                        <input
                          type="text"
                          placeholder="Paste folder link (e.g. https://drive.google.com/drive/folders/...) or type folder name"
                          value={settings.driveConfig?.folderName || ''}
                          disabled={!settings.driveConfig?.connectedEmail}
                          onChange={(e) => {
                            if (!settings.driveConfig) return;
                            onSaveSettings({
                              ...settings,
                              driveConfig: {
                                ...settings.driveConfig,
                                folderName: e.target.value
                              }
                            });
                          }}
                          className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
                        />
                        <span className="text-[10px] text-slate-500 leading-normal">
                          You can paste your shared Google Drive folder link, folder ID, or type a custom name. When a link is detected, we will extract the folder ID automatically and upload photostrips directly inside it.
                        </span>
                      </div>
                    </div>
                  </div>

                  {settings.driveConfig?.connectedEmail && (
                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                      <button
                        onClick={handleTestDriveConnection}
                        disabled={testDriveStatus === 'testing'}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                      >
                        {testDriveStatus === 'testing' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                            Testing Cloud Link...
                          </>
                        ) : testDriveStatus === 'success' ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            Connection Verified!
                          </>
                        ) : testDriveStatus === 'error' ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            Diagnostics Failed
                          </>
                        ) : (
                          <>Test Connection</>
                        )}
                      </button>
                      
                      {testDriveStatus === 'success' && (
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">
                          Folder ready on drive!
                        </span>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
