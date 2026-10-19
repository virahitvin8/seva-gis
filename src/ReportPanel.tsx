import LogoLoader from './LogoLoader'
import { useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  FileJson,
  Printer,
  FileText,
  Languages,
  Mail,
  Send,
  History,
  Trash2,
  FolderOpen,
  Eye,
  Sparkles,
  CheckCircle2,
  Layers,
  Sliders,
  CheckSquare,
  Square,
  Compass,
  PieChart,
  HeartHandshake,
  ShieldCheck,
  Download,
  ExternalLink,
  FileArchive,
  Image,
} from 'lucide-react'
import { createZipArchive } from './lib/zipWriter'
import { useAccount } from './Auth'
import EmailOctopusGreetingModal from './EmailOctopusGreetingModal'
import AoiHealthScorePie from './AoiHealthScorePie'
import ArtCraftStudio from './ArtCraftStudio'
import {
  DEFAULT_OPTS,
  MAP_CHOICES,
  BAND_SYMBOLOGY_CHOICES,
  REPORT_LANG_NAMES,
  buildReport,
  type CartOpts,
  type ReportFarm,
  type ReportLang,
  type ReportOpts,
} from './report'
import { dispatchExport, uploadToGoogleDrive } from './lib/googleDriveVault'
import {
  getReportHistory,
  saveReportToHistory,
  deleteReportHistory,
  clearAllReportHistory,
  downloadHistoricalReport,
  type ReportHistoryEntry,
} from './lib/reportHistory'
import { syncAndSendViaEmailOctopus, EMAIL_OCTOPUS_CONFIG } from './lib/emailOctopus'
import { executeEmailPackageDelivery, type EmailGenerationResult } from './lib/emailGenerator'
import { openReportPrintView } from './lib/reportPdf'
import { useI18n } from './lib/i18n'

export default function ReportPanel({ farm }: { farm?: ReportFarm | null }) {
  // Must be called before the early return below, so the hook order stays stable.
  const { t } = useI18n()
  if (!farm) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>{t('rp.noField')}</p>
        <p style={{ margin: 0, fontSize: '13px' }}>{t('rp.needAoi')}</p>
      </div>
    )
  }
  return <ReportPanelInner farm={farm} />
}

