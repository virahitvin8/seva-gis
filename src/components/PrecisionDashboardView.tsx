import React, { useMemo, useState } from 'react';
import {
  MapPin, Play, Pause, Mic, Navigation, Volume2, Copy, Check,
  Compass, Sun, ShieldCheck, Satellite
} from 'lucide-react';
import {
  toUtm,
  toDdm,
  computeOrthometricAltitudeM,
  estimateMagneticDeclinationDeg,
  computeSolarLunarEphemeris,
  compassCardinal16,
  normalizeDeg,
} from '../lib/geodesyField';
import { formatAllCoordinateSystems } from '../lib/digipin';
import { speakFieldGuidance } from '../lib/fieldAudioSensors';
import { useI18n } from '../lib/i18n';
import type { LiveGnssFix } from './HandyGpsConsole';

interface PrecisionDashboardViewProps {
  lat: number;
  lon: number;
  gpsFix: LiveGnssFix | null;
  gpsError: string | null;
  compassAzimuth: number;
  compassSource: 'sensor' | 'gps' | 'none';
  isTracking: boolean;
  isEasyMode: boolean;
  useOrthometricMsl: boolean;
  onToggleOrthometric: () => void;
  onOpenWaypointSheet: () => void;
  onToggleTracking: () => void;
  onOpenVoiceNote: () => void;
  onOpenProjection: () => void;
}

type HeroFormat = 'dd' | 'dms' | 'utm';

