import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, Square, Volume2, Trash2, Navigation, Edit3, Camera, Flashlight,
  Download, Upload, Radio, Copy, Check, ShieldCheck
} from 'lucide-react';
import {
  type FieldWaypoint,
  type TrackPoint,
  computeTrackStats,
  buildFdrsTelemetryFrames,
  exportFdrsNodeConfigHeader,
  exportWaypointsAndTrackGpx,
  exportWaypointsAndTrackKml,
  exportWaypointsCsv,
  parseGpxOrKml,
} from '../lib/geodesyField';
import { encodeDigipin } from '../lib/digipin';
import { startMicrophoneWaveformAnalyser, speakFieldGuidance } from '../lib/fieldAudioSensors';
import { LANGUAGE_OPTIONS } from '../lib/i18nCatalog';
import { useI18n } from '../lib/i18n';
import type { LiveGnssFix } from './HandyGpsConsole';

export interface VoiceMemoEntry {
  id: string;
  url: string;
  transcript: string;
  lat: number;
  lon: number;
  digipin: string;
  durationSec: number;
  createdAt: string;
}

interface VoiceMemoJointProps {
  lat: number;
  lon: number;
  gpsFix: LiveGnssFix | null;
  farmName: string;
  waypoints: FieldWaypoint[];
  trackPoints: TrackPoint[];
  voiceMemos: VoiceMemoEntry[];
  onAddVoiceMemo: (memo: VoiceMemoEntry) => void;
  onEditWaypoint: (wp: FieldWaypoint) => void;
  onDeleteWaypoint: (id: string) => void;
  onNavigateWaypoint: (wp: FieldWaypoint) => void;
  onImportData: (wps: FieldWaypoint[], trk: TrackPoint[]) => void;
  cameraActive: boolean;
  torchOn: boolean;
  capturedPhotoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onToggleTorch: () => void;
  onCapturePhoto: () => void;
  onOpenRemoteScout: () => void;
  onNotifyToast: (msg: string) => void;
}

const BAR_COUNT = 24;

