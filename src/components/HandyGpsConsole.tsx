import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Compass, Navigation, Plus, Trash2, Copy, Check, Download, Upload,
  Sun, Moon, Volume2, VolumeX, Bell, Crosshair, Activity, ArrowUpRight,
  RotateCcw, Play, Pause, Target, Gauge, Eye, Radio
} from 'lucide-react';
import {
  DATUM_DEFINITIONS,
  type SupportedDatum,
  type FieldWaypoint,
  type TrackPoint,
  type GnssSample,
  computeOrthometricAltitudeM,
  estimateMagneticDeclinationDeg,
  computeRouteLegTelemetry,
  computeSolarLunarEphemeris,
  computeAveragedFix,
  computeTrackStats,
  projectWaypoint,
  geodesicDistanceM,
  bearingDeg,
  compassCardinal16,
  normalizeDeg,
  exportWaypointsAndTrackGpx,
  exportWaypointsAndTrackKml,
  exportWaypointsCsv,
  parseGpxOrKml,
  toMaidenhead,
} from '../lib/geodesyField';
import { formatAllCoordinateSystems } from '../lib/digipin';
import {
  playFieldTone,
  speakFieldGuidance,
  formatGuidanceDistance,
  formatSpeedUnit,
} from '../lib/fieldAudioSensors';

export type CoordinateSystem = 'digipin' | 'decimal' | 'ddm' | 'dms' | 'utm' | 'mgrs' | 'plusCode';
export type UnitSystem = 'metric' | 'imperial' | 'nautical';

export interface LiveGnssFix {
  lat: number;
  lon: number;
  accuracyM: number;
  altitudeM: number | null;
  speedMs: number | null;
  headingDeg: number | null;
  timestamp: number;
}

interface HandyGpsConsoleProps {
  centerCoord: [number, number]; // [lon, lat]
  gpsFix: LiveGnssFix | null;
  gpsError: string | null;
  compassHeadingDeg: number | null;
  compassSource: 'sensor' | 'gps' | 'none';
  pitchDeg: number | null;
  rollDeg: number | null;
  waypoints: FieldWaypoint[];
  onAddWaypoint: (wp: FieldWaypoint) => void;
  onUpdateWaypoints: (wps: FieldWaypoint[]) => void;
  onImportGpxKml: (wps: FieldWaypoint[], track: TrackPoint[]) => void;
  onJumpToCoord: (lon: number, lat: number) => void;
  trackPoints: TrackPoint[];
  isTracking: boolean;
  onToggleTracking: () => void;
  onResetTrack: () => void;
  selectedCoordSys: CoordinateSystem;
  onChangeCoordSys: (cs: CoordinateSystem) => void;
  unitSystem: UnitSystem;
  onChangeUnitSystem: (u: UnitSystem) => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  lang: 'en' | 'te' | 'hi';
}

type GpsSubTab = 'compass' | 'coords' | 'waypoints' | 'track' | 'status';

