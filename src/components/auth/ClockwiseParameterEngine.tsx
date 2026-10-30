import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCw, Activity, ShieldCheck, Info } from 'lucide-react';

export type DomainPillarId = 'agriculture' | 'hydrology' | 'soil' | 'climate';

export interface ParameterStep {
  stepNumber: number;
  code: string;
  name: string;
  formula: string;
  sensor: string;
  mask: string;
  caveat: string;
  metricDemo: string;
  description: string;
}

export interface DomainPillarData {
  id: DomainPillarId;
  code: string;
  icon: string;
  title: string;
  subtitle: string;
  steps: ParameterStep[];
}

export const DOMAIN_DATA: Record<DomainPillarId, DomainPillarData> = {
  agriculture: {
    id: 'agriculture',
    code: 'DOM-01',
    icon: '🌱',
    title: 'Precision Agriculture',
    subtitle: 'Sentinel-2 NDVI & Vigour',
    steps: [
      {
        stepNumber: 1,
        code: 'NDVI',
        name: 'Normalized Difference Vegetation Index',
        formula: '(B8 - B4) / (B8 + B4)',
        sensor: 'Sentinel-2B L2A (10m)',
        mask: 'SCL Cloud/Shadow Masked',
        caveat: 'Indicator only; verify on ground',
        metricDemo: '0.74 ± 0.04 (Healthy)',
        description: 'Quantifies photosynthetic canopy vigour from Sentinel-2 L2A Bottom-of-Atmosphere reflectance bands.',
      },
      {
        stepNumber: 2,
        code: 'EVI',
        name: 'Enhanced Vegetation Index',
        formula: '2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)',
        sensor: 'Sentinel-2 L2A (10m)',
        mask: 'Atmospheric Aerosol Resistance',
        caveat: 'Resistant to high-biomass canopy saturation',
        metricDemo: '0.62 ± 0.03 (Dense Canopy)',
        description: 'Enhances vegetation signal in dense canopies with improved sensitivity through de-coupling of canopy background.',
      },
      {
        stepNumber: 3,
        code: 'SAVI',
        name: 'Soil-Adjusted Vegetation Index',
        formula: '((B8 - B4) / (B8 + B4 + 0.5)) * 1.5',
        sensor: 'Sentinel-2 L2A (10m)',
        mask: 'L=0.5 Bare Soil Adjustment',
        caveat: 'Calibrated for early crop emergence',
        metricDemo: '0.45 ± 0.05 (Early Stage)',
        description: 'Minimizes soil brightness influences in sparse crop cover and early vegetative emergence stages.',
      },
      {
        stepNumber: 4,
        code: 'NDMI',
        name: 'Normalized Difference Moisture Index',
        formula: '(B8 - B11) / (B8 + B11)',
        sensor: 'Sentinel-2 SWIR (20m)',
        mask: 'SWIR 1.61µm Absorption',
        caveat: 'Reflects foliar water turgor, not aquifer depth',
        metricDemo: '0.38 ± 0.02 (Adequate Moisture)',
        description: 'Sensitive to canopy water content and cellular turgidity for irrigation deficit and moisture stress scouting.',
      },
      {
        stepNumber: 5,
        code: 'LAI',
        name: 'Leaf Area Index Proxy',
        formula: '0.57 * exp(2.33 * NDVI)',
        sensor: 'FAO-56 Radiative Transfer',
        mask: 'Empirical Bio-Physical Model',
        caveat: 'Empirical remote-sensing estimate',
        metricDemo: '3.2 m²/m² (Optimum)',
        description: 'Estimates one-sided green leaf area per unit ground surface area for biomass and yield forecasting.',
      },
      {
        stepNumber: 6,
        code: 'SCL',
        name: 'Scene Classification Layer QA',
        formula: 'SCL ∉ {3, 8, 9, 10, 11}',
        sensor: 'ESA Sen2Cor (20m)',
        mask: 'Pixel-Level Provenance Filter',
        caveat: 'Automated cloud & shadow elimination',
        metricDemo: '100% Quality Clear',
        description: 'Guarantees that cloud shadows, high cirrus, snow, and invalid detector pixels are masked to nodata.',
      },
    ],
  },
  hydrology: {
    id: 'hydrology',
    code: 'DOM-02',
    icon: '💧',
    title: 'Hydrology & Water',
    subtitle: 'NDWI, SAR & Runoff',
    steps: [
      {
        stepNumber: 1,
        code: 'NDWI',
        name: 'Normalized Difference Water Index',
        formula: '(B3 - B8) / (B3 + B8)',
        sensor: 'Sentinel-2 Green/NIR (10m)',
        mask: 'Water Threshold > 0.0',
        caveat: 'Delineates open surface moisture and ponding',
        metricDemo: '0.48 (Standing Water)',
        description: 'Delineates open standing water, farm ponds, irrigation canal leakage, and surface flood inundation.',
      },
      {
        stepNumber: 2,
        code: 'MNDWI',
        name: 'Modified NDWI (Sub-Pixel Water)',
        formula: '(B3 - B11) / (B3 + B11)',
        sensor: 'Sentinel-2 Green/SWIR (20m)',
        mask: 'Built-up / Turbidity Suppression',
        caveat: 'Reduces noise from wet soil and settlements',
        metricDemo: '0.55 (Open Waterway)',
        description: 'Substitutes SWIR band for NIR to suppress false positives from built-up surfaces and saturated soil.',
      },
      {
        stepNumber: 3,
        code: 'SAR-VV',
        name: 'Sentinel-1 C-Band SAR Backscatter',
        formula: '10 * log10(σ°_VV)',
        sensor: 'Sentinel-1 SAR C-Band (10m)',
        mask: 'Radiometric Terrain Flattened',
        caveat: 'All-weather cloud-penetrating specular radar',
        metricDemo: '-16.4 dB (Wet Soil)',
        description: 'Measures microwave surface roughness; smooth standing water produces low backscatter (< -18 dB).',
      },
      {
        stepNumber: 4,
        code: 'SSM',
        name: 'Surface Soil Moisture Proxy',
        formula: '(σ° - σ°_min) / (σ°_max - σ°_min)',
        sensor: 'SAR + Optical Fusion',
        mask: 'Incidence Angle Normalized',
        caveat: 'Represents 0-5 cm topsoil moisture only',
        metricDemo: '68% Relative Wetness',
        description: 'Derives relative topsoil moisture index from multi-temporal microwave backscatter extremes.',
      },
      {
        stepNumber: 5,
        code: 'TWI',
        name: 'Topographic Wetness Index',
        formula: 'ln(α / tan(β))',
        sensor: 'Copernicus GLO-30 DEM',
        mask: 'D-Infinity Upslope Catchment',
        caveat: 'Terrain resolution 30m; misses sub-furrows',
        metricDemo: '11.8 (Runoff Accumulation)',
        description: 'Models hydrological runoff convergence and soil saturation based on slope gradient and upslope catchment area.',
      },
      {
        stepNumber: 6,
        code: 'WBAL',
        name: 'Root-Zone Water Balance',
        formula: 'P - ET0 - Q_runoff',
        sensor: 'FAO-56 Penman-Monteith',
        mask: 'Open-Meteo + NASA POWER',
        caveat: 'Field water balance estimate',
        metricDemo: '+14 mm/week (Surplus)',
        description: 'Integrates local evapotranspiration and precipitation data to compute crop root-zone water surplus or deficit.',
      },
    ],
  },
  soil: {
    id: 'soil',
    code: 'DOM-03',
    icon: '🪨',
    title: 'Soil & Terrain',
    subtitle: 'Topography & Carbon',
    steps: [
      {
        stepNumber: 1,
        code: 'BSI',
        name: 'Bare Soil Index',
        formula: '((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2))',
        sensor: 'Sentinel-2 SWIR/VNIR',
        mask: 'NDVI Masked (< 0.25)',
        caveat: 'Quantifies bare topsoil exposure',
        metricDemo: '0.36 (Exposed Soil)',
        description: 'Separates bare agricultural soil from vegetative cover and dry crop residue using SWIR/Red contrast.',
      },
      {
        stepNumber: 2,
        code: 'SLOPE',
        name: 'Digital Elevation Slope Gradient',
        formula: 'arctan(√(dz/dx² + dz/dy²))',
        sensor: 'Copernicus 30m DEM',
        mask: 'Horn 1981 Convolution Filter',
        caveat: 'Vertical accuracy 2-4m',
        metricDemo: '3.8° (Gentle Undulating)',
        description: 'Computes terrain slope angle in degrees to evaluate soil erosion susceptibility and machinery driveability.',
      },
      {
        stepNumber: 3,
        code: 'SOC-P',
        name: 'Soil Organic Carbon Proxy',
        formula: 'f(B2, B3, B4, DEM_elevation)',
        sensor: 'SoilGrids 250m + S2 Optical',
        mask: 'Depth 0-30 cm Topsoil',
        caveat: 'Regional baseline; test soil for lab exactness',
        metricDemo: '1.14% SOC (Moderate)',
        description: 'Provides calibrated baseline of topsoil organic matter content from SoilGrids 2.0 machine learning models.',
      },
      {
        stepNumber: 4,
        code: 'NDSI',
        name: 'Normalized Difference Salinity Index',
        formula: '(B11 - B12) / (B11 + B12)',
        sensor: 'Sentinel-2 SWIR 20m',
        mask: 'Dry Bare Topsoil Window',
        caveat: 'Flags surface salt efflorescence',
        metricDemo: '0.12 (Low Salinity Risk)',
        description: 'Detects white halite/gypsum salt crusting on arid and semi-arid agricultural topsoils.',
      },
      {
        stepNumber: 5,
        code: 'CLAY',
        name: 'Clay & Al-OH Mineral Ratio',
        formula: 'B11 / B12',
        sensor: 'Sentinel-2 SWIR 20m',
        mask: 'Vegetation & Cloud Masked',
        caveat: 'Surface spectral hint; not borehole mineral',
        metricDemo: '1.42 (Smectite Indicated)',
        description: 'Identifies clay mineral absorption features at 2.20 µm corresponding to smectite, illite, and kaolinite.',
      },
      {
        stepNumber: 6,
        code: 'EROS',
        name: 'RUSLE Soil Erosion Risk',
        formula: 'R * K * LS * C * P',
        sensor: 'Copernicus DEM + CHIRPS',
        mask: 'Revised Universal Soil Loss',
        caveat: 'Empirical watershed planning model',
        metricDemo: '4.2 t/ha/yr (Tolerable)',
        description: 'Estimates annual soil loss vulnerability based on rainfall erosivity, soil erodibility, and slope length.',
      },
    ],
  },
  climate: {
    id: 'climate',
    code: 'DOM-04',
    icon: '🛰️',
    title: 'Agro-Meteorology',
    subtitle: 'LST Thermal & Anomaly',
    steps: [
      {
        stepNumber: 1,
        code: 'LST',
        name: 'Land Surface Temperature',
        formula: 'Radiative Transfer (T_b / [1 + (λT_b/ρ)ln(ε)])',
        sensor: 'Landsat-9 TIRS / MODIS',
        mask: 'Split-Window Atmospheric Correction',
        caveat: 'Radiometric skin temperature (°C)',
        metricDemo: '32.4 °C (Normal Canopy)',
        description: 'Calculates true surface radiometric temperature, indicating crop transpirational cooling or heat stress.',
      },
      {
        stepNumber: 2,
        code: 'VCI',
        name: 'Vegetation Condition Index',
        formula: '(NDVI - NDVI_min) / (NDVI_max - NDVI_min) * 100',
        sensor: 'Sentinel-2 10-Yr Baseline',
        mask: 'Decadal Range Normalization',
        caveat: 'Compares current season to 10-year historical',
        metricDemo: '72% (Above Average Vigour)',
        description: 'Assesses whether the current vegetative health is superior or inferior to the decadal historical minimum and maximum.',
      },
      {
        stepNumber: 3,
        code: 'TCI',
        name: 'Temperature Condition Index',
        formula: '(LST_max - LST) / (LST_max - LST_min) * 100',
        sensor: 'Thermal Infrared Historical',
        mask: 'Thermal Anomaly Baseline',
        caveat: 'Inverse scale: low score implies heat stress',
        metricDemo: '65% (Favourable Thermal)',
        description: 'Evaluates moisture-stress-induced canopy warming against the long-term thermal climate baseline.',
      },
      {
        stepNumber: 4,
        code: 'CHIRPS',
        name: '30-Day Cumulative Precipitation',
        formula: 'Σ Precipitation (mm, past 30 days)',
        sensor: 'CHIRPS / ECMWF Reanalysis',
        mask: 'Rainfall Gauge Blended',
        caveat: 'Regional 0.05° gridded satellite rainfall',
        metricDemo: '84.2 mm (Normal Monsoon)',
        description: 'Aggregates 30-day satellite precipitation estimates to track agricultural drought and moisture deficits.',
      },
      {
        stepNumber: 5,
        code: 'GDD',
        name: 'Growing Degree Days Accumulation',
        formula: 'Σ max(0, (T_max + T_min)/2 - T_base)',
        sensor: 'ECMWF Agro-Weather Model',
        mask: 'Crop Base Temperature = 10 °C',
        caveat: 'Phenological thermal time model',
        metricDemo: '1,240 °C·days (Flowering)',
        description: 'Measures heat accumulation to predict crop development stages, flowering onset, and physiological harvest maturity.',
      },
      {
        stepNumber: 6,
        code: 'VHI',
        name: 'Vegetation Health Index Synthesis',
        formula: '0.5 * VCI + 0.5 * TCI',
        sensor: 'Agroclimatology Synthesis',
        mask: 'Drought Severity Scale',
        caveat: 'Combined vegetative & thermal drought',
        metricDemo: '68.5 (Good Health)',
        description: 'Integrated drought monitoring index synthesizing photosynthetic vigour (VCI) and canopy thermal stress (TCI).',
      },
    ],
  },
};

