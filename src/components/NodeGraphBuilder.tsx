/**
 * Node-Graph Agent + Interoperability Agent
 * Visual Dataflow DAG Editor bridging 5 engines:
 *  1. Google Earth Engine (GEE Cloud)
 *  2. QGIS Core (PyQGIS Local HTTP Bridge 127.0.0.1:8765)
 *  3. ArcMap / ArcGIS Pro (arcpy Python Toolbox)
 *  4. MATLAB / GNU Octave Engine
 *  5. SEVA.GIS Synthesizer (Browser-First GeoAI)
 *
 * Rules:
 *  - Manual trigger only (never auto-opens on AOI selection)
 *  - Independent single-port toggle (selecting Port 1 never selects all ports)
 *  - Scroll-synced SVG connection lines
 *  - Green dotted lines for valid typed data links
 *  - Red lines with incompatibility tooltips for mismatched links
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Database,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { EngineNode, NodeConnection, NodePort, PortDataType } from '../types/seva';
import { validatePortConnection, triggerBrowserDownload } from '../services/engineConnector';

interface NodeGraphBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  aoiName?: string;
  onExportGraph?: (connections: NodeConnection[]) => void;
}

const INITIAL_NODES: EngineNode[] = [
  {
    id: 'node-gee',
    engine: 'gee',
    title: 'Google Earth Engine Cloud',
    subtitle: 'Sentinel-2 L2A BOA / Sentinel-1 SAR / GLO-30 DEM',
    badge: 'Cloud Engine',
    ports: [
      { id: 'p-gee-aoi-in', nodeId: 'node-gee', label: 'AOI Geometry In', direction: 'input', dataType: 'AOI_POLYGON', bandOrFormula: 'EPSG:4326', selected: false },
      { id: 'p-gee-s2-out', nodeId: 'node-gee', label: 'S2 L2A BOA Composite (10m)', direction: 'output', dataType: 'MULTISPECTRAL_RASTER', bandOrFormula: 'B2,B3,B4,B8,B11,B12', selected: false },
      { id: 'p-gee-sar-out', nodeId: 'node-gee', label: 'S1 C-Band SAR GRD (10m)', direction: 'output', dataType: 'SAR_BACKSCATTER', bandOrFormula: 'VV, VH (dB)', selected: false },
      { id: 'p-gee-dem-out', nodeId: 'node-gee', label: 'Copernicus 30m DEM Terrain', direction: 'output', dataType: 'DEM_TERRAIN', bandOrFormula: 'Elevation, Slope, Aspect', selected: false },
    ],
  },
  {
    id: 'node-qgis',
    engine: 'qgis',
    title: 'QGIS Core (PyQGIS)',
    subtitle: 'Local HTTP Bridge (127.0.0.1:8765)',
    badge: 'Desktop GPLv2+',
    ports: [
      { id: 'p-qgis-aoi-out', nodeId: 'node-qgis', label: 'Active Canvas Layer AOI', direction: 'output', dataType: 'AOI_POLYGON', bandOrFormula: 'QgsVectorLayer (EPSG:4326)', selected: false },
      { id: 'p-qgis-raster-in', nodeId: 'node-qgis', label: 'Push GEE Composite to Canvas', direction: 'input', dataType: 'MULTISPECTRAL_RASTER', bandOrFormula: 'GeoTIFF / VRT', selected: false },
      { id: 'p-qgis-drainage-out', nodeId: 'node-qgis', label: 'r.watershed Hydro Network', direction: 'output', dataType: 'HYDRO_VECTOR', bandOrFormula: 'GRASS / SAGA Drainage Lines', selected: false },
    ],
  },
  {
    id: 'node-arcmap',
    engine: 'arcmap',
    title: 'ArcMap & ArcGIS Pro (arcpy)',
    subtitle: 'Python Toolbox (.pyt) Geoprocessing',
    badge: 'Desktop Esri',
    ports: [
      { id: 'p-arc-shapefile-out', nodeId: 'node-arcmap', label: 'ArcMap Selected Feature AOI', direction: 'output', dataType: 'AOI_POLYGON', bandOrFormula: 'FeatureClassToNumPyArray', selected: false },
      { id: 'p-arc-raster-in', nodeId: 'node-arcmap', label: 'Spatial Analyst Raster Input', direction: 'input', dataType: 'MULTISPECTRAL_RASTER', bandOrFormula: 'arcpy.sa.Raster', selected: false },
      { id: 'p-arc-hydro-in', nodeId: 'node-arcmap', label: 'Arc Hydro Flow Direction Sink', direction: 'input', dataType: 'DEM_TERRAIN', bandOrFormula: 'Fill + FlowDirection', selected: false },
    ],
  },
  {
    id: 'node-matlab',
    engine: 'matlab',
    title: 'MATLAB / GNU Octave Engine',
    subtitle: 'Spectral Unmixing & Covariance Matrix',
    badge: 'Math Core',
    ports: [
      { id: 'p-mat-raster-in', nodeId: 'node-matlab', label: 'Multispectral Matrix In', direction: 'input', dataType: 'MULTISPECTRAL_RASTER', bandOrFormula: 'Single / Float32 [N x M x B]', selected: false },
      { id: 'p-mat-unmix-out', nodeId: 'node-matlab', label: 'Linear Spectral Unmixing (FCLS)', direction: 'output', dataType: 'MATRIX_1D_SERIES', bandOrFormula: 'Endmember Abundance Fractions', selected: false },
      { id: 'p-mat-savgol-out', nodeId: 'node-matlab', label: 'Savitzky-Golay NDVI Filter', direction: 'output', dataType: 'MATRIX_1D_SERIES', bandOrFormula: 'Polynomial Order 3 / Window 5', selected: false },
    ],
  },
  {
    id: 'node-sevagis',
    engine: 'sevagis',
    title: 'SEVA.GIS Synthesizer',
    subtitle: 'Browser-First GeoAI & Institutional Dossier',
    badge: 'Main Synthesizer',
    ports: [
      { id: 'p-seva-aoi-in', nodeId: 'node-sevagis', label: 'AOI Polygon', direction: 'input', dataType: 'AOI_POLYGON', bandOrFormula: 'Client-side Boundary', selected: false },
      { id: 'p-seva-raster-in', nodeId: 'node-sevagis', label: 'Spectral Raster In', direction: 'input', dataType: 'MULTISPECTRAL_RASTER', bandOrFormula: '30+ Calibrated Indices', selected: false },
      { id: 'p-seva-matrix-in', nodeId: 'node-sevagis', label: 'Matrix & Time-Series In', direction: 'input', dataType: 'MATRIX_1D_SERIES', bandOrFormula: 'NDVI / Moisture Vectors', selected: false },
      { id: 'p-seva-report-out', nodeId: 'node-sevagis', label: '19+ Cartographic Layouts & Report', direction: 'output', dataType: 'COMPOSITE_REPORT', bandOrFormula: 'PDF/DOCX/Drive/SMTP', selected: false },
    ],
  },
];

export const NodeGraphBuilder: React.FC<NodeGraphBuilderProps> = ({
  isOpen,
  onClose,
  aoiName = 'Active AOI',
}) => {
  const [nodes, setNodes] = useState<EngineNode[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<NodeConnection[]>([
    {
      id: 'conn-1',
      fromNodeId: 'node-qgis',
      fromPortId: 'p-qgis-aoi-out',
      toNodeId: 'node-gee',
      toPortId: 'p-gee-aoi-in',
      isValid: true,
      validationMessage: 'Valid Link: PyQGIS AOI feeds Google Earth Engine processing.',
    },
    {
      id: 'conn-2',
      fromNodeId: 'node-gee',
      fromPortId: 'p-gee-s2-out',
      toNodeId: 'node-sevagis',
      toPortId: 'p-seva-raster-in',
      isValid: true,
      validationMessage: 'Valid Link: GEE Sentinel-2 composite feeds SEVA.GIS 30+ spectral engines.',
    },
  ]);

  const [activeSourcePort, setActiveSourcePort] = useState<{
    node: EngineNode;
    port: NodePort;
  } | null>(null);

  const [hoveredConnection, setHoveredConnection] = useState<NodeConnection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Single port selection handler (only toggles clicked port, never all ports)
  const handlePortClick = (node: EngineNode, port: NodePort) => {
    if (!activeSourcePort) {
      if (port.direction === 'output') {
        setActiveSourcePort({ node, port });
      }
      return;
    }

    // If clicking the same port, cancel selection
    if (activeSourcePort.port.id === port.id) {
      setActiveSourcePort(null);
      return;
    }

    // If clicking another output port on any node, switch active source
    if (port.direction === 'output') {
      setActiveSourcePort({ node, port });
      return;
    }

    // Connect source (output) -> target (input)
    const { isValid, reason } = validatePortConnection(
      activeSourcePort.node,
      activeSourcePort.port,
      node,
      port
    );

    const newConnection: NodeConnection = {
      id: `conn-${Date.now()}`,
      fromNodeId: activeSourcePort.node.id,
      fromPortId: activeSourcePort.port.id,
      toNodeId: node.id,
      toPortId: port.id,
      isValid,
      validationMessage: reason,
    };

    setConnections((prev) => [...prev, newConnection]);
    setActiveSourcePort(null);
  };

  const removeConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
  };

  const downloadGraphScript = () => {
    const payload = {
      aoi: aoiName,
      exportedAt: new Date().toISOString(),
      engines: nodes.map((n) => ({ id: n.id, engine: n.engine, title: n.title })),
      pipelineLinks: connections.map((c) => ({
        from: `${c.fromNodeId}:${c.fromPortId}`,
        to: `${c.toNodeId}:${c.toPortId}`,
        valid: c.isValid,
        annotation: c.validationMessage,
      })),
    };
    triggerBrowserDownload(
      `SEVA_GIS_${aoiName.replace(/\W+/g, '_')}_MultiEngine_Graph.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg tracking-tight text-white">
                  Multi-Engine Node-Graph Builder
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Live DAG Editor
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bridge Google Earth Engine, QGIS, ArcMap arcpy, and MATLAB/Octave with typed spatial ports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadGraphScript}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Graph JSON</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Instructions Bar */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Connections: <strong className="text-white">{connections.length}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 border-b-2 border-emerald-400 border-dotted" /> Green Dotted: Valid Typed Link
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 border-b-2 border-rose-500" /> Red: Incompatible Type
            </span>
          </div>

          {activeSourcePort && (
            <div className="text-emerald-300 font-bold bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-500/40">
              Source active: {activeSourcePort.node.title} [{activeSourcePort.port.label}] — click any compatible Input port below
            </div>
          )}
        </div>

        {/* Node Workspace Grid */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] bg-slate-950 relative"
        >
          {/* Active Connections List Box */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-2xl bg-slate-900/90 border-2 border-slate-800 hover:border-slate-700 shadow-xl overflow-hidden flex flex-col"
              >
                {/* Node Header */}
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-white">{node.title}</h3>
                    <p className="text-[11px] text-slate-400">{node.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {node.badge}
                  </span>
                </div>

                {/* Ports List */}
                <div className="p-3 space-y-2 flex-1">
                  {node.ports.map((port) => {
                    const isSelected = activeSourcePort?.port.id === port.id;
                    const isOutput = port.direction === 'output';

                    return (
                      <div
                        key={port.id}
                        onClick={() => handlePortClick(node, port)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400'
                            : isOutput
                            ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
                            : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOutput ? 'bg-sky-400' : 'bg-emerald-400'
                              }`}
                            />
                            <span>{port.label}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {port.dataType} · {port.bandOrFormula}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isOutput
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {port.direction}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Active Connections Panel */}
          <div className="mt-8 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3 relative z-10">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Active Multi-Engine Data Links ({connections.length})
            </h4>

            {connections.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active links. Click any Output port above, then click an Input port to connect engines.
              </p>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoveredConnection(c)}
                    onMouseLeave={() => setHoveredConnection(null)}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                      c.isValid
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {c.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>{c.validationMessage}</span>
                    </div>

                    <button
                      onClick={() => removeConnection(c.id)}
                      className="text-xs font-bold text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800 transition"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeGraphBuilder;
