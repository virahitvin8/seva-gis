import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  Shield,
  Copy,
  Check,
  Undo2,
  RotateCcw,
  Bot,
  Trees,
  Layers,
  Code2,
  ExternalLink,
  ThumbsUp,
  X,
  CheckCircle2
} from 'lucide-react'

export interface SuggestionAppleItem {
  id: number
  text: string
  category: 'RustGIS Core' | '3D Terrain & LiDAR' | 'Village Cadastre' | 'AI MCP Agent' | 'General / Other'
  status: 'on_tree' | 'fallen_half_eaten' | 'completed_vanished'
  upvotes: number
  aiScore: number
  aiReason: string
  treeX: number
  treeY: number
  groundX: number
  groundY: number
}

export interface SuggestionTreeProps {
  onSignIn?: (email: string, password?: string) => void | Promise<void>
  onGuest?: () => void | Promise<void>
  initialTab?: 'signin' | 'engine' | 'blueprint'
}

const STORAGE_KEY = 'sevagis_banyan_apples_v2'

const INITIAL_APPLES: SuggestionAppleItem[] = [
  {
    id: 101,
    text: 'Embed RustGIS L1 zero-copy GeoParquet reader so Seva GIS opens 2GB village parcel files in under 40ms in the browser.',
    category: 'RustGIS Core',
    status: 'on_tree',
    upvotes: 29,
    aiScore: 98,
    aiReason: 'High-impact memory-safe RustGIS L1 data provider enhancement.',
    treeX: 28,
    treeY: 26,
    groundX: 24,
    groundY: 84
  },
  {
    id: 102,
    text: 'Compile WhiteboxTools watershed & D8 flow accumulation to WebAssembly (WASI) for offline monsoon flood mapping.',
    category: '3D Terrain & LiDAR',
    status: 'on_tree',
    upvotes: 24,
    aiScore: 96,
    aiReason: 'Leverages geolibre-rust WASI runner directly in Seva GIS.',
    treeX: 46,
    treeY: 19,
    groundX: 35,
    groundY: 86
  },
  {
    id: 103,
    text: 'Add a natural-language MCP relay (rustgis-cli mcp) so panchayat officers can ask "Highlight drought-prone plots within 500m of canals".',
    category: 'AI MCP Agent',
    status: 'on_tree',
    upvotes: 37,
    aiScore: 97,
    aiReason: 'Directly maps to RustGIS L5 rustgis-assistant CommandSpec architecture.',
    treeX: 64,
    treeY: 17,
    groundX: 48,
    groundY: 85
  },
  {
    id: 104,
    text: 'Support instant Shapefile (.zip) and Cloud-Optimized GeoTIFF (COG) drag-and-drop on the Seva GIS Sign-In preview map.',
    category: 'Village Cadastre',
    status: 'on_tree',
    upvotes: 19,
    aiScore: 92,
    aiReason: 'Core L1 raster/vector zero-upload privacy feature.',
    treeX: 81,
    treeY: 24,
    groundX: 62,
    groundY: 86
  },
  {
    id: 105,
    text: 'Use wgpu hardware acceleration for smooth 3D terrain extrusion of rural elevation models on low-end laptops.',
    category: '3D Terrain & LiDAR',
    status: 'on_tree',
    upvotes: 21,
    aiScore: 94,
    aiReason: 'Uses RustGIS L3 tiny-skia / wgpu rendering backend.',
    treeX: 37,
    treeY: 33,
    groundX: 42,
    groundY: 88
  },
  {
    id: 106,
    text: 'Enable offline PMTiles basemaps with Indian regional language labels using RustGIS i18n catalog.',
    category: 'Village Cadastre',
    status: 'on_tree',
    upvotes: 31,
    aiScore: 95,
    aiReason: 'Matches RustGIS L2 rustgis-tiles + 16-language i18n system.',
    treeX: 73,
    treeY: 32,
    groundX: 74,
    groundY: 85
  },
  {
    id: 107,
    text: 'Replace all GIS map layers with a 3D racing car game and loud disco horns.',
    category: 'General / Other',
    status: 'fallen_half_eaten',
    upvotes: 1,
    aiScore: 12,
    aiReason: 'Flagged by Agentic AI as off-topic / not worth implementing for Seva GIS.',
    treeX: 54,
    treeY: 28,
    groundX: 29,
    groundY: 86
  },
  {
    id: 108,
    text: 'Delete all coordinate systems and make every polygon spin randomly when clicked.',
    category: 'General / Other',
    status: 'fallen_half_eaten',
    upvotes: 0,
    aiScore: 8,
    aiReason: 'Flagged by Admin & Agentic AI as unhelpful / not worth implementing.',
    treeX: 21,
    treeY: 31,
    groundX: 79,
    groundY: 87
  }
]

const INITIAL_COMPLETED = [
  { id: 99, text: 'Strict #[deny(unsafe_code)] memory safety in Seva GIS core', category: 'RustGIS Core' },
  { id: 100, text: 'CommandSpec undo/redo stack for every map edit', category: 'RustGIS Core' }
]

function generateCanopyPosition(index: number) {
  const goldenAngle = 2.399963229728653
  const theta = index * goldenAngle
  const normR = Math.sqrt((index % 64) + 1) / 8.2
  const clampedR = Math.min(0.95, 0.18 + normR * 0.77)
  const cx = 50 + Math.cos(theta) * (35 * clampedR)
  const cy = 25 + Math.sin(theta) * (13.5 * clampedR)
  return {
    treeX: Math.max(13, Math.min(87, Number(cx.toFixed(2)))),
    treeY: Math.max(10, Math.min(41, Number(cy.toFixed(2)))),
    groundX: Number((15 + ((index * 19) % 70)).toFixed(2)),
    groundY: Number((82 + ((index * 7) % 10)).toFixed(2))
  }
}

function evaluateSuggestionWorth(text: string) {
  const lower = text.toLowerCase()
  const lowValueKeywords = [
    'candy crush', 'disco', 'spin 360', 'spinning', 'racing car', 'flappy bird',
    'useless', 'spam', 'meme', 'delete all', 'crash', 'joke', 'nothing', 'blah', 'asdf'
  ]
  const highValueKeywords = [
    'rust', 'wasm', 'webassembly', 'lidar', 'geoparquet', 'shapefile', 'cog',
    'geotiff', 'watershed', 'buffer', 'voronoi', 'cadastre', 'village', 'offline',
    'duckdb', 'postgis', 'tile', '3d', 'globe', 'mcp', 'agent', 'symbology', 'layer', 'map'
  ]

  for (let i = 0; i < lowValueKeywords.length; i++) {
    if (lower.includes(lowValueKeywords[i]) || lower.trim().length < 8) {
      return {
        score: 14,
        worthy: false,
        reason: 'Agentic Triage: Off-topic or counterproductive for Seva GIS geospatial workflows.'
      }
    }
  }

  let bonus = 0
  highValueKeywords.forEach(kw => {
    if (lower.includes(kw)) bonus += 6
  })
  const finalScore = Math.min(99, 76 + bonus)
  return {
    score: finalScore,
    worthy: true,
    reason: 'Agentic Triage: Valuable geospatial improvement aligned with Seva GIS & RustGIS.'
  }
}

