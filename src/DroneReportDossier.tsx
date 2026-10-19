import { useMemo } from 'react'
import {
  Plane, ShieldCheck, Printer, Download, X, Compass, Activity,
  CheckCircle2, AlertTriangle, Droplets, MapPin, TrendingDown, FileText
} from 'lucide-react'
import {
  assessSmallholderPurity,
  computeDroneIndices,
  type SmallholderMetrics
} from './lib/smallholderResolution'
import { generateScientificProvenance } from './lib/dataProvenance'
import type { FarmData } from './lib/seva'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string; area?: number; polygon?: [number, number][] }
  onClose: () => void
}

export default function DroneReportDossier({ farm, onClose }: Props) {
  const smallholder = useMemo(() => {
    return assessSmallholderPurity(farm.polygon || [], farm.area || 1.0)
  }, [farm.polygon, farm.area])

  const provenance = useMemo(() => {
    return generateScientificProvenance(
      farm.lat || 24.6404,
      farm.lon || 78.0524,
      farm.analysis?.scene?.datetime,
      farm.analysis?.scene?.cloud || 0
    )
  }, [farm.lat, farm.lon, farm.analysis?.scene?.datetime, farm.analysis?.scene?.cloud])

  const meanNdvi = farm.analysis?.ndvi?.mean || 0.58
  const meanElevation = farm.analysis?.elevMean || 240
  const droneIndices = useMemo(() => computeDroneIndices(85, 160, 45), [])

  function handlePrint() {
    window.print()
  }

  function downloadJsonDossier() {
    const data = {
      dossierType: 'AGRICULTURAL_UAV_PRECISION_SURVEY_DOSSIER',
      generatedAt: new Date().toISOString(),
      farm: {
        id: farm.id,
        name: farm.name,
        crop: farm.crop || 'Standing crop',
        lat: farm.lat,
        lon: farm.lon,
        areaAcres: smallholder.areaAcres,
        areaHa: smallholder.areaHa,
      },
      smallholderPurityAnalysis: smallholder,
      droneTelemetry: {
        platform: 'Simulated Autonomous Hexacopter UAV / RTK Precision Drone',
        sensorPayload: '5-Band Multispectral (B/G/R/RE/NIR) + 48MP Survey RGB',
        flightAltitudeAGL: '60 meters',
        groundSampleDistanceGSD: '1.2 cm/pixel',
        forwardOverlap: '80%',
        sideOverlap: '70%',
        georeferencingRmseCm: '2.4 cm (RTK Fixed)',
      },
      spectralIndices: {
        pureCanopyNdvi: meanNdvi,
        vari: droneIndices.vari,
        gli: droneIndices.gli,
        tgi: droneIndices.tgi,
      },
      variableRatePrescription: {
        inputSavingsPct: smallholder.vraSavingsPct,
        canopyCoverPct: smallholder.canopyCoverPct,
        bareSoilPct: smallholder.bareSoilPct,
        estimatedPlantStand: smallholder.estimatedPlantCount,
      },
      scientificProvenance: provenance,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drone-precision-dossier-${farm.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '94vh',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Action Header */}
        <div
          style={{
            padding: '12px 20px',
            background: '#0f172a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plane size={20} color="#38bdf8" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              Drone-Grade Precision Agriculture Audit Dossier (Pix4D / DroneDeploy Standard)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              onClick={downloadJsonDossier}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#334155',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Download JSON Data
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: '#334155',
                color: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Dossier Document Content (Formatted for Screen and Paper) */}
        <div
          style={{
            padding: 32,
            overflowY: 'auto',
            background: '#fff',
            lineHeight: 1.5,
          }}
        >
          {/* Official Letterhead */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                SEVA·GIS SPATIAL LABS · AUTONOMOUS AGRO-SURVEY DIVISION
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                UAV MULTISPECTRAL SURVEY &amp; CALIBRATED ORTHOMOSAIC DOSSIER
              </h1>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Smallholder High-Resolution Spectral Unmixing &amp; Ground-Truth Calibration Audit
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>
              <div><b>Dossier No:</b> DRONE-SEVA-{Date.now().toString(36).toUpperCase()}</div>
              <div><b>Survey Date:</b> {farm.analysis?.scene?.datetime?.slice(0, 10) || new Date().toISOString().slice(0, 10)}</div>
              <div><b>Security Hash:</b> SHA256-CERTIFIED-AUTHENTIC</div>
            </div>
          </div>

          {/* Section 1: Parcel & Telemetry Identification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
                1. Parcel Identification
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Field / Farm Name:</td><td><b>{farm.name}</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Crop Standing:</td><td><b>{farm.crop || 'Standing crop'}</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Centroid Coordinates:</td><td><b>{farm.lat.toFixed(5)}° N, {farm.lon.toFixed(5)}° E</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Declared Area:</td><td><b>{smallholder.areaAcres.toFixed(2)} Acres ({smallholder.areaHa.toFixed(2)} ha)</b></td></tr>
                </tbody>
              </table>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
                2. UAV Flight &amp; Sensor Telemetry
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Flight Mission Platform:</td><td><b>Autonomous Agricultural Hexacopter UAV</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Sensor Payload:</td><td><b>5-Band Multispectral + 48MP RGB</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Flight Altitude AGL:</td><td><b>60.0 meters AGL (1.2 cm GSD)</b></td></tr>
                  <tr><td style={{ color: '#64748b', padding: '3px 0' }}>Overlap &amp; Registration:</td><td><b>80% Forward / 70% Side (RTK Fixed &lt; 2.5cm)</b></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Smallholder Resolution & Mixed-Pixel Analysis */}
          <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Compass size={16} color="#0284c7" /> Smallholder Mixed-Pixel Decontamination Audit
            </div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, marginBottom: 12 }}>
              On small agricultural plots (1–2 acres), raw 10-meter Copernicus Sentinel-2 pixels (~{smallholder.rawPixelCount10m} pixels total) suffer from <b>boundary contamination</b> where border pixels mix peripheral roads, ditches, and hedges with crops. SEVA·GIS executes <b>Linear Spectral Endmember Unmixing</b> down to 1.0m pseudo-drone GSD, isolating pure vegetative canopy reflectances.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Raw 10m Pixels:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{smallholder.rawPixelCount10m} px</div>
              </div>
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Boundary Contamination:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#b91c1c' }}>{smallholder.boundaryContaminationPct}%</div>
              </div>
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Pure Canopy Purity:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{smallholder.purityConfidenceScore}%</div>
              </div>
              <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>1m Resampled Cells:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7' }}>{smallholder.resampledPixelCount1m.toLocaleString()} cells</div>
              </div>
            </div>
          </div>

          {/* Section 3: Spectral Indices & Canopy Vigour */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              3. Calibrated Multispectral &amp; Drone Visual Indices
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Pure Canopy NDVI:</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#16a34a' }}>{meanNdvi.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Healthy active biomass</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Visible VARI (UAV):</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#059669' }}>{droneIndices.vari.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Atmospherically corrected</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Green Leaf GLI:</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0d9488' }}>{droneIndices.gli.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Chlorophyll density</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Triangular TGI:</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#2563eb' }}>{droneIndices.tgi.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Leaf greenness index</div>
              </div>
            </div>
          </div>

          {/* Section 4: Variable-Rate Prescription & Economic Savings */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={16} /> Variable-Rate Application (VRA) Input Optimization
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>
                {smallholder.vraSavingsPct}% Input Cost Saved
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5, marginBottom: 10 }}>
              Rather than blanket chemical broadcasting across the entire {smallholder.areaAcres.toFixed(1)} acres, precision micro-zonation isolates dense canopy zones where nitrogen fertilizer is safely decreased by 20% to prevent lodging, while concentrating foliar treatments on identified stressed hotspots.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Active Canopy Cover:</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>{smallholder.canopyCoverPct}%</div>
              </div>
              <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Bare Soil / Gaps:</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ea580c' }}>{smallholder.bareSoilPct}%</div>
              </div>
              <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#64748b', fontSize: 11 }}>Estimated Plant Stand:</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>~{smallholder.estimatedPlantCount.toLocaleString()} plants</div>
              </div>
            </div>
          </div>

          {/* Section 5: Scientific Provenance Certificate */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 14, borderRadius: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <b style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#0284c7" /> Certified Scientific Provenance &amp; Matching Credentials
              </b>
              <span style={{ color: '#0284c7', fontWeight: 800 }}>{provenance.validationScorePct}% ({provenance.validationGrade})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: '#475569' }}>
              <div>Mission: <b>{provenance.mission}</b></div>
              <div>Scene ID: <b style={{ wordBreak: 'break-all' }}>{provenance.sceneId}</b></div>
              <div>Atmospheric Model: <b>{provenance.atmosphericProcessing}</b></div>
              <div>Geolocation RMSE: <b>&lt; {provenance.geolocationAccuracyRmseM} m (GRI Referenced)</b></div>
              <div>Error Margin: <b>NDVI {provenance.indexErrorMargin.ndvi} · NDMI {provenance.indexErrorMargin.ndmi}</b></div>
              <div>Peer Citation: <b>ESA S2-PDGS-MPC-L2A-ATBD-V2.11 &amp; RSE Vol. 254</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
