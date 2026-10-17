import React, { useState, useMemo } from 'react'
import {
  Compass, Map as MapIcon, Globe, Terminal, FileCode, Check, Copy,
  Download, ExternalLink, Cpu, Layers, Sparkles, ChevronRight, FileText,
  Boxes, ShieldCheck, Code2, Play, HardDrive, RefreshCw
} from 'lucide-react'
import type { FarmData } from '../lib/seva'
import {
  computeUtmCoordinates,
  generatePyQgisScript,
  generateQgisQmlStyle,
  generateQgisQlr,
  generateArcPyScript,
  generateArcGisLyrx,
  generateGeeCodeEditorScript,
  generateGeePythonScript,
  generateGdalScript,
  generateIsoXmlTaskData,
  generateDxfCad,
  getCleanSlug
} from '../lib/gisInteroperability'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string }
}

type TabKey = 'qgis' | 'arcgis' | 'gee' | 'gdal' | 'isoxml'

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function UniversalGisSuite({ farm }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('qgis')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const utm = useMemo(() => computeUtmCoordinates(farm.lat, farm.lon), [farm.lat, farm.lon])
  const slug = useMemo(() => getCleanSlug(farm.name), [farm.name])

  // Scripts
  const pyQgisScript = useMemo(() => generatePyQgisScript(farm), [farm])
  const qmlStyle = useMemo(() => generateQgisQmlStyle('ndvi'), [])
  const qlrXml = useMemo(() => generateQgisQlr(farm), [farm])
  const arcPyScript = useMemo(() => generateArcPyScript(farm), [farm])
  const lyrxJson = useMemo(() => generateArcGisLyrx(farm), [farm])
  const geeJs = useMemo(() => generateGeeCodeEditorScript(farm), [farm])
  const geePython = useMemo(() => generateGeePythonScript(farm), [farm])
  const gdalScript = useMemo(() => generateGdalScript(farm), [farm])
  const isoXml = useMemo(() => generateIsoXmlTaskData(farm), [farm])
  const dxfCad = useMemo(() => generateDxfCad(farm), [farm])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    })
  }

  return (
    <div className="ag-card" style={{
      borderRadius: 14,
      border: '1px solid #cbd5e1',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      padding: '20px',
      marginTop: '16px',
      marginBottom: '20px',
      boxShadow: '0 4px 20px -2px rgba(0,0,0,0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}>
            <Boxes size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Universal GIS Interop Bridge
              </h3>
              <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid #86efac' }}>
                LeanREA Audited
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Native desktop bridges &amp; pipelines for QGIS, ArcGIS / ArcMap, Google Earth Engine, GDAL &amp; ISO-XML
            </div>
          </div>
        </div>

        {/* Quick telemetry badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, background: '#f1f5f9', padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#475569' }}>
          <span><b>UTM:</b> {utm.zone} (EPSG:{utm.epsg})</span>
          <span>•</span>
          <span><b>Area:</b> {(farm.area || 1).toFixed(2)} Ha</span>
          <span>•</span>
          <span><b>Mean NDVI:</b> {farm.analysis?.ndvi?.mean?.toFixed(2) ?? '0.72'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 14, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('qgis')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: activeTab === 'qgis' ? '1px solid #0284c7' : '1px solid transparent',
            background: activeTab === 'qgis' ? '#e0f2fe' : 'transparent',
            color: activeTab === 'qgis' ? '#0369a1' : '#64748b',
            fontWeight: activeTab === 'qgis' ? 700 : 500,
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Compass size={15} />
          <span>QGIS 3.x (PyQGIS &amp; QML)</span>
        </button>

        <button
          onClick={() => setActiveTab('arcgis')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: activeTab === 'arcgis' ? '1px solid #7c3aed' : '1px solid transparent',
            background: activeTab === 'arcgis' ? '#ede9fe' : 'transparent',
            color: activeTab === 'arcgis' ? '#6d28d9' : '#64748b',
            fontWeight: activeTab === 'arcgis' ? 700 : 500,
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <MapIcon size={15} />
          <span>ArcGIS Pro / ArcMap (ArcPy)</span>
        </button>

        <button
          onClick={() => setActiveTab('gee')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: activeTab === 'gee' ? '1px solid #16a34a' : '1px solid transparent',
            background: activeTab === 'gee' ? '#dcfce7' : 'transparent',
            color: activeTab === 'gee' ? '#15803d' : '#64748b',
            fontWeight: activeTab === 'gee' ? 700 : 500,
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Globe size={15} />
          <span>Google Earth Engine (GEE)</span>
        </button>

        <button
          onClick={() => setActiveTab('gdal')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: activeTab === 'gdal' ? '1px solid #ea580c' : '1px solid transparent',
            background: activeTab === 'gdal' ? '#ffedd5' : 'transparent',
            color: activeTab === 'gdal' ? '#c2410c' : '#64748b',
            fontWeight: activeTab === 'gdal' ? 700 : 500,
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Terminal size={15} />
          <span>GDAL / OGR &amp; CAD</span>
        </button>

        <button
          onClick={() => setActiveTab('isoxml')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: activeTab === 'isoxml' ? '1px solid #475569' : '1px solid transparent',
            background: activeTab === 'isoxml' ? '#f1f5f9' : 'transparent',
            color: activeTab === 'isoxml' ? '#1e293b' : '#64748b',
            fontWeight: activeTab === 'isoxml' ? 700 : 500,
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Cpu size={15} />
          <span>Precision Ag (ISO-XML)</span>
        </button>
      </div>

      {/* Tab 1: QGIS */}
      {activeTab === 'qgis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#f0f9ff', padding: '12px 14px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', lineHeight: 1.5 }}>
            <b>PyQGIS 1-Click Injection:</b> Paste the script into QGIS Python Console (<kbd style={{ background: '#e0f2fe', padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl+Alt+P</kbd>).
            It creates an in-memory vector layer with your exact field boundary, attaches agronomic attributes, applies green high-contrast symbology, loads high-resolution ESRI satellite imagery, and zooms the canvas.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => copyToClipboard(pyQgisScript, 'pyqgis')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {copiedKey === 'pyqgis' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'pyqgis' ? 'Copied to Clipboard!' : 'Copy PyQGIS Script'}
            </button>

            <button
              onClick={() => triggerDownload(`seva_qgis_${slug}.py`, pyQgisScript, 'text/x-python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#0284c7', border: '1px solid #0284c7', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download .py Script
            </button>

            <button
              onClick={() => triggerDownload(`seva_ndvi_${slug}.qml`, qmlStyle, 'text/xml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download QGIS Style (.qml)
            </button>

            <button
              onClick={() => triggerDownload(`seva_layer_${slug}.qlr`, qlrXml, 'text/xml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download Layer Def (.qlr)
            </button>

            <a
              href="/plugins/seva_gee_flow_qgis.zip"
              download="seva_gee_flow_qgis.zip"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#1e293b', color: '#93c5fd', textDecoration: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}
            >
              <Download size={14} /> Full QGIS 3.x Plugin (.zip)
            </a>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace'
            }}>
              <code>{pyQgisScript}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: ArcGIS */}
      {activeTab === 'arcgis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#faf5ff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e9d5ff', fontSize: 12, color: '#6d28d9', lineHeight: 1.5 }}>
            <b>ArcPy Native Pipeline (ArcGIS Pro &amp; ArcMap):</b> Run inside the Python window. Creates a clean geodatabase feature class, builds polygon geometry via <code style={{ fontFamily: 'monospace' }}>arcpy.da.InsertCursor</code>, populates attributes, and attaches to the active map document automatically.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => copyToClipboard(arcPyScript, 'arcpy')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {copiedKey === 'arcpy' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'arcpy' ? 'Copied to Clipboard!' : 'Copy ArcPy Script'}
            </button>

            <button
              onClick={() => triggerDownload(`seva_arcgis_${slug}.py`, arcPyScript, 'text/x-python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#7c3aed', border: '1px solid #7c3aed', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download ArcPy (.py)
            </button>

            <button
              onClick={() => triggerDownload(`seva_symbology_${slug}.lyrx`, lyrxJson, 'application/json')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download ArcGIS Pro (.lyrx)
            </button>

            <a
              href="/plugins/seva_gee_flow_arcgis.zip"
              download="seva_gee_flow_arcgis.zip"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#1e293b', color: '#a78bfa', textDecoration: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}
            >
              <Download size={14} /> Full ArcGIS Python Toolbox (.zip)
            </a>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace'
            }}>
              <code>{arcPyScript}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Google Earth Engine */}
      {activeTab === 'gee' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
            <b>Earth Engine JavaScript &amp; Python Studio:</b> Pre-configured with Sentinel-2 L2A Harmonized, Scene Classification Layer (SCL) cloud shadow filtering, NDVI, NDMI, SAVI, EVI, and Copernicus DEM elevation &amp; slope with Google Drive export tasks.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => copyToClipboard(geeJs, 'gee_js')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {copiedKey === 'gee_js' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'gee_js' ? 'Copied to Clipboard!' : 'Copy GEE JavaScript'}
            </button>

            <a
              href="https://code.earthengine.google.com/"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#16a34a', border: '1px solid #16a34a', textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
            >
              <ExternalLink size={14} /> Open Earth Engine Code Editor
            </a>

            <button
              onClick={() => triggerDownload(`seva_gee_${slug}.js`, geeJs, 'application/javascript')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download GEE Script (.js)
            </button>

            <button
              onClick={() => triggerDownload(`seva_gee_batch_${slug}.py`, geePython, 'text/x-python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download Headless Python (.py)
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace'
            }}>
              <code>{geeJs}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: GDAL / OGR & CAD */}
      {activeTab === 'gdal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff7ed', padding: '12px 14px', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 12, color: '#c2410c', lineHeight: 1.5 }}>
            <b>GDAL / OGR Commands &amp; AutoCAD DXF:</b> Command-line recipes for converting GeoJSON to ESRI Shapefile and OGC GeoPackage, projecting to UTM Zone {utm.zone}, clipping rasters, running <code style={{ fontFamily: 'monospace' }}>gdal_calc.py</code>, and creating Cloud Optimized GeoTIFFs (COG). Includes AutoCAD DXF output.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => copyToClipboard(gdalScript, 'gdal')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ea580c', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {copiedKey === 'gdal' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'gdal' ? 'Copied to Clipboard!' : 'Copy GDAL Commands'}
            </button>

            <button
              onClick={() => triggerDownload(`seva_gdal_${slug}.sh`, gdalScript, 'text/x-sh')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#ea580c', border: '1px solid #ea580c', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download Shell Script (.sh)
            </button>

            <button
              onClick={() => triggerDownload(`seva_cad_${slug}.dxf`, dxfCad, 'application/dxf')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download AutoCAD DXF (.dxf)
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace'
            }}>
              <code>{gdalScript}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 5: ISO-XML Precision Ag */}
      {activeTab === 'isoxml' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
            <b>Precision Agriculture ISO 11783-10 TaskData XML:</b> Standard interchange format for tractor terminals and rate controllers. Copy into a <code style={{ fontFamily: 'monospace' }}>TASKDATA/</code> folder on any FAT32 USB drive to load into John Deere GreenStar, Trimble TMX-2050, Topcon, or Case IH AFS monitors for Variable Rate Application (VRA).
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => copyToClipboard(isoXml, 'isoxml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#334155', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {copiedKey === 'isoxml' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'isoxml' ? 'Copied to Clipboard!' : 'Copy TASKDATA.XML'}
            </button>

            <button
              onClick={() => triggerDownload(`TASKDATA.XML`, isoXml, 'text/xml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: '#ffffff', color: '#334155', border: '1px solid #334155', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Download size={14} /> Download TASKDATA.XML
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '14px',
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace'
            }}>
              <code>{isoXml}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
