/**
 * Connector Agent + Interoperability Agent
 * Provides:
 *  1. Unified Multi-Engine Adapter API (GEE / QGIS / ArcMap / MATLAB-Octave)
 *  2. Typed Port Compatibility Validator for the Node-Graph Builder
 *  3. Clean Multi-Format Spatial Exporters (GeoJSON, KML, CSV, Excel XML/XLSX, Obsidian Zettelkasten Note)
 *     — Replaces unprofessional WhatsApp text dumps.
 */

import {
  AOIFeature,
  EngineNode,
  MineralIndicationResult,
  NodePort,
  PortDataType,
  SpectralIndexResult,
  SwatParameterRank,
} from '../types/seva';

const COMPATIBLE_PORT_MATRIX: Record<PortDataType, PortDataType[]> = {
  AOI_POLYGON: ['AOI_POLYGON', 'MULTISPECTRAL_RASTER', 'SAR_BACKSCATTER', 'DEM_TERRAIN'],
  MULTISPECTRAL_RASTER: ['MULTISPECTRAL_RASTER', 'DEM_TERRAIN', 'MATRIX_1D_SERIES', 'COMPOSITE_REPORT'],
  SAR_BACKSCATTER: ['SAR_BACKSCATTER', 'MULTISPECTRAL_RASTER', 'DEM_TERRAIN', 'COMPOSITE_REPORT'],
  DEM_TERRAIN: ['DEM_TERRAIN', 'HYDRO_VECTOR', 'MULTISPECTRAL_RASTER', 'COMPOSITE_REPORT'],
  HYDRO_VECTOR: ['HYDRO_VECTOR', 'COMPOSITE_REPORT'],
  MATRIX_1D_SERIES: ['MATRIX_1D_SERIES', 'COMPOSITE_REPORT'],
  COMPOSITE_REPORT: ['COMPOSITE_REPORT'],
};

export function validatePortConnection(
  sourceNode: EngineNode,
  sourcePort: NodePort,
  targetNode: EngineNode,
  targetPort: NodePort
): { isValid: boolean; reason: string } {
  if (sourceNode.id === targetNode.id) {
    return {
      isValid: false,
      reason: `Self-loop blocked: Cannot connect ${sourcePort.label} back into the same engine (${sourceNode.title}).`,
    };
  }

  const allowedTargets = COMPATIBLE_PORT_MATRIX[sourcePort.dataType] || [];
  if (allowedTargets.includes(targetPort.dataType)) {
    return {
      isValid: true,
      reason: `Valid Pipeline Link: ${sourceNode.title} [${sourcePort.label}] → ${targetNode.title} [${targetPort.label}] (${sourcePort.dataType} → ${targetPort.dataType}).`,
    };
  }

  return {
    isValid: false,
    reason: `Incompatible Port Types: ${sourcePort.label} (${sourcePort.dataType}) cannot feed ${targetPort.label} (${targetPort.dataType}) without an intermediate raster/vector conversion node.`,
  };
}

