import React, { useState, useEffect } from 'react';
import { Printer, Download, QrCode, ArrowRight, CheckCircle, Loader2, Link, ExternalLink } from 'lucide-react';
import { CompanionStatus, EventFrame, PhotoboothEvent, Session, AppSettings } from '../types';
import QRCode from 'qrcode';
import { getOrCreateFolder, uploadPhotostripToDrive } from '../utils/googleDrive';
import { uploadToPublicFallback } from '../utils/publicUpload';
import { compressBase64Image } from '../utils/imageCompression';

interface FinalPreviewProps {
  photostripUrl: string;
  guestEmail?: string;
  guestName?: string;
  activeEvent: PhotoboothEvent;
  selectedFrame: EventFrame;
  companionStatus: CompanionStatus;
  onNewSession: () => void;
  wsSocket: WebSocket | null;
  saveSession: (session: Session) => void;
  settings: AppSettings;
  onSaveSettings: (updated: AppSettings) => void;
}

export default function FinalPreview({
  photostripUrl,
  guestEmail = '',
  guestName = '',
  activeEvent,
  selectedFrame,
  companionStatus,
  onNewSession,
  wsSocket,
  saveSession,
  settings,
}: FinalPreviewProps) {
  const [printStatus, setPrintStatus] = useState<'idle' | 'spooling' | 'printing' | 'printed' | 'error'>('idle');
  const [printCopies, setPrintCopies] = useState<number>(activeEvent.printCopies || 1);
  const [printProgress, setPrintProgress] = useState<number>(0);

  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(true);
  const [qrLinkUrl, setQrLinkUrl] = useState<string>('');

  // Print connection method: companion (USB Node.js backend) or AirPrint (Browser standard dialog)
  const [printMethod, setPrintMethod] = useState<'airprint' | 'companion'>(() => {
    return companionStatus.printerConnected ? 'companion' : 'airprint';
  });

  // Dynamic QR code update listener for custom override links
  const [isCustomOverrideLink, setIsCustomOverrideLink] = useState<boolean>(false);
  const [customOverrideUrl, setCustomOverrideUrl] = useState<string>('');

  useEffect(() => {
    if (!qrLinkUrl) return;
    const generateQR = async () => {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrLinkUrl, {
          width: 300,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' }
        });
        setQrUrl(qrDataUrl);
      } catch (err) {
        console.error('Dynamic QR Code generation failed:', err);
      }
    };
    generateQR();
  }, [qrLinkUrl]);

  const handleBrowserPrint = () => {
    setPrintStatus('spooling');
    setPrintProgress(10);

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!iframeDoc) {
        throw new Error('Could not access print frame context');
      }

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Photostrip</title>
            <style>
              @page { size: auto; margin: 0mm; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background-color: white; }
              img { max-width: 100%; max-height: 100vh; display: block; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            <img src="${photostripUrl}" id="print-image" />
            <script>
              const img = document.getElementById('print-image');
              if (img.complete) {
                setTimeout(() => { window.focus(); window.print(); }, 500);
              } else {
                img.onload = function() { setTimeout(() => { window.focus(); window.print(); }, 500); };
              }
            </script>
          </body>
        </html>
      `);
      iframeDoc.close();

      setPrintStatus('printing');
      setPrintProgress(50);

      setTimeout(() => {
        setPrintProgress(100);
        setPrintStatus('printed');
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3500);

    } catch (err) {
      console.error('System AirPrint failed:', err);
      setPrintStatus('error');
    }
  };

  // Upload photostrip and save session
  useEffect(() => {
    setIsUploading(true);

    let sharingOrigin = window.location.origin;
    if (settings.customSharingUrl && settings.customSharingUrl.trim() !== '') {
      sharingOrigin = settings.customSharingUrl.trim().replace(/\/$/, '');
    } else if (!sharingOrigin || sharingOrigin === 'null' || sharingOrigin.includes('null') || sharingOrigin.includes('localhost') || sharingOrigin.includes('127.0.0.1')) {
      sharingOrigin = 'https://ais-pre-2fwpniwqdw3q2peqbs3jv5-446615910495.asia-southeast1.run.app';
    }

    if (sharingOrigin && sharingOrigin.includes('ais-dev-')) {
      sharingOrigin = sharingOrigin.replace('ais-dev-', 'ais-pre-');
    }

    const runUploaderAndSetup = async () => {
      let qrLink = '';
      let driveFileId: string | undefined;
      let driveViewLink: string | undefined;
      const sessionId = `session-${Date.now()}`;

      // 1. Google Drive Upload
      const isManualDrive = settings.driveConfig?.authMethod === 'manual';
      const activeDriveToken = isManualDrive ? settings.driveConfig?.manualToken : settings.driveConfig?.accessToken;

      if (settings.driveConfig?.enabled && activeDriveToken) {
        try {
          const folderId = await getOrCreateFolder(
            activeDriveToken,
            settings.driveConfig.folderName || 'Photobooth Kiosk Photos'
          );
          const fileName = `Photostrip_${sessionId}.png`;
          const result = await uploadPhotostripToDrive(
            activeDriveToken,
            photostripUrl,
            fileName,
            folderId
          );
          if (result.webViewLink) {
            qrLink = result.webViewLink;
            driveFileId = result.id;
            driveViewLink = result.webViewLink;
          }
        } catch (err) {
          console.error('[DRIVE-PREVIEW] Google Drive auto-upload failed:', err);
        }
      }

      // 2. Public fallback upload
      if (!qrLink) {
        try {
          qrLink = await uploadToPublicFallback(photostripUrl);
        } catch (err) {
          console.error('[PUBLIC-PREVIEW] Public cloud fallback upload failed:', err);
        }
      }

      // 3. Companion Server Upload
      try {
        const res = await fetch('/api/photostrips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: photostripUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id && !qrLink) {
            qrLink = `${sharingOrigin}/?download=${data.id}`;
          }
        }
      } catch (err) {
        console.error('[COMPANION-PREVIEW] Companion upload failed:', err);
      }

      if (!qrLink) {
        qrLink = `${sharingOrigin}/download?session=${sessionId}`;
      }

      setQrLinkUrl(qrLink);

      try {
        const qrDataUrl = await QRCode.toDataURL(qrLink, {
          width: 300,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' }
        });
        setQrUrl(qrDataUrl);
      } catch (err) {
        console.error('QR Code generation failed:', err);
      }

      setIsUploading(false);

      let compressedStrip = '';
      try {
        compressedStrip = await compressBase64Image(photostripUrl, 450, 1350, 0.75);
      } catch (cErr) {
        compressedStrip = photostripUrl;
      }

      const newSession: Session = {
        id: sessionId,
        date: new Date().toISOString(),
        guestEmail: '',
        guestName: '',
        frameId: selectedFrame.id,
        photos: [],
        photostripUrl: compressedStrip || qrLink || photostripUrl,
        printed: false,
        emailed: false,
        printCount: 0,
        duration: 35,
        driveFileId,
        driveViewLink,
      };

      saveSession(newSession);

      if (activeEvent.autoPrint && companionStatus.printerConnected) {
        handlePrint();
      }
    };

    runUploaderAndSetup();
  }, [photostripUrl]);

  const handleTogglePrinterConnection = () => {
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          type: 'printer:set_connected',
          connected: !companionStatus.printerConnected,
        })
      );
    }
  };

  const handlePrint = () => {
    if (printMethod === 'airprint') {
      handleBrowserPrint();
      return;
    }

    setPrintStatus('spooling');
    setPrintProgress(10);

    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          type: 'print:send',
          photostrip: photostripUrl,
          copies: printCopies,
          printer: companionStatus.printerModel,
        })
      );
    }

    const spoolTimer = setTimeout(() => {
      setPrintStatus('printing');
      setPrintProgress(40);
    }, 1200);

    let progressInterval: NodeJS.Timeout;
    const printTimer = setTimeout(() => {
      progressInterval = setInterval(() => {
        setPrintProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setPrintStatus('printed');
            return 100;
          }
          return prev + 15;
        });
      }, 500);
    }, 1500);

    return () => {
      clearTimeout(spoolTimer);
      clearTimeout(printTimer);
      clearInterval(progressInterval);
    };
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `photobooth_pro_${Date.now()}.png`;
    link.href = photostripUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 overflow-y-auto select-none" id="final-preview-view">
      {/* Header Info */}
      <div className="w-full max-w-5xl mx-auto flex justify-between items-center z-10 mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">Your Photostrip!</h2>
          <p className="text-xs text-blue-300 font-medium mt-1">Ready for download and printing</p>
        </div>

        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-pulse">
          <CheckCircle className="w-4 h-4 fill-none" /> Photo Ready!
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col md:flex-row gap-8 items-center justify-center py-4 z-10">
        {/* Left Hand: Glowing High Resolution Photostrip Preview */}
        <div className="w-full md:w-5/12 flex justify-center max-h-[58vh]">
          <div className="relative group bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3 shadow-[0_0_50px_rgba(99,102,241,0.15)] flex items-center justify-center overflow-hidden max-h-full">
            <img
              src={photostripUrl}
              alt="Final photostrip preview"
              className="max-h-[52vh] object-contain rounded-lg shadow-2xl transition-transform duration-300 group-hover:scale-[1.01]"
              referrerPolicy="no-referrer"
              id="final-photostrip-image"
            />
          </div>
        </div>

        {/* Right Hand: Touch Action Buttons */}
        <div className="w-full md:w-6/12 flex flex-col gap-5 justify-center">
          {/* Unified Save & Scan Container */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-6">
            {/* Direct QR Code Display */}
            <div 
              onClick={() => setShowQrModal(true)}
              className="shrink-0 flex flex-col items-center bg-white p-3 rounded-2xl shadow-lg relative group cursor-pointer active:scale-95 transition-all"
              title="Click to enlarge QR link"
              id="direct-qr-container"
            >
              {isUploading ? (
                <div className="w-[110px] h-[110px] flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Storing...</span>
                </div>
              ) : qrUrl ? (
                <div className="relative">
                  <img
                    src={qrUrl}
                    alt="Scan QR to download"
                    className="w-[110px] h-[110px] object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 border border-slate-100 rounded-md pointer-events-none"></div>
                </div>
              ) : (
                <div className="w-[110px] h-[110px] flex items-center justify-center text-slate-400">
                  <QrCode className="w-8 h-8 animate-pulse" />
                </div>
              )}
              <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase mt-2">Scan for Phone</span>
            </div>

            {/* Save Photo & Description details */}
            <div className="flex-1 flex flex-col justify-center text-center sm:text-left">
              <h4 className="text-sm font-extrabold text-slate-100 flex items-center justify-center sm:justify-start gap-1.5 mb-1">
                <QrCode className="w-4 h-4 text-purple-400" /> Get Your Memories!
              </h4>
              <p className="text-[11px] text-blue-300 font-medium mb-4 leading-relaxed">
                Scan the QR code with your phone camera to download instantly, or click below to save to this kiosk.
              </p>

              <button
                onClick={handleDownload}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black rounded-xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
                id="btn-download-strip"
              >
                <Download className="w-4 h-4 text-white" /> Save Photo
              </button>

              {/* Manual Google Drive Link Override Option */}
              <div className="mt-3.5 border-t border-white/5 pt-3 w-full">
                {!isCustomOverrideLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomOverrideLink(true);
                      setCustomOverrideUrl(qrLinkUrl);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/15 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> Custom Google/Drive Link Option
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 animate-fade-in w-full text-left">
                    <label className="text-[9px] font-black uppercase text-blue-300 tracking-wider">
                      Paste Google Link / Folder URL (Auto QR Generator):
                    </label>
                    <div className="flex gap-2 w-full">
                      <input
                        type="url"
                        value={customOverrideUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomOverrideUrl(val);
                          if (val.trim()) {
                            setQrLinkUrl(val.trim());
                          }
                        }}
                        placeholder="https://drive.google.com/..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
                        id="custom-google-link-input"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomOverrideLink(false)}
                        className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1.5 bg-white/5 rounded-lg border border-white/5 transition-all"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Print Section Panel */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h4 className="text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-purple-400" /> Print Your Memories
              </h4>
              
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPrintMethod('airprint')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                    printMethod === 'airprint'
                      ? 'bg-blue-600/35 text-white border border-blue-500/30'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                  id="tab-airprint"
                >
                  Wi-Fi / AirPrint
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMethod('companion')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 ${
                    printMethod === 'companion'
                      ? 'bg-purple-600/35 text-white border border-purple-500/30'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                  id="tab-companion"
                >
                  Kiosk USB
                  {companionStatus.printerConnected && (
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Printer Status & Connect Toggle */}
            <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex flex-col gap-0.5 text-left">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Printer Connection:</span>
                <span className={`font-extrabold flex items-center gap-1.5 ${companionStatus.printerConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${companionStatus.printerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {companionStatus.printerConnected ? `Connected (${companionStatus.printerModel || 'DNP DS620'})` : 'Offline / Disconnected'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleTogglePrinterConnection}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                  companionStatus.printerConnected
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-300 animate-pulse'
                }`}
                id="btn-toggle-printer-conn"
              >
                {companionStatus.printerConnected ? 'Disconnect Printer' : 'Connect / Ready Printer'}
              </button>
            </div>

            <div className="mb-4 text-[10px] font-semibold text-slate-400 bg-white/5 px-3 py-2 rounded-xl flex items-center justify-between">
              <span>Selected Pathway:</span>
              <span className="font-extrabold text-blue-300">
                {printMethod === 'airprint' ? '🔗 System print dialog (Compatible with all Wi-Fi/AirPrint)' : `🔌 Kiosk Direct (${companionStatus.printerModel || 'DNP DS620'})`}
              </span>
            </div>

            {printStatus === 'idle' || printStatus === 'printed' ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 w-full sm:w-auto justify-between">
                  <button
                    onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-300 font-bold text-lg rounded-lg hover:bg-white/10"
                  >
                    -
                  </button>
                  <span className="px-4 font-bold text-sm text-white">{printCopies} Copies</span>
                  <button
                    onClick={() => setPrintCopies(printCopies + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-300 font-bold text-lg rounded-lg hover:bg-white/10"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="w-full sm:flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer text-xs uppercase tracking-widest"
                  id="btn-trigger-print"
                >
                  <Printer className="w-4.5 h-4.5" /> {printStatus === 'printed' ? 'Print Again' : 'Print Now'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 animate-pulse">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-blue-400 uppercase tracking-wide">
                    {printStatus === 'spooling' ? 'Spooling printer job...' : 'Active Printing...'}
                  </span>
                  <span className="text-slate-400">{printProgress}%</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/10">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${printProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Session Big Touch Trigger */}
      <div className="w-full max-w-md mx-auto z-10 pt-6">
        <button
          onClick={onNewSession}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
          id="btn-start-new"
        >
          Finished! New Session <ArrowRight className="w-5 h-5 animate-bounce" />
        </button>
      </div>

      {/* QR Code Scan Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 dark:bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 font-display">Scan to Download</h3>
            <p className="text-xs text-blue-300 font-semibold mb-5">Point your phone camera here to download instantly</p>

            {/* QR Frame Container */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-5">
              {qrUrl ? (
                <img src={qrUrl} alt="Download QR Link" className="w-56 h-56 mx-auto select-none animate-fade-in" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center bg-slate-100 text-slate-400 rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-center p-3 bg-black/40 rounded-xl border border-white/10 text-slate-300 text-xs font-mono select-all">
              <Link className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate max-w-[220px]" title={qrLinkUrl || 'Generating...'}>
                {qrLinkUrl || 'Generating link...'}
              </span>
            </div>

            <p className="text-[10px] text-blue-300 font-bold uppercase mt-3 tracking-wider text-center">
              {qrLinkUrl.includes('drive.google.com') 
                ? 'Permanent Google Drive Link' 
                : qrLinkUrl.includes('tmpfiles.org')
                ? 'Cloud Link (Expires in 1 Hour - Unlimited Scans)'
                : qrLinkUrl.includes('file.io')
                ? 'Single-Download Cloud Link'
                : 'QR Link (Requires Kiosk Server Link)'}
            </p>

            <button
              onClick={() => setShowQrModal(false)}
              className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs transition-all uppercase tracking-wider"
              id="btn-close-qr"
            >
              Close Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
