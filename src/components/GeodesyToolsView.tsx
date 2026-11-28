import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight, Layers, Target, Play, Square, Navigation, Download, ShieldCheck
} from 'lucide-react';
import {
  DATUM_DEFINITIONS,
  type SupportedDatum,
  type AveragedFixResult,
  type FieldWaypoint,
  CoordinateAverager,
  transformWgs84ToDatum,
  toUtm,
  toMgrs,
  toDdm,
  toOpenLocationCode,
  toMaidenhead,
  computeOrthometricAltitudeM,
  computeIgrfField,
  projectWaypoint,
  exportWaypointsAndTrackGpx,
  type TrackPoint,
} from '../lib/geodesyField';
import { encodeDigipin } from '../lib/digipin';
import { useI18n } from '../lib/i18n';
import type { LiveGnssFix } from './HandyGpsConsole';

interface GeodesyToolsViewProps {
  lat: number;
  lon: number;
  gpsFix: LiveGnssFix | null;
  farmName: string;
  closedRing: [number, number][];
  waypoints: FieldWaypoint[];
  trackPoints: TrackPoint[];
  useOrthometricMsl: boolean;
  onToggleOrthometric: () => void;
  onAddWaypoint: (wp: FieldWaypoint) => void;
  initialFocusProjection?: boolean;
}

const SPECTRAL_INDICES = [
  { id: 'NDVI', desc: 'Plant Vigour (B8 - B4)/(B8 + B4)' },
  { id: 'NDMI', desc: 'Canopy Water (B8 - B11)/(B8 + B11)' },
  { id: 'NDRE', desc: 'Nitrogen Red-Edge (B8 - B5)/(B8 + B5)' },
  { id: 'SAVI', desc: 'Soil-Adjusted Vegetation' },
  { id: 'EVI', desc: 'Enhanced Canopy Index' },
  { id: 'MSI', desc: 'Moisture Stress (B11/B8)' },
  { id: 'NDWI', desc: 'Surface Water (B3 - B8)/(B3 + B8)' },
  { id: 'GLO-30', desc: 'Copernicus 30m DEM & Horn Slope' },
];