// Radar coordinate trigonometric offsets for 320x320 SVG radar dial
// Exact 60° clockwise intervals starting from 12 o'clock (0°)
const NODE_COORDINATES = [
  { x: 160, y: 42, angle: 0, label: '12:00' },    // Step 1: 0° / 12 o'clock
  { x: 262, y: 101, angle: 60, label: '02:00' },  // Step 2: 60° / 2 o'clock
  { x: 262, y: 219, angle: 120, label: '04:00' }, // Step 3: 120° / 4 o'clock
  { x: 160, y: 278, angle: 180, label: '06:00' }, // Step 4: 180° / 6 o'clock
  { x: 58, y: 219, angle: 240, label: '08:00' },  // Step 5: 240° / 8 o'clock
  { x: 58, y: 101, angle: 300, label: '10:00' },  // Step 6: 300° / 10 o'clock
];

// Circumference of radius 118 circle: 2 * pi * 118 ≈ 741.42
const CIRCUMFERENCE = 741.4;

export const ClockwiseParameterEngine: React.FC = () => {
  const [activeDomainId, setActiveDomainId] = useState<DomainPillarId>('agriculture');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [intervalMs, setIntervalMs] = useState<number>(3000);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dispersionKey, setDispersionKey] = useState<number>(0);

  const activeDomain = DOMAIN_DATA[activeDomainId];
  const activeStep = activeDomain.steps[activeStepIndex];
  const activeCoord = NODE_COORDINATES[activeStepIndex];

  // Automatic Clockwise Sweep timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActiveStepIndex((prev) => {
        const next = (prev + 1) % 6;
        return next;
      });
      // Trigger dispersion pulse on each tick
      setDispersionKey((k) => k + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, isPaused, activeDomainId]);

  // Handle Domain Switch: reset pointer to Step 1 (0 / 12 o'clock)
  const handleDomainChange = (domainId: DomainPillarId) => {
    setActiveDomainId(domainId);
    setActiveStepIndex(0);
    setDispersionKey((k) => k + 1);
  };

  // Step directly to a specific node on manual click
  const handleStepClick = (stepIdx: number) => {
    setActiveStepIndex(stepIdx);
    setDispersionKey((k) => k + 1);
  };

  // Calculate arc stroke-dashoffset: 6 segments around circumference
  // Starts with 1/6 (617.8), fills clockwise to 6/6 (0)
  const arcDashOffset = CIRCUMFERENCE - ((activeStepIndex + 1) / 6) * CIRCUMFERENCE;

  return (
    <div className="w-full space-y-6">
      {/* Domain Intelligence Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Domain Intelligence Matrix
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Clockwise Parameter Engine
          </span>
        </div>

        {/* Speed Cadence and Pause Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 px-1 font-medium">Cadence:</span>
          {[1000, 3000, 5000].map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => setIntervalMs(ms)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                intervalMs === ms
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {ms / 1000}s {ms === 3000 ? '(Default)' : ''}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`ml-1 px-2.5 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 border transition ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* 4 Domain Pillar Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(Object.keys(DOMAIN_DATA) as DomainPillarId[]).map((domId) => {
          const dom = DOMAIN_DATA[domId];
          const isActive = activeDomainId === domId;
          return (
            <button
              key={dom.id}
              type="button"
              onClick={() => handleDomainChange(dom.id)}
              className={`p-3 rounded-2xl text-left transition-all border ${
                isActive
                  ? 'bg-gradient-to-br from-emerald-500/20 via-slate-900/90 to-cyan-500/10 border-emerald-400/80 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/30'
                  : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">{dom.icon}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {dom.code}
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-1.5 truncate">{dom.title}</p>
              <p className="text-[11px] text-slate-400 truncate">{dom.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Clockwise Parameter Engine Canvas: Dial (Left) + Scientific Telemetry (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-slate-950/80 border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 320x320 SVG Radar Dial (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* SVG Orbit and Animated Vector Hand */}
            <svg
              className="w-full h-full"
              viewBox="0 0 320 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="orbitDialGrad" x1="0" y1="0" x2="320" y2="320" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10B981" />
                  <stop offset="0.5" stopColor="#38BDF8" />
                  <stop offset="1" stopColor="#0284C7" />
                </linearGradient>
                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Outer Radar Guide Ring */}
              <circle
                cx="160"
                cy="160"
                r="142"
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="1.5"
              />

              {/* Dashed Clockwise Orbit Track */}
              <circle
                cx="160"
                cy="160"
                r="118"
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth="2"
                strokeDasharray="6 6"
              />

              {/* Active Clockwise Circumference Progress Arc */}
              <circle
                cx="160"
                cy="160"
                r="118"
                stroke="url(#orbitDialGrad)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={arcDashOffset}
                transform="rotate(-90 160 160)"
                className="transition-all duration-700 ease-out"
                filter="url(#glowFilter)"
              />

              {/* Dynamic Dispersion Wave Keyed to Each Tick */}
              <circle
                key={`dispersion-${dispersionKey}`}
                cx="160"
                cy="160"
                r="56"
                stroke="#10B981"
                strokeWidth="2"
                className="animate-ping opacity-30 pointer-events-none"
              />

              {/* Sweeping Vector Radar Hand from Hub (160, 160) to Active Node */}
              <line
                x1="160"
                y1="160"
                x2={activeCoord.x}
                y2={activeCoord.y}
                stroke="url(#orbitDialGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
                filter="url(#glowFilter)"
              />
            </svg>

            {/* 6 Clockwise Parameter Nodes Rendered Around Circle (60° Intervals) */}
            {activeDomain.steps.map((st, idx) => {
              const coord = NODE_COORDINATES[idx];
              const isCurrent = idx === activeStepIndex;
              return (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  style={{
                    position: 'absolute',
                    left: `${(coord.x / 320) * 100}%`,
                    top: `${(coord.y / 320) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border text-xs font-bold shadow-lg z-20 ${
                    isCurrent
                      ? 'bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 border-white scale-110 shadow-emerald-500/40 ring-4 ring-emerald-400/30'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:border-emerald-400/60 hover:scale-105'
                  }`}
                  title={`${st.name} (${coord.label})`}
                >
                  <span className="font-mono text-[9px] opacity-75">STEP {st.stepNumber}</span>
                  <span className="text-[11px] font-extrabold truncate max-w-[48px]">
                    {st.code}
                  </span>
                </button>
              );
            })}

            {/* Center Core Planetary Radar Hub */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-900/95 border-2 border-emerald-500/60 flex flex-col items-center justify-center text-center p-2 shadow-2xl z-10 backdrop-blur-md">
              <span className="text-[9px] font-mono text-cyan-300 uppercase tracking-widest">
                1 → 6 CLOCKWISE
              </span>
              <span className="text-base sm:text-lg font-black text-white mt-0.5 tracking-tight">
                {activeStep.code}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold truncate max-w-[100px]">
                {activeStep.metricDemo.split(' ')[0]}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-mono">
                {isPaused ? 'Paused' : `${intervalMs / 1000}s Tick`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 font-mono">
            <RotateCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>Clockwise Sweep Sequence: 1 → 2 → 3 → 4 → 5 → 6 → 1</span>
          </div>
        </div>

        {/* Active Parameter Scientific Telemetry Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              {activeDomain.title}
            </span>
            <span className="text-xs font-mono text-cyan-300 font-bold">
              Parameter {activeStep.stepNumber} of 6
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
              {activeStep.name} ({activeStep.code})
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {activeStep.description}
            </p>
          </div>

          {/* Scientific Parameter Metadata Grid */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Formula:</span>
              <code className="font-mono text-emerald-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                {activeStep.formula}
              </code>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sensor / Source:</span>
              <span className="font-mono text-slate-200">{activeStep.sensor}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quality Filter:</span>
              <span className="font-mono text-cyan-300">{activeStep.mask}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Scientific Restraint:</span>
              <span className="text-amber-300 text-right font-medium max-w-[200px] truncate" title={activeStep.caveat}>
                {activeStep.caveat}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Reference Benchmark:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {activeStep.metricDemo}
              </span>
            </div>
          </div>

          {/* 6-Step Mini Progress Indicator Strip */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Clockwise Progression</span>
              <span className="font-mono text-emerald-400 font-bold">
                {activeStepIndex + 1} / 6
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === activeStepIndex
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-sm shadow-emerald-400/50'
                      : idx < activeStepIndex
                      ? 'bg-emerald-600/40'
                      : 'bg-slate-800'
                  }`}
                  title={`Step ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockwiseParameterEngine;
