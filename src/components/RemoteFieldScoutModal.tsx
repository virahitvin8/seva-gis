import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Smartphone,
  Navigation,
  Sparkles,
  MapPin,
  RefreshCw,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  createRemoteScoutSession,
  checkScoutBeaconStatus,
  generateWhatsAppScoutInvite,
  generateSmsScoutInvite,
  type ScoutSessionRecord,
  type GroundScoutPayload,
} from '../lib/scoutBeaconService';
import { encodeDigipin } from '../lib/digipin';

interface RemoteFieldScoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plotName?: string;
  onBeaconReceived: (payload: GroundScoutPayload) => void;
}

export const RemoteFieldScoutModal: React.FC<RemoteFieldScoutModalProps> = ({
  isOpen,
  onClose,
  plotName = 'My Agricultural Field',
  onBeaconReceived,
}) => {
  const [label, setLabel] = useState(plotName);
  const [note, setNote] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [session, setSession] = useState<ScoutSessionRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [receivedBeacon, setReceivedBeacon] = useState<GroundScoutPayload | null>(null);

  // Initialize or re-create session when opening
  useEffect(() => {
    if (isOpen && !sessionId) {
      handleCreateSession();
    }
  }, [isOpen]);

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const res = await createRemoteScoutSession(label, note);
      setSessionId(res.sessionId);
      setShareUrl(res.shareUrl);
      setSession(res.session);
    } catch (err) {
      console.error('Failed to create scout session:', err);
    } finally {
      setCreating(false);
    }
  };

  // Poll for beacon updates every 2.5s while waiting
  useEffect(() => {
    if (!isOpen || !sessionId || receivedBeacon) return;

    let active = true;

    const interval = setInterval(async () => {
      try {
        const latest = await checkScoutBeaconStatus(sessionId);
        if (active && latest) {
          setSession(latest);
          if (latest.status === 'completed' && latest.data) {
            setReceivedBeacon(latest.data);
          }
        }
      } catch (err) {
        console.debug('Polling note:', err);
      }
    }, 2500);

    // Also listen for same-window custom events
    const handleLocalEvent = (e: any) => {
      if (active && e.detail && e.detail.sessionId === sessionId && e.detail.data) {
        setReceivedBeacon(e.detail.data);
      }
    };
    window.addEventListener('seva_beacon_received', handleLocalEvent);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('seva_beacon_received', handleLocalEvent);
    };
  }, [isOpen, sessionId, receivedBeacon]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyBeacon = () => {
    if (receivedBeacon) {
      onBeaconReceived(receivedBeacon);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Ask Friend on Field (Scout Link)</h2>
              <p className="text-[11px] text-slate-400">Zero-coordinate crowdsourced field discovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Explanation Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-xl p-3 flex gap-3 text-slate-300">
            <Sparkles size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Don't know your coordinates?</span>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                If a friend, family member, or worker is currently at the field, send them this link. When they open it, their phone takes a GPS-stamped photo/video and automatically centers your map on the exact field!
              </p>
            </div>
          </div>

          {/* Beacon Received State */}
          {receivedBeacon ? (
            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>Field Beacon Received from {receivedBeacon.scoutName || 'Friend'}!</span>
              </div>

              {/* Coordinates Display */}
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-950/80 p-3 rounded-lg border border-emerald-500/30">
                <div>
                  <span className="text-slate-500 block">COORDINATES</span>
                  <span className="text-white font-bold">{receivedBeacon.latitude.toFixed(6)}° N, {receivedBeacon.longitude.toFixed(6)}° E</span>
                </div>
                <div>
                  <span className="text-slate-500 block">MAPPLS DIGIPIN</span>
                  <span className="text-amber-400 font-bold">{receivedBeacon.digipin || encodeDigipin(receivedBeacon.latitude, receivedBeacon.longitude)}</span>
                </div>
                {receivedBeacon.accuracy && (
                  <div className="col-span-2 text-slate-400 text-[10px]">
                    GNSS Accuracy: <strong className="text-emerald-400">±{receivedBeacon.accuracy.toFixed(1)}m</strong>
                    {receivedBeacon.notes && ` · Note: "${receivedBeacon.notes}"`}
                  </div>
                )}
              </div>

              {/* Captured Photo / Video Thumbnail */}
              {receivedBeacon.photoBase64 && (
                <div className="rounded-lg overflow-hidden border border-slate-700 max-h-48 relative">
                  <img src={receivedBeacon.photoBase64} alt="Ground truth crop" className="w-full h-40 object-cover" />
                  <span className="absolute bottom-1 right-2 text-[9px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-white">
                    Ground-Truth Photo
                  </span>
                </div>
              )}
              {receivedBeacon.videoBase64 && (
                <div className="rounded-lg overflow-hidden border border-slate-700 max-h-48">
                  <video src={receivedBeacon.videoBase64} controls className="w-full h-40 object-cover" />
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyBeacon}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
              >
                <MapPin size={16} />
                <span>Apply Coordinates & Snap Field Boundary</span>
              </button>
            </div>
          ) : (
            /* Live Waiting Mode */
            <div className="space-y-4">
              {/* Shareable Link Input */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block text-[11px]">
                  Shareable Ground Scout Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl || 'Generating link...'}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center gap-1.5 cursor-pointer transition shrink-0"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Instant 1-Click Sharing Docks */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={generateWhatsAppScoutInvite(shareUrl, label)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] font-semibold flex items-center justify-center gap-2 transition"
                >
                  <MessageCircle size={16} />
                  <span>Send via WhatsApp</span>
                </a>

                <a
                  href={generateSmsScoutInvite('', shareUrl, label)}
                  className="py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Smartphone size={16} />
                  <span>Send via SMS</span>
                </a>
              </div>

              {/* Waiting Radar Pulse Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center space-y-3">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-75" />
                  <div className="absolute inset-2 rounded-full border border-emerald-500/50 animate-pulse" />
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                    <Navigation size={16} className="animate-spin text-emerald-400" style={{ animationDuration: '6s' }} />
                  </div>
                </div>

                <div>
                  <span className="font-bold text-white text-xs block">Listening for Ground Beacon...</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Keep this modal open. As soon as your friend opens the link and submits their photo/GPS, your map will automatically update.
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  Session Token: {sessionId || 'Connecting...'} · Polling every 2.5s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/40">
          <span className="text-[10px] text-slate-500 font-mono">
            Zero app installation required for friend
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoteFieldScoutModal;
