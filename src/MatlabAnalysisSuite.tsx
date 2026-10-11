import React, { useState, useMemo } from 'react'
import { LineChart, Sparkles, Terminal, Copy, Check, Download, Layers, Activity } from 'lucide-react'
import type { HistoryRow } from './lib/gee'
import type { FarmData } from './lib/seva'

interface Props {
  rows: HistoryRow[]
  farm: FarmData & { id: string; name: string }
}

export default function MatlabAnalysisSuite({ rows, farm }: Props) {
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [degree, setDegree] = useState<2 | 3 | 4>(3)

  // Extract time (days from t0) and NDVI
  const fitData = useMemo(() => {
    if (rows.length < 4) return null
    const t0 = new Date(rows[0].scene.datetime).getTime()
    const points = rows.map(r => {
      const tDays = (new Date(r.scene.datetime).getTime() - t0) / 86400000
      return { tDays, date: r.scene.datetime.slice(0, 10), ndvi: r.ndvi, ndmi: r.ndmi }
    })

    const n = points.length
    const maxT = Math.max(...points.map(p => p.tDays))

    // Least Squares Polynomial Fit: deg 3 -> y = a*x^3 + b*x^2 + c*x + d
    // Normalize x to [0, 1] for numerical stability
    const xs = points.map(p => p.tDays / Math.max(1, maxT))
    const ys = points.map(p => p.ndvi)

    // Build Vandermonde matrix and solve normal equations for deg 3
    // [sum(x^6) sum(x^5) ...] [a] = [sum(x^3 * y)]
    // For small n (10-30), direct normal equation solver
    const deg = degree
    const order = deg + 1
    const A = Array.from({ length: order }, () => Array(order).fill(0))
    const B = Array(order).fill(0)

    for (let r = 0; r < order; r++) {
      for (let c = 0; c < order; c++) {
        const p = (order - 1 - r) + (order - 1 - c)
        A[r][c] = xs.reduce((acc, x) => acc + Math.pow(x, p), 0)
      }
      const pY = order - 1 - r
      B[r] = xs.reduce((acc, x, i) => acc + Math.pow(x, pY) * ys[i], 0)
    }

    // Gaussian elimination
    const coeffs = Array(order).fill(0)
    for (let i = 0; i < order; i++) {
      let maxEl = Math.abs(A[i][i]), maxRow = i
      for (let k = i + 1; k < order; k++) {
        if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k }
      }
      for (let k = i; k < order; k++) {
        const tmp = A[maxRow][k]; A[maxRow][k] = A[i][k]; A[i][k] = tmp
      }
      const tmpB = B[maxRow]; B[maxRow] = B[i]; B[i] = tmpB

      for (let k = i + 1; k < order; k++) {
        const c = -A[k][i] / (A[i][i] || 1e-9)
        for (let j = i; j < order; j++) {
          if (i === j) A[k][j] = 0
          else A[k][j] += c * A[i][j]
        }
        B[k] += c * B[i]
      }
    }

    for (let i = order - 1; i >= 0; i--) {
      coeffs[i] = B[i] / (A[i][i] || 1e-9)
      for (let k = i - 1; k >= 0; k--) {
        B[k] -= A[k][i] * coeffs[i]
      }
    }

    const evalPoly = (xNorm: number) => {
      let sum = 0
      for (let i = 0; i < order; i++) {
        sum += coeffs[i] * Math.pow(xNorm, order - 1 - i)
      }
      return sum
    }

    // Compute R² and RMSE
    const yMean = ys.reduce((a, b) => a + b, 0) / n
    let ssTot = 0, ssRes = 0
    points.forEach((p, idx) => {
      const pred = evalPoly(xs[idx])
      ssTot += Math.pow(p.ndvi - yMean, 2)
      ssRes += Math.pow(p.ndvi - pred, 2)
    })
    const r2 = Math.max(0, Math.min(0.999, 1 - (ssRes / (ssTot || 1))))
    const rmse = Math.sqrt(ssRes / n)

    // Generate fitted curve sample points
    const curveSamples = 60
    const curvePoints = Array.from({ length: curveSamples }, (_, i) => {
      const xNorm = i / (curveSamples - 1)
      const tDays = xNorm * maxT
      const predNdvi = Math.max(0, Math.min(1, evalPoly(xNorm)))
      return { tDays, predNdvi }
    })

    return { points, maxT, coeffs, r2, rmse, curvePoints, evalPoly }
  }, [rows, degree])

  if (!fitData) return null

  // Generate MATLAB .m script code
  const matlabScript = `% =========================================================================
% SEVA·GIS Automated MATLAB Agri-Signal Processing Script
% Study Area: ${farm.name} (Centroid: ${farm.lat.toFixed(5)}°N, ${farm.lon.toFixed(5)}°E)
% Sensor: Sentinel-2 Level-2A Multi-Spectral BOA Reflectance
% =========================================================================
clc; clear; close all;

% 1. Telemetry Ingestion (Days from start & Observed NDVI)
t_days = [${fitData.points.map(p => p.tDays.toFixed(1)).join(', ')}];
ndvi_obs = [${fitData.points.map(p => p.ndvi.toFixed(3)).join(', ')}];
dates = [${fitData.points.map(p => `'${p.date}'`).join(', ')}];

% 2. Polynomial Fitting (Degree ${degree})
p_coeffs = polyfit(t_days, ndvi_obs, ${degree});

% 3. Evaluate High-Density Continuous Trajectory
t_dense = linspace(min(t_days), max(t_days), 200);
ndvi_pred = polyval(p_coeffs, t_dense);

% 4. 1st Derivative (Velocity of Biomass Accumulation dNDVI/dt)
p_deriv = polyder(p_coeffs);
v_growth = polyval(p_deriv, t_dense);

% 5. Goodness of Fit Statistics
y_fit = polyval(p_coeffs, t_days);
SS_tot = sum((ndvi_obs - mean(ndvi_obs)).^2);
SS_res = sum((ndvi_obs - y_fit).^2);
R2 = 1 - (SS_res / SS_tot);
RMSE = sqrt(mean((ndvi_obs - y_fit).^2));

fprintf('===========================================\\n');
fprintf('MATLAB Agri-Spectral Phenology Summary\\n');
fprintf('Polynomial Degree: %d\\n', ${degree});
fprintf('Coefficient of Determination R^2: %.4f\\n', R2);
fprintf('Root Mean Square Error (RMSE)   : %.4f\\n', RMSE);
fprintf('===========================================\\n');

% 6. Render MathWorks Publication Graphic
figure('Name', 'SEVA·GIS Phenology Signal Analysis', 'Color', [1 1 1]);
subplot(2, 1, 1);
plot(t_days, ndvi_obs, 'ro', 'MarkerFaceColor', [0.85 0.33 0.1], 'MarkerSize', 7); hold on;
plot(t_dense, ndvi_pred, 'b-', 'LineWidth', 2.2);
grid on; box on;
xlabel('Elapsed Days (t)'); ylabel('Canopy NDVI');
title(sprintf('Phenological Growth Trajectory (R^2 = %.3f, RMSE = %.3f)', R2, RMSE));
legend('Sentinel-2 Observations', 'MATLAB Polynomial Fit', 'Location', 'best');

subplot(2, 1, 2);
plot(t_dense, v_growth, 'g-', 'LineWidth', 1.8); hold on;
yline(0, 'k--', 'LineWidth', 1);
grid on; box on;
xlabel('Elapsed Days (t)'); ylabel('dNDVI / dt (Growth Velocity)');
title('First-Order Vegetative Biomass Rate of Change');
legend('Growth Velocity (dNDVI/dt)', 'Inflection (Senescence Threshold)', 'Location', 'best');
`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(matlabScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleDownloadScript = () => {
    const blob = new Blob([matlabScript], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SEVA_GIS_${farm.name.replace(/[^a-zA-Z0-9]/g, '_')}_Phenology_MATLAB.m`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Dimensions for MATLAB-themed SVG
  const W = 700, H = 220, L = 50, R = 20, T = 30, B = 35
  const X = (t: number) => L + (t / Math.max(1, fitData.maxT)) * (W - L - R)
  const Y = (v: number) => T + (1 - Math.max(0, Math.min(1, v))) * (H - T - B)

  const curveD = fitData.curvePoints.map((p, i) => `${i ? 'L' : 'M'}${X(p.tDays).toFixed(1)},${Y(p.predNdvi).toFixed(1)}`).join(' ')

  return (
    <div style={{ background: '#ffffff', borderRadius: '10px', border: '1.5px solid #cbd5e1', padding: '16px', marginTop: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {/* Header with MATLAB theme badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#0076a8', color: '#ffffff', borderRadius: 4, padding: '3px 7px', fontSize: 11, fontWeight: 800, letterSpacing: '0.5px' }}>
            MATLAB
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
              Numerical Curve Fitting &amp; Phenology Synthesis (MathWorks Protocol)
            </h4>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Polynomial regression ($R^2$, RMSE) · Biomass rate of change ($d\text{NDVI}/dt$) · Autonomous script synthesis
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 6, padding: '2px 6px', fontSize: 11 }}>
            <span style={{ color: '#475569', marginRight: 4 }}>Degree:</span>
            {[2, 3, 4].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDegree(d as any)}
                style={{
                  border: 'none',
                  background: degree === d ? '#0076a8' : 'transparent',
                  color: degree === d ? '#ffffff' : '#334155',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: degree === d ? 700 : 500,
                  fontSize: 10.5,
                  cursor: 'pointer'
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCode(s => !s)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #0076a8',
              background: showCode ? '#e0f2fe' : '#ffffff',
              color: '#0076a8',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Terminal size={12} />
            <span>{showCode ? 'Hide Code' : 'View MATLAB Code'}</span>
          </button>
        </div>
      </div>

      {/* MATLAB Statistical Indicators Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Goodness-of-Fit (R²)</span>
          <b style={{ fontSize: 14, color: '#0076a8' }}>{fitData.r2.toFixed(3)}</b>
          <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block' }}>Variance explained</span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Root Mean Square Error</span>
          <b style={{ fontSize: 14, color: '#059669' }}>{fitData.rmse.toFixed(3)}</b>
          <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block' }}>Residual standard error</span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Observed Passes</span>
          <b style={{ fontSize: 14, color: '#0f172a' }}>{fitData.points.length} Scenes</b>
          <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block' }}>Calibrated multi-spectral</span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Mathematical Model</span>
          <b style={{ fontSize: 12, color: '#d97706', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Polynomial Deg {degree}
          </b>
          <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block' }}>Least squares inversion</span>
        </div>
      </div>

      {/* MATLAB Figure Canvas */}
      <div style={{ background: '#ffffff', border: '1px solid #94a3b8', borderRadius: 6, padding: '8px 12px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8, fontSize: 10, color: '#475569' }}>
          <span><b>Figure 1:</b> Phenological Growth &amp; Canopy Trajectory ({farm.name})</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }}/> Observed NDVI</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 14, height: 2, background: '#0076a8', display: 'inline-block' }}/> MATLAB Polyfit (Deg {degree})</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          {/* MATLAB Style Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map(v => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={L - 8} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="monospace">{v.toFixed(2)}</text>
            </g>
          ))}

          {/* Time axis ticks */}
          {fitData.points.filter((_, idx) => idx % Math.ceil(fitData.points.length / 5) === 0).map(p => (
            <g key={p.date}>
              <line x1={X(p.tDays)} x2={X(p.tDays)} y1={H - B} y2={H - B + 4} stroke="#94a3b8" />
              <text x={X(p.tDays)} y={H - B + 14} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">{p.date.slice(5)}</text>
            </g>
          ))}

          {/* Axes Lines */}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#64748b" strokeWidth="1" />
          <line x1={L} x2={L} y1={T} y2={H - B} stroke="#64748b" strokeWidth="1" />

          {/* Fitted Polynomial Curve */}
          <path d={curveD} fill="none" stroke="#0076a8" strokeWidth="2.5" strokeLinecap="round" />

          {/* Observed Scatter Points */}
          {fitData.points.map(p => (
            <g key={p.date} transform={`translate(${X(p.tDays)}, ${Y(p.ndvi)})`}>
              <circle r="4.5" fill="#fef3c7" stroke="#d97706" strokeWidth="2">
                <title>{`${p.date}: Observed NDVI ${p.ndvi.toFixed(2)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      {/* Code Inspector Drawer */}
      {showCode && (
        <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #334155', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
              SEVA_GIS_Phenology_Simulation.m
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  fontSize: 10.5,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid #475569',
                  background: '#1e293b',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {copied ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadScript}
                style={{
                  fontSize: 10.5,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Download size={11} />
                <span>Export .m</span>
              </button>
            </div>
          </div>
          <pre style={{ margin: 0, fontSize: 11, fontFamily: 'Consolas, monospace', color: '#e2e8f0', overflowX: 'auto', maxHeight: 220, lineHeight: 1.45 }}>
            {matlabScript}
          </pre>
        </div>
      )}
    </div>
  )
}
