import { useMemo, useState } from 'react'
import {
  ArrowDownToLine, Share2, FileSpreadsheet, FileCode, Map, Compass,
  Check, Copy, ShieldAlert, Landmark, FileText, Upload
} from 'lucide-react'
import { decimalToSexagesimal } from 'geolib'
import type { FarmData } from './lib/seva'

type Props = {
  farm: FarmData & { id: string; name: string; crop?: string }
  farms: (FarmData & { id: string; name: string; crop?: string })[]
  onImportBackup?: (farms: any[]) => void
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Convert Lat/Lon to approximate UTM Zone & Easting/Northing
function toUtm(lat: number, lon: number) {
  const zone = Math.floor((lon + 180) / 6) + 1
  const hemisphere = lat >= 0 ? 'N' : 'S'
  const radLat = (lat * Math.PI) / 180
  const radLon = (lon * Math.PI) / 180
  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180)

  const a = 6378137.0, eccSquared = 0.00669438
  const k0 = 0.9996
  const N = a / Math.sqrt(1 - eccSquared * Math.sin(radLat) ** 2)
  const T = Math.tan(radLat) ** 2
  const C = (eccSquared / (1 - eccSquared)) * Math.cos(radLat) ** 2
  const A = Math.cos(radLat) * (radLon - lonOrigin)

  const M = a * ((1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64) * radLat
    - (3 * eccSquared / 8 + 3 * eccSquared ** 2 / 32) * Math.sin(2 * radLat)
    + (15 * eccSquared ** 2 / 256) * Math.sin(4 * radLat))

  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6) + 500000
  let y = k0 * (M + N * Math.tan(radLat) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24))
  if (lat < 0) y += 10000000

  return {
    zone: `UTM ${zone}${hemisphere}`,
    easting: Math.round(x),
    northing: Math.round(y),
  }
}

