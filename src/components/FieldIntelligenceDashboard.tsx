/**
 * Agronomy & Spectral Agent + Mineral Mapping Agent + Hydrology & Terrain Agent + Weather Agent
 * Field Intelligence Dashboard providing:
 *  1. Interactive Crop Health Over Time Chart with exact hover date (YYYY-MM-DD) & calibrated values
 *  2. Surface Mineral Indication cards (5 SWIR/VNIR ratios, % cover, justification, strictly labeled "Indicated")
 *  3. Clickable SWAT / FQFA Hydrological Sensitivity Ranking with full What / Where / Why explanations
 *  4. Default-collapsed (<details>) farm parameter legends
 *  5. Resilient Weather & Soil Thermal Profile with NASA POWER automatic failover (zero 503s)
 */

import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Droplets,
  Gem,
  CloudRain,
  Sun,
  Thermometer,
  Wind,
  Layers,
  ChevronDown,
  Info,
  Calendar,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  AOIFeature,
  MineralIndicationResult,
  SpectralIndexResult,
  SupportedLanguage,
  SwatParameterRank,
  TimeSeriesPoint,
  WeatherTelemetry,
} from '../types/seva';
import {
  computeAllSpectralInsights,
  computeCropHealthTimeSeries,
  computeMineralIndications,
  computeSwatSensitivityRanking,
} from '../services/geeSpectralEngine';
import { fetchResilientWeather } from '../services/weatherService';
import { TRANSLATIONS, translateReportDynamicText } from '../i18n/translations';

interface FieldIntelligenceDashboardProps {
  aoi: AOIFeature;
  language: SupportedLanguage;
  onSelectIndexForMap?: (indexCode: string) => void;
}

