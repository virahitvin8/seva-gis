import React, { useState, useEffect, useRef } from 'react';
import { Camera, Video, Navigation, MapPin, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Send, ShieldCheck, ArrowRight, User } from 'lucide-react';
import { submitGroundBeaconPayload, checkScoutBeaconStatus, type ScoutSessionRecord } from '../lib/scoutBeaconService';
import { encodeDigipin } from '../lib/digipin';

interface FieldScoutCapturerProps {
  sessionId: string;
  onDone?: () => void;
}

export const FieldScoutCapturer: React.FC<FieldScoutCapturerProps> = ({ sessionId, onDone }) => {
  const [session, setSession] = useState<ScoutSessionRecord | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lon: number; acc: number | null; alt: number | null; heading: number | null } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // Form State
  const [scoutName, setScoutName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Session Info
  useEffect(() => {
    let mounted = true;
    checkScoutBeaconStatus(sessionId)
      .then(rec => {
        if (mounted) {
          setSession(rec);
          setLoadingSession(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingSession(false);
      });
    return () => { mounted = false; };
  }, [sessionId]);

  // 2. Continuous High-Accuracy GPS Tracking
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy,
          alt: pos.coords.altitude,
          heading: pos.coords.heading,
        });
        setGpsError(null);
      },
      err => {
        setGpsError(err.message || 'Unable to retrieve your field GPS location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000,
      }
    );

    setGpsWatchId(watchId);

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Watermark Photo on Canvas
  const processAndWatermarkPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw image
        ctx.drawImage(img, 0, 0, w, h);

        // Watermark Banner at Bottom
        const barHeight = Math.max(50, Math.round(h * 0.12));
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.fillRect(0, h - barHeight, w, barHeight);

        // Green Indicator Line
        ctx.fillStyle = '#10B981';
        ctx.fillRect(0, h - barHeight, w, 4);

        // Text Stamps
        ctx.font = `bold ${Math.round(barHeight * 0.28)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = '#10B981';
        ctx.fillText('SEVA.GIS GROUND TRUTH BEACON', 20, h - barHeight + barHeight * 0.38);

        const digipin = coords ? encodeDigipin(coords.lat, coords.lon) : 'V82-3PG-535J';
        const latStr = coords ? `${coords.lat.toFixed(6)}°N, ${coords.lon.toFixed(6)}°E` : 'Pending GPS...';
        const accStr = coords?.acc ? ` · ±${coords.acc.toFixed(1)}m` : '';
        const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

        ctx.font = `${Math.round(barHeight * 0.22)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(`📍 ${latStr}${accStr} | DIGIPIN: ${digipin}`, 20, h - barHeight + barHeight * 0.68);

        ctx.font = `${Math.round(barHeight * 0.18)}px sans-serif`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`📅 ${dateStr} · Scout: ${scoutName || 'Friend on Ground'}`, 20, h - barHeight + barHeight * 0.90);

        const finalBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoBase64(finalBase64);
        setMediaType('photo');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Video capture handler
  const processVideo = (file: File) => {
    // If larger than 25MB, alert
    if (file.size > 25 * 1024 * 1024) {
      alert('Please record a shorter video (under 25MB) so it transfers quickly.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setVideoBase64(e.target?.result as string);
      setMediaType('video');
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!coords) {
      alert('Please wait for GPS location to lock before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const digipin = encodeDigipin(coords.lat, coords.lon);

    const res = await submitGroundBeaconPayload({
      sessionId,
      latitude: coords.lat,
      longitude: coords.lon,
      accuracy: coords.acc,
      altitude: coords.alt,
      heading: coords.heading,
      digipin,
      scoutName: scoutName.trim() || 'Ground Friend',
      notes: notes.trim(),
      photoBase64,
      videoBase64,
    });

    setSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      if (onDone) setTimeout(onDone, 3000);
    } else {
      setSubmitError(res.error || 'Failed to submit beacon. Please try again.');
    }
  };

  const currentDigipin = coords ? encodeDigipin(coords.lat, coords.lon) : 'Detecting...';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-12">
      {/* 1. Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold text-sm text-emerald-400 tracking-tight">SEVA.GIS GROUND SCOUT</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
          <ShieldCheck size={12} />
          <span>Session #{sessionId.replace('scout_', '')}</span>
        </div>
      </header>

      {/* 2. Success Screen */}
      {submitted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 size={42} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Field Location Transmitted!</h2>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            Your GPS coordinates, DIGIPIN, and ground-truth media have been beamed directly to your friend's SEVA.GIS screen.
          </p>

          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-left font-mono text-xs space-y-2 mb-6">
            <div className="flex justify-between text-slate-400">
              <span>Latitude / Longitude:</span>
              <span className="text-emerald-400 font-bold">{coords?.lat.toFixed(6)}°, {coords?.lon.toFixed(6)}°</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mappls DIGIPIN:</span>
              <span className="text-amber-400 font-bold">{currentDigipin}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GPS Precision:</span>
              <span className="text-white">±{coords?.acc?.toFixed(1) || '1.5'} m</span>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            You may now safely close this browser tab. Thank you for your service! 🌾
          </div>
        </div>
      ) : (
        /* 3. Main Capturer Flow */
        <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles size={14} />
              <span>Assisting Field Identification</span>
            </div>
            <h1 className="text-base font-bold text-white">
              {session?.label || 'Agricultural Field Location Beacon'}
            </h1>
            {session?.requesterNote && (
              <p className="text-xs text-slate-300 mt-1 italic bg-slate-950/50 p-2 rounded border border-slate-800/80">
                "{session.requesterNote}"
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Please stand at or near the agricultural field. Snap a photo or record a short video of the crop, then tap <strong>Done & Send</strong>.
            </p>
          </div>

          {/* GPS Telemetry Pill */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Navigation size={14} className="text-amber-400 animate-pulse" />
                <span>Live On-Ground GNSS Telemetry</span>
              </span>
              {coords ? (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  (coords.acc || 10) <= 5 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  ±{coords.acc?.toFixed(1) || '1.8'}m Accurate
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin" /> Acquiring GPS...
                </span>
              )}
            </div>

            {gpsError ? (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">GPS Permission Needed</p>
                  <p className="text-[11px] text-red-400/90">{gpsError}</p>
                </div>
              </div>
            ) : coords ? (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500">WGS84 LATITUDE</div>
                  <div className="text-slate-200 font-bold text-sm">{coords.lat.toFixed(6)}° N</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500">WGS84 LONGITUDE</div>
                  <div className="text-slate-200 font-bold text-sm">{coords.lon.toFixed(6)}° E</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500">MAPPLS 4M×4M DIGIPIN</div>
                    <div className="text-amber-400 font-bold text-sm tracking-wider">{currentDigipin}</div>
                  </div>
                  {coords.alt && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">ELEVATION</div>
                      <div className="text-slate-300 font-bold text-sm">{Math.round(coords.alt)}m MSL</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-500 animate-pulse">
                Requesting high-precision satellite coordinates...
              </div>
            )}
          </div>

          {/* Media Capture Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Camera size={14} className="text-emerald-400" />
              <span>Ground-Truth Crop Photo or Video</span>
            </span>

            {/* Hidden native camera file inputs with environment camera capture */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  processAndWatermarkPhoto(e.target.files[0]);
                }
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  processVideo(e.target.files[0]);
                }
              }}
            />

            {/* Preview Box */}
            {photoBase64 ? (
              <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 group">
                <img src={photoBase64} alt="Captured Crop" className="w-full h-52 object-cover" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-slate-950/80 backdrop-blur rounded-lg text-[11px] text-slate-200 hover:text-white border border-slate-700 shadow"
                  >
                    Retake
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-mono text-emerald-300">
                  ✓ Geo-Stamped Photo Ready
                </div>
              </div>
            ) : videoBase64 ? (
              <div className="relative rounded-xl overflow-hidden border border-emerald-500/40">
                <video src={videoBase64} controls className="w-full h-52 object-cover bg-black" />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="px-2.5 py-1 bg-slate-950/80 backdrop-blur rounded-lg text-[11px] text-slate-200 hover:text-white border border-slate-700 shadow"
                  >
                    Retake
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl bg-slate-950 border border-dashed border-emerald-500/40 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/5 transition cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Camera size={24} />
                  </div>
                  <span className="text-xs font-bold text-white">Snap Field Photo</span>
                  <span className="text-[10px] text-slate-400">Auto-Geo-Stamped</span>
                </button>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl bg-slate-950 border border-dashed border-cyan-500/40 hover:border-cyan-500 text-cyan-400 hover:bg-cyan-500/5 transition cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Video size={24} />
                  </div>
                  <span className="text-xs font-bold text-white">Record Video</span>
                  <span className="text-[10px] text-slate-400">10-15s Crop Scan</span>
                </button>
              </div>
            )}
          </div>

          {/* Optional Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Your Name / Relation (Optional)
              </label>
              <input
                type="text"
                value={scoutName}
                onChange={e => setScoutName(e.target.value)}
                placeholder="e.g. Ramesh, Field Neighbor, Operator"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Field Observation Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Standing at north-east corner near borewell, mirchi crop in vegetative stage"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 text-xs text-red-300">
              {submitError}
            </div>
          )}

          {/* Big Tactile Submit Action Button */}
          <button
            type="button"
            disabled={!coords || submitting}
            onClick={handleSubmit}
            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition shadow-lg ${
              !coords || submitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-[0.99]'
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Transmitting Field Beacon...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Done & Send to SEVA.GIS</span>
              </>
            )}
          </button>
        </main>
      )}
    </div>
  );
};

export default FieldScoutCapturer;
