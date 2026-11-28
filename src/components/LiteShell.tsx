import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownToLine, CircleDot, CloudRain, Droplets, ExternalLink,
  HelpCircle, Info, Layers, LocateFixed, LogOut, Mail, Menu, Mountain,
  Navigation, Plus, Radio, RefreshCw, Send, Settings2, Share2, ShieldCheck, Smartphone,
  Sprout, Sun, Trash2, X,
} from 'lucide-react'
import { fetchSoil, fetchWeather, textureClass, type Soil, type Weather } from '../lib/agro'
import { addBorewell, removeBorewell, useAssets } from '../lib/assets'
import { sendReportDirectToEmail, type DirectEmailResponse } from '../lib/directEmailService'
import type { FieldWaypoint } from '../lib/geodesyField'
import { humanizeAoiCondition, type ReferenceCitation } from '../lib/humanizeMetrics'
import { useI18n } from '../lib/i18n'
import { getNativeSmsUri, getWhatsAppUri } from '../lib/openSmsGateway'
import type { Analysis, SceneOpts, WeekRec } from '../lib/seva'
import { useUIMode } from '../lib/uiMode'
import IndicatorMap from '../IndicatorMap'
import Lang from '../Lang'
import { MitraAvatar } from '../Mitra'
import Wordmark from '../Wordmark'
import { logoMark as brandLogo } from '../assets/brand'
import InlineHandyGpsBar, { loadFarmWaypoints } from './InlineHandyGpsBar'
import MobileBottomNav from './MobileBottomNav'

export interface LiteFarm {
  id: string
  name: string
  location: string
  crop: string
  area: number
  lat: number
  lon: number
  status: string
  ndvi?: number
  moisture?: number
  rain?: number
  elevation?: number
  sample: boolean
  analysis?: Analysis
  polygon?: [number, number][]
  passes?: WeekRec[]
}

interface LiteShellProps {
  farms: LiteFarm[]
  farm: LiteFarm | null
  selectedId: string
  loading: boolean
  opts: SceneOpts
  who: { id: string; name: string; email: string; isGoogle?: boolean; picture?: string }
  driveConnected: boolean
  onSelectFarm: (id: string) => void
  onRemoveFarm: (farm: LiteFarm) => void
  onRefresh: (farm?: LiteFarm, nextOpts?: SceneOpts) => void
  onOpenAdd: () => void
  onDetectGps: () => void
  onOpenRemoteScout: () => void
  onOpenModal: (modal: string) => void
  onConnectGoogle: () => void
  onSignOut: () => void
  onSaveWalkedBoundary: (ring: [number, number][], name: string, measuredHa: number) => void
}

const LAYER_TICKS = [
  { id: 'ndvi', labelKey: 'lite.layer.veg', defaultOn: true },
  { id: 'ndmi', labelKey: 'lite.layer.water', defaultOn: false },
  { id: 'agri', labelKey: 'lite.layer.land', defaultOn: false },
  { id: 'bsi', labelKey: 'lite.layer.soil', defaultOn: false },
  { id: 'slope', labelKey: 'lite.layer.slope', defaultOn: false },
] as const

const SKY_GRADIENTS: Record<'sunny' | 'rain' | 'dry' | 'harvest', string> = {
  sunny: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 48%, #e0f2fe 100%)',
  rain: 'linear-gradient(135deg, #1e293b 0%, #334155 55%, #64748b 100%)',
  dry: 'linear-gradient(135deg, #0369a1 0%, #f59e0b 65%, #fef3c7 100%)',
  harvest: 'linear-gradient(135deg, #0f766e 0%, #38bdf8 55%, #fed7aa 100%)',
}