export default function GeodesyToolsView({
  lat,
  lon,
  gpsFix,
  farmName,
  closedRing,
  waypoints,
  trackPoints,
  useOrthometricMsl,
  onToggleOrthometric,
  onAddWaypoint,
  initialFocusProjection = false,
}: GeodesyToolsViewProps) {
  const { t } = useI18n();
  const [selectedDatum, setSelectedDatum] = useState<SupportedDatum>('INDIAN75');
  const [projDistM, setProjDistM] = useState('100');
  const [projBearingDeg, setProjBearingDeg] = useState('45');
  const [projectedPt, setProjectedPt] = useState<{ lat: number; lon: number } | null>(null);

  const averagerRef = useRef<CoordinateAverager>(new CoordinateAverager(120));
  const [isAveraging, setIsAveraging] = useState(false);
  const [avgResult, setAvgResult] = useState<AveragedFixResult | null>(null);
  const projRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialFocusProjection && projRef.current) {
      projRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialFocusProjection]);

  useEffect(() => {
    if (!isAveraging || !gpsFix) return;
    const res = averagerRef.current.addSample({
      lat: gpsFix.lat,
      lon: gpsFix.lon,
      altitudeM: gpsFix.altitudeM,
      accuracyM: gpsFix.accuracyM,
      timestamp: gpsFix.timestamp,
    });
    setAvgResult(res);
  }, [isAveraging, gpsFix]);

  const rawEllipM = gpsFix?.altitudeM ?? 500;
  const ortho = useMemo(() => computeOrthometricAltitudeM(rawEllipM, lat, lon), [rawEllipM, lat, lon]);
  const igrf = useMemo(() => computeIgrfField(lat, lon, rawEllipM / 1000), [lat, lon, rawEllipM]);
  const datumOut = useMemo(
    () => transformWgs84ToDatum(lat, lon, rawEllipM, selectedDatum),
    [lat, lon, rawEllipM, selectedDatum]
  );

  const utmOut = useMemo(() => toUtm(datumOut.lat, datumOut.lon), [datumOut]);
  const mgrsOut = useMemo(() => toMgrs(lat, lon, 5), [lat, lon]);
  const digipinOut = useMemo(() => encodeDigipin(lat, lon), [lat, lon]);
  const plusOut = useMemo(() => toOpenLocationCode(lat, lon), [lat, lon]);
  const maidenOut = useMemo(() => toMaidenhead(lat, lon), [lat, lon]);

  const handleToggleAveraging = () => {
    if (isAveraging) {
      setIsAveraging(false);
      if (avgResult) {
        onAddWaypoint({
          id: `wp-avg-${Date.now()}`,
          label: `Averaged (±${avgResult.estimatedCep95M}m)`,
          lat: avgResult.lat,
          lon: avgResult.lon,
          altM: avgResult.altitudeM,
          type: 'survey',
          farmId: farmName,
          notes: `CEP95 ${avgResult.estimatedCep95M}m across ${avgResult.sampleCount} GNSS samples`,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      averagerRef.current.reset();
      setAvgResult(null);
      setIsAveraging(true);
    }
  };

  const handleProject = () => {
    const d = Number.parseFloat(projDistM);
    const b = Number.parseFloat(projBearingDeg);
    if (!Number.isFinite(d) || !Number.isFinite(b)) return;
    setProjectedPt(projectWaypoint(lat, lon, b, d));
  };

  const handleExportQgisGeoJson = () => {
    const fc = {
      type: 'FeatureCollection',
      name: `${farmName}_SEVA_GIS`,
      features: [
        ...(closedRing.length >= 4
          ? [{
              type: 'Feature',
              properties: { name: farmName, source: 'SEVA.GIS' },
              geometry: { type: 'Polygon', coordinates: [closedRing] },
            }]
          : []),
        ...waypoints.map((w) => ({
          type: 'Feature',
          properties: { label: w.label, type: w.type, farmId: w.farmId, crop: w.crop, soilType: w.soilType },
          geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
        })),
      ],
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${farmName.replace(/\W+/g, '_')}_QGIS.geojson`;
    a.click();
  };

  const handleExportQgisGpx = () => {
    const xml = exportWaypointsAndTrackGpx(farmName, waypoints, trackPoints);
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${farmName.replace(/\W+/g, '_')}_QGIS.gpx`;
    a.click();
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <img src="/images/field-kit/32x32-icon-earth.png" alt="Geodesy" className="w-6 h-6 object-contain" />
          <span>{t('field.tools.title')}</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2E7D32]/20 border border-[#2E7D32]/50 text-[11px] font-semibold text-[#A5D6A7]">
          <ShieldCheck size={12} />
          <span>{t('field.badge.localOnly')}</span>
        </span>
      </div>

      <div className="relative h-14 rounded-xl overflow-hidden border border-[#2F2F2F] bg-[#121212]">
        <img
          src="/images/field-kit/BMNG_world.topo.bathy.200405.3.2048x1024.jpg"
          alt="NASA Blue Marble WGS84 Datum Reference"
          className="w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/90 via-transparent to-[#121212]/90 px-4 flex items-center justify-between text-xs font-mono">
          <span className="text-[#81C784] font-bold">WGS84 · IGRF-2025 · EGM2008</span>
          <img src="/images/field-kit/usda_logo-32x32.png" alt="USDA Datum Ref" className="w-6 h-6 object-contain" />
        </div>
      </div>

      {/* Side-by-Side Geodesy Transformation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Source Card */}
        <div className="bg-[#1E1E1E] border border-[#2F2F2F] rounded-2xl p-4 space-y-2.5">
          <div className="text-xs font-bold text-[#81C784] uppercase tracking-wider">
            {t('field.tools.sourceCoord')}
          </div>
          <div className="font-mono text-lg font-bold text-white tabular-nums">
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </div>
          <div className="text-xs font-mono text-[#C7D0C9] space-y-1 tabular-nums">
            <div>DDM: {toDdm(lat, true)} · {toDdm(lon, false)}</div>
            <div>DIGIPIN: <strong className="text-white">{digipinOut}</strong> · Plus: {plusOut}</div>
            <div>MGRS: {mgrsOut} · Grid: {maidenOut}</div>
          </div>
        </div>

        {/* Transformed Output Card */}
        <div className="bg-[#1E1E1E] border border-[#2E7D32]/50 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#FFB74D] uppercase tracking-wider">
              {t('field.tools.convertedOut')}
            </span>
            <select
              value={selectedDatum}
              onChange={(e) => setSelectedDatum(e.target.value as SupportedDatum)}
              aria-label={t('field.tools.datumLabel')}
              className="min-h-[40px] rounded-lg bg-[#121212] border border-[#383838] px-2.5 text-xs font-semibold text-white"
            >
              {Object.values(DATUM_DEFINITIONS).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.ellipsoid})
                </option>
              ))}
            </select>
          </div>
          <div className="font-mono text-lg font-bold text-[#81C784] tabular-nums">
            {utmOut.formatted}
          </div>
          <div className="text-xs font-mono text-[#C7D0C9] space-y-1 tabular-nums">
            <div>EPSG:{utmOut.epsg} · {DATUM_DEFINITIONS[selectedDatum].ellipsoid}</div>
            <div>{selectedDatum}: {datumOut.lat.toFixed(6)}, {datumOut.lon.toFixed(6)}</div>
            <div>UTM Zone {utmOut.zoneNumber}{utmOut.hemisphere} ({utmOut.bandLetter})</div>
          </div>
        </div>
      </div>

      {/* Geoid Height Toggle & IGRF-2025 Magnetic Card */}
      <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">{t('field.tools.geoidToggle')}</div>
            <div className="text-xs text-[#A3B1A6] font-mono tabular-nums mt-0.5">
              {t('field.tools.geoidSep')}: {ortho.geoidSeparationM} m · H = h − N
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleOrthometric}
            role="switch"
            aria-checked={useOrthometricMsl}
            className={`min-h-[48px] px-4 rounded-xl border text-xs font-bold transition ${
              useOrthometricMsl
                ? 'bg-[#2E7D32] border-[#4CAF50] text-white'
                : 'bg-[#121212] border-[#F57C00]/60 text-[#FFB74D]'
            }`}
          >
            {useOrthometricMsl ? t('field.tools.orthometric') : t('field.tools.ellipsoid')}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#2C2C2C] font-mono text-xs tabular-nums">
          <div className="bg-[#121212] p-2.5 rounded-xl">
            <div className="text-[#A3B1A6] text-[10px]">EGM2008 MSL</div>
            <div className="text-sm font-bold text-[#81C784]">{ortho.mslM} m</div>
          </div>
          <div className="bg-[#121212] p-2.5 rounded-xl">
            <div className="text-[#A3B1A6] text-[10px]">Ellipsoid (h)</div>
            <div className="text-sm font-bold text-white">{rawEllipM.toFixed(1)} m</div>
          </div>
          <div className="bg-[#121212] p-2.5 rounded-xl">
            <div className="text-[#A3B1A6] text-[10px]">{igrf.modelName} Declination</div>
            <div className="text-sm font-bold text-[#FFB74D]">
              {igrf.declinationDeg >= 0 ? `+${igrf.declinationDeg}° E` : `${igrf.declinationDeg}° W`}
            </div>
          </div>
          <div className="bg-[#121212] p-2.5 rounded-xl">
            <div className="text-[#A3B1A6] text-[10px]">Total Field F</div>
            <div className="text-sm font-bold text-white">{igrf.totalIntensityNt.toLocaleString()} nT</div>
          </div>
        </div>
      </div>

      {/* Precision GPS Averaging & Waypoint Projection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Target size={18} className="text-[#81C784]" />
              <span>{t('field.tools.averaging')}</span>
            </div>
            <button
              type="button"
              onClick={handleToggleAveraging}
              className={`min-h-[48px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                isAveraging ? 'bg-[#F57C00] text-[#121212]' : 'bg-[#2E7D32] text-white'
              }`}
            >
              {isAveraging ? <Square size={14} /> : <Play size={14} />}
              <span>{isAveraging ? t('field.tools.stopAvg') : t('field.tools.startAvg')}</span>
            </button>
          </div>
          {avgResult ? (
            <div className="bg-[#121212] rounded-xl p-3 font-mono text-xs space-y-1 tabular-nums text-[#E5E7EB]">
              <div>Mean: {avgResult.lat.toFixed(6)}, {avgResult.lon.toFixed(6)}</div>
              <div>Samples: {avgResult.sampleCount} · Best: ±{avgResult.bestAccuracyM}m · CEP95: ±{avgResult.estimatedCep95M}m</div>
            </div>
          ) : (
            <p className="text-xs text-[#A3B1A6]">
              {gpsFix ? `Current accuracy: ±${gpsFix.accuracyM.toFixed(1)}m. Tap Start to converge.` : t('field.dash.waitingGps')}
            </p>
          )}
        </div>

        <div ref={projRef} className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Navigation size={18} className="text-[#FFB74D]" />
            <span>{t('field.tools.projectTitle')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={projDistM}
              onChange={(e) => setProjDistM(e.target.value)}
              placeholder="Dist (m)"
              aria-label="Distance in meters"
              className="min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3 text-sm font-mono text-white"
            />
            <input
              type="number"
              value={projBearingDeg}
              onChange={(e) => setProjBearingDeg(e.target.value)}
              placeholder="Bearing °"
              aria-label="Bearing degrees"
              className="min-h-[48px] rounded-xl bg-[#121212] border border-[#343434] px-3 text-sm font-mono text-white"
            />
            <button
              type="button"
              onClick={handleProject}
              className="min-h-[48px] rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-xs font-bold text-white px-2"
            >
              {t('field.tools.projectBtn')}
            </button>
          </div>
          {projectedPt && (
            <div className="bg-[#121212] rounded-xl p-3 flex items-center justify-between gap-2 font-mono text-xs text-[#81C784] tabular-nums">
              <span>{projectedPt.lat.toFixed(6)}, {projectedPt.lon.toFixed(6)}</span>
              <button
                type="button"
                onClick={() =>
                  onAddWaypoint({
                    id: `wp-proj-${Date.now()}`,
                    label: `Projected ${projDistM}m @ ${projBearingDeg}°`,
                    lat: projectedPt.lat,
                    lon: projectedPt.lon,
                    altM: null,
                    type: 'survey',
                    farmId: farmName,
                    createdAt: new Date().toISOString(),
                  })
                }
                className="min-h-[36px] px-2.5 rounded-lg bg-[#2E7D32] text-white font-sans font-bold"
              >
                + Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spectral Layer Reference & Real QGIS GeoJSON/GPX/Plugin Bridge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-2.5">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={18} className="text-[#81C784]" />
            <span>{t('field.tools.spectralTitle')}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SPECTRAL_INDICES.map((ix) => (
              <div key={ix.id} className="bg-[#121212] border border-[#2B2B2B] rounded-lg px-2.5 py-2">
                <div className="text-xs font-bold text-[#81C784] font-mono">{ix.id}</div>
                <div className="text-[10px] text-[#C7D0C9] truncate">{ix.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-4 space-y-3">
          <div className="text-sm font-bold text-white">{t('field.tools.qgisTitle')}</div>
          <p className="text-xs text-[#A3B1A6]">
            Export authentic GeoJSON &amp; GPX field boundaries directly for QGIS Desktop or install the GPL PyQGIS plugin.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportQgisGeoJson}
              className="min-h-[48px] px-4 rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Download size={15} />
              <span>GeoJSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportQgisGpx}
              className="min-h-[48px] px-4 rounded-xl bg-[#2A2A2A] hover:bg-[#333] text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Download size={15} />
              <span>GPX 1.1</span>
            </button>
            <a
              href="/plugins/seva_gee_flow_qgis.zip"
              download
              className="min-h-[48px] px-4 rounded-xl bg-[#121212] border border-[#383838] text-xs font-bold text-[#81C784] flex items-center gap-1.5"
            >
              <Download size={15} />
              <span>PyQGIS Plugin (.zip)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