export default function VoiceMemoJoint({
  lat,
  lon,
  gpsFix,
  farmName,
  waypoints,
  trackPoints,
  voiceMemos,
  onAddVoiceMemo,
  onEditWaypoint,
  onDeleteWaypoint,
  onNavigateWaypoint,
  onImportData,
  cameraActive,
  torchOn,
  capturedPhotoUrl,
  videoRef,
  onStartCamera,
  onStopCamera,
  onToggleTorch,
  onCapturePhoto,
  onOpenRemoteScout,
  onNotifyToast,
}: VoiceMemoJointProps) {
  const { t, lang, setLang } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [waveformBars, setWaveformBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.08));
  const [fdrsCopied, setFdrsCopied] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const analyserStopRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopAudioPipelines = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserStopRef.current?.();
    analyserStopRef.current = null;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    recognitionRef.current = null;
    setWaveformBars(new Array(BAR_COUNT).fill(0.08));
  };

  useEffect(() => () => stopAudioPipelines(), []);

  const handleToggleVoiceRecord = async () => {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      stopAudioPipelines();
      setIsRecording(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onNotifyToast('Microphone unavailable on this device');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      transcriptRef.current = '';
      setLiveTranscript('');
      startedAtRef.current = Date.now();

      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        onAddVoiceMemo({
          id: `memo-${Date.now()}`,
          url,
          transcript: transcriptRef.current.trim(),
          lat,
          lon,
          digipin: encodeDigipin(lat, lon),
          durationSec,
          createdAt: new Date().toISOString(),
        });
      };

      // Attach live Web Audio AnalyserNode for real frequency bars
      const analyser = await startMicrophoneWaveformAnalyser();
      if (analyser) {
        analyserStopRef.current = analyser.stop;
        const tick = () => {
          setWaveformBars(analyser.readBars(BAR_COUNT).map((v) => Math.max(0.08, v)));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      // Attach Web Speech Recognition when available
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const recog = new SR();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
          recog.onresult = (event: any) => {
            let full = '';
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + ' ';
            }
            transcriptRef.current = full;
            setLiveTranscript(full);
          };
          recog.start();
          recognitionRef.current = recog;
        } catch {}
      }

      recorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      onNotifyToast('Microphone permission required for voice memo');
    }
  };

  const trackStats = useMemo(() => computeTrackStats(trackPoints), [trackPoints]);
  const fdrsPacket = useMemo(
    () =>
      buildFdrsTelemetryFrames({
        lat,
        lon,
        altitudeM: gpsFix?.altitudeM ?? null,
        speedMs: gpsFix?.speedMs ?? null,
        accuracyM: gpsFix?.accuracyM,
      }),
    [lat, lon, gpsFix]
  );

  const downloadFile = (content: string, ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${farmName.replace(/\W+/g, '_')}_field.${ext}`;
    a.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseGpxOrKml(text);
    onImportData(parsed.waypoints, parsed.track);
    onNotifyToast(`Imported ${parsed.waypoints.length} waypoints & ${parsed.track.length} points`);
    e.target.value = '';
  };

  const profilePath = useMemo(() => {
    if (trackStats.profile.length < 2) return '';
    const maxDist = Math.max(1, trackStats.distanceM);
    const minA = trackStats.minAltM ?? 0;
    const spanA = Math.max(1, (trackStats.maxAltM ?? minA + 1) - minA);
    return trackStats.profile
      .map((pt, idx) => {
        const x = (pt.distM / maxDist) * 300;
        const y = 70 - ((pt.altM - minA) / spanA) * 56;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trackStats]);

  return (
    <div className="space-y-4 pb-6">
      {/* Prominent 3-Way Language Switcher (Screen D requirement) */}
      <section className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-white">{t('field.set.language')}</div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2E7D32]/20 border border-[#2E7D32]/50 text-[11px] font-semibold text-[#A5D6A7]">
            <ShieldCheck size={12} />
            <span>{t('field.badge.localOnly')}</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                setLang(opt.code);
                speakFieldGuidance(
                  opt.code === 'hi' ? 'हिंदी चुनी गई है' : opt.code === 'te' ? 'తెలుగు ఎంచుకోబడింది' : 'English selected',
                  opt.code
                );
              }}
              className={`min-h-[48px] rounded-xl font-bold text-sm border transition ${
                lang === opt.code
                  ? 'bg-[#2E7D32] border-[#66BB6A] text-white shadow-md'
                  : 'bg-[#121212] border-[#343434] text-[#D1D5DB] hover:bg-[#252525]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* AI Voice Memo & Live Waveform Visualizer */}
      <section className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Mic size={19} className="text-[#81C784]" />
              <span>{t('field.rec.voiceTitle')}</span>
            </h2>
            <p className="text-xs text-[#A3B1A6] mt-0.5">{t('field.rec.voiceHint')}</p>
          </div>

          <button
            type="button"
            onClick={handleToggleVoiceRecord}
            className={`min-h-[48px] px-5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition ${
              isRecording ? 'bg-[#F57C00] text-[#121212]' : 'bg-[#2E7D32] hover:bg-[#388E3C] text-white'
            }`}
          >
            {isRecording ? <Square size={17} /> : <Mic size={17} />}
            <span>{isRecording ? t('field.rec.stopRecording') : t('field.rec.tapToSpeak')}</span>
          </button>
        </div>

        {/* Real AudioContext Waveform Frequency Bars */}
        <div
          className="h-16 bg-[#121212] border border-[#2B2B2B] rounded-xl px-3 flex items-center justify-between gap-1"
          aria-label="Live microphone waveform"
        >
          {waveformBars.map((level, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-full transition-[height] duration-75"
              style={{
                height: `${Math.round(level * 100)}%`,
                backgroundColor: isRecording ? '#F57C00' : '#2E7D32',
              }}
            />
          ))}
        </div>

        {liveTranscript && (
          <div className="bg-[#121212] border border-[#2E7D32]/50 rounded-xl p-3 text-sm text-[#A5D6A7]">
            <div className="text-[11px] uppercase tracking-wider text-[#81C784] font-bold mb-1">
              {t('field.rec.transcriptLabel')}
            </div>
            <p>“{liveTranscript}”</p>
          </div>
        )}

        {voiceMemos.length > 0 && (
          <div className="space-y-2 pt-1">
            {voiceMemos.slice(0, 5).map((memo) => (
              <div key={memo.id} className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[#A3B1A6]">
                  <span>{memo.digipin} · {memo.durationSec}s</span>
                  <span>{new Date(memo.createdAt).toLocaleTimeString()}</span>
                </div>
                {memo.transcript && <p className="text-sm text-white">“{memo.transcript}”</p>}
                <audio controls src={memo.url} className="w-full h-9" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Waypoints + Quick Navigation & Metadata Edit */}
      <section className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">
            {t('field.rec.waypointsTitle')} ({waypoints.length})
          </h3>
          <button
            type="button"
            onClick={onOpenRemoteScout}
            className="min-h-[40px] px-3 rounded-xl bg-[#F57C00]/20 border border-[#F57C00]/50 text-xs font-bold text-[#FFB74D] flex items-center gap-1.5"
          >
            <Radio size={14} />
            <span>Friend on Field</span>
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {waypoints.map((wp) => (
            <div
              key={wp.id}
              className="bg-[#121212] border border-[#2D2D2D] rounded-xl p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{wp.label}</div>
                <div className="text-xs font-mono text-[#A3B1A6] tabular-nums">
                  {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
                  {wp.crop ? ` · ${wp.crop}` : ''}
                  {wp.soilType ? ` · ${wp.soilType}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateWaypoint(wp)}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2E7D32] text-white flex items-center justify-center"
                  title="Go to waypoint on Map"
                  aria-label="Navigate to waypoint"
                >
                  <Navigation size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onEditWaypoint(wp)}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2A2A2A] text-[#E5E7EB] flex items-center justify-center"
                  aria-label="Edit waypoint details"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteWaypoint(wp.id)}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2A2A2A] hover:bg-red-900/60 text-[#FCA5A5] flex items-center justify-center"
                  aria-label="Delete waypoint"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tracklog & Elevation Profile + Geotagged Camera */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white">Tracklog ({trackStats.pointCount} pts)</div>
            <div className="font-mono text-xs text-[#81C784] tabular-nums">
              {(trackStats.distanceM / 1000).toFixed(2)} km · +{trackStats.ascentM}m
            </div>
          </div>

          <div className="bg-[#121212] border border-[#2B2B2B] rounded-xl p-2 h-24 flex items-center justify-center">
            {profilePath ? (
              <svg viewBox="0 0 300 80" className="w-full h-full">
                <path d={profilePath} fill="none" stroke="#81C784" strokeWidth="2.5" />
              </svg>
            ) : (
              <span className="text-xs text-[#A3B1A6]">Start a tracklog to plot real elevation profile</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => downloadFile(exportWaypointsAndTrackGpx(farmName, waypoints, trackPoints), 'gpx', 'application/gpx+xml')}
              className="min-h-[48px] rounded-xl bg-[#2E7D32] text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <Download size={15} />
              <span>{t('field.rec.exportGpx')}</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile(exportWaypointsAndTrackKml(farmName, waypoints, trackPoints), 'kml', 'application/vnd.google-earth.kml+xml')}
              className="min-h-[48px] rounded-xl bg-[#2A2A2A] text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <Download size={15} />
              <span>{t('field.rec.exportKml')}</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile(exportWaypointsCsv(waypoints), 'csv', 'text/csv')}
              className="min-h-[48px] rounded-xl bg-[#2A2A2A] text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <Download size={15} />
              <span>{t('field.rec.exportCsv')}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[48px] rounded-xl bg-[#121212] border border-[#383838] text-xs font-bold text-[#FFB74D] flex items-center justify-center gap-1.5"
            >
              <Upload size={15} />
              <span>{t('field.rec.importFile')}</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".gpx,.kml,.xml" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        {/* Camera + Hardware Torch */}
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera size={18} className="text-[#81C784]" />
              <span>{t('field.rec.photoTitle')}</span>
            </h3>
            <button
              type="button"
              onClick={cameraActive ? onStopCamera : onStartCamera}
              className="min-h-[40px] px-3 rounded-xl bg-[#2A2A2A] text-xs font-bold text-white"
            >
              {cameraActive ? 'Stop' : 'Start Camera'}
            </button>
          </div>

          <div className="relative h-40 rounded-xl overflow-hidden bg-[#121212] border border-[#2B2B2B] flex items-center justify-center">
            <video ref={videoRef} playsInline muted className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`} />
            {!cameraActive && !capturedPhotoUrl && (
              <span className="text-xs text-[#A3B1A6]">Camera standby — tap Start Camera to inspect live feed</span>
            )}
            {!cameraActive && capturedPhotoUrl && (
              <img src={capturedPhotoUrl} alt="Geotagged field capture" className="w-full h-full object-contain" />
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCapturePhoto}
              className="flex-1 min-h-[48px] rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <Camera size={16} />
              <span>{t('field.rec.snapPhoto')}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTorch}
              disabled={!cameraActive}
              className={`min-h-[48px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 ${
                torchOn ? 'bg-[#F57C00] text-[#121212]' : 'bg-[#2A2A2A] text-white'
              }`}
            >
              <Flashlight size={16} />
              <span>{torchOn ? t('field.rec.torchOff') : t('field.rec.torchOn')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* FDRS LoRa / MQTT Telemetry Packet & Node C++ Firmware Header */}
      <section className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-white">{t('field.rec.fdrsTitle')}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadFile(exportFdrsNodeConfigHeader(101, '0x01', 'lora'), 'fdrs_node_config.h', 'text/plain')}
              className="min-h-[40px] px-3 rounded-xl bg-[#2E7D32] text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>fdrs_node_config.h</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(fdrsPacket.json).catch(() => {});
                setFdrsCopied(true);
                setTimeout(() => setFdrsCopied(false), 1800);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-[#2A2A2A] text-xs font-bold text-[#81C784] flex items-center gap-1.5"
            >
              {fdrsCopied ? <Check size={14} /> : <Copy size={14} />}
              <span>{t('field.rec.copyFdrs')}</span>
            </button>
          </div>
        </div>
        <pre className="bg-[#121212] border border-[#2B2B2B] rounded-xl p-3 text-[11px] font-mono text-[#C7D0C9] overflow-x-auto tabular-nums">
          Topic: {fdrsPacket.gatewayTopic}{'\n'}{fdrsPacket.json}
        </pre>
      </section>
    </div>
  );
}