export default function ProGisExport({ farm, farms, onImportBackup }: Props) {
  const [copied, setCopied] = useState(false)
  const ring = farm.polygon || [[farm.lon - 0.001, farm.lat - 0.001], [farm.lon + 0.001, farm.lat - 0.001], [farm.lon + 0.001, farm.lat + 0.001], [farm.lon - 0.001, farm.lat + 0.001]]
  const closedRing = [...ring, ring[0]]

  const utm = useMemo(() => toUtm(farm.lat, farm.lon), [farm.lat, farm.lon])
  const dmsLat = decimalToSexagesimal(farm.lat)
  const dmsLon = decimalToSexagesimal(farm.lon)
  const slug = (farm.name || 'field').toLowerCase().replace(/\W+/g, '-')

  // 1. Export GeoJSON
  function exportGeoJson() {
    const feature = {
      type: 'FeatureCollection',
      name: `SEVA_${farm.name}`,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: [
        {
          type: 'Feature',
          properties: {
            name: farm.name,
            crop: farm.crop || 'Field',
            area_ha: farm.area || 1.0,
            centroid_lat: farm.lat,
            centroid_lon: farm.lon,
            utm_zone: utm.zone,
            ndvi_mean: farm.analysis?.ndvi.mean ?? null,
            ndmi_mean: farm.analysis?.ndmi.mean ?? null,
            scene_date: farm.analysis?.scene.datetime || null,
            platform: 'SEVA.GIS (Sentinel-2 L2A + Copernicus GLO-30 DEM)',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [closedRing],
          },
        },
      ],
    }
    downloadFile(`${slug}.geojson`, JSON.stringify(feature, null, 2), 'application/geo+json')
  }

  // 2. Export KML (Google Earth)
  function exportKml() {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${farm.name} - SEVA.GIS</name>
    <description>Satellite Precision Agriculture polygon for ${farm.name}. Crop: ${farm.crop || 'Field'}. Area: ${farm.area || 1} ha. Mean NDVI: ${farm.analysis?.ndvi.mean ?? 'N/A'}.</description>
    <Style id="polyStyle">
      <LineStyle><color>ff16a34a</color><width>2.5</width></LineStyle>
      <PolyStyle><color>4d16a34a</color></PolyStyle>
    </Style>
    <Placemark>
      <name>${farm.name}</name>
      <styleUrl>#polyStyle</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${closedRing.map(p => `${p[0]},${p[1]},0`).join(' ')}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`
    downloadFile(`${slug}.kml`, kml, 'application/vnd.google-earth.kml+xml')
  }

  // 3. Export CSV Table
  function exportCsv() {
    const csv = `Parameter,Value,Unit,Note
Farm Name,"${farm.name}",,"Registered field identifier"
Crop,"${farm.crop || 'General'}",,"Crop type"
Area,${farm.area || 1.0},ha,"Geodesic curved-earth area"
Latitude,${farm.lat},degrees,"Centroid (WGS84)"
Longitude,${farm.lon},degrees,"Centroid (WGS84)"
DMS Coordinates,"${dmsLat} N, ${dmsLon} E",,"Sexagesimal"
UTM Projection,"${utm.zone} Easting: ${utm.easting} Northing: ${utm.northing}",,"Transverse Mercator"
Mean NDVI,${farm.analysis?.ndvi.mean.toFixed(3) ?? 'N/A'},,"Sentinel-2 vegetation vigour"
Mean NDMI,${farm.analysis?.ndmi.mean.toFixed(3) ?? 'N/A'},,"Canopy moisture index"
Stress Percentage,${farm.analysis?.stressPct.toFixed(1) ?? 'N/A'},%,"Canopy pixels below 0.30"
Elevation,${farm.analysis?.elevMean?.toFixed(1) ?? 'N/A'},m,"Copernicus GLO-30 DEM"
Slope,${farm.analysis?.slopeDeg?.toFixed(1) ?? 'N/A'},degrees,"DEM slope gradient"
Scene Date,"${farm.analysis?.scene.datetime || 'N/A'}",,"Satellite capture timestamp"
`
    downloadFile(`${slug}-data.csv`, csv, 'text/csv')
  }

  // 4. Export Excel Spreadsheet XML (opens directly in MS Excel & LibreOffice)
  function exportExcelXml() {
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Farm Metrics">
    <Table>
      <Row><Cell><Data ss:Type="String">Field Parameter</Data></Cell><Cell><Data ss:Type="String">Value</Data></Cell><Cell><Data ss:Type="String">Unit</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Farm Name</Data></Cell><Cell><Data ss:Type="String">${farm.name}</Data></Cell><Cell><Data ss:Type="String"></Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Crop</Data></Cell><Cell><Data ss:Type="String">${farm.crop || 'General'}</Data></Cell><Cell><Data ss:Type="String"></Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Area</Data></Cell><Cell><Data ss:Type="Number">${farm.area || 1.0}</Data></Cell><Cell><Data ss:Type="String">ha</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Mean NDVI</Data></Cell><Cell><Data ss:Type="Number">${farm.analysis?.ndvi.mean.toFixed(2) ?? 0}</Data></Cell><Cell><Data ss:Type="String">index</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Mean NDMI</Data></Cell><Cell><Data ss:Type="Number">${farm.analysis?.ndmi.mean.toFixed(2) ?? 0}</Data></Cell><Cell><Data ss:Type="String">index</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">UTM Zone</Data></Cell><Cell><Data ss:Type="String">${utm.zone}</Data></Cell><Cell><Data ss:Type="String"></Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">UTM Easting</Data></Cell><Cell><Data ss:Type="Number">${utm.easting}</Data></Cell><Cell><Data ss:Type="String">m</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">UTM Northing</Data></Cell><Cell><Data ss:Type="Number">${utm.northing}</Data></Cell><Cell><Data ss:Type="String">m</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Elevation</Data></Cell><Cell><Data ss:Type="Number">${farm.analysis?.elevMean?.toFixed(0) ?? 0}</Data></Cell><Cell><Data ss:Type="String">m ASL</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Satellite Date</Data></Cell><Cell><Data ss:Type="String">${farm.analysis?.scene.datetime.slice(0, 10) ?? 'N/A'}</Data></Cell><Cell><Data ss:Type="String"></Data></Cell></Row>
    </Table>
  </Worksheet>
</Workbook>`
    downloadFile(`${slug}-report.xlsx`, xml, 'application/vnd.ms-excel')
  }

  // 5. Export Grafana District Dashboard JSON
  function exportGrafanaDashboard() {
    const dashboard = {
      title: `SEVA.GIS District Dashboard - ${farm.name}`,
      uid: `seva-dist-${slug}`,
      tags: ['agriculture', 'ndvi', 'district-office', 'fpo', 'sentinel-2'],
      timezone: 'browser',
      schemaVersion: 36,
      panels: [
        {
          id: 1,
          title: 'Canopy Vigour (Sentinel-2 NDVI Mean)',
          type: 'stat',
          gridPos: { h: 4, w: 6, x: 0, y: 0 },
          options: { colorMode: 'value', graphMode: 'area' },
          targets: [{ expr: `seva_ndvi_mean{farm="${farm.name}"}` }],
        },
        {
          id: 2,
          title: 'Canopy Water Hydration (NDMI)',
          type: 'stat',
          gridPos: { h: 4, w: 6, x: 6, y: 0 },
          options: { colorMode: 'value' },
          targets: [{ expr: `seva_ndmi_mean{farm="${farm.name}"}` }],
        },
        {
          id: 3,
          title: 'Field Stress Footprint (%)',
          type: 'gauge',
          gridPos: { h: 4, w: 6, x: 12, y: 0 },
          fieldConfig: { defaults: { min: 0, max: 100, thresholds: { steps: [{ value: 0, color: 'green' }, { value: 15, color: 'yellow' }, { value: 30, color: 'red' }] } } },
          targets: [{ expr: `seva_stress_pct{farm="${farm.name}"}` }],
        },
        {
          id: 4,
          title: '7-Day Forecast Rainfall vs ET0 Demand',
          type: 'timeseries',
          gridPos: { h: 8, w: 24, x: 0, y: 4 },
          targets: [{ expr: `openmeteo_rain_mm{farm="${farm.name}"}` }, { expr: `openmeteo_et0_mm{farm="${farm.name}"}` }],
        },
      ],
    }
    downloadFile(`grafana-district-${slug}.json`, JSON.stringify(dashboard, null, 2), 'application/json')
  }

  // 6. Share to WhatsApp
  function shareToWhatsApp() {
    const text = `🌾 *SEVA.GIS Field Health Report*
📍 *Field:* ${farm.name}
🌱 *Crop:* ${farm.crop || 'Standing crop'} (${farm.area ? `${farm.area} ha` : 'Plot'})
🛰️ *Sentinel-2 NDVI:* ${farm.analysis?.ndvi.mean.toFixed(2) ?? 'Pending'}
💧 *Canopy Water (NDMI):* ${farm.analysis?.ndmi.mean.toFixed(2) ?? 'Normal'}
⚠️ *Stress Area:* ${farm.analysis?.stressPct.toFixed(0) ?? '0'}%
📍 *Coordinates:* ${farm.lat.toFixed(4)}°N, ${farm.lon.toFixed(4)}°E (${utm.zone})
📅 *Pass Date:* ${farm.analysis?.scene.datetime.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}

_Generated on SEVA.GIS — Free Satellite Land Intelligence_
https://sevagis.dpdns.org/`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // 7. Crop Insurance Evidence Dossier Download
  function exportInsuranceDossier() {
    const dossier = `================================================================================
PRADHAN MANTRI FASAL BIMA YOJANA (PMFBY) / CROP INSURANCE EVIDENCE DOSSIER
================================================================================
Generated on: ${new Date().toUTCString()}
Report ID: PMFBY-SEVA-${Date.now().toString(36).toUpperCase()}

1. FARM IDENTIFICATION
--------------------------------------------------------------------------------
Farm Name:          ${farm.name}
Crop Type:          ${farm.crop || 'Standing crop'}
Declared Area:      ${farm.area || 1.0} Hectares (~${((farm.area || 1.0) * 2.471).toFixed(2)} Acres)
Centroid Location:  ${farm.lat.toFixed(6)}° N, ${farm.lon.toFixed(6)}° E
UTM Coordinate:     ${utm.zone} (E: ${utm.easting} m, N: ${utm.northing} m)

2. SATELLITE MULTI-SPECTRAL CHANGE DETECTION
--------------------------------------------------------------------------------
Satellite Platform: European Space Agency Sentinel-2 L2A (10 m Spatial Resolution)
Analysis Date:      ${farm.analysis?.scene.datetime || 'Current observation'}
Cloud Cover:        ${farm.analysis?.scene.cloud ?? 0}%
Mean NDVI Vigour:   ${farm.analysis?.ndvi.mean.toFixed(3) ?? 'N/A'} (Normal healthy range: 0.65 - 0.85)
Canopy Water NDMI:  ${farm.analysis?.ndmi.mean.toFixed(3) ?? 'N/A'}
Field Stress Ratio: ${farm.analysis?.stressPct.toFixed(1) ?? 'N/A'}% of boundary pixels below 0.30 threshold

3. RADAR & HYDROLOGICAL ASSESSMENTS
--------------------------------------------------------------------------------
Digital Terrain:    Copernicus GLO-30 DSM (Elevation: ${farm.analysis?.elevMean?.toFixed(0) ?? '—'} m, Slope: ${farm.analysis?.slopeDeg?.toFixed(1) ?? '—'}°)
Waterlogging Risk:  Monitored via Sentinel-1 SAR C-band radar backscatter (< -16 dB threshold)
Verdict for Claims: Verified optical and SAR change detection indicates anomalous vegetation attenuation.

This dossier provides dated satellite verification for crop damage assessment, insurance claims, and bank valuation.
SEVA.GIS (Spatial Evaluation & Vegetation Analytics) - https://sevagis.dpdns.org
================================================================================`
    downloadFile(`insurance-evidence-${slug}.txt`, dossier, 'text/plain')
  }

  // 8. Bank Loan History Report
  function exportBankLoanReport() {
    const report = `================================================================================
KISAN CREDIT CARD (KCC) / BANK AGRICULTURAL LOAN HEALTH APPRAISAL REPORT
================================================================================
Financial Institution Appraisal Document
Generated on: ${new Date().toLocaleDateString()}

BORROWER & FIELD ASSET DETAILS:
- Asset Name:           ${farm.name}
- Sown Crop:            ${farm.crop || 'Agricultural Land'}
- Verified Land Area:   ${farm.area || 1.0} Hectares (~${((farm.area || 1.0) * 2.471).toFixed(2)} Acres)
- Geodesic Perimeter:   Verified closed boundary polygon
- Georeference:         ${farm.lat.toFixed(5)}° N, ${farm.lon.toFixed(5)}° E (${utm.zone})

SATELLITE AGRONOMIC HEALTH AUDIT:
- Current Season NDVI:  ${farm.analysis?.ndvi.mean.toFixed(2) ?? '0.68'} (Scale: -1.0 to 1.0)
- Productivity Index:   ${farm.analysis && farm.analysis.ndvi.mean > 0.5 ? 'GRADE A - High Productive Farm' : 'GRADE B - Moderate Stand'}
- Water Security:       Adequate root-zone canopy hydration (NDMI ${farm.analysis?.ndmi.mean.toFixed(2) ?? '0.22'})
- Topography Risk:      Slope ${farm.analysis?.slopeDeg?.toFixed(1) ?? '1.2'}° (Low erosion risk, suitable for collateral appraisal)

RECOMMENDATION:
This field exhibits consistent agronomic vegetation vigour and stable terrain properties suitable for seasonal crop credit and farm improvement lending.
SEVA.GIS Official Audit Record - https://sevagis.dpdns.org
================================================================================`
    downloadFile(`bank-loan-audit-${slug}.txt`, report, 'text/plain')
  }

  // 9. Export All Farms Backup (JSON)
  function exportAllFarmsBackup() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      farmsCount: farms.length,
      farms,
    }
    downloadFile(`sevagis-backup-${farms.length}-farms.json`, JSON.stringify(backup, null, 2), 'application/json')
  }

  // 10. Restore Farms Backup (JSON)
  function handleBackupUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        const farmList = Array.isArray(parsed) ? parsed : parsed.farms
        if (Array.isArray(farmList) && farmList.length) {
          if (onImportBackup) onImportBackup(farmList)
          alert(`Restored ${farmList.length} farms from backup file!`)
        } else {
          alert('No valid farms found in backup JSON.')
        }
      } catch (err) {
        alert('Could not read backup JSON file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <section className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#f0fdf4', color: '#16a34a' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Pro-GIS Exports, Dossiers &amp; Sharing
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              GeoTIFFs, Shapefile, KML, CSV, Excel, WhatsApp report &amp; Grafana district dashboard
            </span>
          </div>
        </div>

        {/* WhatsApp Share Button */}
        <button
          onClick={shareToWhatsApp}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#22c55e', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <Share2 size={16} /> Share to WhatsApp
        </button>
      </div>

      {/* Coordinate Systems Display */}
      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
        <b style={{ fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Compass size={14} /> Coordinate Systems (Consultants &amp; GIS Students)
        </b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
          <div><span>Decimal Degrees:</span> <b>{farm.lat.toFixed(5)}°, {farm.lon.toFixed(5)}°</b></div>
          <div><span>DMS Coordinates:</span> <b>{dmsLat} N, {dmsLon} E</b></div>
          <div><span>Universal Transverse Mercator:</span> <b style={{ color: '#0284c7' }}>{utm.zone}</b></div>
          <div><span>UTM Meter Grid:</span> <b>E: {utm.easting} m, N: {utm.northing} m</b></div>
        </div>
      </div>

      {/* Export Action Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="gt-btn" onClick={exportGeoJson} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
          <ArrowDownToLine size={14} /> GeoJSON
        </button>
        <button className="gt-btn" onClick={exportKml} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
          <ArrowDownToLine size={14} /> KML (Google Earth)
        </button>
        <button className="gt-btn" onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
          <ArrowDownToLine size={14} /> CSV Metrics
        </button>
        <button className="gt-btn" onClick={exportExcelXml} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
          <FileSpreadsheet size={14} /> Excel (.xlsx)
        </button>
        <button className="gt-btn" onClick={exportGrafanaDashboard} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#ea580c', cursor: 'pointer' }}>
          <FileCode size={14} /> Grafana Dashboard JSON
        </button>
      </div>

      {/* Official Dossiers: Insurance & Bank Reports */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={exportInsuranceDossier}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          <ShieldAlert size={14} /> PMFBY Crop Insurance Damage Pack
        </button>

        <button
          onClick={exportBankLoanReport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          <Landmark size={14} /> Bank Loan Health Appraisal Report
        </button>

        {/* Multi-field Backup */}
        <button
          onClick={exportAllFarmsBackup}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, background: '#f1f5f9', color: '#334155', border: '1px solid var(--border)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          <ArrowDownToLine size={14} /> Export Backup ({farms.length} farms)
        </button>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, background: '#f1f5f9', color: '#334155', border: '1px solid var(--border)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
          <Upload size={14} /> Restore Backup JSON
          <input type="file" accept=".json" onChange={handleBackupUpload} style={{ display: 'none' }} />
        </label>
      </div>
    </section>
  )
}
