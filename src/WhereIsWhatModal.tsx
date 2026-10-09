import { useState } from 'react'
import {
  HelpCircle,
  Network,
  Plus,
  MapPinned,
  Ruler,
  Tag,
  Activity,
  Layers3,
  Sparkles,
  Bot,
  FileText,
  ShieldCheck,
  Compass,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  X
} from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onStartMitraTour: () => void
  onOpenWalkthrough: () => void
}

export default function WhereIsWhatModal({ isOpen, onClose, onStartMitraTour, onOpenWalkthrough }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  if (!isOpen) return null

  const FEATURES = [
    {
      id: 'bridge',
      cat: 'connectivity',
      title: '🌴 Desktop GIS Bridge (QGIS & ArcGIS)',
      location: 'Top Bar (Right) → QGIS · ArcMap Button',
      desc: 'Connects your web browser directly to QGIS 3, ArcMap 10.x, and ArcGIS Pro. Includes the Coconut Tree plugin download center, local bridge server (port 8765), and SHA-256 token pairing.',
      actionLabel: 'Launch Bridge Dialog',
      actionTarget: 'gis-bridge'
    },
    {
      id: 'add-farm',
      cat: 'mapping',
      title: '🗺️ Cadastral Farm Boundary Ingestion',
      location: 'Header & Sidebar → "Add a Farm"',
      desc: 'Draw vector polygons directly on satellite basemap, walk perimeters with mobile GPS, or import GeoJSON, KML, GPX, WKT, and ESRI Shapefiles (.zip).',
      actionLabel: 'Add Farm Modal',
      actionTarget: 'add'
    },
    {
      id: 'ruler',
      cat: 'mapping',
      title: '📏 Metered Tape Ruler (Movable Anywhere)',
      location: 'Interactive Map Tools',
      desc: 'Movable & adjustable precision ruler with TradingView-style properties. Measure geodesic distances in meters/kilometers, perimeter spans, and elevation deltas anywhere on the map.',
      actionLabel: 'Scroll to Map',
      actionTarget: 'map'
    },
    {
      id: 'floating-legend',
      cat: 'legends',
      title: '🏷️ Movable Classification Legends',
      location: 'Beside All Classified Maps & GeoAI Studio',
      desc: 'Movable classification legend shortcut beside maps that is adjustable everywhere. Drag to reposition, snap beside map or top-right, minimize to a compact pill badge, and copy class values with 1 click.',
      actionLabel: 'View in GeoAI Studio',
      actionTarget: 'studio'
    },
    {
      id: 'indices',
      cat: 'analytics',
      title: '🛰️ 14 Spectral Indices Grid',
      location: 'Main Workspace → Field Intelligence Cards',
      desc: 'Full suite of Sentinel-2 indices: NDVI, EVI, SAVI, MSAVI, GNDVI, NDRE, CIre, NBR, NDWI, MNDWI, NDMI, and MSI with color-coded scale bars and stress percentiles.',
      actionLabel: 'Scroll to Indices',
      actionTarget: 'indices'
    },
    {
      id: 'symbology',
      cat: 'analytics',
      title: '🎨 Multispectral Band Symbology',
      location: 'GeoAI Studio → Band Combination Symbology',
      desc: 'Switch live Sentinel-2 band combinations: Natural True Colour (B04-B03-B02), False Colour NIR (B08-B04-B03), Agriculture (B11-B08-B02), SWIR Moisture (B11-B8A-B04), or custom composites.',
      actionLabel: 'Scroll to GeoAI',
      actionTarget: 'studio'
    },
    {
      id: 'ai-studio',
      cat: 'ai',
      title: '🤖 GeoAI In-Browser Studio',
      location: 'Analysis Lab → GeoAI Studio Tab',
      desc: 'Unsupervised K-Means++ spectral clustering and Supervised Random Forest classification executed 100% inside your browser using WebAssembly and client-side raster math.',
      actionLabel: 'Open GeoAI Studio',
      actionTarget: 'studio'
    },
    {
      id: 'swaths',
      cat: 'robotics',
      title: '🚜 Fields2Cover Machinery Swath Robotics',
      location: 'Analysis Lab → Geo Tools Tab',
      desc: 'Autonomous agricultural robotics coverage path planning (CPP). Calculates optimal swath heading, tractor working width, turning radiuses, headland passes, and fuel savings.',
      actionLabel: 'View Swath Robotics',
      actionTarget: 'geotools'
    },
    {
      id: 'reports',
      cat: 'dossier',
      title: '📑 Trilingual Agronomic Dossiers (EN / HI / TE)',
      location: 'Header & Sidebar → Reports',
      desc: 'Export print-ready PDF and standalone HTML dossiers with North arrow, scale bar, Sentinel-2 metadata, and VRA prescriptions in English, Hindi (हिन्दी), and Telugu (తెలుగు).',
      actionLabel: 'Open Reports Dialog',
      actionTarget: 'reports'
    },
    {
      id: 'data-privacy',
      cat: 'privacy',
      title: '🔒 Local-First Data Manager & Privacy',
      location: 'Sidebar → Data Manager',
      desc: 'All coordinates, farm boundaries, notes, and local configurations are stored client-side in IndexedDB / localStorage. Zero tracking, zero telemetry, zero server lock-in.',
      actionLabel: 'Open Data Manager',
      actionTarget: 'data'
    }
  ]

  const CATEGORIES = [
    { id: 'all', label: 'All Features (10)' },
    { id: 'connectivity', label: '🌴 Desktop GIS' },
    { id: 'mapping', label: '🗺️ Map & Tools' },
    { id: 'legends', label: '🏷️ Legends' },
    { id: 'analytics', label: '🛰️ Spectral' },
    { id: 'ai', label: '🤖 GeoAI' },
    { id: 'robotics', label: '🚜 Swaths' },
    { id: 'dossier', label: '📑 Reports' }
  ]

  const filtered = activeCategory === 'all' ? FEATURES : FEATURES.filter(f => f.cat === activeCategory)

  const handleAction = (target: string) => {
    onClose()
    if (target === 'map') {
      document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (target === 'indices') {
      document.querySelector('.intelligence-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (target === 'studio') {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'ai' }))
      document.querySelector('.ge-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (target === 'geotools') {
      document.querySelector('.gt-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      window.dispatchEvent(new CustomEvent('seva-open-modal', { detail: target }))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal where-is-what-modal"
        style={{ width: '880px', maxWidth: '96vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Where is what — guided quick tour directory"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '8px', background: '#ecfdf5', borderRadius: '8px', color: '#16a34a', display: 'flex' }}>
              <Compass size={22} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Where is what — Guided Quick Tour
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Complete roadmap of every tool, feature, shortcut, and capability in SEVA·GIS.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Quick Launch Buttons Banner */}
        <div style={{ display: 'flex', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12.5px', color: '#334155' }}>
            <b>Need a live on-screen spotlight walkthrough?</b> Mitra will guide you step-by-step through each interactive UI element.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="primary"
              onClick={() => {
                onClose()
                onStartMitraTour()
              }}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              Start Live Mitra Tour <ArrowRight size={13} />
            </button>
            <button
              className="outline"
              onClick={() => {
                onClose()
                onOpenWalkthrough()
              }}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              🛰️ Real Satellite Walkthrough
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '5px 11px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: activeCategory === cat.id ? 700 : 500,
                background: activeCategory === cat.id ? '#047857' : '#ffffff',
                color: activeCategory === cat.id ? '#ffffff' : '#475569',
                border: '1px solid ' + (activeCategory === cat.id ? '#047857' : '#cbd5e1'),
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
          {filtered.map(feat => (
            <div
              key={feat.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <b style={{ fontSize: '14px', color: '#0f172a' }}>{feat.title}</b>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>📍 Location:</span> <span>{feat.location}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                  {feat.desc}
                </p>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="outline compact"
                  onClick={() => handleAction(feat.actionTarget)}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                >
                  {feat.actionLabel} <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
