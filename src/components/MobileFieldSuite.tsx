import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass, Map as MapIcon, Sliders, Mic, Settings2, X, Sparkles,
  Sun, Moon, Download, RefreshCw, AlertTriangle, CheckCircle2, Smartphone
} from 'lucide-react';
import type { FarmData } from '../lib/seva';
import { farmRing } from '../lib/seva';
import { areaHa, perimeterM, type Ring } from '../lib/geo';
import { calculateCadastralMetrics, type CadastralAreaMetrics } from '../lib/cadastralUnits';
import { formatAllCoordinateSystems } from '../lib/digipin';
import {
  bearingDeg,
  computeOrthometricAltitudeM,
  geodesicDistanceM,
  normalizeDeg,
  relativeDirectionFromDelta,
  type FieldWaypoint,
  type TrackPoint,
} from '../lib/geodesyField';
import {
  playFieldTone,
  ProximityVoiceScheduler,
  setCameraStreamTorch,
  speakFieldGuidance,
} from '../lib/fieldAudioSensors';
import { appUpdateService } from '../services/appUpdateService';
import { LANGUAGE_OPTIONS } from '../lib/i18nCatalog';
import { useI18n } from '../lib/i18n';
import type { CoordinateSystem, LiveGnssFix, UnitSystem } from './HandyGpsConsole';
import PrecisionDashboardView from './PrecisionDashboardView';
import TacticalMapView from './TacticalMapView';
import GeodesyToolsView from './GeodesyToolsView';
import VoiceMemoJoint, { type VoiceMemoEntry } from './VoiceMemoJoint';
import WaypointMetadataSheet from './WaypointMetadataSheet';
import RemoteFieldScoutModal from './RemoteFieldScoutModal';
import type { GroundScoutPayload } from '../lib/scoutBeaconService';

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string };
  onClose: () => void;
  onApplyBoundary?: (newRing: Ring) => void;
}

type FieldTab = 'dashboard' | 'map' | 'tools' | 'records' | 'settings';

