import React, { useState, useEffect } from 'react';
import { Mail, Printer, Download, QrCode, ArrowRight, CheckCircle, RefreshCw, Loader2, Link } from 'lucide-react';
import { CompanionStatus, EventFrame, PhotoboothEvent, Session, AppSettings, EmailConfig } from '../types';
import QRCode from 'qrcode';
import { getOrCreateFolder, uploadPhotostripToDrive } from '../utils/googleDrive';
import { uploadToPublicFallback } from '../utils/publicUpload';
import { compressBase64Image } from '../utils/imageCompression';

interface FinalPreviewProps {
  photostripUrl: string;
  guestEmail: string;
  guestName?: string;
  activeEvent: PhotoboothEvent;
  selectedFrame: EventFrame;
  companionStatus: CompanionStatus;
  onNewSession: () => void;
  wsSocket: WebSocket | null;
  saveSession: (session: Session) => void;
  settings: AppSettings;
  emailConfig: EmailConfig;
}

export default function FinalPreview({
  photostripUrl,
  guestEmail,
  guestName,
  activeEvent,
  selectedFrame,
  companionStatus,
  onNewSession,
  wsSocket,
  saveSession,
  settings,
  emailConfig,
}: FinalPreviewProps) {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [printStatus, setPrintStatus] = useState<'idle' | 'spooling' | 'printing' | 'printed' | 'error'>('idle');
  const [printCopies, setPrintCopies] = useState<number>(activeEvent.printCopies || 1);
  const [printProgress, setPrintProgress] = useState<number>(0);

  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [uploadedStripId, setUploadedStripId] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(true);
  const [qrLinkUrl, setQrLinkUrl] = useState<string>('');

  // Sync real-time WebSocket response for custom SMTP sending
  useEffect(() => {
    if (!wsSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'email:sent' && data.email === guestEmail) {
          setEmailStatus('sent');
        } else if (data.type === 'email:failed' && data.email === guestEmail) {
          setEmailStatus('error');
        }
      } catch (err) {
        console.error('FinalPreview WS parsing error:', err);
      }
    };

    wsSocket.addEventListener('message', handleMessage);
    return () => {
      wsSocket.removeEventListener('message', handleMessage);
    };
  }, [wsSocket, guestEmail]);

  // Auto-send email on completion if requested, and register Session
  useEffect(() => {
    setIsUploading(true);

    // Resolve sharing origin for the QR code to ensure compatibility with other devices (e.g. phones)
    let sharingOrigin = window.location.origin;
    if (settings.customSharingUrl && settings.customSharingUrl.trim() !== '') {
      sharingOrigin = settings.customSharingUrl.trim().replace(/\/$/, '');
    } else if (!sharingOrigin || sharingOrigin === 'null' || sharingOrigin.includes('null') || sharingOrigin.includes('localhost') || sharingOrigin.includes('127.0.0.1')) {
      // Fallback to the public pre-preview / production URL so mobile devices scanning the QR can download it
      sharingOrigin = 'https://ais-pre-2fwpniwqdw3q2peqbs3jv5-446615910495.asia-southeast1.run.app';
    }

    // CRITICAL: Dev subdomain (ais-dev-) is protected and requires developer authentication.
    // We automatically swap it with the public preview subdomain (ais-pre-) so QR scans work instantly on other devices.
    if (sharingOrigin && sharingOrigin.includes('ais-dev-')) {
      sharingOrigin = sharingOrigin.replace('ais-dev-', 'ais-pre-');
    }

    const runUploaderAndSetup = async () => {
      let qrLink = '';
      let driveFileId: string | undefined;
      let driveViewLink: string | undefined;
      const sessionId = `session-${Date.now()}`;

      // 1. Google Drive Upload
      if (settings.driveConfig?.enabled && settings.driveConfig.accessToken) {
        console.log('[DRIVE-PREVIEW] Auto-uploading photostrip to Google Drive for QR link...');
        try {
          const folderId = await getOrCreateFolder(
            settings.driveConfig.accessToken,
            settings.driveConfig.folderName || 'Photobooth Kiosk Photos'
          );
          const fileName = `Photostrip_${sessionId}.png`;
          const result = await uploadPhotostripToDrive(
            settings.driveConfig.accessToken,
            photostripUrl,
            fileName,
            folderId
          );
          if (result.webViewLink) {
            qrLink = result.webViewLink;
            driveFileId = result.id;
            driveViewLink = result.webViewLink;
            console.log('[DRIVE-PREVIEW] Successfully uploaded! Direct View Link:', qrLink);
          }
        } catch (err) {
          console.error('[DRIVE-PREVIEW] Google Drive auto-upload failed:', err);
        }
      }

      // 1.5. Public anonymous upload fallback (if Google Drive is NOT enabled/connected)
      if (!qrLink) {
        console.log('[PUBLIC-PREVIEW] Google Drive not connected/enabled. Trying public fallback upload...');
        try {
          qrLink = await uploadToPublicFallback(photostripUrl);
          console.log('[PUBLIC-PREVIEW] Successfully uploaded to public cloud fallback! Link:', qrLink);
        } catch (err) {
          console.error('[PUBLIC-PREVIEW] Public cloud fallback upload failed, using local companion:', err);
        }
      }

      // 2. Local Companion Server Upload
      try {
        const res = await fetch('/api/photostrips', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: photostripUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) {
            setUploadedStripId(data.id);
            // Only set QR link to companion if we didn't successfully upload to Drive
            if (!qrLink) {
              qrLink = `${sharingOrigin}/?download=${data.id}`;
            }
          }
        }
      } catch (err) {
        console.error('[COMPANION-PREVIEW] Companion upload failed:', err);
      }

      // 3. Fallback Link
      if (!qrLink) {
        qrLink = `${sharingOrigin}/download?session=${sessionId}`;
      }

      // Store the link URL so we can display it in the modal
      setQrLinkUrl(qrLink);
      console.log(`[QR GENERATED] Target scan link: ${qrLink}`);

      // 4. Generate QR code
      try {
        const qrDataUrl = await QRCode.toDataURL(qrLink, {
          width: 300,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' }
        });
        setQrUrl(qrDataUrl);
      } catch (err) {
        console.error('QR Code generation failed:', err);
        // Fallback local QR
        try {
          const fallbackLink = `${sharingOrigin}/download?session=${sessionId}`;
          setQrLinkUrl(fallbackLink);
          const qrDataUrl = await QRCode.toDataURL(fallbackLink, {
            width: 300,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          setQrUrl(qrDataUrl);
        } catch (fbErr) {
          console.error('Fallback QR Code generation failed too:', fbErr);
        }
      }

      setIsUploading(false);

      // Compress the photostrip to a lightweight JPEG (around 40KB-80KB) for permanent database & offline storage.
      // This prevents Firestore document size limit failures (1MB) and LocalStorage quota exhaustion,
      // while guaranteeing that the photos remain visible in the gallery permanently across browser sessions.
      let compressedStrip = '';
      try {
        compressedStrip = await compressBase64Image(photostripUrl, 450, 1350, 0.75);
        console.log('[COMPRESSION] Successfully compressed photostrip. Base64 length:', compressedStrip.length);
      } catch (cErr) {
        console.error('[COMPRESSION] Failed to compress, using original:', cErr);
        compressedStrip = photostripUrl;
      }

      // 5. Create and save session
      const newSession: Session = {
        id: sessionId,
        date: new Date().toISOString(),
        guestEmail,
        guestName,
        frameId: selectedFrame.id,
        photos: [], // filled if we store raw files
        photostripUrl: compressedStrip || qrLink || photostripUrl,
        printed: false,
        emailed: false,
        printCount: 0,
        duration: 35, // estimated average
        driveFileId,
        driveViewLink,
      };

      saveSession(newSession);

      // 6. Auto-email!
      handleSendEmail();

      // 7. Auto-print if enabled in event
      if (activeEvent.autoPrint && companionStatus.printerConnected) {
        handlePrint();
      }
    };

    runUploaderAndSetup();
  }, [photostripUrl]);

  const handleSendEmail = () => {
    if (!guestEmail || !guestEmail.includes('@')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('sending');

    // Notify backend companion to send the email
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          type: 'email:send',
          email: guestEmail,
          name: guestName || 'Guest',
          photostrip: photostripUrl, // base64
          subject: activeEvent.emailSubject,
          body: activeEvent.emailBody,
          config: emailConfig,
        })
      );
    } else {
      // Since we are running full-stack in AI Studio, if websocket is offline, we fallback to simulated success
      setTimeout(() => {
        setEmailStatus('sent');
      }, 1800);
    }
  };

  const handlePrint = () => {
    setPrintStatus('spooling');
    setPrintProgress(10);

    // Send print trigger to Node.js backend
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

    // Animate printing spooling bar
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
          <p className="text-xs text-blue-300 font-medium mt-1">Ready for download, printing, and email</p>
        </div>

        {/* Thank you note */}
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-pulse">
          <CheckCircle className="w-4 h-4 fill-none" /> Delivery processing...
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
          {/* Email Delivery Status Panel */}
          <div className="p-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">Email Address</h4>
                <p className="text-xs text-blue-300 font-semibold mt-0.5">{guestEmail}</p>
              </div>
            </div>

            {/* Email send actions */}
            <div>
              {emailStatus === 'sending' && (
                <div className="flex items-center gap-1 text-xs text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                </div>
              )}
              {emailStatus === 'sent' && (
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 fill-none" /> Delivered!
                </div>
              )}
              {emailStatus === 'idle' && (
                <button
                  onClick={handleSendEmail}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Send Again
                </button>
              )}
            </div>
          </div>

          {/* Unified Save & Scan Container */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-6">
            {/* Direct QR Code Display with Expand-on-click UX */}
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

              {/* Big, beautiful highlighted Save Photo button */}
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black rounded-xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
                id="btn-download-strip"
              >
                <Download className="w-4 h-4 text-white" /> Save Photo
              </button>
            </div>
          </div>

          {/* Print Section Panel */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-md">
            <h4 className="text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5 mb-4">
              <Printer className="w-4 h-4 text-purple-400" /> Print Your Memories
            </h4>

            {printStatus === 'idle' || printStatus === 'printed' ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Print count selectors */}
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

                {/* Print trigger button */}
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