export function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAoiGeoJson(
  aoi: AOIFeature,
  indices: SpectralIndexResult[],
  minerals: MineralIndicationResult[]
): string {
  const ring = aoi.coordinates.map((c) => [c.lon, c.lat]);
  if (ring.length > 0) ring.push([aoi.coordinates[0].lon, aoi.coordinates[0].lat]);

  const geojson = {
    type: 'FeatureCollection',
    name: `SEVAGIS_${aoi.name}`,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: [
      {
        type: 'Feature',
        properties: {
          id: aoi.id,
          name: aoi.name,
          hectares: aoi.hectares,
          acres: aoi.acres,
          perimeterKm: aoi.perimeterKm,
          ...Object.fromEntries(indices.map((i) => [i.code, i.value])),
          ...Object.fromEntries(minerals.map((m) => [m.id, `${m.aoiCoveragePercent}% (Indicated)`])),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      },
    ],
  };
  return JSON.stringify(geojson, null, 2);
}

export function exportAoiKml(aoi: AOIFeature, indices: SpectralIndexResult[]): string {
  const coordsStr = [
    ...aoi.coordinates.map((c) => `${c.lon},${c.lat},0`),
    `${aoi.coordinates[0]?.lon || 0},${aoi.coordinates[0]?.lat || 0},0`,
  ].join(' ');

  const extendedData = indices
    .map(
      (idx) =>
        `<Data name="${idx.code}"><value>${idx.value} (${idx.status})</value></Data>`
    )
    .join('\n          ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SEVA.GIS — ${aoi.name}</name>
    <Placemark>
      <name>${aoi.name} (${aoi.hectares.toFixed(2)} ha)</name>
      <ExtendedData>
        ${extendedData}
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

export function exportAoiCsvAndExcel(
  aoi: AOIFeature,
  indices: SpectralIndexResult[],
  minerals: MineralIndicationResult[],
  swat: SwatParameterRank[]
): string {
  const rows: string[][] = [
    ['SEVA.GIS Spatial & Agronomic Telemetry Export', aoi.name, `${aoi.hectares.toFixed(2)} ha`],
    [],
    ['Category', 'Code / Mineral / Parameter', 'Formula / Formulation', 'Value', 'Unit / Coverage', 'Status / Rank', 'Citation & Source'],
    ...indices.map((i) => [
      i.category.toUpperCase(),
      `${i.code} (${i.name})`,
      i.formula,
      String(i.value),
      i.unit,
      i.status,
      `${i.citation} — ${i.sensor}`,
    ]),
    ...minerals.map((m) => [
      'MINERAL (INDICATED)',
      m.mineralGroup,
      m.bandRatioFormula,
      String(m.meanRatioValue),
      `${m.aoiCoveragePercent}% AOI Cover`,
      m.statusLabel,
      `${m.citation} — ${m.sensorSource}`,
    ]),
    ...swat.map((s) => [
      'SWAT HYDROLOGY',
      `${s.parameterCode} (${s.parameterName})`,
      s.formulation,
      String(s.fittedValue),
      `t-stat: ${s.tStatSensitivity}`,
      `Rank #${s.rank}`,
      `p-value: ${s.pValue}`,
    ]),
  ];

  return rows
    .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/**
 * Generates an Obsidian Zettelkasten Markdown Note structured after groepl/Obsidian-Templates
 */
export function exportObsidianZettelkastenNote(
  aoi: AOIFeature,
  indices: SpectralIndexResult[],
  minerals: MineralIndicationResult[]
): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `---
title: "SEVA.GIS Field Intelligence Note — ${aoi.name}"
date: "${dateStr}"
tags:
  - type/field-note
  - theme/seva-gis
  - theme/precision-agriculture
  - sensor/sentinel-2-l2a
aoi_hectares: ${aoi.hectares.toFixed(2)}
centroid: [${aoi.centroid.lat.toFixed(5)}, ${aoi.centroid.lon.toFixed(5)}]
---

# ${aoi.name} — Spatial Evaluation & Vegetation Analytics

> **Summary:** Multi-sensor Earth Observation synthesis for **${aoi.name}** (${aoi.hectares.toFixed(2)} ha / ${aoi.acres.toFixed(2)} ac) computed via SEVA.GIS ("Where Satellites Meet Soil").

## 1. Key Spectral Insights
${indices.map((i) => `- **${i.code} (${i.name})**: \`${i.value}\` [${i.status}] — *Formula:* \`${i.formula}\` (${i.citation})`).join('\n')}

## 2. Indicated Surface Mineralogy (Spectrally Inferred)
${minerals.map((m) => `- **${m.mineralGroup}** (*${m.statusLabel}*): Ratio \`${m.meanRatioValue}\` covering **${m.aoiCoveragePercent}%** of AOI — ${m.justification}`).join('\n')}

---
*Template structure adapted from [groepl/Obsidian-Templates](https://github.com/groepl/Obsidian-Templates) for SEVA.GIS Zettelkasten Agronomic Vaults.*
`;
}