function ReportPanelInner({ farm }: { farm: ReportFarm }) {
  const { who } = useAccount()
  const { t } = useI18n()
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [reports, setReports] = useState<Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>>>({})
  const [previewLang, setPreviewLang] = useState<ReportLang>('en')
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'create' | 'history' | 'health' | 'adv' | 'craft'>('create')
  const [greetingModalData, setGreetingModalData] = useState<{
    isOpen: boolean
    recipientEmail: string
    farmName: string
    custodianName?: string
    reportId: string
    filename: string
    htmlContent: string
    areaHa?: number
    ndvi?: number
    ndmi?: number
    contactId?: string
  }>({
    isOpen: false,
    recipientEmail: '',
    farmName: '',
    custodianName: who.name || 'SEVA·GIS Member',
    reportId: '',
    filename: '',
    htmlContent: '',
    areaHa: farm.area,
    ndvi: farm.analysis?.ndvi?.mean,
    ndmi: farm.analysis?.ndmi?.mean,
    contactId: '',
  })
  const [emailInput, setEmailInput] = useState(() => {
    try {
      return localStorage.getItem('seva-user-email') || ''
    } catch {
      return ''
    }
  })
  const [autoEmailOnDownload, setAutoEmailOnDownload] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailPackage, setEmailPackage] = useState<EmailGenerationResult | null>(null)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [historyList, setHistoryList] = useState<ReportHistoryEntry[]>([])
  const [downloading, setDownloading] = useState<'pdf' | 'doc' | 'dossier' | 'json' | 'md' | 'zip' | 'images' | ''>('')
  const [exportFormat, setExportFormat] = useState<'html' | 'pdf' | 'doc' | 'json' | 'md' | 'zip'>('html')

  const [selectedLangs, setSelectedLangs] = useState<ReportLang[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('seva-report-langs') || '["en"]')
      return Array.isArray(saved) && saved.length ? saved : ['en']
    } catch {
      return ['en']
    }
  })
  const [opts, setOpts] = useState<ReportOpts>(() => {
    try {
      return { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem('seva-report-opts') || '{}') }
    } catch {
      return DEFAULT_OPTS
    }
  })

  const loadHistory = async () => {
    const list = await getReportHistory(farm.id)
    setHistoryList(list)
  }

  useEffect(() => {
    loadHistory()
  }, [farm.id, tab])

  const upd = (o: ReportOpts) => {
    setOpts(o)
    localStorage.setItem('seva-report-opts', JSON.stringify(o))
  }

  const toggleLang = (l: ReportLang) => {
    let next: ReportLang[]
    if (selectedLangs.includes(l)) {
      if (selectedLangs.length === 1) return
      next = selectedLangs.filter(x => x !== l)
    } else {
      next = [...selectedLangs, l]
    }
    setSelectedLangs(next)
    localStorage.setItem('seva-report-langs', JSON.stringify(next))
  }

  const toggleMap = (id: string) => {
    const next = opts.maps.includes(id) ? opts.maps.filter(m => m !== id) : [...opts.maps, id]
    upd({ ...opts, maps: next })
  }

  const toggleBandSymbology = (id: string) => {
    const cur = opts.bandSymbologies ?? []
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    upd({ ...opts, bandSymbologies: next })
  }

  const selectAllMaps = () => upd({ ...opts, maps: MAP_CHOICES.map(m => m.id) })
  const defaultMaps = () => upd({ ...opts, maps: DEFAULT_OPTS.maps })
  const selectAllBands = () => upd({ ...opts, bandSymbologies: BAND_SYMBOLOGY_CHOICES.map(b => b.id) })
  const defaultBands = () => upd({ ...opts, bandSymbologies: DEFAULT_OPTS.bandSymbologies ?? ['rgb', 'cir', 'agri'] })

  const CART: [keyof CartOpts, string, string][] = [
    ['title', 'Title & Border Plaque', 'top-left neatline banner'],
    ['north', 'Compass Rose North Arrow', 'top-right geodetic quadrant'],
    ['scale', 'Dual-Tone Metric Scale Bar', 'bottom-left corner'],
    ['legend', 'Comprehensive Map Legend', 'bottom-right corner'],
    ['coords', 'Geodetic Grid Coordinate Ticks', 'tick marks along all 4 borders'],
  ]

  const farmUpper = farm.name.toUpperCase().trim()
  const baseFilename = `(${farmUpper}_SEVA GIS)`

  // Display values come from the loaded analysis or show an em dash. The old
  // invented fallbacks (0.65 / 0.32 / 7.5) are gone.
  const aNdvi = farm.analysis?.ndvi?.mean
  const aNdmi = farm.analysis?.ndmi?.mean
  const aStress = farm.analysis?.stressPct
  const num2 = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v.toFixed(2) : '—')
  const num1 = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v.toFixed(1) : '—')
  const deltaOf = (v: number | undefined, ref: number, digits = 2) =>
    v !== undefined && Number.isFinite(v) ? `${v - ref >= 0 ? '+' : ''}${(v - ref).toFixed(digits)}` : '—'

  async function make() {
    if (!selectedLangs.length) {
      setErr('Please select at least one language.')
      return
    }
    setErr('')
    setReports({})
    setBusy('Starting')
    try {
      let viewport: { zoom?: number; bbox?: [number, number, number, number] } | undefined
      try {
        const saved = JSON.parse(localStorage.getItem('seva-map-view-bounds') || '{}')
        if (saved.zoom || saved.bbox) {
          viewport = { zoom: saved.zoom, bbox: saved.bbox }
        }
      } catch {}
      const runOpts: ReportOpts = { ...opts, viewport }

      const res: Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>> = {}
      for (const l of selectedLangs) {
        setBusy(`Compiling ${REPORT_LANG_NAMES[l].native} 3D report…`)
        const r = await buildReport(farm, setBusy, { ...runOpts, lang: l })
        res[l] = r

        const rd = r.data as {
          metrics?: { ndvi?: { mean?: number | null }; stressPct?: number | null }
          areaHa?: number | null
          scene?: { datetime?: string | null }
        }
        await saveReportToHistory({
          id: r.id + '-' + l,
          farmId: farm.id,
          farmName: farm.name,
          filename: `${baseFilename}_${l.toUpperCase()}`,
          createdAt: new Date().toISOString(),
          sizeBytes: new Blob([r.html]).size,
          lang: l,
          format: 'HTML',
          htmlContent: r.html,
          summary: {
            ndviMean: rd.metrics?.ndvi?.mean ?? null,
            stressPct: rd.metrics?.stressPct ?? null,
            areaHa: rd.areaHa ?? null,
            location: farm.location,
            sceneDate: typeof rd.scene?.datetime === 'string' ? rd.scene.datetime.slice(0, 10) : null,
          },
          devicePath: `/seva-gis/reports/${baseFilename}_${l.toUpperCase()}.html`,
        })
      }
      setReports(res)
      const active = selectedLangs.includes(previewLang) ? previewLang : selectedLangs[0]
      setPreviewLang(active)
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([res[active]!.html], { type: 'text/html' })))
      await loadHistory()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not build the report. Check connection and try again.')
    }
    setBusy('')
  }

  const switchPreview = (l: ReportLang) => {
    setPreviewLang(l)
    if (reports[l]) {
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([reports[l]!.html], { type: 'text/html' })))
    }
  }

  const save = (name: string, body: string, type: string) => {
    void dispatchExport({
      category: 'reports',
      fileName: name,
      blob: body,
      mimeType: type,
      customToast: `Saved report (${name}) to device & Google Drive: SEVA GIS / Reports`
    })
  }

  /**
   * Downloads the report as a PDF by handing the *same document that is being
   * previewed* to the browser's print-to-PDF engine. Also syncs the generated
   * report HTML to the user's Google Drive "SEVA GIS/Reports" folder if connected.
   */
  const handleDownloadPdf = () => {
    const cur = reports[previewLang]
    if (!cur) return
    setDownloading('pdf')
    try {
      openReportPrintView(cur.html, `${baseFilename}.pdf`)
      // Mirror report to Google Drive Reports folder in background
      void uploadToGoogleDrive('reports', `${baseFilename}.html`, cur.html, 'text/html')
    } finally {
      setTimeout(() => setDownloading(''), 1500)
    }
  }

  const print = () => {
    const cur = reports[previewLang]
    if (!cur) return
    openReportPrintView(cur.html, `${baseFilename}.pdf`)
  }

  const handleDownloadWord = () => {
    const cur = reports[previewLang]
    if (!cur) return
    setDownloading('doc')
    try {
      const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${baseFilename}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page { size: A4; margin: 2.5cm 2.5cm 2.5cm 3.5cm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
          th, td { border: 1pt solid #cbd5e1; padding: 6pt; }
          th { background-color: #f1f5f9; font-weight: bold; }
          h1 { font-size: 18pt; text-align: center; color: #10231b; }
          h2 { font-size: 14pt; color: #10231b; }
        </style>
      </head>
      <body>
        ${cur.html}
      </body>
      </html>
    `
      save(`${baseFilename}.doc`, wordHtml, 'application/msword;charset=utf-8')
    } finally {
      setTimeout(() => setDownloading(''), 1000)
    }
  }

  const handleSendEmail = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    if (!emailInput || !emailInput.includes('@')) {
      setErr('Please enter a valid email address.')
      return
    }
    const current = reports[previewLang]
    if (!current) {
      setErr('Please generate the report before sending via email.')
      return
    }

    setSendingEmail(true)
    setEmailSuccess('')
    setErr('')

    try {
      localStorage.setItem('seva-user-email', emailInput)

      const ext = exportFormat === 'pdf' ? 'pdf' : exportFormat === 'doc' ? 'doc' : exportFormat === 'zip' ? 'zip' : exportFormat === 'json' ? 'json' : exportFormat === 'md' ? 'md' : 'html'

      // 1. Generate authentic email bundle, Gmail web link, and sync to Drive without forced .eml download
      const deliveryRes = await executeEmailPackageDelivery({
        recipientEmail: emailInput,
        farmName: farm.name,
        reportId: current.id,
        areaHa: farm.area,
        ndvi: farm.analysis?.ndvi?.mean,
        ndmi: farm.analysis?.ndmi?.mean,
        filename: `${baseFilename}.${ext}`,
        htmlContent: current.html,
        senderName: who.name || 'SEVA·GIS',
        downloadEml: false, // NO FORCED DOWNLOAD
      })

      setEmailPackage(deliveryRes.packageData)
      setEmailSuccess(`Report (${ext.toUpperCase()}) package ready for ${emailInput}! Use the options below to download or send it.`)

      // 2. Background audience sync (non-blocking)
      syncAndSendViaEmailOctopus({
        email: emailInput,
        farmName: farm.name,
        reportId: current.id,
        areaHa: farm.area,
        ndvi: farm.analysis?.ndvi?.mean,
        ndmi: farm.analysis?.ndmi?.mean,
        filename: `${baseFilename}.${ext}`,
        htmlContent: current.html,
      }).catch(() => {})

      setGreetingModalData({
        isOpen: true,
        recipientEmail: emailInput,
        farmName: farm.name,
        custodianName: who.name || 'SEVA·GIS Member',
        reportId: current.id,
        filename: `${baseFilename}.${ext}`,
        htmlContent: current.html,
        areaHa: farm.area,
        ndvi: farm.analysis?.ndvi?.mean,
        ndmi: farm.analysis?.ndmi?.mean,
        // No subscriber ID exists unless an EmailOctopus sync confirmed one;
        // the modal shows a dash rather than a made-up identifier.
        contactId: '',
      })
    } catch (err: any) {
      setErr(err?.message || 'Could not compile email package. Please check network.')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDownloadDossier = async () => {
    if (!curReport) return
    setDownloading('dossier')
    try {
      save(`${baseFilename}.html`, curReport.html, 'text/html')

      const targetEmail = emailInput || localStorage.getItem('seva-user-email') || ''
      if (targetEmail && targetEmail.includes('@') && autoEmailOnDownload) {
        try {
          setSendingEmail(true)
          const deliveryRes = await executeEmailPackageDelivery({
            recipientEmail: targetEmail,
            farmName: farm.name,
            reportId: curReport.id,
            areaHa: farm.area,
            ndvi: farm.analysis?.ndvi?.mean,
            filename: `${baseFilename}.html`,
            htmlContent: curReport.html,
            senderName: who.name || 'SEVA·GIS',
            downloadEml: false, // NO FORCED DOWNLOAD
          })
          setEmailPackage(deliveryRes.packageData)
          setEmailSuccess(`Report downloaded! Email package prepared for ${targetEmail}.`)
          setTimeout(() => setEmailSuccess(''), 10000)
        } catch (e) {
          console.warn('Auto-email on download failed:', e)
        } finally {
          setSendingEmail(false)
        }
      } else if (!targetEmail) {
        setEmailSuccess(`Report downloaded to device! Enter your email in the box below to prepare an email package.`)
        setTimeout(() => setEmailSuccess(''), 8000)
      }
    } finally {
      setTimeout(() => setDownloading(''), 1000)
    }
  }

  const generateMarkdownDossier = () => {
    const cur = reports[previewLang]
    return `# SEVA·GIS Earth Intelligence Dossier: ${farm.name}
**Report ID**: ${cur?.id ?? 'not yet generated'}  
**Location**: ${farm.location} (${farm.lat.toFixed(5)}°N, ${farm.lon.toFixed(5)}°E)  
**Surface Area**: ${farm.area.toFixed(2)} ha (${(farm.area * 2.47105).toFixed(2)} acres)  
**Crop / Ground Cover**: ${farm.crop || 'Agricultural Parcel'}  
**Evaluation Timestamp**: ${new Date().toISOString()}  

---

## Remote Sensing & Canopy Vigor Indices
- **NDVI (Normalized Difference Vegetation Index)**: ${farm.analysis?.ndvi?.mean?.toFixed(2) ?? 'N/A'} (Range: ${farm.analysis?.ndvi?.min?.toFixed(2) ?? '-'} to ${farm.analysis?.ndvi?.max?.toFixed(2) ?? '-'})
- **NDMI (Normalized Difference Moisture Index)**: ${farm.analysis?.ndmi?.mean?.toFixed(2) ?? 'N/A'}
- **Vegetative Canopy Stress**: ${farm.analysis?.stressPct !== undefined ? `${farm.analysis.stressPct.toFixed(1)}% of clear pixels below the 0.30 NDVI flag` : 'Not available - run an analysis first'}
- **Topographical Slope**: ${farm.analysis?.slopePct !== undefined ? `${farm.analysis.slopePct.toFixed(1)}% gradient` : 'Not available'} (Elevation: ${farm.elevation !== undefined ? `${farm.elevation.toFixed(1)} m` : 'Not available'})

---

## Hydrological Water Balance
- **Status**: Not computed here. A continuous water balance needs a calibrated SWAT-class model run with observed streamflow or gauge records for this area of interest; this dossier never estimates those numbers.
- **Framework** (used only when such a run is attached): USDA SCS-CN runoff (Q = (P - Ia)^2 / (P - Ia + S)) and Hargreaves reference ET.

---

## Direct Actionable Agronomic Recommendations
1. **Irrigation check**: The moisture index (NDMI) is a scene reading, not a soil probe. If NDMI looks low, confirm with a soil-moisture check before scheduling irrigation.
2. **Variable Rate Application (VRA)**: The NDVI/NDMI maps show where the crop differs. Follow your normal method in vigorous zones; inspect low-vigour zones in person first (water, pests, drainage, nutrients). SEVA·GIS does not prescribe fertiliser doses.
3. **Soil Conservation**: Contour bunding is a common option on sloping fields. Confirm the gradient with the terrain layer and a field visit before earthworks.

---
*Generated by SEVA·GIS in the browser from the loaded satellite scene, elevation grid and farm records.*
`
  }

  const handleDownloadMarkdown = () => {
    if (!curReport) return
    setDownloading('md')
    try {
      const md = generateMarkdownDossier()
      save(`${baseFilename}_README.md`, md, 'text/markdown;charset=utf-8')
    } finally {
      setTimeout(() => setDownloading(''), 1000)
    }
  }

  const handleDownloadZipPackage = async () => {
    if (!curReport) return
    setDownloading('zip')
    try {
      const mdContent = generateMarkdownDossier()
      const jsonContent = JSON.stringify(curReport.data, null, 2)
      const zipBlob = createZipArchive([
        { name: `${baseFilename}.html`, content: curReport.html },
        { name: `${baseFilename}.json`, content: jsonContent },
        { name: `${baseFilename}_README.md`, content: mdContent },
      ])

      await dispatchExport({
        category: 'reports',
        fileName: `${baseFilename}_Complete_Package.zip`,
        blob: zipBlob,
        mimeType: 'application/zip',
        customToast: `Saved complete ZIP dossier package (${baseFilename}.zip) to device & Google Drive!`,
      })
    } catch (e) {
      console.warn('ZIP generation error:', e)
    } finally {
      setTimeout(() => setDownloading(''), 1000)
    }
  }

  const handleDownloadCartographicImages = async () => {
    if (!curReport) return
    setDownloading('images')
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(curReport.html, 'text/html')
      const svgElements = doc.querySelectorAll('svg')
      const entries: { name: string; content: string }[] = []

      svgElements.forEach((svg, idx) => {
        const title = svg.closest('.figure-box, .map-frame')?.querySelector('figcaption, .fig-title, h3')?.textContent?.trim() || `Map_Figure_${idx + 1}`
        const cleanName = `${idx + 1}_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`
        const serializer = new XMLSerializer()
        const svgStr = serializer.serializeToString(svg)
        entries.push({ name: cleanName, content: svgStr })
      })

      if (entries.length === 0) {
        entries.push({
          name: `${baseFilename}_overview.svg`,
          content: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#10231b"/><text x="50%" y="50%" fill="#86efac" font-size="20" text-anchor="middle">SEVA·GIS Cartographic Map: ${farm.name}</text></svg>`
        })
      }

      const zipBlob = createZipArchive(entries)
      await dispatchExport({
        category: 'images',
        fileName: `${baseFilename}_Cartographic_Maps.zip`,
        blob: zipBlob,
        mimeType: 'application/zip',
        customToast: `Saved ${entries.length} cartographic map images (.zip) to device & Google Drive!`,
      })
    } catch (e) {
      console.warn('Cartographic images export failed:', e)
    } finally {
      setTimeout(() => setDownloading(''), 1000)
    }
  }

  const curReport = reports[previewLang]
  const hasReports = Object.keys(reports).length > 0

  return (
    <div className="rp">
      {/* Tab Navigation */}
      <div className="rp-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'create'}
          className={tab === 'create' ? 'on' : ''}
          onClick={() => setTab('create')}
        >
          <FileText size={15} style={{ display: 'inline', marginRight: 6 }} />{t('rp.generate')}</button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'on' : ''}
          onClick={() => setTab('history')}
        >
          <History size={15} style={{ display: 'inline', marginRight: 6 }} />
          Matcha Vault &amp; History ({historyList.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'health'}
          className={tab === 'health' ? 'on' : ''}
          onClick={() => setTab('health')}
        >
          <PieChart size={15} style={{ display: 'inline', marginRight: 6 }} />{t('rp.healthPie')}</button>
        <button
          role="tab"
          aria-selected={tab === 'adv'}
          className={tab === 'adv' ? 'on' : ''}
          onClick={() => setTab('adv')}
        >{t('rp.cartoSettings')}</button>
        <button
          role="tab"
          aria-selected={tab === 'craft'}
          className={tab === 'craft' ? 'on' : ''}
          onClick={() => setTab('craft')}
          style={{ background: tab === 'craft' ? '#1e1b4b' : undefined, color: tab === 'craft' ? '#c7d2fe' : undefined }}
        >
          <Sparkles size={15} style={{ display: 'inline', marginRight: 6, color: '#818cf8' }} />{t('rp.workbench')}</button>
      </div>

      {/* CREATE TAB */}
      {tab === 'create' && (
        <>
          {/* Language Selection */}
          <div className="rp-lang-select">
            <div className="rp-lang-header">
              <Languages size={15} />
              <span>{t('rp.language')}</span>
            </div>
            <div className="rp-lang-grid">
              {(['en', 'hi', 'te'] as ReportLang[]).map(l => (
                <label key={l} className={`rp-lang-chip ${selectedLangs.includes(l) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedLangs.includes(l)}
                    onChange={() => toggleLang(l)}
                  />
                  <span className="rp-lang-name">{REPORT_LANG_NAMES[l].native}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 1: Core Dossier Elements Checkboxes */}
          <div style={{ marginTop: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <Layers size={16} color="#2d6a4f" />
                <span>{t('rp.coreItems')}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>{t('rp.coreItemsNote')}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.include3dTerrain !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.include3dTerrain !== false}
                  onChange={() => upd({ ...opts, include3dTerrain: opts.include3dTerrain === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>3D Topographic Terrain Model</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.item3d')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeCharts !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeCharts !== false}
                  onChange={() => upd({ ...opts, includeCharts: opts.includeCharts === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{t('rp.itemSensitivity')}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.itemSensitivityNote')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeTables !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeTables !== false}
                  onChange={() => upd({ ...opts, includeTables: opts.includeTables === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{t('rp.itemTables')}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.itemTablesNote')}</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Analysis Lab Parameters Checkboxes */}
          <div style={{ marginTop: '14px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <Sliders size={16} color="#2d6a4f" />
                <span>Analysis Lab Parameters &amp; Maps ({opts.maps.length}/{MAP_CHOICES.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="outline sm" onClick={selectAllMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>{t('rp.selectAll')}</button>
                <button type="button" className="outline sm" onClick={defaultMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Defaults
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {[...new Set(MAP_CHOICES.map(m => m.group))].map(group => {
                const groupMaps = MAP_CHOICES.filter(m => m.group === group)
                const selectedCount = groupMaps.filter(m => opts.maps.includes(m.id)).length
                return (
                  <details key={group} open={selectedCount > 0} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', background: '#fcfdfc' }}>
                    <summary style={{ cursor: 'pointer', color: '#1b4332', fontSize: '12px', fontWeight: 700 }}>
                      {group} <span style={{ color: '#64748b', fontWeight: 500 }}>({selectedCount}/{groupMaps.length})</span>
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px', marginTop: '8px' }}>
                      {groupMaps.map(m => {
                        const checked = opts.maps.includes(m.id)
                        return (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', border: checked ? '1px solid #a7f3d0' : '1px solid #f1f5f9', background: checked ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: '12px' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMap(m.id)} />
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name.split(' (')[0]}</span>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{m.note}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>

          {/* Section 3: Remote Field Review - Band Combinations Checkboxes */}
          <div style={{ marginTop: '14px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <ShieldCheck size={16} color="#2d6a4f" />
                <span>Band Combination Symbology Images ({(opts.bandSymbologies ?? []).length}/{BAND_SYMBOLOGY_CHOICES.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="outline sm" onClick={selectAllBands} style={{ padding: '2px 8px', fontSize: '11.5px' }}>{t('rp.selectAll')}</button>
                <button type="button" className="outline sm" onClick={defaultBands} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Defaults
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
              {BAND_SYMBOLOGY_CHOICES.map(b => {
                const checked = (opts.bandSymbologies ?? []).includes(b.id)
                return (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', border: checked ? '1px solid #a7f3d0' : '1px solid #f1f5f9', background: checked ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBandSymbology(b.id)}
                    />
                    <div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{b.name}</span>
                      <span style={{ fontSize: '10.5px', color: '#2d6a4f', display: 'block', fontFamily: 'monospace' }}>{b.bands}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <p style={{ margin: '14px 0 10px', fontSize: '13px', color: '#334155' }}>{t('rp.compilesIntro')}<b>{baseFilename}</b> in <b>{selectedLangs.map(l => REPORT_LANG_NAMES[l].native).join(', ')}</b>. All raster layers are ingested from official Sentinel-2 L2A &amp; Copernicus DEM, perfectly centered in geodetic frames without border collision.
          </p>

          <button className="primary" onClick={make} disabled={!!busy} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: '14.5px' }}>
            {busy ? <LogoLoader inline size={24} text="" /> : <Sparkles size={16} />}
            {busy ? `${busy}` : hasReports ? 'Re-Generate Dossier' : 'Generate 3D Cartographic Report'}
          </button>

          {err && <p className="rp-err">{err}</p>}

          {/* EmailOctopus delivery snippet box - Stacked Clean Layout */}
          {hasReports && curReport && (
            <div className="rp-email-box" style={{ background: '#f8fafc', border: '1.5px solid #10b981', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                  <Mail size={17} color="#059669" />
                  <span>Report Email Generator &amp; Direct Dispatch</span>
                </div>
                <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                  ● RFC 822 Email Engine &amp; Drive Vault
                </span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#64748b' }}>
                Compiles a complete email package (.eml) with the report attached, pre-populates your email client, and auto-syncs to your Google Drive.
              </p>

              {/* Email form with format selector and direct dispatch */}
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>{t('rp.recipient')}</label>
                    <input
                      type="email"
                      placeholder="Enter your email (e.g. you@gmail.com)"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #10b981',
                        fontSize: '13.5px',
                        background: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>Attachment Format</label>
                    <select
                      value={exportFormat}
                      onChange={e => setExportFormat(e.target.value as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #10b981',
                        fontSize: '13px',
                        background: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        height: '42px'
                      }}
                    >
                      <option value="html">HTML Dossier (.html)</option>
                      <option value="pdf">Print-Ready PDF (.pdf)</option>
                      <option value="zip">Complete Bundle (.zip)</option>
                      <option value="doc">Word Document (.doc)</option>
                      <option value="md">Markdown README (.md)</option>
                      <option value="json">Analytical Data (.json)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="primary sm" disabled={sendingEmail} style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '13.5px' }}>
                  <Send size={15} />
                  {sendingEmail ? 'Compiling Package...' : `Send Report via Email / EmailOctopus (${exportFormat.toUpperCase()})`}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '12.5px', color: '#475569' }}>
                <input
                  type="checkbox"
                  id="auto-email-cb"
                  checked={autoEmailOnDownload}
                  onChange={e => setAutoEmailOnDownload(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="auto-email-cb" style={{ cursor: 'pointer' }}>Automatically generate email package on report download</label>
              </div>

              {emailSuccess && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#047857', fontSize: '12.5px', marginTop: '12px', background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong>{emailSuccess}</strong>
                  </div>
                </div>
              )}

              {/* Multi-Channel Real Email Actions Grid */}
              {emailPackage && (
                <div style={{ marginTop: '14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#059669" />
                    <span>Real Delivery Actions (Instant &amp; Reliable):</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                    <a
                      href={emailPackage.gmailWebUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#ea4335',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Open in Gmail Web</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        const url = URL.createObjectURL(emailPackage.emlBlob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = emailPackage.emlFilename
                        a.click()
                        setTimeout(() => URL.revokeObjectURL(url), 2000)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#047857',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={13} />
                      <span>Download .eml File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(emailPackage.plainSummary)
                          setCopiedEmail(true)
                          setTimeout(() => setCopiedEmail(false), 3000)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#f1f5f9',
                        color: '#1e293b',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      <CheckCircle2 size={13} color={copiedEmail ? '#10b981' : '#64748b'} />
                      <span>{copiedEmail ? 'Copied Briefing!' : 'Copy Briefing Text'}</span>
                    </button>

                    <a
                      href={emailPackage.mailtoUrl}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#f1f5f9',
                        color: '#1e293b',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #cbd5e1',
                        textDecoration: 'none'
                      }}
                    >
                      <Mail size={13} />
                      <span>Default Mail Client</span>
                    </a>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                    Opening the <b>.eml file</b> or <b>Gmail Web</b> will immediately load the executive briefing, attachments, and recipient address without any third-party server delivery failure.
                  </p>
                </div>
              )}

            </div>
          )}

          {hasReports && curReport && (
            <>
              {selectedLangs.length > 1 && (
                <div className="rp-preview-bar">
                  <span className="rp-preview-label">{t('rp.previewLanguage')}</span>
                  <div className="rp-preview-pills">
                    {selectedLangs.map(l => (
                      <button
                        key={l}
                        type="button"
                        className={`rp-preview-pill ${previewLang === l ? 'active' : ''}`}
                        onClick={() => switchPreview(l)}
                      >
                        {REPORT_LANG_NAMES[l].native}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rp-actions" style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  className="primary"
                  onClick={handleDownloadDossier}
                  disabled={!!downloading}
                >
                  {downloading === 'dossier' ? <LogoLoader inline size={16} text="" /> : <ArrowDownToLine size={16} />}
                  {downloading === 'dossier' ? 'Preparing Dossier…' : `HTML Dossier (.html)`}
                </button>
                <button
                  className="primary"
                  onClick={handleDownloadPdf}
                  disabled={!!downloading}
                  style={{ background: '#047857', border: '1px solid #059669' }}
                >
                  {downloading === 'pdf' ? <LogoLoader inline size={16} text="" /> : <ArrowDownToLine size={16} />}
                  {downloading === 'pdf' ? 'Preparing PDF…' : `Print-Ready PDF (.pdf)`}
                </button>
                <button
                  className="primary"
                  onClick={handleDownloadZipPackage}
                  disabled={!!downloading}
                  style={{ background: '#0f766e', border: '1px solid #14b8a6' }}
                  title="Download Complete Package bundling HTML, JSON data, and Markdown README"
                >
                  {downloading === 'zip' ? <LogoLoader inline size={16} text="" /> : <FileArchive size={16} />}
                  {downloading === 'zip' ? 'Packaging ZIP…' : `Complete Package (.zip)`}
                </button>
                <button
                  className="outline"
                  onClick={handleDownloadCartographicImages}
                  disabled={!!downloading}
                  title="Download all high-resolution cartographic map figures as a ZIP pack"
                >
                  {downloading === 'images' ? <LogoLoader inline size={16} text="" /> : <Image size={16} />}
                  {downloading === 'images' ? 'Extracting Maps…' : `Cartographic Images (.zip)`}
                </button>
                <button className="outline" onClick={handleDownloadWord} disabled={!!downloading}>
                  {downloading === 'doc' ? <LogoLoader inline size={16} text="" /> : <FileText size={16} />}
                  {downloading === 'doc' ? 'Exporting Word…' : `Word Document (.doc)`}
                </button>
                <button className="outline" onClick={handleDownloadMarkdown} disabled={!!downloading}>
                  {downloading === 'md' ? <LogoLoader inline size={16} text="" /> : <FileText size={16} />}
                  README Dossier (.md)
                </button>
                <button
                  className="outline"
                  onClick={() => save(`${baseFilename}.json`, JSON.stringify(curReport.data, null, 2), 'application/json')}
                >
                  <FileJson size={16} />
                  Data (JSON)
                </button>
                <button className="outline" onClick={print} title={t('rp.printPreview')}>
                  <Printer size={16} />{t('rp.print')}
                </button>
              </div>

              <p className="rp-note" style={{ margin: '10px 0 14px', fontSize: '12.5px', color: '#475569' }}>
                <b>{t('rp.downloadPdf')}</b> opens your browser's print dialog with this exact report. Choose{' '}
                <b>Destination &rarr; Save as PDF</b> — the saved file is the document you previewed here, with maps,
                legends, scale bars and page breaks intact.
              </p>

              <iframe id="report-frame" className="rp-frame" title={t('rp.previewTitle')} src={url} />
            </>
          )}
        </>
      )}

      {/* MATCHA-INSPIRED REPORT HISTORY & VAULT TAB */}
      {tab === 'history' && (
        <div className="rp-history-pane" style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderOpen size={17} color="#2d6a4f" />{t('rp.vault')}</h4>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>{t('rp.vaultNote')}</p>
            </div>
            {historyList.length > 0 && (
              <button
                className="outline sm"
                onClick={async () => {
                  if (confirm('Clear all historical reports from this device?')) {
                    await clearAllReportHistory()
                    await loadHistory()
                  }
                }}
              >
                <Trash2 size={13} />{t('rp.clearAll')}</button>
            )}
          </div>

          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <History size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>{t('rp.noArchives')}</p>
              <p style={{ margin: '4px 0 12px', fontSize: '12.5px', color: '#64748b' }}>{t('rp.noArchivesNote')}</p>
              <button className="primary sm" onClick={() => setTab('create')}>{t('rp.generateFirst')}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {historyList.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e293b' }}>{entry.filename}</span>
                      <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                        {REPORT_LANG_NAMES[entry.lang]?.label ?? entry.lang}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      Generated: {new Date(entry.createdAt).toLocaleString()} · Size: {(entry.sizeBytes / 1024).toFixed(1)} KB · ID: {entry.id}
                    </div>
                    <div style={{ fontSize: '11px', color: '#2d6a4f', marginTop: '2px', fontFamily: 'monospace' }}>
                      Path: {entry.devicePath}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="outline sm"
                      title={t('rp.previewNewWindow')}
                      onClick={() => {
                        const blob = new Blob([entry.htmlContent], { type: 'text/html' })
                        const u = URL.createObjectURL(blob)
                        window.open(u, '_blank')
                      }}
                    >
                      <Eye size={13} />
                      View
                    </button>
                    <button
                      className="primary sm"
                      title={t('rp.redownload')}
                      onClick={() => downloadHistoricalReport(entry)}
                    >
                      <ArrowDownToLine size={13} />
                      Download
                    </button>
                    <button
                      className="outline sm"
                      title={t('rp.deleteStorage')}
                      onClick={async () => {
                        await deleteReportHistory(entry.id)
                        await loadHistory()
                      }}
                    >
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADVANCED CARTOGRAPHY SETTINGS TAB */}
      {tab === 'adv' && (
        <div className="rp-adv">
          <h4>{t('rp.mapsToInclude')}</h4>
          <p>{t('rp.mapsNote')}</p>
          <div className="rp-checks">
            {MAP_CHOICES.map(m => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={opts.maps.includes(m.id)}
                  onChange={() => toggleMap(m.id)}
                />
                <span>
                  <b>{m.name}</b>
                  <small>{m.note}</small>
                </span>
              </label>
            ))}
          </div>
          <h4>{t('rp.frameElements')}</h4>
          <div className="rp-checks">
            {CART.map(([k, n, w]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={opts.cart[k]}
                  onChange={() => upd({ ...opts, cart: { ...opts.cart, [k]: !opts.cart[k] } })}
                />
                <span>
                  <b>{n}</b>
                  <small>{w}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="rp-tip">
            <b>{t('rp.guarantee')}</b>{t('rp.guaranteeNote')}</p>
          <button className="outline" onClick={() => upd(DEFAULT_OPTS)}>{t('rp.resetCarto')}</button>
        </div>
      )}

      {/* HEALTH TAB: Overall Field Health Pie & Reporter Briefing */}
      {tab === 'health' && (
        <div className="rp-health-tab" style={{ padding: '8px 0' }}>
          <AoiHealthScorePie
            farmName={farm.name}
            crop={farm.crop}
            areaHa={farm.area}
            analysis={farm.analysis}
          />

          {/* Reporter In-Depth Investigation Panel */}
          <div
            style={{
              marginTop: '20px',
              background: '#ffffff',
              border: '1.5px solid #10b981',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>{t('rp.specialDossier')}</span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>{t('rp.reporterDesk')}</span>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 800, color: '#064e3b' }}>{t('rp.pieSynthesis')}</h3>

            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#334155', margin: '0 0 14px' }}>
              <b>{t('rp.context')}</b>{t('rp.contextBody')}</p>

            {/* Parameter Differences Table */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colParam')}</th>
                    <th style={{ padding: '8px 10px' }}>Observed</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colBaseline')}</th>
                    <th style={{ padding: '8px 10px' }}>Difference (Δ)</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colRole')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colVerdict')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowNdvi')}</td>
                    <td style={{ padding: '8px 10px', color: aNdvi === undefined ? '#64748b' : aNdvi >= 0.60 ? '#047857' : '#dc2626', fontWeight: 700 }}>{num2(aNdvi)}</td>
                    <td style={{ padding: '8px 10px' }}>0.60</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: aNdvi === undefined ? '#64748b' : aNdvi >= 0.60 ? '#047857' : '#dc2626' }}>
                      {deltaOf(aNdvi, 0.60)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>Additive (+45% Weight)</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowNdviNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowNdmi')}</td>
                    <td style={{ padding: '8px 10px', color: aNdmi === undefined ? '#64748b' : aNdmi >= 0.30 ? '#0284c7' : '#dc2626', fontWeight: 700 }}>{num2(aNdmi)}</td>
                    <td style={{ padding: '8px 10px' }}>0.30</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: aNdmi === undefined ? '#64748b' : aNdmi >= 0.30 ? '#0284c7' : '#dc2626' }}>
                      {deltaOf(aNdmi, 0.30)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>Additive (+35% Weight)</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowNdmiNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowSavi')}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b', fontWeight: 700 }}>—</td>
                    <td style={{ padding: '8px 10px' }}>0.50</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#64748b' }}>—</td>
                    <td style={{ padding: '8px 10px' }}>{t('rp.saviNotComputed')}</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowSaviNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowStress')}</td>
                    <td style={{ padding: '8px 10px', color: aStress === undefined ? '#64748b' : '#dc2626', fontWeight: 700 }}>{num1(aStress)}%</td>
                    <td style={{ padding: '8px 10px' }}>&lt; 5.0%</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: aStress === undefined ? '#64748b' : '#dc2626' }}>
                      {deltaOf(aStress, 5.0, 1)}%
                    </td>
                    <td style={{ padding: '8px 10px', color: '#dc2626' }}>{t('rp.colDeduction')}</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowStressNote')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reporter Detailed Narrative */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', fontSize: '12.5px', lineHeight: 1.6, color: '#334155' }}>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '6px' }}>{t('rp.synthesis')}</strong>
              <span>
                <b>{t('rp.whyDiffer')}</b>{t('rp.whyDifferBody')}</span>
              <br /><br />
              <span>
                <b>{t('rp.formula')}</b> <code>{t('rp.formulaBody')}</code>. From this sum, stress and moisture deficit penalties are deducted to arrive at the net composite score displayed in the pie chart.
              </span>
              <br /><br />
              <span>
                <b>{t('rp.directive')}</b>{t('rp.directiveBody')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ARTCRAFT WORKBENCH TAB */}
      {tab === 'craft' && (
        <div style={{ marginTop: '16px' }}>
          <ArtCraftStudio farm={farm as any} isModal={false} initialTab="pdfcraft" />
        </div>
      )}

      {/* EmailOctopus Greeting Modal */}
      <EmailOctopusGreetingModal
        isOpen={greetingModalData.isOpen}
        onClose={() => setGreetingModalData(prev => ({ ...prev, isOpen: false }))}
        recipientEmail={greetingModalData.recipientEmail}
        farmName={greetingModalData.farmName}
        custodianName={greetingModalData.custodianName}
        reportId={greetingModalData.reportId}
        filename={greetingModalData.filename}
        htmlContent={greetingModalData.htmlContent}
        areaHa={greetingModalData.areaHa}
        ndvi={greetingModalData.ndvi}
        ndmi={greetingModalData.ndmi}
        contactId={greetingModalData.contactId}
      />
    </div>
  )
}