export default function MobileFieldSuite({ farm, onClose, onApplyBoundary }: Props) {
  const { t, lang, setLang } = useI18n();

  const [activeTab, setActiveTab] = useState<FieldTab>('dashboard');
  const [isEasyMode, setIsEasyMode] = useState<boolean>(true);
  const [selectedCoordSys, setSelectedCoordSys] = useState<CoordinateSystem>('digipin');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [useOrthometricMsl, setUseOrthometricMsl] = useState<boolean>(true);
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [focusProjection, setFocusProjection] = useState<boolean>(false);

  // Polygon & center
  const initialRing = useMemo<Ring>(() => farmRing(farm), [farm]);
  const [pins, setPins] = useState<[number, number][]>(() => initialRing.slice(0, -1));
  const [centerCoord, setCenterCoord] = useState<[number, number]>(() =>
    initialRing.length > 0 ? initialRing[0] : [farm.lon ?? 78.4867, farm.lat ?? 17.385]
  );

  // Real GNSS & Compass Sensors
  const [gpsFix, setGpsFix] = useState<LiveGnssFix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const hadFixRef = useRef(false);
  const [compassHeadingDeg, setCompassHeadingDeg] = useState<number | null>(null);
  const [compassSource, setCompassSource] = useState<'sensor' | 'gps' | 'none'>('none');

  // Tracking, Walking, Waypoints, Memos
  const [isTrackingLog, setIsTrackingLog] = useState(false);
  const [isWalkingPerimeter, setIsWalkingPerimeter] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>(() => {
    try {
      const raw = localStorage.getItem('seva_field_tracklog');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [waypoints, setWaypoints] = useState<FieldWaypoint[]>(() => {
    try {
      const raw = localStorage.getItem('seva_field_waypoints');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const baseLat = initialRing[0]?.[1] ?? farm.lat ?? 17.385;
    const baseLon = initialRing[0]?.[0] ?? farm.lon ?? 78.4867;
    return [
      {
        id: 'wp-start',
        label: 'Corner Post #1',
        lat: baseLat,
        lon: baseLon,
        type: 'corner',
        farmId: farm.name,
        crop: farm.crop,
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [voiceMemos, setVoiceMemos] = useState<VoiceMemoEntry[]>([]);
  const [navTarget, setNavTarget] = useState<FieldWaypoint | null>(null);
  const voiceSchedRef = useRef(new ProximityVoiceScheduler());

  // Waypoint Bottom Sheet & Remote Scout
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<FieldWaypoint | null>(null);
  const [showRemoteScout, setShowRemoteScout] = useState(false);

  // Camera & Torch
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Toast alert queue
  const [toastMsg, setToastMsg] = useState<{ text: string; kind: 'ok' | 'warn' } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const notifyToast = (text: string, kind: 'ok' | 'warn' = 'ok') => {
    setToastMsg({ text, kind });
    setTimeout(() => setToastMsg((cur) => (cur?.text === text ? null : cur)), 4200);
  };

  useEffect(() => {
    try { localStorage.setItem('seva_field_waypoints', JSON.stringify(waypoints)); } catch {}
  }, [waypoints]);

  useEffect(() => {
    try { localStorage.setItem('seva_field_tracklog', JSON.stringify(trackPoints.slice(-2000))); } catch {}
  }, [trackPoints]);

  // Real Hardware GNSS WatchPosition
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Geolocation API unavailable');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nextFix: LiveGnssFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? 12,
          altitudeM: pos.coords.altitude,
          speedMs: pos.coords.speed,
          headingDeg: pos.coords.heading,
          timestamp: pos.timestamp || Date.now(),
        };
        setGpsFix(nextFix);
        setGpsError(null);
        if (!hadFixRef.current) {
          hadFixRef.current = true;
          playFieldTone('fix-acquired');
          notifyToast(t('field.toast.gpsReady'), 'ok');
        }
        if (typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)) {
          setCompassHeadingDeg((prev) => prev ?? pos.coords.heading);
          setCompassSource((prev) => (prev === 'sensor' ? 'sensor' : 'gps'));
        }
      },
      (err) => {
        setGpsError(err.message || 'GNSS signal unavailable');
        if (hadFixRef.current) {
          hadFixRef.current = false;
          playFieldTone('fix-lost');
          notifyToast(t('field.toast.gpsLost'), 'warn');
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Device Orientation Compass
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const anyEv = ev as any;
      let heading: number | null = null;
      if (typeof anyEv.webkitCompassHeading === 'number' && Number.isFinite(anyEv.webkitCompassHeading)) {
        heading = anyEv.webkitCompassHeading;
      } else if (typeof ev.alpha === 'number' && Number.isFinite(ev.alpha)) {
        heading = 360 - ev.alpha;
      }
      if (heading !== null) {
        setCompassHeadingDeg(normalizeDeg(heading));
        setCompassSource('sensor');
      }
    };
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Append real GNSS positions to tracklog & boundary walk
  useEffect(() => {
    if (!gpsFix) return;
    if (isTrackingLog || isWalkingPerimeter) {
      const msl =
        gpsFix.altitudeM != null
          ? computeOrthometricAltitudeM(gpsFix.altitudeM, gpsFix.lat, gpsFix.lon).mslM
          : null;
      setTrackPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && geodesicDistanceM(last.lat, last.lon, gpsFix.lat, gpsFix.lon) < 2.5) return prev;
        return [...prev, { lat: gpsFix.lat, lon: gpsFix.lon, altM: msl, timestamp: gpsFix.timestamp, speedMs: gpsFix.speedMs }];
      });
    }
    if (isWalkingPerimeter) {
      setPins((prev) => {
        const last = prev[prev.length - 1];
        if (last && geodesicDistanceM(last[1], last[0], gpsFix.lat, gpsFix.lon) < 4) return prev;
        return [...prev, [Number(gpsFix.lon.toFixed(7)), Number(gpsFix.lat.toFixed(7))]];
      });
    }
  }, [gpsFix, isTrackingLog, isWalkingPerimeter]);

  const activeLat = gpsFix?.lat ?? centerCoord[1];
  const activeLon = gpsFix?.lon ?? centerCoord[0];
  const compassAzimuth = compassHeadingDeg ?? gpsFix?.headingDeg ?? 0;

  // Turn-by-turn proximity voice alert when navigating to a waypoint
  useEffect(() => {
    if (!navTarget || !gpsFix) return;
    const dist = geodesicDistanceM(gpsFix.lat, gpsFix.lon, navTarget.lat, navTarget.lon);
    const brng = bearingDeg(gpsFix.lat, gpsFix.lon, navTarget.lat, navTarget.lon);
    const signedDelta = ((brng - compassAzimuth + 540) % 360) - 180;
    const dir = relativeDirectionFromDelta(signedDelta, lang);
    voiceSchedRef.current.evaluate(dist, dir, (phrase) => speakFieldGuidance(phrase, lang), Date.now(), lang);
  }, [navTarget, gpsFix, compassAzimuth, lang]);

  // Camera lifecycle
  const stopCamera = () => {
    cameraStream?.getTracks().forEach((tr) => tr.stop());
    setCameraStream(null);
    setTorchOn(false);
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      notifyToast('Camera permission denied or unavailable', 'warn');
    }
  };

  const handleToggleTorch = async () => {
    const next = !torchOn;
    setTorchOn(next);
    await setCameraStreamTorch(cameraStream, next);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current || !cameraActive || !videoRef.current.videoWidth) {
      notifyToast('Start Camera first to capture real geotagged frame', 'warn');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const stampH = 160;
    const stampY = canvas.height - stampH;
    ctx.fillStyle = 'rgba(18, 18, 18, 0.90)';
    ctx.fillRect(0, stampY, canvas.width, stampH);
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, stampY);
    ctx.lineTo(canvas.width, stampY);
    ctx.stroke();

    const coords = formatAllCoordinateSystems(activeLat, activeLon);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`SEVA.GIS · ${farm.name} (${cadastralMetrics.formatted.acres})`, 32, stampY + 46);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#81C784';
    ctx.fillText(`${coords.decimal} · DIGIPIN ${coords.digipin}`, 32, stampY + 86);
    ctx.fillStyle = '#C7D0C9';
    ctx.fillText(
      `Azimuth ${Math.round(compassAzimuth)}° · ${gpsFix ? `±${gpsFix.accuracyM.toFixed(1)}m` : 'No fix'} · ${new Date().toISOString()}`,
      32,
      stampY + 122
    );

    const url = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhotoUrl(url);
    playFieldTone('pin-drop');
    notifyToast('Geotagged photo stamped with coordinates');
  };

  const closedRing = useMemo<[number, number][]>(() => {
    const active = pins.length >= 3 ? pins : initialRing.slice(0, -1);
    return active.length > 0 ? [...active, active[0]] : [];
  }, [pins, initialRing]);

  const cadastralMetrics = useMemo<CadastralAreaMetrics>(() => {
    if (closedRing.length < 4) {
      return calculateCadastralMetrics(areaHa(initialRing) * 10000, perimeterM(initialRing));
    }
    return calculateCadastralMetrics(areaHa(closedRing as Ring) * 10000, perimeterM(closedRing as Ring));
  }, [closedRing, initialRing]);

  const handleSaveWaypoint = (wp: FieldWaypoint) => {
    setWaypoints((prev) => {
      const idx = prev.findIndex((p) => p.id === wp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = wp;
        return next;
      }
      return [wp, ...prev];
    });
    playFieldTone('pin-drop');
    setSheetOpen(false);
    setEditingWaypoint(null);
    notifyToast(t('field.toast.waypointSaved'));
  };

  const handleScoutBeaconReceived = (payload: GroundScoutPayload) => {
    setCenterCoord([payload.longitude, payload.latitude]);
    if (payload.corners && payload.corners.length >= 3) {
      setPins(payload.corners);
    }
    notifyToast(`Received beacon from ${payload.scoutName || 'field partner'}`);
  };

  const handleManualOtaCheck = async () => {
    setCheckingUpdate(true);
    try {
      const res = await appUpdateService.checkForRemoteVersion(false);
      notifyToast(res ? `${t('field.toast.otaReady')} (${res.version})` : t('field.toast.otaReady'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const navItems: Array<{ id: FieldTab; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { id: 'dashboard', label: t('field.nav.dashboard'), icon: Compass },
    { id: 'map', label: t('field.nav.map'), icon: MapIcon },
    { id: 'tools', label: t('field.nav.tools'), icon: Sliders },
    { id: 'records', label: t('field.nav.records'), icon: Mic },
    { id: 'settings', label: t('field.nav.settings'), icon: Settings2 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#121212] text-white flex flex-col md:flex-row font-sans overflow-hidden"
      style={isNightMode ? { filter: 'sepia(0.45) brightness(0.76) hue-rotate(-35deg)' } : undefined}
    >
      {/* Desktop Side Rail */}
      <aside className="hidden md:flex md:w-24 lg:w-56 shrink-0 flex-col bg-[#1E1E1E] border-r border-[#2E2E2E] p-3 justify-between">
        <div className="space-y-4">
          <div className="px-2 pt-1">
            <div className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <Smartphone size={18} className="text-[#66BB6A]" />
              <span className="hidden lg:inline">SEVA·GIS FIELD</span>
            </div>
            <div className="text-[11px] font-mono text-[#81C784] hidden lg:block mt-0.5">v4.7.0</div>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Field studio side rail">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveTab(item.id); setFocusProjection(false); }}
                  className={`min-h-[48px] px-3 rounded-xl flex items-center justify-center lg:justify-start gap-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-[#2E7D32] text-white shadow-md'
                      : 'text-[#C7D0C9] hover:bg-[#2A2A2A]'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[48px] px-3 rounded-xl bg-[#2A2A2A] hover:bg-[#353535] text-xs font-bold text-[#E5E7EB] flex items-center justify-center lg:justify-start gap-2"
        >
          <X size={18} />
          <span className="hidden lg:inline">{t('field.action.close')}</span>
        </button>
      </aside>

      {/* Main Responsive Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Industrial Bar */}
        <header className="shrink-0 bg-[#1E1E1E] border-b border-[#2E2E2E] px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white truncate">{farm.name}</span>
              <span className="px-2 py-0.5 rounded bg-[#2E7D32]/25 border border-[#4CAF50]/40 text-[11px] font-mono text-[#A5D6A7] shrink-0">
                v4.7.0
              </span>
            </div>
            <div className="text-xs font-mono text-[#A3B1A6] truncate tabular-nums">
              {cadastralMetrics.formatted.acres} · {cadastralMetrics.formatted.guntha}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Mode Switch: Easy Farmer vs Industrial Pro */}
            <button
              type="button"
              onClick={() => setIsEasyMode((v) => !v)}
              className={`min-h-[48px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                isEasyMode
                  ? 'bg-[#2E7D32]/25 border-[#4CAF50] text-[#A5D6A7]'
                  : 'bg-[#F57C00]/20 border-[#F57C00] text-[#FFB74D]'
              }`}
            >
              <Sparkles size={15} />
              <span>{isEasyMode ? t('field.mode.easy') : t('field.mode.pro')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="md:hidden min-h-[48px] min-w-[48px] rounded-xl bg-[#2A2A2A] hover:bg-[#353535] text-white flex items-center justify-center"
              aria-label={t('field.action.close')}
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Scrollable Screen Container */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-5 pt-4 pb-24 md:pb-6 max-w-5xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <PrecisionDashboardView
              lat={activeLat}
              lon={activeLon}
              gpsFix={gpsFix}
              gpsError={gpsError}
              compassAzimuth={compassAzimuth}
              compassSource={compassSource}
              isTracking={isTrackingLog}
              isEasyMode={isEasyMode}
              useOrthometricMsl={useOrthometricMsl}
              onToggleOrthometric={() => setUseOrthometricMsl((v) => !v)}
              onOpenWaypointSheet={() => {
                setEditingWaypoint(null);
                setSheetOpen(true);
              }}
              onToggleTracking={() => setIsTrackingLog((v) => !v)}
              onOpenVoiceNote={() => setActiveTab('records')}
              onOpenProjection={() => {
                setFocusProjection(true);
                setActiveTab('tools');
              }}
            />
          )}

          {activeTab === 'map' && (
            <TacticalMapView
              centerCoord={centerCoord}
              onChangeCenter={setCenterCoord}
              gpsFix={gpsFix}
              pins={pins}
              closedRing={closedRing}
              waypoints={waypoints}
              trackPoints={trackPoints}
              unitSystem={unitSystem}
              cadastralMetrics={cadastralMetrics}
              isWalkingPerimeter={isWalkingPerimeter}
              onDropPin={() => {
                setPins((p) => [...p, [centerCoord[0], centerCoord[1]]]);
                playFieldTone('pin-drop');
              }}
              onUndoPin={() => setPins((p) => p.slice(0, -1))}
              onToggleWalkPerimeter={() => setIsWalkingPerimeter((v) => !v)}
              onApplyBoundary={
                onApplyBoundary && closedRing.length >= 4
                  ? () => onApplyBoundary(closedRing as Ring)
                  : undefined
              }
              onNotifyToast={(msg) => notifyToast(msg)}
            />
          )}

          {activeTab === 'tools' && (
            <GeodesyToolsView
              lat={activeLat}
              lon={activeLon}
              gpsFix={gpsFix}
              farmName={farm.name}
              closedRing={closedRing}
              waypoints={waypoints}
              trackPoints={trackPoints}
              useOrthometricMsl={useOrthometricMsl}
              onToggleOrthometric={() => setUseOrthometricMsl((v) => !v)}
              onAddWaypoint={handleSaveWaypoint}
              initialFocusProjection={focusProjection}
            />
          )}

          {activeTab === 'records' && (
            <VoiceMemoJoint
              lat={activeLat}
              lon={activeLon}
              gpsFix={gpsFix}
              farmName={farm.name}
              waypoints={waypoints}
              trackPoints={trackPoints}
              voiceMemos={voiceMemos}
              onAddVoiceMemo={(m) => setVoiceMemos((prev) => [m, ...prev])}
              onEditWaypoint={(wp) => {
                setEditingWaypoint(wp);
                setSheetOpen(true);
              }}
              onDeleteWaypoint={(id) => setWaypoints((prev) => prev.filter((w) => w.id !== id))}
              onNavigateWaypoint={(wp) => {
                setNavTarget(wp);
                setCenterCoord([wp.lon, wp.lat]);
                voiceSchedRef.current.reset();
                setActiveTab('map');
                notifyToast(`Navigating to ${wp.label}`);
              }}
              onImportData={(wps, trk) => {
                if (wps.length > 0) setWaypoints((prev) => [...wps, ...prev]);
                if (trk.length > 0) setTrackPoints((prev) => [...prev, ...trk]);
              }}
              cameraActive={cameraActive}
              torchOn={torchOn}
              capturedPhotoUrl={capturedPhotoUrl}
              videoRef={videoRef}
              onStartCamera={startCamera}
              onStopCamera={stopCamera}
              onToggleTorch={handleToggleTorch}
              onCapturePhoto={handleCapturePhoto}
              onOpenRemoteScout={() => setShowRemoteScout(true)}
              onNotifyToast={(msg) => notifyToast(msg)}
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 pb-6">
              <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
                <div className="text-sm font-bold text-white">{t('field.set.language')}</div>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLang(opt.code)}
                      className={`min-h-[48px] rounded-xl font-bold text-sm border ${
                        lang === opt.code
                          ? 'bg-[#2E7D32] border-[#66BB6A] text-white'
                          : 'bg-[#121212] border-[#343434] text-[#D1D5DB]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-2.5">
                  <div className="text-sm font-bold text-white">{t('field.set.units')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['metric', 'imperial', 'nautical'] as UnitSystem[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnitSystem(u)}
                        className={`min-h-[48px] rounded-xl text-xs font-bold uppercase border ${
                          unitSystem === u
                            ? 'bg-[#2E7D32] border-[#66BB6A] text-white'
                            : 'bg-[#121212] border-[#343434] text-[#D1D5DB]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-2.5">
                  <div className="text-sm font-bold text-white">{t('field.set.coordFormat')}</div>
                  <select
                    value={selectedCoordSys}
                    onChange={(e) => setSelectedCoordSys(e.target.value as CoordinateSystem)}
                    className="w-full min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3 text-sm font-mono text-white"
                  >
                    <option value="digipin">DIGIPIN</option>
                    <option value="decimal">WGS84 Decimal Degrees</option>
                    <option value="utm">UTM Zone (Meters)</option>
                    <option value="mgrs">MGRS Grid</option>
                    <option value="plusCode">Open Location Code (Plus)</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {isNightMode ? <Moon size={20} className="text-[#F57C00]" /> : <Sun size={20} className="text-[#FFB74D]" />}
                  <span className="text-sm font-bold text-white">{t('field.set.nightVision')}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isNightMode}
                  onClick={() => setIsNightMode((v) => !v)}
                  className={`min-h-[48px] px-4 rounded-xl font-bold text-xs border ${
                    isNightMode ? 'bg-[#F57C00] border-[#FFB74D] text-[#121212]' : 'bg-[#121212] border-[#383838] text-white'
                  }`}
                >
                  {isNightMode ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="bg-[#1E1E1E] border border-[#2E7D32]/50 rounded-2xl p-4 space-y-3">
                <div className="text-sm font-bold text-white">{t('field.set.otaTitle')}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleManualOtaCheck}
                    disabled={checkingUpdate}
                    className="min-h-[48px] px-4 rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-xs font-bold text-white flex items-center gap-2"
                  >
                    <RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />
                    <span>{t('field.set.checkUpdate')}</span>
                  </button>
                  <a
                    href="https://github.com/virahitvin8/seva-gis/releases/latest/download/seva-gis-latest.apk"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[48px] px-4 rounded-xl bg-[#2A2A2A] hover:bg-[#333] text-xs font-bold text-[#81C784] flex items-center gap-2"
                  >
                    <Download size={16} />
                    <span>{t('update.getApk')}</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="md:hidden shrink-0 bg-[#1E1E1E] border-t border-[#2E2E2E] px-2 py-1.5 flex items-center justify-around z-30"
          style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
          aria-label="Field studio bottom navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setActiveTab(item.id); setFocusProjection(false); }}
                className={`flex-1 min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1 transition ${
                  active ? 'text-[#81C784] bg-[#2E7D32]/20 font-bold' : 'text-[#C7D0C9]'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[11px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Floating Toast Alert (Signal / Waypoint / OTA) */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 right-4 left-4 sm:left-auto sm:max-w-sm z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-bold ${
            toastMsg.kind === 'warn'
              ? 'bg-[#2C1A0B] border-[#F57C00] text-[#FFB74D]'
              : 'bg-[#18291A] border-[#4CAF50] text-[#A5D6A7]'
          }`}
        >
          {toastMsg.kind === 'warn' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Waypoint Metadata Bottom Sheet Modal */}
      <WaypointMetadataSheet
        isOpen={sheetOpen}
        initialLat={activeLat}
        initialLon={activeLon}
        initialAltM={gpsFix?.altitudeM ?? null}
        defaultFarmName={farm.name}
        defaultCrop={farm.crop}
        editingWaypoint={editingWaypoint}
        onClose={() => {
          setSheetOpen(false);
          setEditingWaypoint(null);
        }}
        onSave={handleSaveWaypoint}
      />

      {/* Crowdsource Remote Field Scout Modal */}
      {showRemoteScout && (
        <RemoteFieldScoutModal
          isOpen={showRemoteScout}
          onClose={() => setShowRemoteScout(false)}
          plotName={farm.name}
          onBeaconReceived={handleScoutBeaconReceived}
        />
      )}
    </div>
  );
}
