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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ask Friend on Field"
    >
      <div
        className="bg-white border-2 border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 m-0">Ask Friend on Field (Scout Link)</h2>
              <p className="text-[11px] text-slate-600 m-0">Receive live field GPS &amp; photo from someone on site</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs bg-white">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex gap-3 text-slate-700">
            <Sparkles size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900">Don't know your field coordinates?</span>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed mb-0">
                Send this link to a friend or worker standing at the field. When they open it on their phone and tap send, their GPS pin and field photo appear here automatically.
              </p>
            </div>
          </div>

          {receivedBeacon ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-700" />
                <span>Field Beacon Received from {receivedBeacon.scoutName || 'Friend'}!</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-white p-3 rounded-lg border border-emerald-200 text-slate-800">
                <div>
                  <span className="text-slate-500 block font-sans font-semibold text-[10px]">COORDINATES</span>
                  <span className="text-slate-900 font-bold">{receivedBeacon.latitude.toFixed(6)}° N, {receivedBeacon.longitude.toFixed(6)}° E</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans font-semibold text-[10px]">DIGIPIN</span>
                  <span className="text-sky-700 font-bold">{receivedBeacon.digipin || encodeDigipin(receivedBeacon.latitude, receivedBeacon.longitude)}</span>
                </div>
                {receivedBeacon.accuracy && (
                  <div className="col-span-2 text-slate-600 text-[10px] font-sans">
                    GNSS Accuracy: <strong className="text-emerald-700">±{receivedBeacon.accuracy.toFixed(1)}m</strong>
                    {receivedBeacon.notes && ` · Note: "${receivedBeacon.notes}"`}
                  </div>
                )}
              </div>

              {receivedBeacon.photoBase64 && (
                <div className="rounded-lg overflow-hidden border border-slate-200 max-h-48 relative bg-slate-50">
                  <img src={receivedBeacon.photoBase64} alt="Ground truth field photo" className="w-full h-40 object-cover" />
                  <span className="absolute bottom-1 right-2 text-[9px] font-mono bg-white/90 text-slate-900 border border-slate-200 px-1.5 py-0.5 rounded">
                    Field Photo
                  </span>
                </div>
              )}
              {receivedBeacon.videoBase64 && (
                <div className="rounded-lg overflow-hidden border border-slate-200 max-h-48 bg-slate-50">
                  <video src={receivedBeacon.videoBase64} controls className="w-full h-40 object-cover" />
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyBeacon}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
              >
                <MapPin size={16} />
                <span>Apply Location &amp; Center Map</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-800 font-semibold block text-[11px]">
                  Shareable Field Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl || (creating ? 'Creating link...' : 'Link ready')}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-[11px] focus:outline-none focus:border-sky-600"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
                  >
                    {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href={generateWhatsAppScoutInvite(shareUrl, label)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold flex items-center justify-center gap-2 transition no-underline"
                >
                  <MessageCircle size={16} />
                  <span>Send via WhatsApp</span>
                </a>

                <a
                  href={generateSmsScoutInvite('', shareUrl, label)}
                  className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-800 font-semibold flex items-center justify-center gap-2 transition no-underline"
                >
                  <Smartphone size={16} />
                  <span>Send via SMS</span>
                </a>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2.5">
                <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-emerald-400/60 animate-ping opacity-60" />
                  <div className="absolute inset-2 rounded-full border border-emerald-500/60 animate-pulse" />
                  <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-400 flex items-center justify-center text-emerald-700">
                    <Navigation size={15} className="animate-spin text-emerald-700" style={{ animationDuration: '6s' }} />
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-900 text-xs block">Waiting for Friend's Location...</span>
                  <p className="text-[11px] text-slate-600 mt-0.5 mb-0">
                    Keep this window open. Once they submit from the field link, the coordinates load automatically.
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  Token: {sessionId || 'Connecting...'} · Polling every 2.5s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <span className="text-[10px] text-slate-600 font-mono">
            No app install needed for your friend
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoteFieldScoutModal;
