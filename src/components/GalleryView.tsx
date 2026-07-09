import React, { useState } from 'react';
import { Session, EventFrame } from '../types';
import { Search, Calendar, Download, Trash2, Printer, Mail, Eye, Clock, Image as ImageIcon, Cloud, ExternalLink } from 'lucide-react';

interface GalleryViewProps {
  sessions: Session[];
  frames: EventFrame[];
  onDeleteSession: (id: string) => void;
}

export default function GalleryView({ sessions, frames, onDeleteSession }: GalleryViewProps) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const getFrameName = (frameId: string) => {
    return frames.find((f) => f.id === frameId)?.name || 'Custom Layout';
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.guestEmail.toLowerCase().includes(search.toLowerCase()) || 
                          (session.guestName && session.guestName.toLowerCase().includes(search.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (dateFilter) {
      const sessionDate = new Date(session.date).toDateString();
      const filterDate = new Date(dateFilter).toDateString();
      return sessionDate === filterDate;
    }

    return true;
  });

  const handleDownloadStrip = (session: Session) => {
    const link = document.createElement('a');
    link.download = `strip_${session.id}.png`;
    link.href = session.photostripUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6" id="gallery-manager-panel">
      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-black/40 border border-white/10 backdrop-blur-md rounded-3xl p-6 w-full max-w-3xl flex flex-col md:flex-row gap-6 shadow-2xl">
            {/* Left strip display */}
            <div className="w-full md:w-5/12 bg-black/60 p-3 rounded-2xl border border-white/10 flex items-center justify-center max-h-[60vh] overflow-y-auto">
              <img
                src={selectedSession.photostripUrl}
                alt="Session Photostrip"
                className="max-h-[50vh] object-contain rounded-lg"
              />
            </div>

            {/* Right meta details */}
            <div className="flex-1 flex flex-col justify-between pt-2">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-white font-display tracking-tight">{selectedSession.guestName || 'Anonymous Guest'}</h3>
                    <p className="text-sm text-blue-400 mt-0.5 font-bold">{selectedSession.guestEmail}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-all font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3.5 bg-black/60 p-4 rounded-xl border border-white/10 text-xs text-slate-300 font-mono">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[9px]">Session ID</span>
                    <span className="text-slate-200 truncate">{selectedSession.id}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[9px]">Captured Frame</span>
                    <span className="text-slate-200 truncate">{getFrameName(selectedSession.frameId)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[9px]">Date & Time</span>
                    <span className="text-slate-200">{new Date(selectedSession.date).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 uppercase font-black tracking-wider text-[9px]">Duration</span>
                    <span className="text-slate-200">{selectedSession.duration}s</span>
                  </div>
                </div>

                {/* Delivery Logs Indicators */}
                <div className="flex gap-2">
                  <div className={`flex-1 p-3 rounded-xl border text-center ${
                    selectedSession.emailed 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    <Mail className="w-5 h-5 mx-auto mb-1 opacity-75" />
                    <span className="text-xs font-black uppercase tracking-wider">{selectedSession.emailed ? 'Emailed' : 'Auto-Queued'}</span>
                  </div>
                  {selectedSession.driveViewLink ? (
                    <a
                      href={selectedSession.driveViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 p-3 rounded-xl border text-center bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all flex flex-col items-center justify-center"
                    >
                      <Cloud className="w-5 h-5 mb-1 opacity-75 text-blue-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 text-blue-400">
                        View Drive <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </a>
                  ) : (
                    <div className="flex-1 p-3 rounded-xl border border-white/5 text-center text-slate-500 bg-white/5">
                      <Cloud className="w-5 h-5 mx-auto mb-1 opacity-30" />
                      <span className="text-xs font-black uppercase tracking-wider">No Drive Sync</span>
                    </div>
                  )}
                  <div className={`flex-1 p-3 rounded-xl border text-center ${
                    selectedSession.printed 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}>
                    <Printer className="w-5 h-5 mx-auto mb-1 opacity-75" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      {selectedSession.printed ? `Printed (${selectedSession.printCount}x)` : 'No Print'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Download & Pruning */}
              <div className="flex gap-2.5 mt-8">
                <button
                  onClick={() => {
                    onDeleteSession(selectedSession.id);
                    setSelectedSession(null);
                  }}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Delete Session
                </button>
                <button
                  onClick={() => handleDownloadStrip(selectedSession)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/15 transition-all"
                >
                  <Download className="w-4 h-4" /> Download PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Query Filters row */}
      <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions by guest email or name..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            id="gallery-search-input"
          />
        </div>

        {/* Date Selector */}
        <div className="relative w-full sm:w-56">
          <Calendar className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 font-sans"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="gallery-sessions-grid">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500">
            <ImageIcon className="w-12 h-12 opacity-30 mb-3 animate-pulse" />
            <p className="text-sm font-semibold">No recorded photobooth sessions found.</p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex gap-4 hover:bg-white/10 hover:border-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-md group relative overflow-hidden"
              id={`session-card-${session.id}`}
            >
              {/* Left thumbnail strip */}
              <div className="w-16 h-28 bg-black/60 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={session.photostripUrl}
                  alt="Thumbnail strip"
                  className="h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Right metadata */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden py-1">
                <div className="overflow-hidden">
                  <h4 className="font-bold text-sm text-slate-200 truncate">
                    {session.guestName || 'Anonymous Guest'}
                  </h4>
                  <p className="text-[11px] text-blue-400 font-bold truncate mt-0.5">{session.guestEmail}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-1">
                    Frame: {getFrameName(session.frameId)}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 border-t border-white/10 pt-2 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.driveFileId && (
                      <Cloud className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <Mail className={`w-3.5 h-3.5 ${session.emailed ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <Printer className={`w-3.5 h-3.5 ${session.printed ? 'text-purple-400' : 'text-slate-600'}`} />
                  </div>
                </div>
              </div>

              {/* Subtle hover detail indicator */}
              <div className="absolute top-2 right-2 p-1 bg-black/60 border border-white/10 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <Eye className="w-3.5 h-3.5" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
