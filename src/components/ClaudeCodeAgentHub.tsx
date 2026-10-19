import React, { useState, useMemo } from 'react'
import {
  Cpu, Terminal, Key, Globe, ShieldCheck, Check, Copy, Download, Sparkles,
  ExternalLink, Layers, GitBranch, Boxes, Zap, Lock, Code2, RefreshCw, AlertCircle
} from 'lucide-react'
import { BRAND_PROFILES, type BrandMode, loadBrandMode, saveBrandMode } from '../lib/brandIdentity'
import { dispatchExport } from '../lib/googleDriveVault'

interface Props {
  onClose?: () => void
  isModal?: boolean
}

type HubTab = 'claude-settings' | 'rea-harness' | 'brand-domain' | 'security-198'

interface ModelProviderPreset {
  id: string
  name: string
  badge: string
  baseUrl: string
  primaryModel: string
  fastModel: string
  opusModel: string
  description: string
  envExtra?: Record<string, string>
}

const MODEL_PRESETS: ModelProviderPreset[] = [
  {
    id: 'radoxai',
    name: 'RadoxAI Unified Endpoint (33 Models · 10M Free Tokens)',
    badge: '10M FREE TOKENS',
    baseUrl: 'https://radoxai.com/v1',
    primaryModel: 'claude-opus-5.5',
    fastModel: 'fable-5.1',
    opusModel: 'gpt-5.6-sol',
    description: 'Single unified endpoint from your screenshot supporting Claude Opus 5.5, GPT-5.6 Sol, Fable 5.1, and Kimi K3 in Claude Code.'
  },
  {
    id: 'beatapi',
    name: 'BeatAPI.io Proxy (GLM-5.3, GLM-5.3 Flash, JEV 1.13, DeepSeek)',
    badge: 'DECISION + FLASH',
    baseUrl: 'https://api.beatapi.io/v1',
    primaryModel: 'glm-5.3',
    fastModel: 'glm-5.3-flash',
    opusModel: 'jev-1.13',
    description: 'Runs GLM 5.3 for deep coding, GLM 5.3 Flash for instant subagent sweeps, and JEV 1.13 for routing/classification.'
  },
  {
    id: 'opencode-rea',
    name: 'OpenCode + DeepSeek V4.1 / GLM-5.3 Flash (Free REA Stack)',
    badge: 'REA v6.7.0 READY',
    baseUrl: 'https://api.deepseek.com/anthropic',
    primaryModel: 'deepseek-v4.1',
    fastModel: 'glm-5.3-flash',
    opusModel: 'deepseek-reasoner',
    description: 'Ideal for running morluto/rea (rea-agents v6.7.0) binary & JS reverse-engineering before handing off to Claude Opus 5.5.'
  },
  {
    id: 'antigravity-gemini',
    name: 'Google Antigravity Ultra (Gemini 4 Argon + 30 Science DBs)',
    badge: '6 MO FREE SCIENCE',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    primaryModel: 'gemini-4-argon',
    fastModel: 'gemini-3.5-flash',
    opusModel: 'gemini-4-argon-ultra',
    description: 'Connects Gemini 4 Argon and Google Harness² self-improving agent loops for scientific & geospatial pipelines.'
  },
  {
    id: 'local-ollama',
    name: 'Local Ollama / vLLM / llama.cpp (Zero Cloud Cost)',
    badge: '100% OFFLINE',
    baseUrl: 'http://localhost:11434/v1',
    primaryModel: 'qwen3-coder:32b',
    fastModel: 'deepseek-r1:14b',
    opusModel: 'glm-5-local:latest',
    description: 'Run Claude Code or OpenCode completely offline against your local GPU / Vega-U adapter engine.'
  }
]