export default function LiteShell({
  farms,
  farm,
  selectedId,
  loading,
  opts,
  who,
  driveConnected,
  onSelectFarm,
  onRemoveFarm,
  onRefresh,
  onOpenAdd,
  onDetectGps,
  onOpenRemoteScout,
  onOpenModal,
  onConnectGoogle,
  onSignOut,
  onSaveWalkedBoundary,
}: LiteShellProps) {
  const { t } = useI18n()
  const { mode, setMode, isApp, canSwitchMode } = useUIMode()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [layersTarget, setLayersTarget] = useState<HTMLDivElement | null>(null)
  const [checkedLayers, setCheckedLayers] = useState<Record<string, boolean>>({
    ndvi: true,
    ndmi: false,
    agri: false,
    bsi: false,
    slope: false,
  })
  const [weather, setWeather] = useState<Weather | null>(null)
  const [weatherErr, setWeatherErr] = useState<string>('')
  const [soil, setSoil] = useState<Soil | null>(null)
  const [soilErr, setSoilErr] = useState<string>('')
  const [activeRef, setActiveRef] = useState<ReferenceCitation | null>(null)
  const [waypoints, setWaypoints] = useState<FieldWaypoint[]>(() => (farm ? loadFarmWaypoints(farm.id) : []))
  const [mapFocus, setMapFocus] = useState(false)

  // Report email & sharing state
  const [reportOpen, setReportOpen] = useState(false)
  const [reportEmail, setReportEmail] = useState(who?.email || '')
  const [reportMailBusy, setReportMailBusy] = useState(false)
  const [reportMailRes, setReportMailRes] = useState<DirectEmailResponse | null>(null)
  const [reportMailErr, setReportMailErr] = useState('')

  const assets = useAssets()
  const farmBorewells = useMemo(
    () => (farm ? assets.borewells.filter((b) => b.farmId === farm.id) : []),
    [assets.borewells, farm]
  )

  const reloadClimateAndSoil = () => {
    if (!farm) return
    setWeatherErr('')
    setSoilErr('')
    fetchWeather(farm.lat, farm.lon, true)
      .then((d) => setWeather(d))
      .catch((e: any) => setWeatherErr(e?.message || 'Weather unavailable'))
    fetchSoil(farm.lat, farm.lon, true)
      .then((d) => setSoil(d))
      .catch((e: any) => setSoilErr(e?.message || 'Soil profile unavailable'))
  }

  useEffect(() => {
    if (!farm) {
      setWeather(null)
      setSoil(null)
      setWaypoints([])
      return
    }
    setWaypoints(loadFarmWaypoints(farm.id))
    let dead = false
    setWeatherErr('')
    setSoilErr('')
    fetchWeather(farm.lat, farm.lon)
      .then((d) => { if (!dead) setWeather(d) })
      .catch((e: any) => { if (!dead) setWeatherErr(e?.message || 'Weather unavailable') })
    fetchSoil(farm.lat, farm.lon)
      .then((d) => { if (!dead) setSoil(d) })
      .catch((e: any) => { if (!dead) setSoilErr(e?.message || 'Soil data unavailable') })
    return () => { dead = true }
  }, [farm?.id, farm?.lat, farm?.lon])

  const soilSummary = useMemo(() => {
    if (!soil) return null
    const avg = (k: string) => {
      const vals = (soil[k]?.depths ?? []).slice(0, 3).filter(Number.isFinite)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN
    }
    const sand = avg('sand'), clay = avg('clay'), silt = avg('silt'), ph = avg('phh2o')
    if (![sand, clay, silt].every(Number.isFinite)) return null
    return {
      texture: textureClass(clay, sand, silt),
      sand: Math.round(sand),
      clay: Math.round(clay),
      silt: Math.round(silt),
      ph: Number.isFinite(ph) ? ph.toFixed(1) : '—',
    }
  }, [soil])

  const cond = useMemo(() => humanizeAoiCondition({
    areaHa: farm?.area,
    analysis: farm?.analysis,
    rain7dMm: weather?.rainNext7 ?? farm?.rain,
    soilMoisturePct: weather ? Math.round(weather.soilM.d9_27 * 100) : undefined,
    elevationM: farm?.analysis?.elevMean ?? farm?.elevation,
  }), [farm, weather])

  const toggleLayerCheckbox = (id: string) => {
    setCheckedLayers((prev) => {
      const nextVal = !prev[id]
      window.dispatchEvent(new CustomEvent('seva-apply-indicator-layer', { detail: { layerId: id, enabled: nextVal } }))
      return { ...prev, [id]: nextVal }
    })
  }

  // Real time-lapse passes comparison (first vs latest cloud-free pass)
  const timelapse = useMemo(() => {
    const passes = [...(farm?.passes || [])].sort((a, b) => a.date.localeCompare(b.date))
    if (passes.length < 2) return null
    const first = passes[0]
    const latest = passes[passes.length - 1]
    return {
      first,
      latest,
      ndviDelta: Number((latest.ndvi - first.ndvi).toFixed(2)),
      ndmiDelta: Number((latest.ndmi - first.ndmi).toFixed(2)),
      stressDelta: Math.round(latest.stressPct - first.stressPct),
      count: passes.length,
    }
  }, [farm?.passes])

  // Polygon preview path for Simplified Report Generator
  const aoiPreviewSvgPoints = useMemo(() => {
    if (!farm?.polygon || farm.polygon.length < 3) return null
    const lons = farm.polygon.map((p) => p[0])
    const lats = farm.polygon.map((p) => p[1])
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const spanX = Math.max(maxLon - minLon, 1e-5)
    const spanY = Math.max(maxLat - minLat, 1e-5)
    return farm.polygon
      .map(([lon, lat]) => `${(((lon - minLon) / spanX) * 180 + 10).toFixed(1)},${(((maxLat - lat) / spanY) * 110 + 10).toFixed(1)}`)
      .join(' ')
  }, [farm?.polygon])

  const shareSummaryText = useMemo(() => {
    if (!farm) return 'SEVA.GIS Field Report'
    const lines = [
      `*SEVA.GIS Area Report — ${farm.name}*`,
      `Area: ${farm.area.toFixed(2)} ha (${(farm.area * 2.471).toFixed(2)} ac)`,
      `Coordinates: ${farm.lat.toFixed(5)}°, ${farm.lon.toFixed(5)}°`,
      `Health Score: ${cond.aoiHealthScore !== null ? `${cond.aoiHealthScore}/100` : 'Pending Sentinel-2'}`,
      `Condition: ${cond.conditionLabel}`,
      `Moisture: ${cond.moistureStatus}`,
      `Water Plan: ${cond.waterNeedMm !== null ? `${cond.waterNeedMm} mm (${cond.waterVolumeM3 ?? '—'} m³ total · ${cond.dailyWaterMm} mm/day)` : 'Pending weather'}`,
      `Waypoints marked: ${waypoints.length}${waypoints.length > 0 ? ' (' + waypoints.map((w) => w.label).slice(0, 6).join(', ') + ')' : ''}`,
    ]
    return lines.join('\n')
  }, [farm, cond, waypoints])

  const buildReportHtml = () => {
    if (!farm) return ''
    const wpRows = waypoints.length
      ? waypoints.map((w) => `<li><b>${w.label}</b> (${w.type}) — ${w.lat.toFixed(5)}°, ${w.lon.toFixed(5)}°</li>`).join('')
      : '<li>No field waypoints marked yet.</li>'
    return `
      <div style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a">
        <h2 style="color:#059669;margin-bottom:4px">SEVA·GIS Simplified Field Report — ${farm.name}</h2>
        <p style="color:#475569;margin-top:0">Area: <b>${farm.area.toFixed(2)} ha (${(farm.area * 2.471).toFixed(2)} acres)</b> · Coordinates: ${farm.lat.toFixed(5)}°, ${farm.lon.toFixed(5)}° · Sentinel-2 Date: ${farm.analysis?.scene?.datetime?.slice(0, 10) || 'Latest available'}</p>
        <h3>Overall AOI Health Score: ${cond.aoiHealthScore !== null ? `${cond.aoiHealthScore} / 100` : 'Pending satellite scene'}</h3>
        <p>${cond.naviSummary}</p>
        <ul>
          <li><b>Vegetation Cover:</b> ${cond.conditionLabel}</li>
          <li><b>Canopy Moisture:</b> ${cond.moistureStatus}</li>
          <li><b>Water &amp; Irrigation Estimate:</b> ${cond.waterNeedMm !== null ? `${cond.waterNeedMm} mm (${cond.waterVolumeM3 ?? '—'} m³ · ${cond.dailyWaterMm} mm/day)` : 'Weather unavailable'}</li>
          <li><b>Land Cover &amp; Terrain:</b> ${cond.landCoverSummary} · ${cond.slopeLabel}</li>
        </ul>
        <h3>Field Waypoints (${waypoints.length})</h3>
        <ul>${wpRows}</ul>
        ${timelapse ? `<h3>Time-Lapse Change (${timelapse.first.date} → ${timelapse.latest.date})</h3><p>NDVI change: ${timelapse.ndviDelta >= 0 ? '+' : ''}${timelapse.ndviDelta} · Moisture change: ${timelapse.ndmiDelta >= 0 ? '+' : ''}${timelapse.ndmiDelta}</p>` : ''}
      </div>
    `
  }

  const handleSendReportEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!farm) return
    setReportMailErr('')
    setReportMailRes(null)
    setReportMailBusy(true)
    try {
      const res = await sendReportDirectToEmail({
        recipientEmail: reportEmail.trim(),
        farmName: farm.name,
        reportId: `lite-${farm.id}-${Date.now()}`,
        areaHa: farm.area,
        ndvi: farm.analysis?.ndvi?.mean ?? 0,
        ndmi: farm.analysis?.ndmi?.mean ?? 0,
        format: 'pdf',
        filename: `${farm.name.replace(/\W+/g, '_')}_simple_report.html`,
        htmlContent: buildReportHtml(),
      })
      setReportMailRes(res)
    } catch (err: any) {
      setReportMailErr(err?.message || 'Unable to send email.')
    } finally {
      setReportMailBusy(false)
    }
  }

  return (
    <div id="lite-shell-root" style={{ minHeight: '100vh', background: '#f1f5f9', color: '#0f172a', paddingBottom: 88 }}>
      {/* Sticky Clean Top Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 900,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            data-tour="lite-menu"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('shell.openNav')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              color: '#0f172a',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Menu size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={brandLogo}
              alt="SEVA.GIS"
              style={{ width: 28, height: 28, objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.src = '/logo.png' }}
            />
            <Wordmark variant="pro" />
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#dcfce7', color: '#166534', textTransform: 'uppercase' }}>
              {t('lite.badge')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Website ONLY Binance-style Lite / Pro mode toggle */}
          {canSwitchMode && !isApp && (
            <div
              role="group"
              aria-label="Experience Mode"
              style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: '#f1f5f9', border: '1px solid #cbd5e1' }}
            >
              <button
                type="button"
                onClick={() => setMode('lite')}
                style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', border: 'none',
                  background: mode === 'lite' ? '#059669' : 'transparent', color: mode === 'lite' ? '#fff' : '#475569',
                }}
              >
                {t('mode.lite')}
              </button>
              <button
                type="button"
                onClick={() => setMode('pro')}
                style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', border: 'none',
                  background: mode === 'pro' ? '#0f172a' : 'transparent', color: mode === 'pro' ? '#fff' : '#475569',
                }}
              >
                {t('mode.pro')}
              </button>
            </div>
          )}

          <Lang />

          <button
            type="button"
            onClick={() => (driveConnected ? onOpenModal('settings') : onConnectGoogle())}
            title={driveConnected ? t('top.driveConnected') : t('top.googleSignIn')}
            style={{
              height: 36,
              padding: '0 10px',
              borderRadius: 9,
              border: driveConnected ? '1px solid #86efac' : '1px solid #cbd5e1',
              background: driveConnected ? '#ecfdf5' : '#fff',
              color: driveConnected ? '#15803d' : '#334155',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>{driveConnected ? t('top.driveConnected') : 'Google'}</span>
          </button>

          <span
            title={who?.name || 'Guest'}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#059669',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {(who?.name || 'G')[0].toUpperCase()}
          </span>
        </div>
      </header>

      {/* Three-Lines (≡) Slide-Over Navigation Drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15, 23, 42, 0.48)', display: 'flex' }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            aria-label="Simplified Field Menu"
            style={{
              width: 'min(320px, 86vw)',
              height: '100%',
              background: '#ffffff',
              color: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              padding: 18,
              boxShadow: '12px 0 40px rgba(15, 23, 42, 0.22)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img src={brandLogo} alt="" width={28} height={28} onError={(e) => { e.currentTarget.src = '/logo.png' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: 15 }}>SEVA·GIS</strong>
                  <small style={{ fontSize: 11.5, color: '#059669', fontWeight: 700 }}>{who?.name || 'Field User'}</small>
                </div>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('nav.farms')} ({farms.length})
              </div>
              {farms.length === 0 ? (
                <button
                  type="button"
                  onClick={() => { setDrawerOpen(false); onOpenAdd() }}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px dashed #059669', background: '#f0fdf4', color: '#166534', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                >
                  + {t('empty.addFirstField')}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {farms.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '9px 10px',
                        borderRadius: 10,
                        background: f.id === selectedId ? '#ecfdf5' : '#f8fafc',
                        border: f.id === selectedId ? '2px solid #059669' : '1px solid #e2e8f0',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => { onSelectFarm(f.id); setDrawerOpen(false) }}
                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0f172a' }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>{f.name}</strong>
                        <small style={{ fontSize: 11, color: '#475569' }}>{f.area.toFixed(2)} ha · {f.status}</small>
                      </button>
                      <button type="button" onClick={() => onRemoveFarm(f)} aria-label={`Remove ${f.name}`} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                {t('shell.workspace')}
              </div>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onOpenAdd() }}
                style={{ minHeight: 46, padding: '0 12px', borderRadius: 10, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <Plus size={16} /> {t('lite.addBoundary')}
              </button>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onDetectGps() }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <LocateFixed size={16} color="#0284c7" /> {t('ob.detectGps')}
              </button>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onOpenRemoteScout() }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <Radio size={16} color="#d97706" /> Ask Friend on Field
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setReportOpen(true)
                  setTimeout(() => document.getElementById('lite-report-card')?.scrollIntoView({ behavior: 'smooth' }), 60)
                }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <ArrowDownToLine size={16} color="#059669" /> {t('lite.reportBtn')}
              </button>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onOpenModal('sources') }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <ShieldCheck size={16} color="#0284c7" /> {t('shell.dataSources')}
              </button>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); window.dispatchEvent(new Event('seva-tour')) }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <HelpCircle size={16} /> {t('shell.mitraTour')}
              </button>
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); onOpenModal('settings') }}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <Settings2 size={16} /> Workspace Settings
              </button>
              <button
                type="button"
                data-tour="lite-signout"
                onClick={() => { setDrawerOpen(false); onSignOut() }}
                style={{ minHeight: 46, padding: '0 12px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <LogOut size={16} /> {t('shell.logout')}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '14px' }}>
        {/* Weather-Reactive Makoto-Shinkai Sky Header & AOI Health Score */}
        <section
          data-tour="lite-aoi-banner"
          style={{
            position: 'relative',
            borderRadius: 20,
            overflow: 'hidden',
            background: SKY_GRADIENTS[cond.skyTheme],
            padding: '20px 18px',
            color: '#0f172a',
            marginBottom: 14,
            boxShadow: '0 12px 30px rgba(2, 132, 199, 0.16)',
            border: '1.5px solid rgba(255,255,255,0.65)',
          }}
        >
          {/* Subtle Painted Cloud Silhouette */}
          <svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: '75%', height: '100%', opacity: 0.25, pointerEvents: 'none' }}>
            <path d="M40 120 C70 70, 140 60, 190 95 C235 45, 330 40, 385 88 C430 50, 520 55, 580 120 Z" fill="#ffffff" />
            {cond.skyTheme === 'rain' && (
              <g stroke="#e0f2fe" strokeWidth="1.5" opacity="0.6">
                <line x1="120" y1="10" x2="105" y2="55" />
                <line x1="260" y1="15" x2="245" y2="65" />
                <line x1="420" y1="8" x2="405" y2="58" />
                <line x1="520" y1="22" x2="505" y2="72" />
              </g>
            )}
          </svg>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ maxWidth: 660 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 8 }}>
                {cond.skyTheme === 'rain' ? <CloudRain size={13} /> : <Sun size={13} />}
                <span>{t('lite.aoiTitle')} · {farm ? farm.name : t('empty.noFieldsSaved')}</span>
              </div>

              <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: cond.skyTheme === 'rain' ? '#ffffff' : '#0b1f35' }}>
                {farm ? cond.conditionLabel : t('empty.title')}
              </h1>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.9)' }}>
                <MitraAvatar size={36} />
                <div style={{ fontSize: 13, lineHeight: 1.45, color: '#1e293b' }}>
                  <strong style={{ color: '#059669' }}>NAVI: </strong>
                  <span>{cond.naviSummary}</span>
                </div>
              </div>
            </div>

            {/* Score Circle Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 98,
                  height: 98,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: `4px solid ${cond.conditionTone === 'good' ? '#059669' : cond.conditionTone === 'warn' ? '#d97706' : cond.conditionTone === 'bad' ? '#dc2626' : '#0284c7'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.14)',
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: '#0f172a' }}>
                  {cond.aoiHealthScore !== null ? cond.aoiHealthScore : '—'}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b' }}>/ 100</span>
              </div>
            </div>
          </div>
        </section>

        {/* Empty Onboarding vs Active AOI Dashboard */}
        {!farm ? (
          <section style={{ background: '#ffffff', borderRadius: 18, padding: 28, border: '1.5px solid #cbd5e1', textAlign: 'center', marginBottom: 16 }}>
            <Sprout size={38} color="#059669" style={{ margin: '0 auto 10px', display: 'block' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900 }}>{t('empty.title')}</h2>
            <p style={{ margin: '0 auto 18px', maxWidth: 460, fontSize: 13.5, color: '#475569' }}>{t('empty.body')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={onDetectGps} style={{ minHeight: 48, padding: '0 18px', borderRadius: 12, background: '#059669', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <LocateFixed size={17} /> {t('onboard.detectGps')}
              </button>
              <button type="button" onClick={onOpenAdd} style={{ minHeight: 48, padding: '0 18px', borderRadius: 12, background: '#fff', color: '#0f172a', border: '1.5px solid #059669', fontWeight: 800, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <Plus size={17} /> {t('lite.addBoundary')}
              </button>
              <button type="button" onClick={onOpenRemoteScout} style={{ minHeight: 48, padding: '0 18px', borderRadius: 12, background: '#fffbeb', color: '#92400e', border: '1.5px solid #f59e0b', fontWeight: 800, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <Radio size={17} /> Ask Friend on Field
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Quick Farm Switcher + Action Pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {farms.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectFarm(f.id)}
                    style={{
                      minHeight: 40,
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: f.id === selectedId ? '#059669' : '#ffffff',
                      color: f.id === selectedId ? '#ffffff' : '#0f172a',
                      border: f.id === selectedId ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    }}
                  >
                    {f.name} ({f.area.toFixed(1)} ha)
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={onOpenAdd} style={{ minHeight: 40, padding: '6px 12px', borderRadius: 10, background: '#fff', border: '1.5px solid #059669', color: '#065f46', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={14} /> {t('lite.addBoundary')}
                </button>
                <button type="button" onClick={() => onRefresh(farm)} disabled={loading} style={{ minHeight: 40, padding: '6px 12px', borderRadius: 10, background: '#0f172a', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={13} className={loading ? 'spin' : ''} /> {loading ? t('action.updating') : t('action.refresh')}
                </button>
              </div>
            </div>

            {/* Map Card + Tick-Mark Layer Selector (strictly clipped to selected polygon) */}
            <section
              id="my-farms"
              data-tour="lite-map"
              className={`map-card ${mapFocus ? 'map-focus' : ''}`}
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '1.5px solid #cbd5e1',
                overflow: 'hidden',
                marginBottom: 14,
                boxShadow: '0 6px 20px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 15, display: 'block', color: '#0f172a' }}>{farm.name}</strong>
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    {farm.location} · {farm.area.toFixed(2)} ha ({(farm.area * 2.471).toFixed(2)} ac) · Clipped strictly to your selected AOI
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${farm.lat},${farm.lon}`, '_blank', 'noopener,noreferrer')}
                  style={{ padding: '6px 11px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Navigation size={13} /> {t('farm.viewLocation')}
                </button>
              </div>

              {/* Layer Checkboxes (Tick boxes on/off) */}
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Layers size={14} color="#059669" /> {t('lite.layers')}:
                </span>
                {LAYER_TICKS.map((layer) => (
                  <label
                    key={layer.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 9,
                      background: checkedLayers[layer.id] ? '#dcfce7' : '#ffffff',
                      border: checkedLayers[layer.id] ? '1.5px solid #059669' : '1px solid #cbd5e1',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      cursor: 'pointer',
                      minHeight: 36,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedLayers[layer.id])}
                      onChange={() => toggleLayerCheckbox(layer.id)}
                      style={{ accentColor: '#059669', width: 15, height: 15 }}
                    />
                    <span>{t(layer.labelKey)}</span>
                  </label>
                ))}
              </div>

              <div className="map-wrap" style={{ minHeight: 340 }}>
                <IndicatorMap farm={farm as any} loading={loading} panelTarget={layersTarget} sceneOpts={opts} />
              </div>

              <div ref={setLayersTarget} style={{ padding: '6px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }} />
            </section>

            {/* Inline Handy GPS (Flags, Pushpins, Walk Perimeter, Live Lat/Lon) */}
            <InlineHandyGpsBar
              farm={farm}
              onSaveWalkedBoundary={onSaveWalkedBoundary}
              onWaypointsChange={setWaypoints}
            />

            {/* Simple Parameter Cards Grid with (i) Data Source Verification */}
            <section data-tour="lite-metrics" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                  {t('lite.aoiCondition')}
                </h2>
                <button
                  type="button"
                  data-tour="lite-report-btn"
                  onClick={() => {
                    setReportOpen((v) => !v)
                    setTimeout(() => document.getElementById('lite-report-card')?.scrollIntoView({ behavior: 'smooth' }), 60)
                  }}
                  style={{
                    minHeight: 42,
                    padding: '0 14px',
                    borderRadius: 10,
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 12.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowDownToLine size={15} /> {t('lite.reportBtn')}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {/* Card 1: Vegetation Vigor */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Sprout size={15} /> {t('lite.vegTitle')}
                    </span>
                    <button type="button" onClick={() => setActiveRef(cond.references[0])} aria-label="Check vegetation source" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#0284c7' }}>
                      <Info size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                    {cond.aoiHealthScore !== null ? `${cond.aoiHealthScore}/100` : 'Unavailable'}
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#475569' }}>
                    {cond.conditionLabel} {farm.analysis?.ndvi?.mean !== undefined ? `(NDVI ${farm.analysis.ndvi.mean.toFixed(2)})` : ''}
                  </p>
                </article>

                {/* Card 2: Water & Irrigation Plan */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Droplets size={15} /> {t('lite.waterTitle')}
                    </span>
                    <button type="button" onClick={() => setActiveRef(cond.references[1])} aria-label="Check water source" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#0284c7' }}>
                      <Info size={14} />
                    </button>
                  </div>
                  {weatherErr ? (
                    <div style={{ fontSize: 12, color: '#b91c1c' }}>
                      Weather unavailable ({weatherErr}) <button type="button" onClick={reloadClimateAndSoil} style={{ textDecoration: 'underline', border: 'none', background: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                        {cond.waterNeedMm !== null ? `${cond.waterNeedMm} mm` : 'Loading…'}
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#475569' }}>
                        {cond.waterVolumeM3 !== null ? `${cond.waterVolumeM3.toLocaleString()} m³ total · ${cond.dailyWaterMm} mm/day · ` : ''}{cond.moistureStatus}
                      </p>
                    </>
                  )}
                </article>

                {/* Card 3: Land Cover & Soil */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Layers size={15} /> {t('lite.soilTitle')}
                    </span>
                    <button type="button" onClick={() => setActiveRef(cond.references[2])} aria-label="Check soil source" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#0284c7' }}>
                      <Info size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                    {soilSummary ? soilSummary.texture : soilErr ? 'Soil unavailable' : 'Loading SoilGrids…'}
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#475569' }}>
                    {cond.landCoverSummary}{soilSummary ? ` · pH ${soilSummary.ph} (${soilSummary.sand}% sand, ${soilSummary.clay}% clay)` : ''}
                  </p>
                </article>

                {/* Card 4: Slope, Rainfall & Temperature */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Mountain size={15} /> {t('lite.slopeWeatherTitle')}
                    </span>
                    <button type="button" onClick={() => setActiveRef(cond.references[2])} aria-label="Check terrain source" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#0284c7' }}>
                      <Info size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                    {cond.slopeLabel}
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#475569' }}>
                    {weather
                      ? `7-day rain: ${weather.rainNext7.toFixed(1)} mm · Temp: ${weather.tminNext7.toFixed(0)}–${weather.tmaxNext7.toFixed(0)} °C`
                      : 'Open-Meteo weather pending'}
                  </p>
                </article>

                {/* Card 5: Drainage & Borewell Planner */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CircleDot size={15} /> {t('lite.borewellTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={() => addBorewell({
                        farmId: farm.id,
                        name: `Borewell ${farmBorewells.length + 1}`,
                        lat: farm.lat,
                        lon: farm.lon,
                        depth: 90,
                        level: 25,
                        yieldM3h: 5,
                        hours: 6,
                      })}
                      style={{ padding: '4px 9px', borderRadius: 7, background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                    >
                      + Borewell
                    </button>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                    {farmBorewells.length} active borewells
                  </div>
                  {farmBorewells.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                      Tap + Borewell to log supply capacity and compare with daily field water demand.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {farmBorewells.slice(0, 3).map((b) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#334155' }}>
                          <span>{b.name}: <b>{b.yieldM3h * b.hours} m³/day</b></span>
                          <button type="button" onClick={() => removeBorewell(b.id)} aria-label="Remove borewell" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                {/* Card 6: Low-Vigor / Possible Pest Spots */}
                <article style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={15} /> {t('lite.pestTitle')}
                    </span>
                    <button type="button" onClick={() => setActiveRef(cond.references[0])} aria-label="Check stress source" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#0284c7' }}>
                      <Info size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                    {cond.stressSharePct !== null ? `${cond.stressSharePct}% of pixels` : 'Unavailable'}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                    Share of clear 10m pixels below NDVI 0.30. Inspect low patches on foot to distinguish pest, moisture, or thin cover.
                  </p>
                </article>
              </div>
            </section>

            {/* Time-Lapse Before / After Comparison */}
            <section style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 16, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                {t('lite.timelapseTitle')}
              </h3>
              {!timelapse ? (
                <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                  At least 2 cloud-free Sentinel-2 passes are required for a before/after comparison. Refresh when new scenes are available.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12.5 }}>
                  <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Earlier ({timelapse.first.date})</span>
                    <strong>NDVI {timelapse.first.ndvi.toFixed(2)} · NDMI {timelapse.first.ndmi.toFixed(2)}</strong>
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Latest ({timelapse.latest.date})</span>
                    <strong>NDVI {timelapse.latest.ndvi.toFixed(2)} · NDMI {timelapse.latest.ndmi.toFixed(2)}</strong>
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, background: timelapse.ndviDelta >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${timelapse.ndviDelta >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ color: '#475569', display: 'block', fontSize: 11 }}>Change ({timelapse.count} scenes)</span>
                    <strong style={{ color: timelapse.ndviDelta >= 0 ? '#15803d' : '#b91c1c' }}>
                      NDVI {timelapse.ndviDelta >= 0 ? '+' : ''}{timelapse.ndviDelta} · Moisture {timelapse.ndmiDelta >= 0 ? '+' : ''}{timelapse.ndmiDelta}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            {/* Simplified Visual Report Generator (AOI map + waypoints + params + time-lapse + score + Mail/WA/SMS) */}
            <section
              id="lite-report-card"
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '2px solid #0284c7',
                padding: 18,
                boxShadow: '0 10px 28px rgba(2, 132, 199, 0.10)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{t('lite.reportBtn')}</h3>
                  <span style={{ fontSize: 12, color: '#475569' }}>Includes AOI polygon, named waypoints, health score &amp; instant share</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen((v) => !v)}
                  style={{ padding: '7px 12px', borderRadius: 9, background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {reportOpen ? 'Collapse Preview' : 'Open Report Preview'}
                </button>
              </div>

              {(reportOpen || true) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 }}>
                  {/* AOI Mini-Map & Dimensions */}
                  <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>AOI Polygon &amp; Waypoints ({waypoints.length})</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <svg viewBox="0 0 200 130" width={120} height={80} style={{ background: '#0f172a', borderRadius: 8, flexShrink: 0 }}>
                        {aoiPreviewSvgPoints ? (
                          <polygon points={aoiPreviewSvgPoints} fill="rgba(16,185,129,0.35)" stroke="#34d399" strokeWidth="3" />
                        ) : (
                          <circle cx="100" cy="65" r="14" fill="#34d399" />
                        )}
                      </svg>
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                        <div><b>{farm.area.toFixed(2)} ha</b> ({(farm.area * 2.471).toFixed(2)} ac)</div>
                        <div>Score: <b>{cond.aoiHealthScore !== null ? `${cond.aoiHealthScore}/100` : 'Pending'}</b></div>
                        <div>Pins: <b>{waypoints.length}</b> marked</div>
                      </div>
                    </div>
                    {waypoints.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: '#475569' }}>
                        <b>Named pins:</b> {waypoints.map((w) => w.label).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Direct Share Channels: Email + WhatsApp + SMS */}
                  <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <strong style={{ fontSize: 12.5 }}>Send Report via Email, WhatsApp or SMS</strong>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => window.open(getWhatsAppUri('', shareSummaryText), '_blank', 'noopener,noreferrer')}
                        style={{ flex: 1, minHeight: 42, borderRadius: 9, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                      >
                        <Share2 size={14} /> WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => { window.location.href = getNativeSmsUri('', shareSummaryText) }}
                        style={{ flex: 1, minHeight: 42, borderRadius: 9, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                      >
                        <Smartphone size={14} /> Phone SMS
                      </button>
                    </div>

                    <form onSubmit={handleSendReportEmail} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        type="email"
                        required
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        placeholder="Recipient email (e.g. name@gmail.com)"
                        style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff', color: '#0f172a' }}
                      />
                      <button
                        type="submit"
                        disabled={reportMailBusy}
                        style={{ minHeight: 38, padding: '0 12px', borderRadius: 8, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                      >
                        <Send size={13} /> {reportMailBusy ? 'Sending…' : 'Email'}
                      </button>
                    </form>

                    {reportMailErr && <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>{reportMailErr}</div>}
                    {reportMailRes && (
                      <div style={{ fontSize: 11.5, background: '#fff', border: '1px solid #bae6fd', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontWeight: 700, color: reportMailRes.delivered ? '#15803d' : '#0369a1', marginBottom: 4 }}>{reportMailRes.message}</div>
                        {reportMailRes.packageData && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <a href={reportMailRes.packageData.gmailWebUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <ExternalLink size={12} /> Gmail Web
                            </a>
                            <a href={reportMailRes.packageData.mailtoUrl} style={{ color: '#047857', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Mail size={12} /> Mail App
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                const url = URL.createObjectURL(reportMailRes.packageData!.emlBlob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = reportMailRes.packageData!.emlFilename
                                a.click()
                                URL.revokeObjectURL(url)
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#334155', fontWeight: 700, cursor: 'pointer' }}
                            >
                              .eml
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Reference / Formula / Accuracy Verification Popover */}
      {activeRef && (
        <div
          onClick={() => setActiveRef(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Data Reference and Source"
          style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: '100%', background: '#ffffff', color: '#0f172a', borderRadius: 18, padding: 22, border: '2px solid #0284c7', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 16 }}>{activeRef.parameter}</strong>
              <button type="button" onClick={() => setActiveRef(null)} aria-label={t('common.close')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div><b style={{ color: '#0369a1' }}>Dataset:</b> {activeRef.dataset}</div>
              <div><b style={{ color: '#0369a1' }}>Resolution:</b> {activeRef.resolution}</div>
              <div><b style={{ color: '#0369a1' }}>Formula:</b> <code>{activeRef.formula}</code></div>
              <div><b style={{ color: '#0369a1' }}>Observation Date:</b> {activeRef.acquisitionDate}{activeRef.cloudPct !== undefined ? ` (${activeRef.cloudPct}% cloud cover)` : ''}</div>
              {farm && <div><b style={{ color: '#0369a1' }}>Field Location:</b> {farm.lat.toFixed(5)}°, {farm.lon.toFixed(5)}°</div>}
              <p style={{ margin: '4px 0 0', padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                {activeRef.methodNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentNav="Overview"
        onNavChange={(target) => {
          if (target === 'My farms') setDrawerOpen(true)
          else if (target === 'Alerts') onOpenModal('alerts')
          else if (target === 'Reports') {
            setReportOpen(true)
            document.getElementById('lite-report-card')?.scrollIntoView({ behavior: 'smooth' })
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
        onQuickAdd={onDetectGps}
        isMapFocused={mapFocus}
        onToggleMapFocus={() => {
          setMapFocus((v) => !v)
          document.getElementById('my-farms')?.scrollIntoView({ behavior: 'smooth' })
        }}
        unreadAlertsCount={0}
      />
    </div>
  )
}