function RingGauge({
  label,
  valueText,
  subText,
  percent,
  strokeColor,
}: {
  label: string;
  valueText: string;
  subText: string;
  percent: number;
  strokeColor: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);

  return (
    <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-3.5 flex flex-col items-center text-center gap-2">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#2D2D2D" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute font-['JetBrains_Mono',monospace] text-sm font-bold text-white tabular-nums">
          {valueText}
        </span>
      </div>
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-[#E5EAE6]">{label}</div>
        <div className="text-[11px] font-mono text-[#A3B1A6] tabular-nums">{subText}</div>
      </div>
    </div>
  );
}

export default function PrecisionDashboardView({
  lat,
  lon,
  gpsFix,
  gpsError,
  compassAzimuth,
  compassSource,
  isTracking,
  isEasyMode,
  useOrthometricMsl,
  onToggleOrthometric,
  onOpenWaypointSheet,
  onToggleTracking,
  onOpenVoiceNote,
  onOpenProjection,
}: PrecisionDashboardViewProps) {
  const { t, lang } = useI18n();
  const [heroFormat, setHeroFormat] = useState<HeroFormat>('dd');
  const [copied, setCopied] = useState(false);

  const coords = useMemo(() => formatAllCoordinateSystems(lat, lon), [lat, lon]);
  const utm = useMemo(() => toUtm(lat, lon), [lat, lon]);
  const ddmLat = useMemo(() => toDdm(lat, true), [lat]);
  const ddmLon = useMemo(() => toDdm(lon, false), [lon]);

  const declinationDeg = useMemo(() => estimateMagneticDeclinationDeg(lat, lon, new Date()), [lat, lon]);
  const ephemeris = useMemo(() => computeSolarLunarEphemeris(lat, lon, new Date()), [lat, lon]);

  const ortho = useMemo(() => {
    if (gpsFix?.altitudeM == null) return null;
    return computeOrthometricAltitudeM(gpsFix.altitudeM, lat, lon);
  }, [gpsFix?.altitudeM, lat, lon]);

  const fixClassification = useMemo(() => {
    if (!gpsFix) {
      return {
        label: t('field.dash.fixNone'),
        badgeClass: 'bg-[#F57C00]/20 text-[#FFB74D] border-[#F57C00]/50',
        dotClass: 'bg-[#F57C00]',
        healthPct: 0,
      };
    }
    if (gpsFix.accuracyM <= 3 && gpsFix.altitudeM != null) {
      return {
        label: t('field.dash.fixDgps'),
        badgeClass: 'bg-[#2E7D32]/30 text-[#A5D6A7] border-[#4CAF50]/60',
        dotClass: 'bg-[#4CAF50]',
        healthPct: 96,
      };
    }
    if (gpsFix.altitudeM != null) {
      return {
        label: t('field.dash.fix3d'),
        badgeClass: 'bg-[#2E7D32]/25 text-[#A5D6A7] border-[#2E7D32]/60',
        dotClass: 'bg-[#66BB6A]',
        healthPct: Math.max(55, Math.min(92, Math.round(100 - gpsFix.accuracyM * 2.2))),
      };
    }
    return {
      label: t('field.dash.fix2d'),
      badgeClass: 'bg-[#F57C00]/20 text-[#FFB74D] border-[#F57C00]/50',
      dotClass: 'bg-[#F57C00]',
      healthPct: Math.max(35, Math.min(72, Math.round(80 - gpsFix.accuracyM * 1.8))),
    };
  }, [gpsFix, t]);

  const accMeters = gpsFix ? gpsFix.accuracyM : null;
  const accPercent = accMeters == null ? 0 : Math.max(10, Math.min(100, Math.round(100 - Math.min(30, accMeters) * 3)));

  const activeAltM = useMemo(() => {
    if (!gpsFix || gpsFix.altitudeM == null) return null;
    return useOrthometricMsl && ortho ? ortho.mslM : Number(gpsFix.altitudeM.toFixed(1));
  }, [gpsFix, useOrthometricMsl, ortho]);

  const heroPrimary = useMemo(() => {
    if (heroFormat === 'dd') {
      return {
        line1: `${lat.toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`,
        line2: `${lon.toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`,
        copy: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      };
    }
    if (heroFormat === 'dms') {
      return {
        line1: coords.dms.split(',')[0]?.trim() || ddmLat,
        line2: coords.dms.split(',')[1]?.trim() || ddmLon,
        copy: coords.dms,
      };
    }
    return {
      line1: `${utm.zoneNumber}${utm.hemisphere} (${utm.bandLetter}) · E ${Math.round(utm.easting)}`,
      line2: `N ${Math.round(utm.northing)} m`,
      copy: utm.formatted,
    };
  }, [heroFormat, lat, lon, coords.dms, ddmLat, ddmLon, utm]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(heroPrimary.copy).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSpeakSummary = () => {
    const accText = accMeters != null ? `${Math.round(accMeters)} meters` : 'waiting for GPS';
    const altText = activeAltM != null ? `${Math.round(activeAltM)} meters` : 'unavailable';
    if (lang === 'hi') {
      speakFieldGuidance(
        `वर्तमान स्थिति: अक्षांश ${lat.toFixed(4)}, देशांतर ${lon.toFixed(4)}. सटीकता ${accMeters != null ? Math.round(accMeters) + ' मीटर' : 'प्रतीक्षा में'}. ऊँचाई ${activeAltM != null ? Math.round(activeAltM) + ' मीटर' : 'उपलब्ध नहीं'}.`,
        'hi'
      );
    } else if (lang === 'te') {
      speakFieldGuidance(
        `ప్రస్తుత స్థానం: అక్షాంశం ${lat.toFixed(4)}, రేఖాంశం ${lon.toFixed(4)}. ఖచ్చితత్వం ${accMeters != null ? Math.round(accMeters) + ' మీటర్లు' : 'వేచి ఉంది'}. ఎత్తు ${activeAltM != null ? Math.round(activeAltM) + ' మీటర్లు' : 'అందుబాటులో లేదు'}.`,
        'te'
      );
    } else {
      speakFieldGuidance(
        `Position ${lat.toFixed(4)} north, ${lon.toFixed(4)} east. Accuracy ${accText}. Altitude ${altText}.`,
        'en'
      );
    }
  };

  const magAzimuth = normalizeDeg(compassAzimuth - declinationDeg);

  return (
    <div className="space-y-4 pb-6">
      {/* Status & Privacy Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`min-h-[40px] px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 ${fixClassification.badgeClass}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${fixClassification.dotClass} ${gpsFix ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
          <Satellite size={14} />
          <span>{fixClassification.label}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2E7D32]/20 border border-[#2E7D32]/50 text-xs font-semibold text-[#A5D6A7]">
            <ShieldCheck size={14} />
            <span>{t('field.badge.localOnly')}</span>
          </span>
        </div>
      </div>

      {/* Hero Sunlight-Readable Coordinate Block */}
      <section className="bg-[#1E1E1E] border border-[#2F2F2F] rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#2C2C2C]">
            {(['dd', 'dms', 'utm'] as HeroFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setHeroFormat(fmt)}
                className={`min-h-[48px] px-3.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  heroFormat === fmt
                    ? 'bg-[#2E7D32] text-white'
                    : 'text-[#C7D0C9] hover:bg-[#252525]'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSpeakSummary}
              className="min-h-[48px] px-3.5 rounded-xl bg-[#2E7D32]/25 border border-[#4CAF50]/40 hover:bg-[#2E7D32]/40 text-xs font-bold text-[#A5D6A7] flex items-center gap-1.5"
              title={t('field.dash.readSummary')}
            >
              <Volume2 size={17} />
              <span>{t('field.action.listen')}</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#2A2A2A] hover:bg-[#343434] text-white flex items-center justify-center"
              aria-label="Copy coordinates"
            >
              {copied ? <Check size={18} className="text-[#66BB6A]" /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        <div className="bg-[#121212] border border-[#2B2B2B] rounded-xl p-4 space-y-1">
          <div className="font-['JetBrains_Mono',monospace] text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums break-all">
            {heroPrimary.line1}
          </div>
          <div className="font-['JetBrains_Mono',monospace] text-xl sm:text-2xl font-semibold text-[#81C784] tabular-nums break-all">
            {heroPrimary.line2}
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#A3B1A6] font-mono">
            <span>DIGIPIN: <strong className="text-white">{coords.digipin}</strong></span>
            {!gpsFix && <span className="text-[#FFB74D]">{gpsError || t('field.dash.waitingGps')}</span>}
          </div>
        </div>
      </section>

      {/* 3 Circular Precision Gauges */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <RingGauge
          label={t('field.dash.accuracy')}
          valueText={accMeters != null ? `±${accMeters.toFixed(1)}m` : '--'}
          subText={accMeters != null && accMeters <= 5 ? 'RTK / High' : accMeters != null ? 'Standard' : t('field.dash.fixNone')}
          percent={accPercent}
          strokeColor={accMeters != null && accMeters <= 6 ? '#2E7D32' : '#F57C00'}
        />
        <RingGauge
          label={t('field.dash.signalHealth')}
          valueText={`${fixClassification.healthPct}%`}
          subText={fixClassification.label}
          percent={fixClassification.healthPct}
          strokeColor={fixClassification.healthPct >= 75 ? '#2E7D32' : '#F57C00'}
        />
        <button
          type="button"
          onClick={onToggleOrthometric}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] rounded-2xl"
        >
          <RingGauge
            label={useOrthometricMsl ? t('field.dash.altitudeMsl') : t('field.dash.altitudeEllip')}
            valueText={activeAltM != null ? `${Math.round(activeAltM)}m` : '--'}
            subText={ortho ? `N=${ortho.geoidSeparationM}m` : 'MSL'}
            percent={activeAltM != null ? 84 : 0}
            strokeColor="#4CAF50"
          />
        </button>
      </div>

      {/* 4-Button Glove-Friendly Quick Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenWaypointSheet}
          className="min-h-[82px] rounded-2xl bg-[#2E7D32] hover:bg-[#388E3C] text-white p-4 flex flex-col items-start justify-between gap-2 shadow-lg text-left transition active:scale-[0.98]"
        >
          <MapPin size={24} strokeWidth={2.2} />
          <div>
            <div className="text-sm sm:text-base font-bold leading-tight">{t('field.dash.markWaypoint')}</div>
            {isEasyMode && <div className="text-xs text-[#C8E6C9] mt-0.5">{t('field.dash.easyHintMark')}</div>}
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleTracking}
          className={`min-h-[82px] rounded-2xl p-4 flex flex-col items-start justify-between gap-2 shadow-lg text-left border transition active:scale-[0.98] ${
            isTracking
              ? 'bg-[#F57C00] border-[#FFB74D] text-[#121212]'
              : 'bg-[#1E1E1E] border-[#F57C00]/60 hover:bg-[#282828] text-white'
          }`}
        >
          {isTracking ? <Pause size={24} strokeWidth={2.4} /> : <Play size={24} strokeWidth={2.4} className="text-[#F57C00]" />}
          <div>
            <div className="text-sm sm:text-base font-bold leading-tight">
              {isTracking ? t('field.dash.stopTrack') : t('field.dash.startTrack')}
            </div>
            {isEasyMode && (
              <div className={`text-xs mt-0.5 ${isTracking ? 'text-[#1E1E1E]' : 'text-[#C7D0C9]'}`}>
                {t('field.dash.easyHintWalk')}
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenVoiceNote}
          className="min-h-[82px] rounded-2xl bg-[#1E1E1E] border border-[#323232] hover:border-[#4CAF50]/60 hover:bg-[#252525] text-white p-4 flex flex-col items-start justify-between gap-2 text-left transition active:scale-[0.98]"
        >
          <Mic size={24} strokeWidth={2.2} className="text-[#81C784]" />
          <div>
            <div className="text-sm sm:text-base font-bold leading-tight">{t('field.dash.voiceNote')}</div>
            {isEasyMode && <div className="text-xs text-[#C7D0C9] mt-0.5">{t('field.dash.easyHintVoice')}</div>}
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenProjection}
          className="min-h-[82px] rounded-2xl bg-[#1E1E1E] border border-[#323232] hover:border-[#F57C00]/60 hover:bg-[#252525] text-white p-4 flex flex-col items-start justify-between gap-2 text-left transition active:scale-[0.98]"
        >
          <Navigation size={24} strokeWidth={2.2} className="text-[#FFB74D]" />
          <div>
            <div className="text-sm sm:text-base font-bold leading-tight">{t('field.dash.projection')}</div>
            {isEasyMode && <div className="text-xs text-[#C7D0C9] mt-0.5">{t('field.dash.easyHintPhoto')}</div>}
          </div>
        </button>
      </div>

      {/* Compass, IGRF-2025 Declination & Ephemeris Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#A3B1A6]">{t('field.dash.heading')}</div>
            <div className="font-mono text-base font-bold text-white tabular-nums mt-0.5">
              {Math.round(compassAzimuth)}°T ({compassCardinal16(compassAzimuth)}) · {Math.round(magAzimuth)}°M
            </div>
          </div>
          <Compass size={22} className={compassSource === 'sensor' ? 'text-[#81C784]' : 'text-[#A3B1A6]'} />
        </div>

        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-xl p-3.5">
          <div className="text-xs text-[#A3B1A6]">{t('field.dash.declination')}</div>
          <div className="font-mono text-base font-bold text-[#81C784] tabular-nums mt-0.5">
            {declinationDeg >= 0 ? `+${declinationDeg.toFixed(1)}° E` : `${declinationDeg.toFixed(1)}° W`}
          </div>
        </div>

        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#A3B1A6]">{t('field.dash.sunTimes')}</div>
            <div className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
              ☀ {ephemeris.sunriseUtc || '--'} · 🌙 {ephemeris.sunsetUtc || '--'} UTC
            </div>
          </div>
          <Sun size={20} className="text-[#FFB74D]" />
        </div>
      </div>
    </div>
  );
}