const REPO_SKILLS_SUMMARY = [
  { name: 'understand-anything-geospatial', category: 'Core GIS', role: 'Sentinel-2 L2A, Copernicus DEM, Horn 1981 slope, TWI, Fields2Cover robotics & VRA prescriptions.' },
  { name: 'antigravity-spatial-pipeline', category: 'Core GIS', role: 'Zero-backend WebGL tile streaming, IndexedDB raster caching & agent tool execution.' },
  { name: 'precision-ag-superpowers', category: 'Core GIS', role: 'Invariant verification loops for coverage path planning, FAO-56 ETc & spectral math.' },
  { name: 'leanrea', category: 'Reverse Eng', role: 'Reverse engineer QGIS, ArcGIS, MATLAB & JS/WASM bundles via morluto/rea v6.7.0.' },
  { name: 'impeccable', category: 'Design & UI', role: 'Anti-slop UI audit, typography, layout rhythm, live DOM verification & craft floor.' },
  { name: 'hallmark', category: 'Design & UI', role: 'Together AI 21 macrostructures, OKLCH color scales & 57 slop-test gates.' },
  { name: 'awwwards-mcp', category: 'Design & UI', role: 'Bento grids, 3D card tilt, kinetic typography & spatial interfaces.' },
  { name: 'genjutsu', category: 'Motion & 3D', role: 'Spring physics, fluid micro-interactions, WebGL/CSS aura & tactile feedback.' },
  { name: 'dembrandt-skills', category: 'Design & UI', role: 'WCAG 2.2 AA contrast standards, elevation layers & brand token architecture.' },
  { name: 'codebase-design', category: 'Architecture', role: 'Deep modules, interface seams & Design-It-Twice verification.' },
  { name: 'diagnosing-bugs', category: 'Quality', role: 'Root-cause HITL diagnosis loop for performance and async race conditions.' },
  { name: 'git-guardrails-claude-code', category: 'Security', role: 'Pre-tool-use Claude Code hook blocking destructive git reset/clean/force-push.' }
]

const REA_PROMPT_TEXT = `REVERSE ENGINEER ANYTHING · OpenCode (morluto/rea v6.7.0)
Use only the official REA: github.com/morluto/rea (docs: rea.tools and the repo's docs/). Never guess a command: check npx -y rea-agents@latest --help. Every claim needs REA evidence.
0 RESUME: If REA-TASK.md exists, continue from the step it marks.
1 ASK: Ask and wait: what to reverse (QGIS algorithm, ArcGIS geoprocessing tool, MATLAB toolbox function, GEE script, APK, or web app), where it is, which ONE feature, and the goal: A) proof, B) SPEC.md, C) working TypeScript/Python version.
2 SETUP: Node 22.19+, 24.11+ or 26+. Run npx -y rea-agents@latest doctor --client opencode --json.
3 ROUTE: Electron/JS: npx -y rea-agents@latest analyze-javascript-application "<path>" --json. Native/Ghidra/Kuna: doctor --provider ghidra --json.
4 TRACE: Follow the feature from click/input to final raster/vector output.
5 REPORT: Plain explanation; each step with file, function, line or offset; CONFIRMED vs INFERRED.
6 BUILD: Write SPEC.md (behavior, edge cases, invariants, no copied proprietary code) -> build clean implementation + tests.
7 REPO: Commit REA-TASK.md, reports, SPEC.md, implementation and tests.`