export const FieldIntelligenceDashboard: React.FC<FieldIntelligenceDashboardProps> = ({
  aoi,
  language,
  onSelectIndexForMap,
}) => {
  const t = TRANSLATIONS[language];

  const [indices, setIndices] = useState<SpectralIndexResult[]>([]);
  const [minerals, setMinerals] = useState<MineralIndicationResult[]>([]);
  const [swatRanking, setSwatRanking] = useState<SwatParameterRank[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [weather, setWeather] = useState<WeatherTelemetry | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);
  const [selectedSwatParam, setSelectedSwatParam] = useState<SwatParameterRank | null>(null);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);

  useEffect(() => {
    setIndices(computeAllSpectralInsights(aoi));
    setMinerals(computeMineralIndications(aoi));
    const swat = computeSwatSensitivityRanking(aoi);
    setSwatRanking(swat);
    setSelectedSwatParam(swat[0] || null);
    setTimeSeries(computeCropHealthTimeSeries(aoi));

    fetchResilientWeather(aoi.centroid.lat, aoi.centroid.lon).then(setWeather);
  }, [aoi]);

  return (
    <div className="space-y-10 py-6 text-slate-900">
      {/* 1. Crop Health & Canopy Moisture Over Time (Hoverable SVG Chart) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-100 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-extrabold text-slate-900">
                {t.cropHealthChartTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {t.cropHealthHoverHint}
            </p>
          </div>

          {hoveredPoint && (
            <div className="bg-emerald-950 text-white px-4 py-2 rounded-xl text-xs space-y-0.5 shadow-md border border-emerald-500/40 animate-in fade-in">
              <div className="font-mono text-emerald-300 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date: {hoveredPoint.date} ({hoveredPoint.sensorPass})</span>
              </div>
              <div className="flex items-center gap-3">
                <span>NDVI Vigour: <strong className="text-emerald-400">{hoveredPoint.ndvi}</strong></span>
                <span>NDMI Moisture: <strong className="text-sky-400">{hoveredPoint.ndmi}</strong></span>
                <span>Cloud Cover: <strong>{hoveredPoint.cloudCoverPct}%</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* SVG Time-Series Chart */}
        <div className="relative pt-2 pb-4">
          <svg className="w-full h-44 overflow-visible" viewBox="0 0 700 160">
            {/* Grid Lines */}
            <line x1="40" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="60" x2="680" y2="60" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="100" x2="680" y2="100" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="140" x2="680" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Y-Axis Labels */}
            <text x="10" y="24" fill="#94a3b8" fontSize="10" fontFamily="monospace">1.0</text>
            <text x="10" y="64" fill="#94a3b8" fontSize="10" fontFamily="monospace">0.6</text>
            <text x="10" y="104" fill="#94a3b8" fontSize="10" fontFamily="monospace">0.3</text>
            <text x="10" y="144" fill="#94a3b8" fontSize="10" fontFamily="monospace">0.0</text>

            {/* NDVI Polyline Curve */}
            {timeSeries.length > 0 && (
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={timeSeries
                  .map((p, idx) => {
                    const x = 50 + idx * 85;
                    const y = 140 - p.ndvi * 120;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}

            {/* NDMI Polyline Curve */}
            {timeSeries.length > 0 && (
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={timeSeries
                  .map((p, idx) => {
                    const x = 50 + idx * 85;
                    const y = 140 - Math.max(0, p.ndmi) * 120;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}

            {/* Interactive Points on Hover */}
            {timeSeries.map((p, idx) => {
              const x = 50 + idx * 85;
              const y = 140 - p.ndvi * 120;
              const isHovered = hoveredPoint?.date === p.date;

              return (
                <g
                  key={p.date}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 7 : 4.5}
                    fill={isHovered ? '#10b981' : '#ffffff'}
                    stroke="#059669"
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-150"
                  />
                  <text
                    x={x}
                    y="156"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {p.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="w-3 h-1 bg-emerald-600 rounded" /> NDVI Canopy Vigour (10m)
              </span>
              <span className="flex items-center gap-1.5 font-bold text-sky-800">
                <span className="w-3 h-1 bg-sky-600 rounded border-dashed" /> NDMI Moisture Turgor (20m)
              </span>
            </div>
            <span>Calibrated Bottom-of-Atmosphere (BOA) Reflectance</span>
          </div>
        </div>
      </section>

      {/* 2. Surface Mineral Indication Module (5 SWIR/VNIR Indicators, strictly "Indicated") */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-100 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-extrabold text-slate-900">
              {t.mineralSectionTitle}
            </h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Spectrally Inferred (SWIR/VNIR Ratios)
          </span>
        </div>

        <p className="text-xs text-amber-900 font-semibold bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-xl">
          {t.mineralDisclaimer}
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {minerals.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/40 to-slate-50 border border-amber-200/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  {translateReportDynamicText(language, m.statusLabel, 'mineral')}
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {m.aoiCoveragePercent}% AOI Cover
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-snug">
                  {translateReportDynamicText(language, m.mineralGroup, 'mineral')}
                </h3>
                <div className="font-mono text-xs text-amber-800 mt-1">
                  Formula: {m.bandRatioFormula}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-200">
                <p>
                  <strong>{t.mineralJustificationPrefix}</strong> {m.justification}
                </p>
                <p className="text-emerald-800 font-medium">
                  <strong>Agronomic Note:</strong> {m.agronomicRelevance}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('seva-show-mineral-points', {
                    detail: {
                      mineralKey: m.mineralKey ?? m.id,
                      mineralName: m.mineralGroup,
                      color: m.color ?? '#e65100',
                      points: m.points ?? []
                    }
                  }));
                  const el = document.getElementById('my-farms') || document.querySelector('.map-wrap');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-2 py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Display anomalous cluster centroids for this mineral on the map"
              >
                <Gem className="w-3.5 h-3.5" />
                <span>Show points ({m.points?.length ?? 0})</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 3. SWAT & FQFA Hydrological Sensitivity Ranking (Clickable Zones & Explanations) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-sky-100 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-sky-600" />
            <h2 className="text-xl font-extrabold text-slate-900">
              {t.swatSectionTitle}
            </h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
            Soil & Water Assessment Tool (SWAT-2012)
          </span>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          {t.swatClickHint}
        </p>

        <div className="grid lg:grid-cols-12 gap-6 pt-2">
          {/* Parameter Ranking Table */}
          <div className="lg:col-span-7 space-y-2">
            {swatRanking.map((param) => {
              const isSelected = selectedSwatParam?.parameterCode === param.parameterCode;

              return (
                <div
                  key={param.parameterCode}
                  onClick={() => setSelectedSwatParam(param)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-50 border-sky-500 shadow-md ring-2 ring-sky-400'
                      : 'bg-slate-50 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-xs">
                        #{param.rank}
                      </span>
                      <strong className="text-sm text-slate-900">{param.parameterCode}</strong>
                    </div>
                    <span className="text-xs font-mono font-bold text-sky-800">
                      |t-stat|: {param.tStatSensitivity} (p={param.pValue})
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {param.parameterName}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Parameter Detail Inspector */}
          <div className="lg:col-span-5 bg-gradient-to-br from-sky-50 to-blue-50/60 rounded-2xl p-5 border border-sky-200 space-y-3">
            {selectedSwatParam ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-sky-900 bg-sky-200/80 px-2 py-0.5 rounded">
                    Rank #{selectedSwatParam.rank} Sensitivity Focus
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    Fitted: {selectedSwatParam.fittedValue}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900">
                  {selectedSwatParam.parameterName} ({selectedSwatParam.parameterCode})
                </h3>

                <div className="text-xs text-slate-700 space-y-2">
                  <p>
                    <strong>What it Means:</strong> {selectedSwatParam.whatItMeans}
                  </p>
                  <p>
                    <strong>Where on AOI:</strong> {selectedSwatParam.whereItIsOnAoi}
                  </p>
                  <p className="bg-white/80 p-2.5 rounded-xl border border-sky-200">
                    <strong>{t.swatExplanationPrefix}</strong> {selectedSwatParam.justification}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Select any hydrological parameter row to view scientific details.</p>
            )}
          </div>
        </div>
      </section>

      {/* 4. Resilient Weather & Soil Thermal Profile (Zero 503s) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-100 shadow-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-extrabold text-slate-900">
              {t.weatherSectionTitle}
            </h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            {weather?.provider || 'ECMWF IFS / NASA POWER'}
          </span>
        </div>

        {weather?.status === 'ok' && weather.current ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
              <div className="text-xs text-amber-900 font-bold flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5" /> Air Temp (2m)
              </div>
              <div className="text-xl font-black text-slate-900">{weather.current.airTempC ?? '--'} °C</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 space-y-1">
              <div className="text-xs text-sky-900 font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5" /> Relative Humidity
              </div>
              <div className="text-xl font-black text-slate-900">{weather.current.humidityPct ?? '--'} %</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
              <div className="text-xs text-blue-900 font-bold flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5" /> Rain (Current)
              </div>
              {/* Guaranteed non-overlapping mm text */}
              <div className="text-xl font-black text-slate-900">{weather.current.precipitationMm} mm</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs text-slate-700 font-bold flex items-center gap-1">
                <Wind className="w-3.5 h-3.5" /> Wind Speed
              </div>
              <div className="text-xl font-black text-slate-900">{weather.current.windSpeedKmh ?? '--'} km/h</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="text-xs text-emerald-900 font-bold flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5" /> Topsoil Temp
              </div>
              <div className="text-xl font-black text-slate-900">{weather.current.soilTemp0cmC ?? '--'} °C</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 space-y-1">
              <div className="text-xs text-teal-900 font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5" /> Soil Moisture
              </div>
              <div className="text-xl font-black text-slate-900">{weather.current.soilMoistureM3M3 ? `${weather.current.soilMoistureM3M3} m³/m³` : 'Optimal'}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
            Meteorological observation gateways connecting to Open-Meteo & NASA POWER...
          </div>
        )}

        {/* 7-Day Rainfall Outlook */}
        {weather?.daily && weather.daily.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              {t.rainfallOutlookTitle}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {weather.daily.slice(0, 7).map((d) => (
                <div key={d.date} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                  <div className="text-[11px] font-mono text-slate-500">{d.date.slice(5)}</div>
                  <div className="text-sm font-black text-blue-700">{d.precipMm} mm</div>
                  <div className="text-[10px] text-slate-500 font-medium">{d.tempMaxC}° / {d.tempMinC}°</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. What to Look For on Your Farm (Default-Collapsed Triangle Accordion) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-black text-slate-900">
            {t.whatToLookForTitle}
          </h2>
        </div>

        <div className="space-y-3">
          {indices.map((idx) => (
            <details
              key={idx.id}
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden transition"
            >
              <summary className="cursor-pointer p-4 font-bold text-sm text-slate-900 flex items-center justify-between select-none hover:bg-slate-100/80">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{idx.code} — {idx.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    {idx.value} {idx.unit}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>

              <div className="p-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-200/80 bg-white">
                <p><strong>Front Assessment:</strong> {idx.frontSummary}</p>
                <p><strong>Spectral Physics & Sensor:</strong> {idx.backTechnicalDetail} ({idx.sensor})</p>
                <p className="text-emerald-800 font-bold"><strong>Agronomic Action:</strong> {idx.agronomicAction}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};

export default FieldIntelligenceDashboard;
