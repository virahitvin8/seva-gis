import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Cpu,
  Brain,
  Key,
  CheckCircle2,
  AlertTriangle,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  X,
  Languages,
  Zap,
  Sliders,
  Droplets,
  Layers
} from 'lucide-react'
import {
  evaluateWithGemini4Argon,
  getGeminiApiKey,
  setGeminiApiKey,
  generateArgonPythonScript,
  type ArgonAnalysisResult,
  type FarmArgonTelemetry
} from '../services/geminiArgonService'
import type { FarmData } from '../lib/seva'

export interface GeminiArgonAdvisorModalProps {
  isOpen: boolean
  onClose: () => void
  farm: FarmData & { id: string; name: string; crop?: string }
}

export default function GeminiArgonAdvisorModal({ isOpen, onClose, farm }: GeminiArgonAdvisorModalProps) {
  const [apiKey, setApiKey] = useState(getGeminiApiKey())
  const [showKeyInput, setShowKeyInput] = useState(!getGeminiApiKey())
  const [thinkingLevel, setThinkingLevel] = useState<'high' | 'medium' | 'low'>('high')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ArgonAnalysisResult | null>(null)
  const [activeLang, setActiveLang] = useState<'en' | 'hi' | 'te'>('en')
  const [copiedCode, setCopiedCode] = useState(false)

  // Auto-run analysis when modal opens or farm changes
  useEffect(() => {
    if (!isOpen) return
    runAnalysis()
  }, [isOpen, farm.id, thinkingLevel])

  const runAnalysis = async () => {
    setLoading(true)
    const telemetry: FarmArgonTelemetry = {
      farmName: farm.name || 'Sample Field AOI',
      crop: farm.crop || 'Field Crop',
      growthStage: 'Mid-Season Vegetative',
      areaHa: farm.area || 2.4,
      lat: farm.lat,
      lon: farm.lon,
      ndvi: (farm as any).ndvi || 0.64,
      ndre: (farm as any).ndre || 0.38,
      ndmi: (farm as any).moisture ? (farm as any).moisture / 100 : 0.22,
      soilMoisturePct: (farm as any).moisture || 24,
      elevationM: (farm as any).elevation || 450,
      slopeDegrees: 2.1,
      soilType: 'Clay Loam',
      recentRainfallMm: (farm as any).rain || 12.4
    }

    try {
      const res = await evaluateWithGemini4Argon(telemetry, {
        apiKey,
        thinkingLevel,
        outputLanguage: activeLang
      })
      setResult(res)
    } catch (err) {
      console.error('[Gemini 4 Argon] Analysis failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = (newKey: string) => {
    setApiKey(newKey)
    setGeminiApiKey(newKey)
    setShowKeyInput(false)
    runAnalysis()
  }

  const handleCopyPython = () => {
    const telemetry: FarmArgonTelemetry = {
      farmName: farm.name,
      crop: farm.crop || 'Field Crop',
      areaHa: farm.area || 2.4,
      lat: farm.lat,
      lon: farm.lon,
      ndvi: (farm as any).ndvi || 0.64,
      ndre: 0.38,
      ndmi: 0.22
    }
    const py = generateArgonPythonScript(telemetry)
    navigator.clipboard.writeText(py)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header — Sapphire and Emerald Radiance */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-lg shadow-sky-500/10">
              <Brain size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  Gemini 4 Argon · High Reasoning Cognitive GeoAI
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  gemini-4-argon
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  thinking_level: {thinkingLevel}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Deep multi-spectral chain-of-thought agronomic analysis replacing legacy Flash tiers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Configure Google AI Studio API Key"
            >
              <Key size={13} className={apiKey ? 'text-emerald-400' : 'text-amber-400'} />
              <span>{apiKey ? 'API Key Active' : 'Enter API Key'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* API Key Drawer */}
        {showKeyInput && (
          <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <span className="text-slate-400 font-medium">Google AI Studio Key:</span>
              <input
                type="password"
                placeholder="AIzaSy... (from aistudio.google.com)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="flex-1 max-w-md px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleSaveKey(apiKey)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
              >
                Save
              </button>
            </div>
            <a
              href="https://aistudio.google.com/apps/3bb45d74-02be-40e3-96b3-0a34b3b5fd16?showAssistant=true&showCode=true"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium group text-decoration-none"
            >
              <span>AI Studio Reference App</span>
              <ExternalLink size={12} className="group-hover:translate-x-0.5 transition" />
            </a>
          </div>
        )}

        {/* Toolbar: Thinking Level & Field Metadata */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-300">
            <span><b>Field:</b> {farm.name}</span>
            <span><b>Crop:</b> {farm.crop || 'Field Crop'}</span>
            <span><b>Area:</b> {farm.area?.toFixed(2) || '2.40'} ha</span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <Sparkles size={12} /> NDVI: {(farm as any).ndvi?.toFixed(3) || '0.640'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
                <Sliders size={11} /> Thinking:
              </span>
              {(['high', 'medium', 'low'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setThinkingLevel(lvl)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold capitalize transition cursor-pointer ${
                    thinkingLevel === lvl
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Reasoning...' : 'Re-Run Argon'}</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/20 animate-pulse">
                <Brain size={32} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Gemini 4 Argon is Thinking (High Effort)...</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Synthesizing Sentinel-2 L2A BOA reflectance bands, Copernicus DEM slope, and soil water deficit equations.
                </p>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Diagnostic Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                  result.status === 'critical'
                    ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                    : result.status === 'warning'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.status === 'optimal' ? (
                      <CheckCircle2 size={20} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={20} className={result.status === 'critical' ? 'text-rose-400' : 'text-amber-400'} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-black/40">
                        {result.status}
                      </span>
                      <span className="text-xs text-slate-300 font-mono">
                        Confidence: {(result.confidenceScore * 100).toFixed(1)}%
                      </span>
                      {result.isSimulatedOffline && (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          Offline FAO-56 Simulation
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">{result.headline}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyPython}
                    className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white border border-white/10 text-xs flex items-center gap-1 transition cursor-pointer"
                    title="Copy Python script using Google GenAI SDK"
                  >
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Copied' : 'Python Code'}</span>
                  </button>
                </div>
              </div>

              {/* Deep Reasoning Markdown Block */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Brain size={14} className="text-indigo-400" /> Multi-Spectral Deep Reasoning Chain
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Model: {result.model} | Level: {result.thinkingLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {result.deepReasoningMarkdown}
                </div>
              </div>

              {/* Variable-Rate Advisory Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Droplets size={12} className="text-sky-400" /> Irrigation Recommendation
                  </div>
                  <div className="text-lg font-bold text-white">
                    {result.variableRateAdvisory.irrigationDepthMm ? `${result.variableRateAdvisory.irrigationDepthMm} mm` : 'Not Required'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Target root-zone saturation
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Sparkles size={12} className="text-emerald-400" /> Variable-Rate Nitrogen (Urea)
                  </div>
                  <div className="text-lg font-bold text-white">
                    {result.variableRateAdvisory.nitrogenUreaKgHa ? `${result.variableRateAdvisory.nitrogenUreaKgHa} kg/ha` : 'Nil / Balanced'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Apply only to depressed NDRE zones
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Zap size={12} className="text-amber-400" /> Application Window
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {result.variableRateAdvisory.recommendedWindow}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Optimal microclimate condition
                  </div>
                </div>
              </div>

              {/* Actionable Recommendations Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-emerald-900/30">
                  <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Immediate Actions
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    {result.actionableRecommendations.immediate.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-sky-900/30">
                  <h4 className="text-xs font-bold text-sky-400 mb-2 flex items-center gap-1.5">
                    <Sliders size={13} /> Preventive Steps
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    {result.actionableRecommendations.preventive.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-rose-900/30">
                  <h4 className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Practices to Avoid
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    {result.actionableRecommendations.whatToAvoid.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Vernacular Farmer Advisory Tabs */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Languages size={14} className="text-sky-400" /> Vernacular Farmer Advisory (SMS Ready)
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setActiveLang('en')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        activeLang === 'en' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setActiveLang('hi')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        activeLang === 'hi' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      हिन्दी
                    </button>
                    <button
                      onClick={() => setActiveLang('te')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        activeLang === 'te' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      తెలుగు
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-medium leading-relaxed">
                  {activeLang === 'en' && result.multilingualAdvisories.english}
                  {activeLang === 'hi' && result.multilingualAdvisories.hindi}
                  {activeLang === 'te' && result.multilingualAdvisories.telugu}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