export default function ClaudeCodeAgentHub({ onClose, isModal = false }: Props) {
  const [activeTab, setActiveTab] = useState<HubTab>('claude-settings')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(MODEL_PRESETS[0].id)
  const [apiKeyInput, setApiKeyInput] = useState<string>('sk-your-custom-api-key-here')
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(MODEL_PRESETS[0].baseUrl)
  const [customPrimaryModel, setCustomPrimaryModel] = useState<string>(MODEL_PRESETS[0].primaryModel)
  const [customFastModel, setCustomFastModel] = useState<string>(MODEL_PRESETS[0].fastModel)
  const [customOpusModel, setCustomOpusModel] = useState<string>(MODEL_PRESETS[0].opusModel)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [brandMode, setBrandMode] = useState<BrandMode>(loadBrandMode)
  const [customDomainInput, setCustomDomainInput] = useState<string>('dyopgis.tech')

  const activePreset = useMemo(
    () => MODEL_PRESETS.find(p => p.id === selectedPresetId) || MODEL_PRESETS[0],
    [selectedPresetId]
  )

  const handleSelectPreset = (preset: ModelProviderPreset) => {
    setSelectedPresetId(preset.id)
    setCustomBaseUrl(preset.baseUrl)
    setCustomPrimaryModel(preset.primaryModel)
    setCustomFastModel(preset.fastModel)
    setCustomOpusModel(preset.opusModel)
  }

  const generatedSettingsJson = useMemo(() => {
    return JSON.stringify(
      {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          ANTHROPIC_BASE_URL: customBaseUrl,
          ANTHROPIC_AUTH_TOKEN: apiKeyInput,
          ANTHROPIC_API_KEY: apiKeyInput,
          ANTHROPIC_MODEL: customPrimaryModel,
          ANTHROPIC_SMALL_FAST_MODEL: customFastModel,
          ANTHROPIC_DEFAULT_SONNET_MODEL: customPrimaryModel,
          ANTHROPIC_DEFAULT_OPUS_MODEL: customOpusModel,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: customFastModel,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          API_TIMEOUT_MS: '600000'
        },
        permissions: {
          allow: [
            'Bash(npm run *)',
            'Bash(npx -y rea-agents@latest *)',
            'Bash(git status)',
            'Bash(git diff*)',
            'Read(**)'
          ],
          deny: [
            'Bash(git push --force*)',
            'Bash(git reset --hard*)',
            'Bash(rm -rf /)'
          ]
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: 'bash .agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh'
                }
              ]
            }
          ]
        }
      },
      null,
      2
    )
  }, [customBaseUrl, apiKeyInput, customPrimaryModel, customFastModel, customOpusModel])

  const generatedPowerShellScript = useMemo(() => {
    return `# Run in PowerShell on Windows (e.g., f:\\SEVAGIS\\seva gis)
$claudeDir = Join-Path $HOME ".claude"
if (!(Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir | Out-Null }

$settingsJson = @'
${generatedSettingsJson}
'@

Set-Content -Path (Join-Path $claudeDir "settings.json") -Value $settingsJson -Encoding UTF8
Set-Content -Path ".\\.claude\\settings.local.json" -Value $settingsJson -Encoding UTF8
Write-Host "Successfully configured Claude Code settings.json for ${customPrimaryModel} via ${customBaseUrl}" -ForegroundColor Green`
  }, [generatedSettingsJson, customPrimaryModel, customBaseUrl])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(id)
      setTimeout(() => setCopiedKey(null), 2200)
    })
  }

  const handleBrandChange = (mode: BrandMode) => {
    setBrandMode(mode)
    saveBrandMode(mode)
    if (mode === 'dyop') setCustomDomainInput('dyopgis.tech')
    else if (mode === 'seva') setCustomDomainInput('sevagis.tech')
    else setCustomDomainInput('dyopgis.tech')
  }

  return (
    <section
      className="ag-card claude-agent-hub"
      style={{
        borderRadius: 16,
        border: '1px solid #cbd5e1',
        background: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
        color: '#f8fafc',
        padding: isModal ? '24px' : '22px',
        marginTop: isModal ? 0 : '18px',
        marginBottom: isModal ? 0 : '22px',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.45)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f97316 0%, #8b5cf6 50%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
          }}>
            <Terminal size={23} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
                Claude Code Multi-Model `settings.json`, REA v6.7.0 Agents &amp; Brand/Domain Studio
              </h2>
              <span style={{ fontSize: 10.5, background: 'rgba(249, 115, 22, 0.2)', color: '#fdba74', padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(249, 115, 22, 0.4)' }}>
                Use Any Model in Claude Code
              </span>
              <span style={{ fontSize: 10.5, background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                42 .agents/skills Loaded
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
              Switch Claude Code to RadoxAI, BeatAPI, GLM-5.3 Flash, DeepSeek V4.1, or Gemini 4 Argon · Run REA v6.7.0 + Harness² · Switch SEVA·GIS ⇄ DYOP·GIS &amp; Claim Free .TECH Domain
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#f8fafc',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close Hub
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {[
          { id: 'claude-settings' as HubTab, label: '1. Claude Code settings.json (Use Any Model / API)', icon: Key },
          { id: 'rea-harness' as HubTab, label: '2. REA v6.7.0 + Google Harness² + .agents/skills', icon: Cpu },
          { id: 'brand-domain' as HubTab, label: '3. DYOP·GIS vs SEVA·GIS Brand Switcher & Free .TECH Domain', icon: Globe },
          { id: 'security-198' as HubTab, label: '4. 198 Production Security Gates & 6-Repo Containment', icon: ShieldCheck }
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 10,
                border: active ? '1.5px solid #a78bfa' : '1px solid rgba(148, 163, 184, 0.22)',
                background: active ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(249, 115, 22, 0.22))' : 'rgba(15, 23, 42, 0.65)',
                color: active ? '#f8fafc' : '#cbd5e1',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <Icon size={15} color={active ? '#c4b5fd' : '#94a3b8'} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: CLAUDE CODE SETTINGS.JSON CONFIGURATOR */}
      {activeTab === 'claude-settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
              Select Model Endpoint Preset (From Your Screenshots)
            </div>
            {MODEL_PRESETS.map(preset => {
              const active = preset.id === selectedPresetId
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: active ? '1.5px solid #f97316' : '1px solid rgba(148, 163, 184, 0.2)',
                    background: active ? 'rgba(249, 115, 22, 0.14)' : 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: 'rgba(249, 115, 22, 0.2)', color: '#fdba74' }}>
                      {preset.badge}
                    </span>
                    <code style={{ fontSize: 10.5, color: '#94a3b8' }}>{preset.primaryModel}</code>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{preset.name}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>{preset.description}</div>
                </button>
              )
            })}

            {/* Custom inputs */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Customize Endpoint &amp; Models</div>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>
                ANTHROPIC_BASE_URL
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={e => setCustomBaseUrl(e.target.value)}
                  style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 6, background: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>
                API Key / Auth Token (ANTHROPIC_AUTH_TOKEN)
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 6, background: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: 12 }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>
                  Primary Model
                  <input
                    type="text"
                    value={customPrimaryModel}
                    onChange={e => setCustomPrimaryModel(e.target.value)}
                    style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 6, background: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: 12 }}
                  />
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>
                  Fast / Subagent Model
                  <input
                    type="text"
                    value={customFastModel}
                    onChange={e => setCustomFastModel(e.target.value)}
                    style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 6, background: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: 12 }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    Generated `~/.claude/settings.json` (or `f:\SEVAGIS\seva gis\.claude\settings.local.json`)
                  </h3>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                    Overrides Claude Code to route through <b>{customBaseUrl}</b> using model <b>{customPrimaryModel}</b> + Git safety guardrails
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedSettingsJson, 'settings-json')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#f8fafc',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedKey === 'settings-json' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                    <span>{copiedKey === 'settings-json' ? 'Copied settings.json' : 'Copy settings.json'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void dispatchExport({
                        category: 'data',
                        fileName: 'settings.json',
                        blob: generatedSettingsJson,
                        mimeType: 'application/json',
                        customToast: 'Downloaded Claude Code settings.json — place in ~/.claude/settings.json or .claude/settings.local.json'
                      })
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'linear-gradient(135deg, #f97316, #8b5cf6)',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    <span>Download settings.json</span>
                  </button>
                </div>
              </div>

              <pre style={{
                margin: 0,
                padding: 14,
                borderRadius: 10,
                background: '#020617',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                color: '#fde68a',
                fontSize: 11.5,
                lineHeight: 1.5,
                overflowX: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
              }}>
                <code>{generatedSettingsJson}</code>
              </pre>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  1-Click Windows PowerShell Installer (`f:\SEVAGIS\seva gis\scripts\setup-claude-code-models.ps1`)
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedPowerShellScript, 'ps1-script')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(56, 189, 248, 0.18)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#7dd3fc',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copiedKey === 'ps1-script' ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                  <span>{copiedKey === 'ps1-script' ? 'Copied PowerShell' : 'Copy PowerShell Command'}</span>
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: 12,
                borderRadius: 8,
                background: '#020617',
                color: '#7dd3fc',
                fontSize: 11,
                overflowX: 'auto',
                fontFamily: 'ui-monospace, monospace'
              }}>
                <code>{generatedPowerShellScript}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REA v6.7.0 + GOOGLE HARNESS² + .AGENTS/SKILLS */}
      {activeTab === 'rea-harness' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.24)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                  Official REA (`morluto/rea` v6.7.0) OpenCode Prompt
                </h3>
                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  Step 1: OpenCode + DeepSeek V4.1 / GLM-5.3 Flash → Step 2: REA 0–7 Trace → Step 3: Claude Opus 5.5
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(REA_PROMPT_TEXT, 'rea-prompt')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  color: '#6ee7b7',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {copiedKey === 'rea-prompt' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey === 'rea-prompt' ? 'Copied REA Prompt' : 'Copy REA 0–7 Prompt'}</span>
              </button>
            </div>
            <pre style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              background: '#020617',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#a7f3d0',
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, monospace'
            }}>
              {REA_PROMPT_TEXT}
            </pre>

            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd', marginBottom: 4 }}>
                Google Harness² Self-Improving Agent Loop + CometML Opik
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.45 }}>
                Wraps the model with self-refining <b>System Prompt + Tools + Memory + `.agents/skills` + Subagents</b>. On every geospatial task, the harness compares candidate runs, records lessons learned into `docs/ANALYSIS/`, and generates regression tests so fixed bugs never return.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.24)', padding: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
              Active Repository `.agents/skills` &amp; Motion/Scraping MCP Stack
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {REPO_SKILLS_SUMMARY.map(sk => (
                <div key={sk.name} style={{ background: '#020617', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <code style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>{sk.name}</code>
                    <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(148,163,184,0.15)', color: '#cbd5e1' }}>
                      {sk.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>{sk.role}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(148, 163, 184, 0.2)', fontSize: 11.5, color: '#cbd5e1' }}>
              <b>Motion, Icons &amp; Scraping MCPs Integrated:</b> HyperFrames (`claude plugin install hyperframes@hyperframes`), OpenDesign Motion (`open-design.ai`), MCP for Blender, GSAP Skills, NeatIcons MCP (`neaticons.com`), Crawlee, Playwright, Oxylabs Web API MCP, Trafilatura &amp; Firecrawl.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BRAND STRATEGY (DYOP·GIS vs SEVA·GIS) & FREE .TECH DOMAIN WIZARD */}
      {activeTab === 'brand-domain' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Brand Identity Switcher — Click Any Option to Rebrand the Entire App Instantaneously
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {(Object.keys(BRAND_PROFILES) as BrandMode[]).map(modeKey => {
                const profile = BRAND_PROFILES[modeKey]
                const active = brandMode === modeKey
                return (
                  <div
                    key={modeKey}
                    onClick={() => handleBrandChange(modeKey)}
                    style={{
                      background: active ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.2), rgba(2, 132, 199, 0.15))' : 'rgba(15, 23, 42, 0.75)',
                      border: active ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: 14,
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: active ? '#10b981' : 'rgba(148,163,184,0.2)', color: active ? '#022c22' : '#cbd5e1' }}>
                          {profile.badge}
                        </span>
                        {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>● ACTIVE LIVE</span>}
                      </div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                        {profile.shortName}
                      </h4>
                      <div style={{ fontSize: 11.5, color: '#38bdf8', fontWeight: 600, marginBottom: 6 }}>
                        {profile.expansion}
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.45 }}>
                        {profile.positioning}
                      </p>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                        {profile.whyChoose.map((reason, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ fontSize: 11, color: '#6ee7b7', borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 8 }}>
                      <b>Suggested Domain:</b> <code>{profile.recommendedDomain}</code>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Free .TECH Domain Wizard */}
          <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: 14, border: '1px solid rgba(56, 189, 248, 0.3)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.2)', color: '#7dd3fc' }}>
                FREE .TECH DOMAIN (1 YEAR · $0.00)
              </span>
              <a href="https://get.tech" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span>get.tech</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
              Claim `dyopgis.tech` or `sevagis.tech` for $0
            </h4>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.55 }}>
              <li>Open <b>hacktoberfest.com/my/promos</b> &amp; sign in with <b>MyMLH</b> (or use promo code <code>hacktoberfestd0b8o5</code>).</li>
              <li>Go to <b>get.tech</b> and search <code>dyopgis.tech</code> or <code>sevagis.tech</code>.</li>
              <li>Apply coupon at checkout ($12.99 → <b>$0.00</b>) and <b>turn off auto-renew</b> to avoid the $29.99 renewal.</li>
              <li>Add CNAME record `@` → <code>virahitvin8.github.io</code> (or the 4 GitHub Pages A records: <code>185.199.108.153</code> – <code>.111.153</code>).</li>
            </ol>

            <div style={{ marginTop: 4 }}>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>
                Bind Custom Domain CNAME:
                <input
                  type="text"
                  value={customDomainInput}
                  onChange={e => setCustomDomainInput(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, background: '#020617', border: '1px solid #334155', color: '#f8fafc', fontSize: 12 }}
                />
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(`npm run set-domain ${customDomainInput}\ngit add public/CNAME CNAME\ngit commit -m "chore: bind custom domain ${customDomainInput}"\ngit push origin main`, 'cname-cmd')}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7, #10b981)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {copiedKey === 'cname-cmd' ? '✓ Copied Domain Bind Commands' : `Copy Git CNAME Bind Commands (${customDomainInput})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 198 SECURITY GATES & 6-REPO CONTAINMENT STACK */}
      {activeTab === 'security-198' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.35)', padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', marginBottom: 4 }}>GATES 01–40 · APPLICATION SECURITY</div>
            <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#f8fafc' }}>Zero-Trust Input, Auth &amp; Secret Hardening</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              <li><b>GeoJSON &amp; WKT Validation:</b> Rejects malformed rings, self-intersections, and SSRF URLs.</li>
              <li><b>Secrets Isolation:</b> `.env` in `.gitignore`; zero hardcoded EmailOctopus or GEE private keys in client bundle.</li>
              <li><b>CORS &amp; Headers:</b> `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and strict Cloud Run origin verification.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.35)', padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>GATES 41–133 · DATA &amp; CONCURRENCY</div>
            <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#f8fafc' }}>Backpressure, AbortControllers &amp; Cache TTLs</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              <li><b>Race Condition Prevention:</b> Per-parcel `AbortController` map cancels stale Sentinel-2 &amp; Open-Meteo requests on farm switch.</li>
              <li><b>IndexedDB + Drive Vault:</b> Local-first persistence with automatic Google Drive folder organization (`TIFF Files`, `Images`, `Reports`).</li>
              <li><b>Web Worker Offloading:</b> Heavy Float32Array spectral &amp; Horn 1981 terrain kernels execute without blocking UI frames.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 12, border: '1px solid rgba(167, 139, 250, 0.35)', padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd', marginBottom: 4 }}>GATES 158–198 · 6-REPO CONTAINMENT STACK</div>
            <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#f8fafc' }}>Automated Blast-Radius Containment</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              <li><b>01 GitHub Actions:</b> Controlled build, typecheck &amp; Vitest CI pipeline.</li>
              <li><b>02–03 Argo CD &amp; Rollouts:</b> GitOps state sync &amp; progressive canary containment.</li>
              <li><b>04–06 Prometheus, Sentry &amp; OpenTelemetry:</b> `SectionBoundary` isolation + `PopTheTeamModal` real-time incident telemetry.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