export default function SuggestionTree({ onSignIn, onGuest, initialTab = 'signin' }: SuggestionTreeProps) {
  // Navigation & role state
  const [activeTab, setActiveTab] = useState<'signin' | 'engine' | 'blueprint'>(initialTab)
  const [isAdminMode, setIsAdminMode] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedAppleId, setSelectedAppleId] = useState<number | null>(null)
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en')

  // Apples state
  const [apples, setApples] = useState<SuggestionAppleItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return INITIAL_APPLES
  })

  const [completedHistory, setCompletedHistory] = useState<{ id: number; text: string; category: string }[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '_completed')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return INITIAL_COMPLETED
  })

  const [newlySpawnedId, setNewlySpawnedId] = useState<number | null>(null)
  const [fallingAppleId, setFallingAppleId] = useState<number | null>(null)
  const [vanishingAppleId, setVanishingAppleId] = useState<number | null>(null)

  // Suggestion form input
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionCategory, setSuggestionCategory] = useState<SuggestionAppleItem['category']>('RustGIS Core')

  // Sign-in form state
  const [loginEmail, setLoginEmail] = useState('admin@sevagis.org')
  const [loginPassword, setLoginPassword] = useState('••••••••••••')
  const [loginRuntime, setLoginRuntime] = useState('wasm-wgpu')
  const [loginRemember, setLoginRemember] = useState(true)
  const [signInFeedback, setSignInFeedback] = useState<string | null>(null)

  // Map sandbox state
  const [mapCommandStack, setMapCommandStack] = useState<string[]>(['init'])
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'rustgis-cli mcp --attach 127.0.0.1:8767 # Ready',
    'Loaded Seva_Villages.geojson (5 features, EPSG:3857)'
  ])
  const [frameTime, setFrameTime] = useState<string>('0.82 ms')

  // Code blueprint tab
  const [activeCodeKey, setActiveCodeKey] = useState<'rust_wasm' | 'cargo_toml' | 'python_mcp'>('rust_wasm')
  const [copiedCode, setCopiedCode] = useState(false)

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playSound = useCallback((type: 'spawn' | 'click' | 'vanish' | 'fall_crunch') => {
    if (!soundEnabled || typeof window === 'undefined') return
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }
      const now = ctx.currentTime

      if (type === 'spawn') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(360, now)
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.14)
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.28)
        gain.gain.setValueAtTime(0.16, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.33)
      } else if (type === 'click') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(520, now)
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.08)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.11)
      } else if (type === 'vanish') {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + idx * 0.06)
          gain.gain.setValueAtTime(0.12, now + idx * 0.06)
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.24)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + idx * 0.06)
          osc.stop(now + idx * 0.06 + 0.25)
        })
      } else if (type === 'fall_crunch') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(620, now)
        osc.frequency.exponentialRampToValueAtTime(135, now + 0.45)
        gain.gain.setValueAtTime(0.11, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.5)
      }
    } catch {}
  }, [soundEnabled])

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apples))
      localStorage.setItem(STORAGE_KEY + '_completed', JSON.stringify(completedHistory))
    } catch {}
  }, [apples, completedHistory])

  // Canvas atmosphere animation ref
  const atmoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = atmoCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sparkles: { x: number; y: number; r: number; vx: number; vy: number; phase: number }[] = []
    for (let i = 0; i < 36; i++) {
      sparkles.push({
        x: Math.random() * 1400,
        y: Math.random() * 640,
        r: 1.8 + Math.random() * 2.8,
        vx: -0.25 + Math.random() * 0.5,
        vy: -0.35 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      })
    }

    const resize = () => {
      if (!canvas.parentElement) return
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = Math.max(320, rect.width)
      canvas.height = Math.max(480, rect.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let animId = 0
    const animate = (ts: number) => {
      if (ctx && canvas.width > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < sparkles.length; i++) {
          const p = sparkles[i]
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0) p.x = canvas.width
          if (p.x > canvas.width) p.x = 0
          if (p.y < 0) p.y = canvas.height
          if (p.y > canvas.height) p.y = 0

          const alpha = 0.35 + 0.55 * Math.sin(ts * 0.003 + p.phase)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(254, 249, 195, ${alpha.toFixed(2)})`
          ctx.fill()
        }
      }
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [activeTab])

  // Map canvas drawing simulation
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (activeTab !== 'engine') return
    const canvas = mapCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.parentElement?.getBoundingClientRect()
    canvas.width = Math.max(300, rect?.width || 600)
    canvas.height = Math.max(320, rect?.height || 400)
    const w = canvas.width
    const h = canvas.height

    const villages = [
      { name: 'Nellore North Hub', x: 0.25, y: 0.35, pop: 8400 },
      { name: 'Penna River Basin', x: 0.52, y: 0.48, pop: 14200 },
      { name: 'Kovur Canal Sector', x: 0.38, y: 0.68, pop: 6300 },
      { name: 'Coastal Cyclone Shelter', x: 0.76, y: 0.32, pop: 11900 },
      { name: 'South Tank Watershed', x: 0.68, y: 0.72, pop: 9100 }
    ]

    // Basemap background grid
    ctx.fillStyle = '#091526'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'
    ctx.lineWidth = 1
    for (let gx = 0; gx < w; gx += 44) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
    }
    for (let gy = 0; gy < h; gy += 44) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
    }

    const hasWatershed = mapCommandStack.includes('watershed')
    const hasVoronoi = mapCommandStack.includes('voronoi')
    const hasBuffer = mapCommandStack.includes('buffer')
    const hasGraduated = mapCommandStack.includes('graduated')
    const hasGeoParquet = mapCommandStack.includes('geoparquet')

    // Watershed stream
    if (hasWatershed) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(w * 0.08, h * 0.22)
      ctx.bezierCurveTo(w * 0.35, h * 0.38, w * 0.52, h * 0.52, w * 0.92, h * 0.58)
      ctx.stroke()
    }

    // GeoParquet parcels
    if (hasGeoParquet) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)'
      for (let px = 0; px < 5; px++) {
        for (let py = 0; py < 3; py++) {
          const rx = w * 0.18 + px * (w * 0.13)
          const ry = h * 0.2 + py * (h * 0.2)
          ctx.fillRect(rx, ry, w * 0.11, h * 0.16)
          ctx.strokeRect(rx, ry, w * 0.11, h * 0.16)
        }
      }
    }

    // Voronoi network mesh
    if (hasVoronoi) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)'
      ctx.lineWidth = 1.8
      for (let i = 0; i < villages.length; i++) {
        for (let j = i + 1; j < villages.length; j++) {
          ctx.beginPath()
          ctx.moveTo(villages[i].x * w, villages[i].y * h)
          ctx.lineTo(villages[j].x * w, villages[j].y * h)
          ctx.stroke()
        }
      }
    }

    // Villages & Buffers
    villages.forEach(v => {
      const vx = v.x * w
      const vy = v.y * h

      if (hasBuffer) {
        ctx.beginPath()
        ctx.arc(vx, vy, 46, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(249, 115, 22, 0.22)'
        ctx.fill()
        ctx.strokeStyle = '#fb923c'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      const radius = hasGraduated ? Math.max(8, v.pop / 750) : 9
      ctx.beginPath()
      ctx.arc(vx, vy, radius, 0, Math.PI * 2)
      ctx.fillStyle = hasGraduated ? '#c084fc' : '#38bdf8'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#f8fafc'
      ctx.font = '600 12px Inter, sans-serif'
      ctx.fillText(`${v.name} (${v.pop.toLocaleString()})`, vx + 14, vy + 4)
    })

    setFrameTime(`${(0.4 + Math.random() * 0.4).toFixed(2)} ms`)
  }, [activeTab, mapCommandStack])

  // Apple submission handler
  const handleAddApple = (text: string, category: SuggestionAppleItem['category']) => {
    const cleanText = text.trim()
    if (!cleanText) return

    const maxId = apples.reduce((max, a) => Math.max(max, a.id), 108)
    const newId = maxId + 1
    const coords = generateCanopyPosition(apples.length + 3)
    const evaluation = evaluateSuggestionWorth(cleanText)

    const newApple: SuggestionAppleItem = {
      id: newId,
      text: cleanText,
      category,
      status: 'on_tree',
      upvotes: 1,
      aiScore: evaluation.score,
      aiReason: evaluation.reason,
      treeX: coords.treeX,
      treeY: coords.treeY,
      groundX: coords.groundX,
      groundY: coords.groundY
    }

    setApples(prev => [newApple, ...prev])
    setNewlySpawnedId(newId)
    setSelectedAppleId(newId)
    playSound('spawn')

    setTimeout(() => {
      setNewlySpawnedId(null)
    }, 1200)
  }

  // Fall to grass animation
  const handleFallApple = (appleId: number) => {
    const target = apples.find(a => a.id === appleId)
    if (!target || target.status !== 'on_tree') return

    playSound('fall_crunch')
    setFallingAppleId(appleId)

    setTimeout(() => {
      setApples(prev => prev.map(a => a.id === appleId ? { ...a, status: 'fallen_half_eaten' } : a))
      setFallingAppleId(null)
    }, 780)
  }

  // Done / Vanish animation
  const handleVanishApple = (appleId: number) => {
    const target = apples.find(a => a.id === appleId)
    if (!target) return

    playSound('vanish')
    setVanishingAppleId(appleId)

    setTimeout(() => {
      setApples(prev => prev.map(a => a.id === appleId ? { ...a, status: 'completed_vanished' } : a))
      setCompletedHistory(prev => [
        { id: target.id, text: target.text, category: target.category },
        ...prev
      ])
      setVanishingAppleId(null)
      setSelectedAppleId(null)
    }, 750)
  }

  // Re-hang apple
  const handleRestoreApple = (appleId: number) => {
    const target = apples.find(a => a.id === appleId)
    if (!target) return
    playSound('spawn')
    setApples(prev => prev.map(a => a.id === appleId ? { ...a, status: 'on_tree' } : a))
    setNewlySpawnedId(appleId)
    setTimeout(() => setNewlySpawnedId(null), 1000)
  }

  // Agentic auto-judge
  const handleAgenticTriage = () => {
    const unworthyOnTree = apples.filter(a => a.status === 'on_tree' && a.aiScore < 50)
    if (unworthyOnTree.length === 0) {
      handleAddApple(
        'Spam suggestion: replace village water table map with a meme generator.',
        'General / Other'
      )
      setTimeout(() => {
        const last = apples[0]
        if (last) handleFallApple(last.id)
      }, 600)
      return
    }

    unworthyOnTree.forEach((apple, idx) => {
      setTimeout(() => {
        handleFallApple(apple.id)
      }, idx * 300)
    })
  }

  // Burst +5 apples
  const handleBurstApples = () => {
    const extraSamples: { t: string; c: SuggestionAppleItem['category'] }[] = [
      { t: 'Add COPC LiDAR point-cloud elevation slicing in browser via WebGPU.', c: '3D Terrain & LiDAR' },
      { t: 'Expose rustgis-cli MCP server so field engineers can script map exports.', c: 'AI MCP Agent' },
      { t: 'Support live PostGIS & DuckDB Spatial SQL queries for district water tables.', c: 'RustGIS Core' },
      { t: 'Add Telugu, Hindi, and Tamil ribbon translations in RustGIS i18n TSV catalog.', c: 'Village Cadastre' },
      { t: 'Include FlatGeobuf spatial bounding-box streaming over 3G rural networks.', c: 'RustGIS Core' }
    ]

    extraSamples.forEach((item, idx) => {
      setTimeout(() => {
        handleAddApple(item.t, item.c)
      }, idx * 120)
    })
  }

  // Code Blueprint data
  const CODE_SNIPPETS = {
    rust_wasm: `//! crates/seva-rustgis-wasm/src/lib.rs
//! Pure-Rust Geospatial Engine for Seva GIS (following opengeos/RustGIS L0-L5 architecture)
#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use geo::{Area, BooleanOps, Buffer, EuclideanDistance, MultiPolygon, Point, Polygon};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppleStatus {
    ShiningOnTree,
    ImplementedAndVanished,
    RejectedHalfEatenOnGrass,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionApple {
    pub id: u64,
    pub anonymous_query: String,
    pub category: String,
    pub status: AppleStatus,
    pub agentic_worth_score: u8,
    pub canopy_xy: (f64, f64),
    pub ground_xy: (f64, f64),
}

#[wasm_bindgen]
pub struct SevaRustGisSession {
    apples: Vec<SuggestionApple>,
    command_history: Vec<String>,
}

#[wasm_bindgen]
impl SevaRustGisSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { apples: Vec::new(), command_history: Vec::new() }
    }

    /// Anonymous user plants a new shining apple on the Banyan Tree (no limit)
    pub fn plant_suggestion_apple(&mut self, query: &str, category: &str) -> u64 {
        let id = (self.apples.len() as u64) + 1;
        let score = Self::agentic_score_query(query);
        self.apples.push(SuggestionApple {
            id,
            anonymous_query: query.trim().to_string(),
            category: category.to_string(),
            status: AppleStatus::ShiningOnTree,
            agentic_worth_score: score,
            canopy_xy: (50.0, 24.0),
            ground_xy: (35.0, 86.0),
        });
        id
    }

    /// Admin marks suggestion as Done -> Apple vanishes from tree
    pub fn admin_mark_implemented(&mut self, apple_id: u64) -> bool {
        if let Some(apple) = self.apples.iter_mut().find(|a| a.id == apple_id) {
            apple.status = AppleStatus::ImplementedAndVanished;
            return true;
        }
        false
    }

    /// Admin or Agentic AI marks suggestion as Not Worth It -> Falls & becomes Half-Eaten
    pub fn admin_or_agent_reject(&mut self, apple_id: u64) -> bool {
        if let Some(apple) = self.apples.iter_mut().find(|a| a.id == apple_id) {
            apple.status = AppleStatus::RejectedHalfEatenOnGrass;
            return true;
        }
        false
    }

    fn agentic_score_query(q: &str) -> u8 {
        if q.len() < 8 || q.to_lowercase().contains("spam") { 15 } else { 94 }
    }
}`,
    cargo_toml: `# Cargo.toml — Seva GIS Workspace integrating opengeos/RustGIS & GeoRust Crates
[workspace]
members = ["crates/seva-geom", "crates/seva-data", "crates/seva-analysis", "crates/seva-rustgis-wasm"]
resolver = "2"

[workspace.dependencies]
# Core GeoRust & opengeos/RustGIS stack
geo = "0.29"
geo-types = "0.7"
geojson = "0.24"
geoarrow = "0.3"
parquet = { version = "53.0", default-features = false }
proj4rs = "0.1"              # Pure-Rust EPSG coordinate reprojection (wasm-compatible)
tiny-skia = "0.11"           # Pure-Rust 2D map rasterizer
wgpu = "22.0"                # Cross-platform GPU map & 3D globe rendering
wasmi = "0.40"               # Sandboxed WebAssembly plugin runtime (.rgplugin)
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[workspace.lints.rust]
unsafe_code = "forbid"

[workspace.lints.clippy]
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"`,
    python_mcp: `# seva_backend.py — Python FastAPI + rustgis in-process session & Banyan Apple Tree API
from fastapi import FastAPI
from pydantic import BaseModel
import rustgis  # pip install rustgis (opengeos/RustGIS Python bindings)

app = FastAPI(title="Seva GIS Portal & Banyan Suggestion Tree API")
gis_session = rustgis.Session(sample=False)

class AnonymousSuggestion(BaseModel):
    query: str
    category: str = "RustGIS Core"

@app.post("/api/banyan-tree/apples")
def plant_anonymous_apple(payload: AnonymousSuggestion):
    """Stores any random user suggestion as a shining apple on the Sign-In Banyan Tree."""
    return {
        "status": "on_tree",
        "anonymous": True,
        "query": payload.query,
        "category": payload.category,
    }

@app.post("/api/rustgis/command")
def execute_rustgis_command(tool: str, input_layer: str, distance: float = 100.0):
    """Dispatches a deterministic CommandSpec to the embedded RustGIS L4 engine."""
    gis_session.run("gp.run", tool=tool, params={"input": input_layer, "distance": distance})
    gdf = gis_session.layer(f"{input_layer}_Buffer").to_geopandas()
    return {"features_count": len(gdf), "crs": str(gdf.crs)}`
  }

  const handleCopyCode = () => {
    const text = CODE_SNIPPETS[activeCodeKey]
    try {
      void navigator.clipboard.writeText(text)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {}
  }

  // Filtered apples
  const onTreeApples = apples.filter(a => a.status === 'on_tree')
  const fallenApples = apples.filter(a => a.status === 'fallen_half_eaten')
  const visibleApples = apples.filter(a => {
    if (a.status === 'completed_vanished') return false
    if (activeFilter !== 'all' && a.category !== activeFilter) return false
    return true
  })

  const selectedApple = apples.find(a => a.id === selectedAppleId)

  // Scale down slightly if 45+ apples
  const scaleFactor = onTreeApples.length > 45 ? Math.max(0.68, 1 - (onTreeApples.length - 45) * 0.005) : 1

  return (
    <section className="w-full bg-slate-950 text-slate-100 flex flex-col border-t-2 border-emerald-500/30 overflow-hidden font-sans">
      {/* ===================================================================== */}
      {/* TOP NAVIGATION BAR                                                    */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Core Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-red-500 to-amber-500 p-0.5 shadow-lg shadow-orange-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3.6 9h16.8M3.6 15h16.8" />
                  <path d="M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Seva GIS</span>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold">
                  RustGIS L0–L6 Core
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Pure-Rust WebAssembly Geospatial Engine &amp; Community Suggestion Orchard
              </p>
            </div>
          </div>

          {/* Main View Switcher Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'signin'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              🍎 Sign-In &amp; Banyan Apple Tree
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('engine')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'engine'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              🦀 Live RustGIS Sandbox
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blueprint')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'blueprint'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              ⚙️ Reverse-Engineered Code
            </button>
          </nav>

          {/* Controls: Role Switcher & Audio */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdminMode(!isAdminMode)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-amber-500/15 border-amber-400/50 text-amber-200 hover:bg-amber-500/25"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isAdminMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
              <span>{isAdminMode ? 'Role: Admin & Agentic AI (Active)' : 'Role: Random Visitor (View & Plant Only)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Cartoon Sound Effects"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden md:inline">{soundEnabled ? 'SFX On' : 'Muted'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* VIEW 1: SIGN-IN + 3D CARTOON BANYAN APPLE SUGGESTION TREE             */}
      {/* ===================================================================== */}
      {activeTab === 'signin' && (
        <main className="flex-1 flex flex-col">
          {/* Top Section: Sign-in Card + Suggestion Seeder */}
          <section className="max-w-7xl w-full mx-auto px-4 pt-6 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* LEFT: SEVA GIS SIGN-IN CARD (5 Cols) */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-36 h-36 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      wasm32-unknown-unknown Ready
                    </span>
                    <span className="text-xs font-mono text-slate-400">v2.4.0-rustgis</span>
                  </div>

                  <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                    Sign in to Seva GIS Portal
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mb-5">
                    Powered by our reverse-engineered <strong className="text-orange-300">RustGIS L0–L6</strong> architecture: zero-copy GeoParquet/COG loading, 1,000+ Whitebox/GeoLibre tools, and GPU rendering.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setSignInFeedback(`Authenticated as ${loginEmail} (${loginRuntime})!`)
                      playSound('spawn')
                      if (onSignIn) {
                        void onSignIn(loginEmail, loginPassword)
                      }
                    }}
                    className="space-y-3.5"
                  >
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Seva GIS ID / Official Email
                      </label>
                      <input
                        type="text"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                        placeholder="name@sevagis.org"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Passkey / Token
                        </label>
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Compute Runtime
                        </label>
                        <select
                          value={loginRuntime}
                          onChange={(e) => setLoginRuntime(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                        >
                          <option value="wasm-wgpu">RustGIS WebAssembly + wgpu</option>
                          <option value="mcp-relay">RustGIS MCP Local Relay (:8767)</option>
                          <option value="python-session">PyO3 rustgis.Session Bridge</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={loginRemember}
                          onChange={(e) => setLoginRemember(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0"
                        />
                        Keep local DuckDB Spatial &amp; PMTiles cache offline
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-400 hover:to-red-400 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <span>🚀 Launch Seva GIS × RustGIS Workspace</span>
                    </button>
                  </form>
                </div>

                {signInFeedback && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between">
                    <span>{signInFeedback}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('engine')}
                      className="underline font-bold ml-2 text-emerald-300 hover:text-white"
                    >
                      Open Map →
                    </button>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>🔒 Memory-Safe: <code className="text-orange-300">#[deny(unsafe_code)]</code></span>
                  <span>Scroll down for the 3D Apple Suggestion Tree ↓</span>
                </div>
              </div>

              {/* RIGHT: ANONYMOUS SUGGESTION SEEDER (7 Cols) */}
              <div className="lg:col-span-7 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-400/40">
                      🍎 Anonymous Community Suggestion Orchard
                    </span>
                    <span className="text-xs font-semibold text-emerald-300">
                      100% Anonymous • No Login or Name Needed • Unlimited Apples!
                    </span>
                  </div>

                  <h2 className="font-cartoon text-2xl sm:text-3xl font-bold text-white tracking-wide mb-1">
                    Type Any Idea to Grow a Shining Apple on Our Banyan Tree!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4">
                    Every query or feature request you type below automatically turns into a <strong className="text-red-300">3D-painted shining apple</strong> hanging on the giant Banyan tree below. Anyone on the Sign-In page can click an apple to read it!
                  </p>

                  {/* Suggestion Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAddApple(suggestionText, suggestionCategory)
                      setSuggestionText('')
                    }}
                    className="space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex-1">
                        <label htmlFor="suggestionInputReact" className="sr-only">Your Suggestion for Seva GIS</label>
                        <input
                          id="suggestionInputReact"
                          type="text"
                          required
                          maxLength={220}
                          value={suggestionText}
                          onChange={(e) => setSuggestionText(e.target.value)}
                          placeholder="Type any suggestion or query for Seva GIS (no name needed)... e.g., Add offline LiDAR watershed tool in RustGIS!"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border-2 border-emerald-500/50 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400 shadow-inner"
                        />
                      </div>
                      <select
                        value={suggestionCategory}
                        onChange={(e) => setSuggestionCategory(e.target.value as SuggestionAppleItem['category'])}
                        className="px-3 py-3 rounded-xl bg-slate-950/90 border-2 border-emerald-500/40 text-xs sm:text-sm font-semibold text-emerald-200 focus:outline-none focus:border-yellow-400"
                      >
                        <option value="RustGIS Core">🦀 RustGIS Core</option>
                        <option value="3D Terrain & LiDAR">🏔️ 3D Terrain &amp; LiDAR</option>
                        <option value="Village Cadastre">🗺️ Village Cadastre</option>
                        <option value="AI MCP Agent">🤖 AI MCP Agent</option>
                        <option value="General / Other">✨ General / Other</option>
                      </select>
                      <button
                        type="submit"
                        className="cartoon-btn-primary px-5 py-3 rounded-xl font-cartoon font-bold text-base text-white whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        <span>🍎 Grow Shining Apple!</span>
                      </button>
                    </div>
                  </form>

                  {/* Presets */}
                  <div className="mt-4 pt-3 border-t border-emerald-500/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-emerald-200">⚡ Quick-Test Presets (Click to spawn apples immediately):</span>
                      <span className="text-[11px] text-slate-400">No limit on apples — click as many times as you like!</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddApple('Stream rural cadastral parcels in zero-copy GeoParquet format using RustGIS L1 provider.', 'Village Cadastre')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 transition"
                      >
                        + Good Idea: Zero-Copy GeoParquet Cadastral Parcels
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddApple('Run WhiteboxTools D-Infinity flow accumulation in WebAssembly for check-dam site selection.', '3D Terrain & LiDAR')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 transition"
                      >
                        + Good Idea: WASI Whitebox Flood Inundation Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddApple('Add a Candy Crush mini-game popup every time a surveyor clicks a village boundary.', 'General / Other')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition"
                      >
                        + Unworthy Idea: Add Candy Crush mini-game to map
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddApple('Make the map spin 360 degrees continuously with disco lights.', 'General / Other')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition"
                      >
                        + Unworthy Idea: Make map spin 360° every 3 seconds
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Orchard Counters & Agentic Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 font-semibold">
                      🍎 Shining on Tree: <strong className="text-white">{onTreeApples.length}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 font-semibold">
                      🥀 Half-Eaten on Grass (Not Worth It): <strong className="text-white">{fallenApples.length}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-semibold">
                      ✨ Implemented &amp; Vanished: <strong className="text-white">{completedHistory.length}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAgenticTriage}
                      className="cartoon-btn-amber px-3.5 py-1.5 rounded-xl font-cartoon font-bold text-xs flex items-center gap-1.5"
                    >
                      <Bot size={14} />
                      <span>Agentic AI Auto-Judge Apples</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBurstApples}
                      className="cartoon-btn-green px-3 py-1.5 rounded-xl font-cartoon font-bold text-xs text-white flex items-center gap-1"
                    >
                      <Trees size={14} />
                      <span>+5 Random Apples</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =================================================================== */}
          {/* BOTTOM: 3D-PAINTED CARTOON BANYAN APPLE SUGGESTION TREE             */}
          {/* =================================================================== */}
          <section className="max-w-7xl w-full mx-auto px-4 pb-8 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌳</span>
                <h3 className="font-cartoon text-lg sm:text-xl font-bold text-amber-300 tracking-wide">
                  Seva GIS Banyan Suggestion Tree (Click Any Shining Apple or Fallen Half-Eaten Apple!)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white"></span> Shining Apple = Active User Suggestion</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-400 border border-white"></span> Admin Done = Sparkles &amp; Disappears</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-amber-300 border border-amber-900"></span> Not Worth It = Falls &amp; Half-Eaten on Grass</span>
              </div>
            </div>

            {/* THE 3D PAINTED CARTOON WORLD CONTAINER */}
            <div className="cartoon-scene-wrapper rounded-3xl w-full min-h-[600px] sm:min-h-[660px] select-none relative">
              {/* Ambient Floating Sunbeams & Fireflies Canvas */}
              <canvas
                ref={atmoCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* 3D-PAINTED CARTOON SVG BACKGROUND */}
              <svg
                viewBox="0 0 1400 760"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-[600px] sm:h-[660px] block pointer-events-none"
              >
                <defs>
                  {/* Sun Glow */}
                  <radialGradient id="sunGlowGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fffbeb" stopOpacity="1" />
                    <stop offset="35%" stopColor="#fde047" stopOpacity="0.9" />
                    <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </radialGradient>

                  {/* 3D Painted Bark Gradient */}
                  <linearGradient id="banyanBark3D" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b1d0e" />
                    <stop offset="22%" stopColor="#6b3416" />
                    <stop offset="48%" stopColor="#9a4e24" />
                    <stop offset="68%" stopColor="#7c3a19" />
                    <stop offset="88%" stopColor="#4e230d" />
                    <stop offset="100%" stopColor="#2b1206" />
                  </linearGradient>

                  <linearGradient id="banyanBarkHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#d97706" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#92400e" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
                  </linearGradient>

                  <linearGradient id="aerialRootGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3f1d0b" />
                    <stop offset="45%" stopColor="#85421e" />
                    <stop offset="100%" stopColor="#2e1508" />
                  </linearGradient>

                  {/* 3D Canopy Gradients */}
                  <radialGradient id="canopyDeepGrad" cx="50%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#16a34a" />
                    <stop offset="60%" stopColor="#15803d" />
                    <stop offset="100%" stopColor="#052e16" />
                  </radialGradient>

                  <radialGradient id="canopyMidGrad" cx="45%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="45%" stopColor="#22c55e" />
                    <stop offset="85%" stopColor="#15803d" />
                    <stop offset="100%" stopColor="#064e3b" />
                  </radialGradient>

                  <radialGradient id="canopySunlitGrad" cx="40%" cy="25%" r="60%">
                    <stop offset="0%" stopColor="#d9f99d" />
                    <stop offset="30%" stopColor="#86efac" />
                    <stop offset="70%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#166534" />
                  </radialGradient>

                  <linearGradient id="meadowBackHill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>

                  <linearGradient id="meadowFrontHill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a3e635" />
                    <stop offset="35%" stopColor="#4ade80" />
                    <stop offset="80%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#065f46" />
                  </linearGradient>

                  <filter id="paintedShadow" x="-15%" y="-15%" width="130%" height="135%">
                    <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#052e16" floodOpacity="0.55" />
                  </filter>
                  <filter id="trunkShadow" x="-15%" y="-10%" width="130%" height="125%">
                    <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#1a0c04" floodOpacity="0.65" />
                  </filter>
                </defs>

                {/* 1. GOLDEN SUN & RAYS */}
                <g>
                  <circle cx="160" cy="110" r="145" fill="url(#sunGlowGrad)" />
                  <circle cx="160" cy="110" r="56" fill="#fef08a" stroke="#f59e0b" strokeWidth="5" />
                  <ellipse cx="144" cy="92" rx="18" ry="10" transform="rotate(-25 144 92)" fill="#ffffff" opacity="0.75" />
                </g>

                {/* 2. PUFFY CARTOON CLOUDS */}
                <g className="cloud-anim-1" opacity="0.92">
                  <path d="M90 190 Q90 160 120 160 Q135 135 168 140 Q198 130 215 158 Q245 160 245 186 Q245 210 215 210 L115 210 Q90 210 90 190 Z" fill="#ffffff" stroke="#bae6fd" strokeWidth="4" />
                  <ellipse cx="155" cy="160" rx="35" ry="12" fill="#f0f9ff" />
                </g>
                <g className="cloud-anim-2" opacity="0.9">
                  <path d="M1080 135 Q1080 105 1112 105 Q1132 78 1170 84 Q1205 74 1225 104 Q1258 106 1258 134 Q1258 158 1222 158 L1108 158 Q1080 158 1080 135 Z" fill="#ffffff" stroke="#bae6fd" strokeWidth="4" />
                </g>

                {/* 3. DISTANT ROLLING HILLS */}
                <path d="M-40 560 Q220 455 540 520 T1120 495 Q1290 475 1440 535 L1440 760 L-40 760 Z" fill="url(#meadowBackHill)" stroke="#14532d" strokeWidth="4" />

                {/* 4. AERIAL PROP ROOTS */}
                <g className="aerial-root-sway">
                  <path d="M310 310 C295 410, 280 510, 260 615 L286 620 C298 515, 312 415, 330 315 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3.5" />
                  <path d="M365 330 C358 430, 345 520, 335 605 L354 608 C362 520, 372 430, 382 332 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3" />
                  <path d="M235 340 C225 430, 210 515, 192 605 L210 608 C225 520, 238 432, 248 342 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3" />
                  <path d="M1065 315 C1080 415, 1095 510, 1118 615 L1092 620 C1075 515, 1060 415, 1045 320 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3.5" />
                  <path d="M1005 330 C1015 430, 1025 520, 1038 605 L1018 608 C1008 520, 998 430, 988 332 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3" />
                  <path d="M1145 340 C1155 430, 1170 515, 1188 605 L1170 608 C1155 520, 1142 432, 1132 342 Z" fill="url(#aerialRootGrad)" stroke="#2b1206" strokeWidth="3" />
                  <path d="M450 320 Q442 410 448 485" stroke="#5c2d16" strokeWidth="6" strokeLinecap="round" fill="none" />
                  <path d="M468 335 Q462 400 465 455" stroke="#7c3a19" strokeWidth="4" strokeLinecap="round" fill="none" />
                  <path d="M930 320 Q938 410 932 490" stroke="#5c2d16" strokeWidth="6" strokeLinecap="round" fill="none" />
                  <path d="M910 335 Q916 405 912 460" stroke="#7c3a19" strokeWidth="4" strokeLinecap="round" fill="none" />
                </g>

                {/* 5. DEEP CANOPY FOLIAGE */}
                <g className="canopy-sway" filter="url(#paintedShadow)">
                  <ellipse cx="300" cy="275" rx="220" ry="125" fill="url(#canopyDeepGrad)" stroke="#052e16" strokeWidth="5" />
                  <ellipse cx="1100" cy="275" rx="220" ry="125" fill="url(#canopyDeepGrad)" stroke="#052e16" strokeWidth="5" />
                  <ellipse cx="700" cy="210" rx="460" ry="165" fill="url(#canopyDeepGrad)" stroke="#052e16" strokeWidth="5" />
                  <ellipse cx="460" cy="295" rx="270" ry="120" fill="url(#canopyDeepGrad)" />
                  <ellipse cx="940" cy="295" rx="270" ry="120" fill="url(#canopyDeepGrad)" />
                </g>

                {/* 6. GIANT BANYAN TRUNK & ROOTS */}
                <g filter="url(#trunkShadow)">
                  <path d="M650 380 C530 340, 360 315, 210 285 L230 245 C390 275, 550 295, 675 330 Z" fill="url(#banyanBark3D)" stroke="#2b1206" strokeWidth="4.5" />
                  <path d="M750 380 C870 340, 1040 315, 1190 285 L1170 245 C1010 275, 850 295, 725 330 Z" fill="url(#banyanBark3D)" stroke="#2b1206" strokeWidth="4.5" />
                  <path d="M675 350 C600 265, 490 215, 390 185 L415 150 C525 182, 635 235, 705 320 Z" fill="url(#banyanBark3D)" stroke="#2b1206" strokeWidth="4.5" />
                  <path d="M725 350 C800 265, 910 215, 1010 185 L985 150 C875 182, 765 235, 695 320 Z" fill="url(#banyanBark3D)" stroke="#2b1206" strokeWidth="4.5" />
                  <path d="M585 290 C605 390, 580 495, 445 615 Q535 605, 595 632 Q655 595, 700 640 Q755 595, 815 632 Q875 605, 955 615 C820 495, 795 390, 815 290 Z" fill="url(#banyanBark3D)" stroke="#2b1206" strokeWidth="5" strokeLinejoin="round" />
                  <path d="M645 315 C640 420, 610 515, 520 605" stroke="url(#banyanBarkHighlight)" strokeWidth="14" strokeLinecap="round" fill="none" />
                  <path d="M695 305 C692 425, 688 520, 680 618" stroke="url(#banyanBarkHighlight)" strokeWidth="18" strokeLinecap="round" fill="none" />
                  <path d="M745 315 C755 420, 785 515, 865 605" stroke="#3b1d0e" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.7" />
                  {/* Owl Knot / Hollow */}
                  <ellipse cx="705" cy="445" rx="24" ry="32" fill="#1e0b03" stroke="#5c2d16" strokeWidth="5" />
                  <ellipse cx="700" cy="442" rx="16" ry="22" fill="#0f0501" />
                </g>

                {/* 7. LUSH 3D CANOPY PUFFS */}
                <g className="canopy-sway" filter="url(#paintedShadow)">
                  <ellipse cx="265" cy="240" rx="195" ry="110" fill="url(#canopyMidGrad)" stroke="#064e3b" strokeWidth="4" />
                  <ellipse cx="1135" cy="240" rx="195" ry="110" fill="url(#canopyMidGrad)" stroke="#064e3b" strokeWidth="4" />
                  <ellipse cx="475" cy="190" rx="245" ry="135" fill="url(#canopyMidGrad)" stroke="#064e3b" strokeWidth="4" />
                  <ellipse cx="925" cy="190" rx="245" ry="135" fill="url(#canopyMidGrad)" stroke="#064e3b" strokeWidth="4" />
                  <ellipse cx="700" cy="155" rx="310" ry="140" fill="url(#canopyMidGrad)" stroke="#064e3b" strokeWidth="4" />
                  <ellipse cx="250" cy="215" rx="145" ry="78" fill="url(#canopySunlitGrad)" />
                  <ellipse cx="465" cy="155" rx="185" ry="92" fill="url(#canopySunlitGrad)" />
                  <ellipse cx="700" cy="122" rx="235" ry="98" fill="url(#canopySunlitGrad)" />
                  <ellipse cx="935" cy="155" rx="185" ry="92" fill="url(#canopySunlitGrad)" />
                  <ellipse cx="1150" cy="215" rx="145" ry="78" fill="url(#canopySunlitGrad)" />
                  <ellipse cx="365" cy="260" rx="150" ry="72" fill="url(#canopyMidGrad)" />
                  <ellipse cx="600" cy="248" rx="175" ry="82" fill="url(#canopyMidGrad)" />
                  <ellipse cx="810" cy="248" rx="175" ry="82" fill="url(#canopyMidGrad)" />
                  <ellipse cx="1035" cy="260" rx="150" ry="72" fill="url(#canopyMidGrad)" />
                  {/* Glossy Specular Highlights */}
                  <ellipse cx="640" cy="78" rx="68" ry="20" fill="#ecfccb" opacity="0.55" />
                  <ellipse cx="425" cy="112" rx="52" ry="16" fill="#ecfccb" opacity="0.5" />
                  <ellipse cx="905" cy="112" rx="52" ry="16" fill="#ecfccb" opacity="0.45" />
                  <ellipse cx="215" cy="175" rx="42" ry="14" fill="#ecfccb" opacity="0.5" />
                  <ellipse cx="1120" cy="175" rx="42" ry="14" fill="#ecfccb" opacity="0.45" />
                </g>

                {/* 8. FOREGROUND MEADOW GRASS */}
                <g>
                  <path d="M-40 615 Q320 555 700 590 T1440 600 L1440 760 L-40 760 Z" fill="url(#meadowFrontHill)" stroke="#064e3b" strokeWidth="5" />
                  <path d="M-20 622 Q320 564 700 598 T1420 608" stroke="#d9f99d" strokeWidth="6" fill="none" opacity="0.65" strokeLinecap="round" />
                  <g fill="#15803d" stroke="#052e16" strokeWidth="2.5" strokeLinejoin="round">
                    <path d="M120 655 Q112 630 102 622 Q118 632 126 652 Q132 626 144 618 Q138 638 134 656 Z" fill="#4ade80" />
                    <path d="M280 675 Q272 650 262 642 Q278 652 286 672 Q292 646 304 638 Q298 658 294 676 Z" fill="#86efac" />
                    <path d="M430 648 Q422 623 412 615 Q428 625 436 645 Q442 619 454 611 Q448 631 444 649 Z" fill="#4ade80" />
                    <path d="M575 685 Q567 660 557 652 Q573 662 581 682 Q587 656 599 648 Q593 668 589 686 Z" fill="#86efac" />
                    <path d="M825 680 Q817 655 807 647 Q823 657 831 677 Q837 651 849 643 Q843 663 839 681 Z" fill="#4ade80" />
                    <path d="M985 650 Q977 625 967 617 Q983 627 991 647 Q997 621 1009 613 Q1003 633 999 651 Z" fill="#86efac" />
                    <path d="M1190 672 Q1182 647 1172 639 Q1188 649 1196 669 Q1202 643 1214 635 Q1208 655 1204 673 Z" fill="#4ade80" />
                  </g>
                  {/* Wooden Orchard Signpost */}
                  <g transform="translate(652, 545)" filter="url(#paintedShadow)">
                    <rect x="42" y="38" width="14" height="52" rx="4" fill="#5c2d16" stroke="#2b1206" strokeWidth="3" />
                    <rect x="0" y="0" width="98" height="44" rx="10" fill="#fef3c7" stroke="#451a03" strokeWidth="4" />
                    <text x="49" y="19" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontSize="12" fontWeight="700" fill="#78350f">SEVA GIS</text>
                    <text x="49" y="34" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontSize="11" fontWeight="700" fill="#b91c1c">IDEA TREE</text>
                  </g>
                </g>
              </svg>

              {/* INTERACTIVE LAYER: APPLES ON CANOPY & FALLEN HALF-EATEN ON GRASS */}
              <div className="absolute inset-0 w-full h-full z-30 pointer-events-auto">
                {visibleApples.map(apple => {
                  const isSelected = apple.id === selectedAppleId
                  const isSpawning = apple.id === newlySpawnedId
                  const isFalling = apple.id === fallingAppleId
                  const isVanishing = apple.id === vanishingAppleId

                  if (apple.status === 'on_tree') {
                    return (
                      <button
                        key={apple.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          playSound('click')
                          setSelectedAppleId(apple.id)
                        }}
                        style={{
                          left: `${apple.treeX}%`,
                          top: `${apple.treeY}%`,
                          transform: scaleFactor < 1 ? `translate(-50%, -50%) scale(${scaleFactor})` : undefined
                        }}
                        className={`cartoon-apple-node group focus:outline-none ${
                          isSpawning ? 'apple-spawn-entry' : ''
                        } ${isFalling ? 'apple-falling-anim' : ''} ${isVanishing ? 'apple-vanishing' : ''}`}
                        aria-label={`Suggestion Apple #${apple.id}: ${apple.text}`}
                      >
                        <div className="relative flex flex-col items-center">
                          {/* 3D Shining Apple SVG */}
                          <svg className="apple-inner-svg w-11 h-11 sm:w-12 sm:h-12" viewBox="0 0 64 64" fill="none">
                            <defs>
                              <radialGradient id={`appleBodyGrad_${apple.id}`} cx="35%" cy="30%" r="65%">
                                <stop offset="0%" stopColor="#ff9a8b" />
                                <stop offset="28%" stopColor="#ff3b30" />
                                <stop offset="72%" stopColor="#c81e1e" />
                                <stop offset="100%" stopColor="#690808" />
                              </radialGradient>
                              <linearGradient id={`appleLeafGrad_${apple.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#bef264" />
                                <stop offset="100%" stopColor="#15803d" />
                              </linearGradient>
                            </defs>
                            <path d="M32 16 C32 10, 35 6, 39 5" stroke="#5c2d16" strokeWidth="4" strokeLinecap="round" />
                            <path d="M33 13 C24 5, 14 8, 16 16 C22 19, 28 17, 33 13 Z" fill={`url(#appleLeafGrad_${apple.id})`} stroke="#052e16" strokeWidth="2" />
                            <path
                              d="M32 17 C21 14, 10 22, 11 36 C12 50, 22 58, 29 57 C31 56.5, 33 56.5, 35 57 C42 58, 52 50, 53 36 C54 22, 43 14, 32 17 Z"
                              fill={`url(#appleBodyGrad_${apple.id})`}
                              stroke={isSelected ? '#fde047' : '#3f0d0d'}
                              strokeWidth={isSelected ? '3.5' : '2.2'}
                            />
                            <ellipse cx="42" cy="42" rx="6" ry="8" fill="#facc15" opacity="0.32" transform="rotate(15 42 42)" />
                            <ellipse cx="22" cy="27" rx="5.5" ry="9.5" transform="rotate(-22 22 27)" fill="#ffffff" opacity="0.82" />
                            <circle cx="19" cy="40" r="2.3" fill="#ffffff" opacity="0.65" />
                          </svg>
                          <span className="mt-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-cartoon font-bold bg-slate-950/85 text-amber-200 border border-amber-400/50 shadow whitespace-nowrap">
                            #{apple.id}
                          </span>
                        </div>
                      </button>
                    )
                  }

                  if (apple.status === 'fallen_half_eaten') {
                    return (
                      <button
                        key={apple.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          playSound('click')
                          setSelectedAppleId(apple.id)
                        }}
                        style={{
                          left: `${apple.groundX}%`,
                          top: `${apple.groundY}%`
                        }}
                        className="half-eaten-apple-node group focus:outline-none"
                        aria-label={`Fallen Half-Eaten Apple #${apple.id}: ${apple.text}`}
                      >
                        <div className="relative flex flex-col items-center">
                          {/* Half-eaten Apple SVG */}
                          <svg className="w-12 h-12 sm:w-14 sm:h-14" viewBox="0 0 68 68" fill="none">
                            <ellipse cx="34" cy="56" rx="22" ry="6" fill="#052e16" opacity="0.45" />
                            <g transform="rotate(24 34 36)">
                              <path d="M34 11 C34 6, 38 4, 41 3" stroke="#5c2d16" strokeWidth="3.5" strokeLinecap="round" />
                              <path d="M34 10 C26 6, 19 10, 21 16 C26 17, 30 14, 34 10 Z" fill="#65a30d" stroke="#1a2e05" strokeWidth="1.8" />
                              <path d="M20 20 L48 20 C42 26, 41 42, 48 49 L20 49 C27 42, 26 26, 20 20 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                              <circle cx="21" cy="28" r="4" fill="#fef08a" />
                              <circle cx="22" cy="36" r="4.5" fill="#fef3c7" />
                              <circle cx="46" cy="30" r="4" fill="#fef08a" />
                              <circle cx="45" cy="39" r="4.5" fill="#fef3c7" />
                              <path d="M34 13 C23 11, 14 16, 16 23 C23 25, 45 25, 52 23 C54 16, 45 11, 34 13 Z" fill="#dc2626" stroke={isSelected ? '#fde047' : '#451a03'} strokeWidth="2.2" />
                              <ellipse cx="26" cy="17" rx="5" ry="2.2" fill="#ffffff" opacity="0.75" />
                              <path d="M17 47 C24 45, 44 45, 51 47 C49 55, 41 58, 34 57 C27 58, 19 55, 17 47 Z" fill="#b91c1c" stroke={isSelected ? '#fde047' : '#451a03'} strokeWidth="2.2" />
                              <ellipse cx="31" cy="35" rx="2.1" ry="3.4" transform="rotate(-12 31 35)" fill="#451a03" />
                              <ellipse cx="37" cy="36" rx="2.1" ry="3.4" transform="rotate(14 37 36)" fill="#451a03" />
                            </g>
                          </svg>
                          <span className="-mt-1 px-1.5 py-0.2 rounded-full text-[10px] font-cartoon font-bold bg-amber-950/90 text-amber-300 border border-amber-500/50 shadow whitespace-nowrap">
                            #{apple.id} (Half-Eaten)
                          </span>
                        </div>
                      </button>
                    )
                  }

                  return null
                })}
              </div>

              {/* Floating HUD Overlays */}
              <div className="absolute top-3 left-3 z-40 flex flex-wrap items-center gap-2 pointer-events-auto">
                <div className="bg-slate-950/85 backdrop-blur-md border-2 border-amber-400/60 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-2.5">
                  <span className="text-xl">🍎</span>
                  <div>
                    <div className="font-cartoon text-xs sm:text-sm font-bold text-white leading-tight">
                      Interactive 3D Banyan Suggestion Tree
                    </div>
                    <div className="text-[11px] text-amber-200">
                      Click any shining apple on branches (or half-eaten on grass) to inspect &amp; moderate!
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Pills in Top-Right */}
              <div className="absolute top-3 right-3 z-40 flex flex-wrap items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border-2 border-slate-700 pointer-events-auto">
                {[
                  { key: 'all', label: 'All Visible' },
                  { key: 'RustGIS Core', label: '🦀 RustGIS' },
                  { key: '3D Terrain & LiDAR', label: '🏔️ LiDAR' },
                  { key: 'Village Cadastre', label: '🗺️ Cadastre' }
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveFilter(f.key)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      activeFilter === f.key
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* SELECTED APPLE INSPECTOR MODAL */}
              {selectedApple && (
                <div className="absolute bottom-4 right-4 left-4 sm:left-auto sm:w-[430px] z-50 bg-slate-950/95 backdrop-blur-xl border-4 border-amber-400 rounded-3xl p-5 shadow-2xl pointer-events-auto">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center text-2xl ${
                        selectedApple.status === 'on_tree'
                          ? 'bg-red-500/20 border-red-400'
                          : 'bg-amber-500/20 border-amber-400'
                      }`}>
                        {selectedApple.status === 'on_tree' ? '🍎' : '🥀'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-cartoon font-bold text-base text-amber-300">
                            Apple #{selectedApple.id}
                          </span>
                          <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            selectedApple.status === 'on_tree'
                              ? 'bg-red-500/20 text-red-300 border-red-400/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                          }`}>
                            {selectedApple.status === 'on_tree' ? 'Shining on Banyan Tree' : 'Fallen & Half-Eaten on Grass'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Anonymous Visitor • Category: {selectedApple.category}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAppleId(null)}
                      className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Suggestion Quote */}
                  <div className="my-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-700/80">
                    <p className="text-sm sm:text-base font-medium text-white leading-relaxed">
                      "{selectedApple.text}"
                    </p>
                  </div>

                  {/* Agentic AI Verdict */}
                  <div className="mb-3 px-3 py-2 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between">
                    <span>🤖 Agentic Score: {selectedApple.aiScore}/100 — {selectedApple.aiReason}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setApples(prev => prev.map(a => a.id === selectedApple.id ? { ...a, upvotes: a.upvotes + 1 } : a))
                        playSound('click')
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/50 text-white font-bold transition flex items-center gap-1"
                    >
                      <ThumbsUp size={12} />
                      <span>{selectedApple.upvotes}</span>
                    </button>
                  </div>

                  {/* Admin / Agentic Controls */}
                  {isAdminMode && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-2 flex items-center justify-between">
                        <span>👑 Admin / Agentic Decision Controls</span>
                        <span className="text-slate-400 font-normal">Live State Change</span>
                      </div>
                      {selectedApple.status === 'on_tree' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleVanishApple(selectedApple.id)}
                            className="cartoon-btn-green py-2 px-3 rounded-xl font-cartoon font-bold text-xs text-white flex items-center justify-center gap-1.5"
                          >
                            <span>✨ Done / Implemented (Vanish Apple)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFallApple(selectedApple.id)}
                            className="cartoon-btn-primary py-2 px-3 rounded-xl font-cartoon font-bold text-xs text-white flex items-center justify-center gap-1.5"
                          >
                            <span>🥀 Not Worth It (Fall &amp; Half-Eaten)</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreApple(selectedApple.id)}
                          className="w-full py-2 px-3 rounded-xl font-cartoon font-bold text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1.5"
                        >
                          <span>🌱 Re-Hang as Fresh Shining Apple on Tree</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recently Implemented & Vanished Log Strip */}
            <div className="mt-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🏆</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Recently Implemented &amp; Vanished Apples (Adopted by Seva GIS Admin)
                  </h4>
                  <p className="text-xs text-slate-400">
                    When an admin completes a user suggestion, its apple sparkles and disappears from the Banyan tree into this release log.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {completedHistory.slice(0, 5).map(item => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-200"
                  >
                    <span>✨ #{item.id}:</span>
                    <strong className="text-white">
                      {item.text.length > 44 ? item.text.slice(0, 44) + '…' : item.text}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: LIVE SEVA GIS × RUSTGIS ENGINE SANDBOX                        */}
      {/* ===================================================================== */}
      {activeTab === 'engine' && (
        <section className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold">
                Reverse-Engineered opengeos/RustGIS Engine (L0–L6)
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">Seva GIS × RustGIS Interactive Command &amp; Map Sandbox</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                In <code className="text-orange-300">opengeos/RustGIS</code>, every UI button is a deterministic command ID (<code className="text-emerald-300">CommandSpec</code>) backed by pure-Rust crates (<code className="text-orange-300">#[deny(unsafe_code)]</code>). Test live geoprocessing commands below!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (mapCommandStack.length > 1) {
                    setMapCommandStack(prev => prev.slice(0, -1))
                    setTerminalLines(prev => [...prev, "$ rustgis-cli run --cmd 'edit.undo={}'"])
                    playSound('click')
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                <Undo2 size={13} />
                <span>Undo Last Command ({Math.max(0, mapCommandStack.length - 1)})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapCommandStack(['init'])
                  setTerminalLines(prev => [...prev, '$ rustgis-cli session --reset'])
                  playSound('click')
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-300 border border-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Reset Session</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Map Canvas & Toolbar */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-2">
                {[
                  { id: 'buffer', label: '📐 gp.run: Buffer (250m)', color: 'bg-orange-500/20 text-orange-200 border-orange-500/40 hover:bg-orange-500/30', cli: "rustgis-cli run --cmd 'gp.run={\"tool\":\"buffer\",\"params\":{\"input\":\"Seva_Villages\",\"distance\":250}}'" },
                  { id: 'voronoi', label: '🕸️ gp.run: Service Voronoi', color: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/30', cli: "rustgis-cli run --cmd 'gp.run={\"tool\":\"delaunayTriangulation\",\"params\":{\"input\":\"Seva_Villages\"}}'" },
                  { id: 'watershed', label: '🌊 whitebox: Flow & Watershed', color: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 hover:bg-cyan-500/30', cli: "rustgis-cli run --cmd 'gp.run={\"tool\":\"whitebox.d8_flow\",\"params\":{\"dem\":\"Nellore_SRTM.tif\"}}'" },
                  { id: 'graduated', label: '🎨 layer.symbology: Graduated', color: 'bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30', cli: "rustgis-cli run --cmd 'layer.symbology={\"layer\":\"Seva_Villages\",\"type\":\"graduated\",\"field\":\"pop\"}}'" },
                  { id: 'geoparquet', label: '📦 data.load: Zero-Copy GeoParquet', color: 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30', cli: "rustgis-cli run --cmd 'data.open={\"path\":\"seva_cadastre.parquet\",\"zeroCopy\":true}'" }
                ].map(cmd => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      setMapCommandStack(prev => [...prev, cmd.id])
                      setTerminalLines(prev => [...prev, `$ ${cmd.cli}`])
                      playSound('click')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${cmd.color}`}
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>

              <div className="relative h-[400px] bg-slate-950">
                <canvas ref={mapCanvasRef} className="w-full h-full block" />
                <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] font-mono text-slate-300">
                  CRS: EPSG:3857 (Web Mercator) • Renderer: rustgis-render (wgpu/tiny-skia) • Frame: <span className="text-emerald-400 font-bold">{frameTime}</span>
                </div>
              </div>
            </div>

            {/* Stack Info & Terminal */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-2">🦀 RustGIS 7-Layer Crate Pipeline (Active in Seva GIS)</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="font-mono text-orange-300">L0 rustgis-geom</span>
                    <span className="text-slate-400">Geodesic area, BBox, projections</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="font-mono text-amber-300">L1 rustgis-data</span>
                    <span className="text-slate-400">GeoParquet, COG, FlatGeobuf, SQL</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="font-mono text-emerald-300">L2 map &amp; analysis</span>
                    <span className="text-slate-400">GeoRust algorithms, MVT tiles</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="font-mono text-cyan-300">L3 render &amp; geolibre</span>
                    <span className="text-slate-400">1,000+ Whitebox WASI + wgpu</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="font-mono text-indigo-300">L4–L5 engine &amp; mcp</span>
                    <span className="text-slate-400">Session undo + AI MCP (:8767)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white">Terminal Command Log (<code className="text-orange-300">rustgis-cli</code>)</h3>
                  <span className="text-[11px] text-emerald-400 font-mono">stdio MCP active</span>
                </div>
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 space-y-1.5 overflow-y-auto max-h-56">
                  {terminalLines.map((line, idx) => (
                    <div key={idx} className="break-all">{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: REVERSE-ENGINEERED CODE BLUEPRINTS                            */}
      {/* ===================================================================== */}
      {activeTab === 'blueprint' && (
        <section className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Production Integration Code
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">Seva GIS × RustGIS Integration &amp; Banyan Tree Engine Code</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Copy-ready Rust (<code className="text-orange-300">crates/seva-rustgis-wasm/src/lib.rs</code>) and Python/JS bridge code to embed <code className="text-orange-300">opengeos/RustGIS</code> into your Seva GIS repository.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5"
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedCode ? '✅ Copied to Clipboard!' : '📋 Copy Active Code File'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'rust_wasm' as const, label: '1. crates/seva-rustgis/src/lib.rs (Rust + WASM)' },
              { key: 'cargo_toml' as const, label: '2. Cargo.toml (Layered Crates)' },
              { key: 'python_mcp' as const, label: '3. seva_backend.py (RustGIS Python & Apple Tree API)' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCodeKey(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition ${
                  activeCodeKey === tab.key
                    ? 'bg-orange-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
            <pre className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre">
              {CODE_SNIPPETS[activeCodeKey]}
            </pre>
          </div>
        </section>
      )}
    </section>
  )
}