export default function HandyGpsConsole({
  centerCoord,
  gpsFix,
  gpsError,
  compassHeadingDeg,
  compassSource,
  pitchDeg,
  rollDeg,
  waypoints,
  onAddWaypoint,
  onUpdateWaypoints,
  onImportGpxKml,
  onJumpToCoord,
  trackPoints,
  isTracking,
  onToggleTracking,
  onResetTrack,
  selectedCoordSys,
  onChangeCoordSys,
  unitSystem,
  onChangeUnitSystem,
  isNightMode,
  onToggleNightMode,
  lang,
}: HandyGpsConsoleProps) {
  const [subTab, setSubTab] = useState<GpsSubTab>('compass');
  const [datum, setDatum] = useState<SupportedDatum>('WGS84');
  const [useTrueNorth, setUseTrueNorth] = useState<boolean>(true);
  const [manualDeclination, setManualDeclination] = useState<string>('');
  const [manualGeoidOffset, setManualGeoidOffset] = useState<string>('');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Goto & Route Navigation
  const [targetWpId, setTargetWpId] = useState<string>(() => waypoints[1]?.id || waypoints[0]?.id || '');
  const [reverseRoute, setReverseRoute] = useState<boolean>(false);
  const [autoNextWaypoint, setAutoNextWaypoint] = useState<boolean>(true);
  const [proximityRadiusM, setProximityRadiusM] = useState<number>(25);
  const [voiceGuidanceOn, setVoiceGuidanceOn] = useState<boolean>(false);
  const [audioAlertsOn, setAudioAlertsOn] = useState<boolean>(true);
  const [speedAlertKmh, setSpeedAlertKmh] = useState<number>(0); // 0 = off
  const lastVoiceTimeRef = useRef<number>(0);
  const lastProxAlarmWpRef = useRef<string | null>(null);

  // GPS Averaging state
  const [isAveraging, setIsAveraging] = useState<boolean>(false);
  const [avgSamples, setAvgSamples] = useState<GnssSample[]>([]);
  const [avgMaxAccFilter, setAvgMaxAccFilter] = useState<number>(15);

  // Waypoint projection & editing
  const [projName, setProjName] = useState<string>('Projected Corner');
  const [projBearing, setProjBearing] = useState<string>('45');
  const [projDistM, setProjDistM] = useState<string>('100');
  const [sortByDist, setSortByDist] = useState<boolean>(false);
  const [editingWpId, setEditingWpId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>('');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active observer position: real GNSS fix when available, otherwise map center reticle
  const activeLat = gpsFix ? gpsFix.lat : centerCoord[1];
  const activeLon = gpsFix ? gpsFix.lon : centerCoord[0];
  const activeSpeedMs = gpsFix?.speedMs ?? 0;
  const activeSpeedKmh = activeSpeedMs * 3.6;

  // Magnetic declination & compass azimuth
  const autoDeclination = useMemo(
    () => estimateMagneticDeclinationDeg(activeLat, activeLon),
    [activeLat, activeLon]
  );
  const activeDeclination =
    manualDeclination.trim() !== '' && Number.isFinite(Number(manualDeclination))
      ? Number(manualDeclination)
      : autoDeclination;

  const rawHeading = compassHeadingDeg ?? gpsFix?.headingDeg ?? 0;
  const displayAzimuth = normalizeDeg(useTrueNorth ? rawHeading : rawHeading - activeDeclination);

  // Geoid & MSL orthometric height
  const parsedManualOffset =
    manualGeoidOffset.trim() !== '' && Number.isFinite(Number(manualGeoidOffset))
      ? Number(manualGeoidOffset)
      : null;

  const orthoAlt = useMemo(() => {
    if (gpsFix?.altitudeM == null) return null;
    return computeOrthometricAltitudeM(gpsFix.altitudeM, activeLat, activeLon, parsedManualOffset);
  }, [gpsFix?.altitudeM, activeLat, activeLon, parsedManualOffset]);

  // All coordinate formats in active datum
  const allCoords = useMemo(
    () => formatAllCoordinateSystems(activeLat, activeLon, datum),
    [activeLat, activeLon, datum]
  );
  const maidenhead = useMemo(() => toMaidenhead(activeLat, activeLon), [activeLat, activeLon]);

  // Active Goto Target
  const orderedWaypoints = useMemo(() => {
    const list = reverseRoute ? [...waypoints].reverse() : [...waypoints];
    if (!sortByDist) return list;
    return list.sort(
      (a, b) =>
        geodesicDistanceM(activeLat, activeLon, a.lat, a.lon) -
        geodesicDistanceM(activeLat, activeLon, b.lat, b.lon)
    );
  }, [waypoints, reverseRoute, sortByDist, activeLat, activeLon]);

  const targetWp = useMemo(
    () => orderedWaypoints.find((w) => w.id === targetWpId) || orderedWaypoints[0] || null,
    [orderedWaypoints, targetWpId]
  );

  const legTelemetry = useMemo(() => {
    if (!targetWp) return null;
    const idx = orderedWaypoints.findIndex((w) => w.id === targetWp.id);
    const prevWp = idx > 0 ? orderedWaypoints[idx - 1] : undefined;
    return computeRouteLegTelemetry(
      activeLat,
      activeLon,
      activeSpeedMs,
      displayAzimuth,
      targetWp.lat,
      targetWp.lon,
      prevWp ? { lat: prevWp.lat, lon: prevWp.lon } : undefined
    );
  }, [targetWp, orderedWaypoints, activeLat, activeLon, activeSpeedMs, displayAzimuth]);

  // Proximity Alarm, Auto-Next Waypoint, Speed Alert, & Voice Guidance
  useEffect(() => {
    if (!gpsFix) return;

    if (speedAlertKmh > 0 && activeSpeedKmh > speedAlertKmh && audioAlertsOn) {
      playFieldTone('speed-alert');
    }

    if (targetWp && legTelemetry) {
      if (legTelemetry.distanceM <= proximityRadiusM) {
        if (lastProxAlarmWpRef.current !== targetWp.id) {
          lastProxAlarmWpRef.current = targetWp.id;
          if (audioAlertsOn) playFieldTone('proximity');
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([120, 60, 120]); } catch {}
          }
          if (voiceGuidanceOn) {
            speakFieldGuidance(`Arrived within ${proximityRadiusM} meters of ${targetWp.label}`, lang);
          }
          if (autoNextWaypoint && orderedWaypoints.length > 1) {
            const idx = orderedWaypoints.findIndex((w) => w.id === targetWp.id);
            if (idx >= 0 && idx + 1 < orderedWaypoints.length) {
              setTargetWpId(orderedWaypoints[idx + 1].id);
            }
          }
        }
      } else {
        if (lastProxAlarmWpRef.current === targetWp.id) {
          lastProxAlarmWpRef.current = null;
        }
        if (voiceGuidanceOn && Date.now() - lastVoiceTimeRef.current > 15000) {
          lastVoiceTimeRef.current = Date.now();
          const distStr = formatGuidanceDistance(legTelemetry.distanceM, unitSystem);
          speakFieldGuidance(
            `${distStr} ${legTelemetry.cardinal} to ${targetWp.label}`,
            lang
          );
        }
      }
    }
  }, [
    gpsFix,
    targetWp,
    legTelemetry,
    proximityRadiusM,
    audioAlertsOn,
    voiceGuidanceOn,
    autoNextWaypoint,
    orderedWaypoints,
    speedAlertKmh,
    activeSpeedKmh,
    unitSystem,
    lang,
  ]);

  // Collect GPS Averaging samples whenever a new fix arrives while averaging is active
  useEffect(() => {
    if (!isAveraging || !gpsFix) return;
    if (gpsFix.accuracyM > avgMaxAccFilter) return;
    setAvgSamples((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].timestamp === gpsFix.timestamp) {
        return prev;
      }
      return [
        ...prev,
        {
          lat: gpsFix.lat,
          lon: gpsFix.lon,
          altitudeM: gpsFix.altitudeM,
          accuracyM: gpsFix.accuracyM,
          timestamp: gpsFix.timestamp,
        },
      ];
    });
  }, [isAveraging, gpsFix, avgMaxAccFilter]);

  const averagedResult = useMemo(() => computeAveragedFix(avgSamples), [avgSamples]);
  const trackStats = useMemo(() => computeTrackStats(trackPoints), [trackPoints]);
  const astro = useMemo(() => computeSolarLunarEphemeris(activeLat, activeLon), [activeLat, activeLon]);

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedFormat(label);
    setTimeout(() => setCopiedFormat(null), 1800);
  };

  const handleSaveAveragedWaypoint = () => {
    if (!averagedResult) return;
    const wp: FieldWaypoint = {
      id: `avg-${Date.now()}`,
      label: `Averaged Point (${averagedResult.sampleCount} fixes)`,
      lat: averagedResult.lat,
      lon: averagedResult.lon,
      altM: averagedResult.altitudeM,
      type: 'averaged',
      createdAt: new Date().toISOString(),
      notes: `CEP95 ±${averagedResult.estimatedCep95M}m · Best fix ±${averagedResult.bestAccuracyM}m`,
    };
    onAddWaypoint(wp);
    if (audioAlertsOn) playFieldTone('pin-drop');
    setIsAveraging(false);
    setSubTab('waypoints');
  };

  const handleProjectWaypoint = (e: React.FormEvent) => {
    e.preventDefault();
    const brng = Number(projBearing);
    const dist = Number(projDistM);
    if (!Number.isFinite(brng) || !Number.isFinite(dist) || dist <= 0) return;
    const dest = projectWaypoint(activeLat, activeLon, brng, dist);
    const wp: FieldWaypoint = {
      id: `proj-${Date.now()}`,
      label: projName.trim() || `Projected ${brng}°/${dist}m`,
      lat: dest.lat,
      lon: dest.lon,
      altM: orthoAlt?.mslM ?? gpsFix?.altitudeM ?? null,
      type: 'projected',
      createdAt: new Date().toISOString(),
      notes: `Projected ${dist}m @ ${brng}° from ${activeLat.toFixed(5)}, ${activeLon.toFixed(5)}`,
    };
    onAddWaypoint(wp);
    setTargetWpId(wp.id);
    if (audioAlertsOn) playFieldTone('pin-drop');
  };

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseGpxOrKml(text);
      onImportGpxKml(parsed.waypoints, parsed.track);
      setImportNotice(`Imported ${parsed.waypoints.length} waypoints & ${parsed.track.length} track points`);
      setTimeout(() => setImportNotice(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className={`w-full h-full p-3 sm:p-4 overflow-y-auto space-y-4 max-w-5xl mx-auto ${isNightMode ? 'bg-[#120404] text-red-200' : ''}`}>
      {/* Header & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Compass size={18} className={isNightMode ? 'text-red-400' : 'text-cyan-400'} />
            <span>Handy GPS Tactical Field Console</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            {gpsFix
              ? `Live GNSS Fix ±${gpsFix.accuracyM.toFixed(1)}m · ${compassSource === 'sensor' ? 'Hardware Compass' : 'GPS Course'} · ${DATUM_DEFINITIONS[datum].label}`
              : gpsError
                ? `GNSS notice: ${gpsError} (using map center)`
                : 'Awaiting device GNSS fix — showing map reticle reference'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Unit Switcher */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            {(['metric', 'imperial', 'nautical'] as UnitSystem[]).map((u) => (
              <button
                key={u}
                onClick={() => onChangeUnitSystem(u)}
                className={`px-2 py-1 rounded uppercase font-bold cursor-pointer ${unitSystem === u ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
              >
                {u === 'metric' ? 'M/KM' : u === 'imperial' ? 'FT/MI' : 'NM/KT'}
              </button>
            ))}
          </div>

          {/* Night Red-Light Mode Toggle */}
          <button
            onClick={onToggleNightMode}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
              isNightMode
                ? 'bg-red-950 text-red-300 border-red-500/60'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-red-500/40'
            }`}
            title="Low-glare red-shifted night vision mode"
          >
            <Eye size={13} />
            <span>Night</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills (48dp touch ergonomics) */}
      <div className="grid grid-cols-5 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
        {(
          [
            ['compass', 'Compass & Goto'],
            ['coords', 'Coords & Avg'],
            ['waypoints', `Waypoints (${waypoints.length})`],
            ['track', 'Track & Elev'],
            ['status', 'GNSS & Sun'],
          ] as Array<[GpsSubTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`py-2 px-1.5 rounded-lg transition cursor-pointer min-h-[42px] truncate ${
              subTab === id
                ? isNightMode
                  ? 'bg-red-700 text-white'
                  : 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: COMPASS ROSE, BUBBLE CLINOMETER & GOTO NAVIGATION */}
      {subTab === 'compass' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compass Dial + Clinometer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center relative shadow-xl">
              <div className="flex items-center justify-between w-full mb-3 text-[11px] font-mono">
                <button
                  onClick={() => setUseTrueNorth(!useTrueNorth)}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 hover:border-amber-400 cursor-pointer"
                >
                  {useTrueNorth ? `True North (Decl ${activeDeclination >= 0 ? '+' : ''}${activeDeclination}°)` : 'Magnetic North'}
                </button>
                <span className="text-slate-400">
                  {compassSource === 'sensor' ? 'Mag Sensor' : gpsFix?.headingDeg != null ? 'GPS Heading' : 'Static'}
                </span>
              </div>

              <div className="relative w-56 h-56 rounded-full border-4 border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner">
                {/* Rotating Compass Card */}
                <div
                  className="absolute inset-2 rounded-full border border-dashed border-slate-700 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${-displayAzimuth}deg)` }}
                >
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 font-bold text-sm text-red-500">N</span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-300">E</span>
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-bold text-xs text-slate-300">S</span>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-300">W</span>
                </div>

                {/* Target Waypoint Bearing Needle */}
                {legTelemetry && (
                  <div
                    className="absolute w-1.5 h-24 bg-gradient-to-t from-transparent via-cyan-400 to-cyan-300 origin-bottom transition-transform duration-300 rounded-full"
                    style={{
                      transform: `rotate(${legTelemetry.bearingTrueDeg - displayAzimuth}deg)`,
                      bottom: '50%',
                    }}
                  />
                )}

                {/* Center Azimuth Hub */}
                <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-700 flex flex-col items-center justify-center font-mono z-10">
                  <span className="text-xl font-bold text-amber-400">{Math.round(displayAzimuth)}°</span>
                  <span className="text-[11px] font-bold text-emerald-400">{compassCardinal16(displayAzimuth)}</span>
                  <span className="text-[9px] text-slate-500 uppercase">Azimuth</span>
                </div>
              </div>

              {/* Bubble Level / Clinometer Bar */}
              <div className="w-full mt-4 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span>Clinometer / Level</span>
                  <span>
                    Pitch: {pitchDeg != null ? `${pitchDeg.toFixed(1)}°` : 'n/a'} · Roll: {rollDeg != null ? `${rollDeg.toFixed(1)}°` : 'n/a'}
                  </span>
                </div>
                <div className="relative h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-600 -translate-x-1/2" />
                  <div
                    className="absolute top-0.5 w-4 h-2 rounded-full bg-emerald-400 transition-all duration-150"
                    style={{
                      left: `calc(50% + ${Math.max(-42, Math.min(42, (rollDeg ?? 0) * 1.2))}%)`,
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Goto Target & Route Guidance Telemetry */}
            <div className="space-y-3 font-mono">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                    <Target size={14} /> Active Goto Target
                  </span>
                  <select
                    value={targetWp?.id || ''}
                    onChange={(e) => setTargetWpId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[180px]"
                  >
                    {orderedWaypoints.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                {targetWp && legTelemetry ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">DISTANCE TO TARGET</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {formatGuidanceDistance(legTelemetry.distanceM, unitSystem)}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">TARGET BEARING</div>
                      <div className="text-base font-bold text-cyan-400 mt-0.5">
                        {Math.round(legTelemetry.bearingTrueDeg)}° {legTelemetry.cardinal}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">CROSS-TRACK (XTE)</div>
                      <div className="text-sm font-bold text-amber-300 mt-0.5">
                        {Math.abs(legTelemetry.xteM).toFixed(1)}m {legTelemetry.xteM >= 0 ? 'Right' : 'Left'}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">VMG / ETA</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        {formatSpeedUnit(legTelemetry.vmgMs * 3.6, unitSystem)} · {legTelemetry.etaSeconds != null ? formatDuration(legTelemetry.etaSeconds) : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Add or select a waypoint to start bearing guidance.</p>
                )}

                {/* Guidance Controls: Proximity, Voice, Tone, Auto-Next, Reverse */}
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>Proximity Alert:</span>
                      <select
                        value={proximityRadiusM}
                        onChange={(e) => setProximityRadiusM(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white"
                      >
                        {[10, 25, 50, 100, 250].map((r) => (
                          <option key={r} value={r}>{r}m</option>
                        ))}
                      </select>
                    </label>

                    <button
                      onClick={() => setVoiceGuidanceOn(!voiceGuidanceOn)}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer ${
                        voiceGuidanceOn
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {voiceGuidanceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                      <span>Voice Guide</span>
                    </button>

                    <button
                      onClick={() => {
                        const next = !audioAlertsOn;
                        setAudioAlertsOn(next);
                        if (next) playFieldTone('fix-acquired');
                      }}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer ${
                        audioAlertsOn
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      <Bell size={13} />
                      <span>Tones</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setAutoNextWaypoint(!autoNextWaypoint)}
                      className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                        autoNextWaypoint
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Auto-Next WP: {autoNextWaypoint ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => setReverseRoute(!reverseRoute)}
                      className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                        reverseRoute
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Route: {reverseRoute ? 'Reverse' : 'Forward'}
                    </button>
                    {targetWp && legTelemetry && (
                      <button
                        onClick={() =>
                          speakFieldGuidance(
                            `${formatGuidanceDistance(legTelemetry.distanceM, unitSystem)} ${legTelemetry.cardinal} to ${targetWp.label}`,
                            lang
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer"
                      >
                        Speak Now
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Speed & MSL Quick Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Current Speed</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    {gpsFix ? formatSpeedUnit(activeSpeedKmh, unitSystem) : 'Awaiting GPS'}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">MSL Altitude (EGM)</div>
                  <div className="text-base font-bold text-cyan-300 mt-1">
                    {orthoAlt ? `${orthoAlt.mslM}m MSL` : 'Awaiting GPS Alt'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ALL COORDINATE FORMATS, DATUMS, GEOID MSL & GPS AVERAGING */}
      {subTab === 'coords' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">All Coordinate Formats & Datum Converter</h3>
                <p className="text-[11px] text-slate-400">
                  Switch datum ({DATUM_DEFINITIONS[datum].ellipsoid}) and tap any row to copy.
                </p>
              </div>
              <select
                value={datum}
                onChange={(e) => setDatum(e.target.value as SupportedDatum)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300"
              >
                {Object.values(DATUM_DEFINITIONS).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
              {[
                ['digipin', 'India Post DIGIPIN (4m×4m)', allCoords.digipin],
                ['decimal', `Decimal Degrees (${datum})`, allCoords.decimal],
                ['ddm', `Degrees Decimal Min (${datum})`, allCoords.ddm],
                ['dms', `Deg Min Sec (${datum})`, allCoords.dms],
                ['utm', `UTM Transverse Mercator`, allCoords.utm],
                ['mgrs', `MGRS Military Grid`, allCoords.mgrs],
                ['plusCode', 'Open Location (Plus Code)', allCoords.plusCode],
                ['maidenhead', 'Maidenhead Grid Locator', maidenhead],
              ].map(([key, label, value]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (['digipin', 'decimal', 'ddm', 'dms', 'utm', 'mgrs', 'plusCode'].includes(key)) {
                      onChangeCoordSys(key as CoordinateSystem);
                    }
                    handleCopy(key, value);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                    selectedCoordSys === key
                      ? 'bg-emerald-950/40 border-emerald-500/60'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 uppercase">{label}</div>
                    <div className="text-white font-bold truncate mt-0.5">{value}</div>
                  </div>
                  <span className="text-slate-400 shrink-0">
                    {copiedFormat === key ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Geoid MSL & Magnetic Declination Calibration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold uppercase text-cyan-400">EGM Geoid Altitude Correction</h4>
              <p className="text-[11px] text-slate-400 font-sans">
                Raw GNSS altitude uses the WGS84 ellipsoid. MSL orthometric height subtracts local geoid separation (N).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">WGS84 Ellipsoid</div>
                  <div className="text-white font-bold">{gpsFix?.altitudeM != null ? `${gpsFix.altitudeM.toFixed(1)} m` : '—'}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Orthometric MSL</div>
                  <div className="text-cyan-300 font-bold">{orthoAlt ? `${orthoAlt.mslM} m` : '—'}</div>
                </div>
              </div>
              <label className="block text-[11px] text-slate-400">
                Manual Altitude Offset (m, blank = EGM model):
                <input
                  type="number"
                  step="0.1"
                  value={manualGeoidOffset}
                  onChange={(e) => setManualGeoidOffset(e.target.value)}
                  placeholder="Auto EGM"
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </label>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold uppercase text-amber-400">GPS Coordinate Averaging (Sub-Meter)</h4>
              <p className="text-[11px] text-slate-400 font-sans">
                Records live GNSS samples passing accuracy filter to compute an inverse-variance weighted centroid.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (!isAveraging) setAvgSamples([]);
                    setIsAveraging(!isAveraging);
                  }}
                  className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${
                    isAveraging
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {isAveraging ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isAveraging ? 'Stop Averaging' : 'Start Averaging'}</span>
                </button>

                <label className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Max ±m:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={avgMaxAccFilter}
                    onChange={(e) => setAvgMaxAccFilter(Math.max(1, Number(e.target.value) || 15))}
                    className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white"
                  />
                </label>

                {averagedResult && (
                  <button
                    onClick={handleSaveAveragedWaypoint}
                    className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                  >
                    Save Waypoint
                  </button>
                )}
              </div>

              {averagedResult ? (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/30 text-[11px] space-y-1">
                  <div className="text-emerald-400 font-bold">
                    {averagedResult.sampleCount} samples · CEP95 ±{averagedResult.estimatedCep95M}m (Best ±{averagedResult.bestAccuracyM}m)
                  </div>
                  <div className="text-white">
                    {averagedResult.lat.toFixed(7)}°, {averagedResult.lon.toFixed(7)}°
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  {isAveraging
                    ? 'Waiting for live GNSS fixes matching accuracy filter...'
                    : 'Tap Start Averaging outdoors to lock a precision corner centroid.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: WAYPOINTS, PROJECTION & GPX/KML/CSV EXPORT-IMPORT */}
      {subTab === 'waypoints' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                Field Waypoints & Route Sequence
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setSortByDist(!sortByDist)}
                  className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                    sortByDist ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-950 text-slate-300 border-slate-700'
                  }`}
                >
                  Sort by Distance
                </button>
                <button
                  onClick={() => {
                    const wp: FieldWaypoint = {
                      id: `wp-${Date.now()}`,
                      label: `Field Pin #${waypoints.length + 1}`,
                      lat: activeLat,
                      lon: activeLon,
                      altM: orthoAlt?.mslM ?? gpsFix?.altitudeM ?? null,
                      type: gpsFix ? 'gnss' : 'reticle',
                      createdAt: new Date().toISOString(),
                    };
                    onAddWaypoint(wp);
                    if (audioAlertsOn) playFieldTone('pin-drop');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Mark Current
                </button>
              </div>
            </div>

            {/* Export / Import Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800 text-[11px]">
              <button
                onClick={() =>
                  handleDownloadFile(
                    exportWaypointsAndTrackGpx('SEVA_GIS_Field', waypoints, trackPoints),
                    `sevagis-field-${Date.now()}.gpx`,
                    'application/gpx+xml'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Download size={12} /> Export GPX
              </button>
              <button
                onClick={() =>
                  handleDownloadFile(
                    exportWaypointsAndTrackKml('SEVA_GIS_Field', waypoints, trackPoints),
                    `sevagis-field-${Date.now()}.kml`,
                    'application/vnd.google-earth.kml+xml'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Download size={12} /> Export KML
              </button>
              <button
                onClick={() =>
                  handleDownloadFile(
                    exportWaypointsCsv(waypoints),
                    `sevagis-waypoints-${Date.now()}.csv`,
                    'text/csv'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Download size={12} /> Export CSV
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Upload size={12} /> Import GPX/KML
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,.kml,.xml"
                className="hidden"
                onChange={handleFileImport}
              />
              {importNotice && <span className="text-emerald-400 font-semibold">{importNotice}</span>}
            </div>

            {/* Waypoints List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {orderedWaypoints.map((wp, idx) => {
                const distM = geodesicDistanceM(activeLat, activeLon, wp.lat, wp.lon);
                const brng = bearingDeg(activeLat, activeLon, wp.lat, wp.lon);
                return (
                  <div
                    key={wp.id}
                    className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-mono ${
                      targetWp?.id === wp.id
                        ? 'bg-cyan-950/30 border-cyan-500/50'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        {editingWpId === wp.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              className="bg-slate-900 border border-emerald-500 rounded px-2 py-0.5 text-white text-xs"
                            />
                            <button
                              onClick={() => {
                                onUpdateWaypoints(
                                  waypoints.map((item) =>
                                    item.id === wp.id ? { ...item, label: editingLabel.trim() || item.label } : item
                                  )
                                );
                                setEditingWpId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-600 text-white"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-white font-semibold truncate cursor-pointer hover:text-emerald-300"
                            onClick={() => {
                              setEditingWpId(wp.id);
                              setEditingLabel(wp.label);
                            }}
                            title="Tap to rename waypoint"
                          >
                            {wp.label}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          {wp.lat.toFixed(5)}°, {wp.lon.toFixed(5)}° · {formatGuidanceDistance(distM, unitSystem)} @ {Math.round(brng)}° {compassCardinal16(brng)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setTargetWpId(wp.id);
                          setSubTab('compass');
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 cursor-pointer"
                      >
                        Goto
                      </button>
                      <button
                        onClick={() => onJumpToCoord(wp.lon, wp.lat)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Center map reticle on waypoint"
                      >
                        <Crosshair size={12} />
                      </button>
                      <button
                        onClick={() => onUpdateWaypoints(waypoints.filter((item) => item.id !== wp.id))}
                        className="p-1 rounded bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 cursor-pointer"
                        aria-label="Delete waypoint"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Waypoint Tool */}
          <form onSubmit={handleProjectWaypoint} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase text-amber-400">Project New Waypoint by Bearing & Distance</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
              <input
                type="text"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                placeholder="Waypoint name"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
              />
              <input
                type="number"
                step="0.1"
                value={projBearing}
                onChange={(e) => setProjBearing(e.target.value)}
                placeholder="Bearing (0-360°)"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
              />
              <input
                type="number"
                step="1"
                value={projDistM}
                onChange={(e) => setProjDistM(e.target.value)}
                placeholder="Distance (m)"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
              >
                + Project & Goto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 4: TRACKLOG ODOMETER, SPEED ALERT & ELEVATION PROFILE */}
      {subTab === 'track' && (
        <div className="space-y-4 font-mono">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white font-sans">Tracklog Odometer & Elevation Profile</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Records real GPS breadcrumb points with distance, climb/descent, and speed statistics.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleTracking}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    isTracking ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {isTracking ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isTracking ? 'Pause Tracklog' : 'Record Tracklog'}</span>
                </button>
                <button
                  onClick={onResetTrack}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">ODOMETER</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {formatGuidanceDistance(trackStats.distanceM, unitSystem)}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">TIMER</div>
                <div className="text-base font-bold text-white mt-0.5">{formatDuration(trackStats.elapsedSeconds)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">AVG / MAX SPEED</div>
                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                  {formatSpeedUnit(trackStats.avgSpeedKmh, unitSystem)} / {formatSpeedUnit(trackStats.maxSpeedKmh, unitSystem)}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">ASCENT / DESCENT</div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  +{trackStats.ascentM}m / -{trackStats.descentM}m
                </div>
              </div>
            </div>

            {/* Audible Speed Alert Threshold */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
              <label className="flex items-center gap-2 text-slate-300">
                <Gauge size={14} className="text-amber-400" />
                <span>Audible Speed Alert (km/h, 0 = off):</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={speedAlertKmh}
                  onChange={(e) => setSpeedAlertKmh(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                />
              </label>
              <span className="text-[11px] text-slate-400">{trackStats.pointCount} track points logged</span>
            </div>

            {/* SVG Elevation Profile Chart */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                <span>Elevation Profile</span>
                <span>
                  {trackStats.minAltM != null && trackStats.maxAltM != null
                    ? `Min ${trackStats.minAltM}m · Max ${trackStats.maxAltM}m`
                    : 'Record track points with GPS altitude to render profile'}
                </span>
              </div>
              {trackStats.profile.length >= 2 ? (
                <svg viewBox="0 0 400 100" className="w-full h-24 overflow-visible">
                  {(() => {
                    const prof = trackStats.profile;
                    const maxD = Math.max(1, prof[prof.length - 1].distM);
                    const minA = trackStats.minAltM ?? 0;
                    const spanA = Math.max(2, (trackStats.maxAltM ?? 10) - minA);
                    const pts = prof
                      .map((p) => {
                        const x = (p.distM / maxD) * 400;
                        const y = 92 - ((p.altM - minA) / spanA) * 82;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ');
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={pts}
                        />
                        <polygon
                          fill="rgba(16, 185, 129, 0.16)"
                          points={`0,95 ${pts} 400,95`}
                        />
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="h-16 flex items-center justify-center text-[11px] text-slate-500">
                  No elevation track profile yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: GNSS STATUS & SOLAR/LUNAR EPHEMERIS */}
      {subTab === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <Radio size={14} /> Live GNSS Receiver Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Fix State</span>
                <span className={gpsFix ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {gpsFix ? '3D GNSS Active' : gpsError ? 'Unavailable' : 'Acquiring...'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Horizontal Accuracy</span>
                <span className="text-white font-bold">{gpsFix ? `±${gpsFix.accuracyM.toFixed(1)} m` : '—'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Magnetic Declination</span>
                <span className="text-amber-300 font-bold">{activeDeclination >= 0 ? `+${activeDeclination}° E` : `${activeDeclination}° W`}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">EGM Geoid Undulation (N)</span>
                <span className="text-cyan-300 font-bold">{orthoAlt ? `${orthoAlt.geoidSeparationM} m` : '—'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Last GNSS Timestamp</span>
                <span className="text-slate-300">
                  {gpsFix ? new Date(gpsFix.timestamp).toISOString().slice(11, 19) + ' UTC' : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5">
              <Sun size={14} /> Field Sun & Moon Ephemeris
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Sunrise / Sunset</span>
                <span className="text-amber-300 font-bold">
                  {astro.sunriseUtc ?? 'Polar'} · {astro.sunsetUtc ?? 'Polar'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Last Light (Civil Dusk)</span>
                <span className="text-white font-bold">{astro.civilDuskUtc ?? '—'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Daylight Duration</span>
                <span className="text-emerald-400 font-bold">
                  {astro.dayLengthMin != null ? `${Math.floor(astro.dayLengthMin / 60)}h ${astro.dayLengthMin % 60}m` : '—'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Time Until Sunset</span>
                <span className="text-cyan-300 font-bold">
                  {astro.minutesUntilSunset != null
                    ? astro.minutesUntilSunset > 0
                      ? `${Math.floor(astro.minutesUntilSunset / 60)}h ${astro.minutesUntilSunset % 60}m`
                      : 'After sunset'
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Moon size={12} /> Lunar Phase
                </span>
                <span className="text-slate-200 font-bold">
                  {astro.moonPhaseName} ({astro.moonIlluminationPct}% · Day {astro.moonAgeDays})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

