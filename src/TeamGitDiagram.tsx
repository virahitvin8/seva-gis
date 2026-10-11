import React, { useState } from 'react'
import { GitBranch, GitCommit, GitMerge, Users, ChevronRight, Layers, Sparkles, Terminal } from 'lucide-react'

type GitNode = {
  id: string
  branch: 'main' | 'spectral' | 'hydro' | 'ui'
  commit: string
  author: string
  role: string
  desc: string
  color: string
  tag: string
}

const NODES: GitNode[] = [
  {
    id: 'c1',
    branch: 'main',
    commit: '7a29e4b',
    author: 'N. Akshit Vinay',
    role: 'Lead Architect & Systems Engineer',
    desc: 'Architected SEVA·GIS client-side GIS processing pipeline, GEE cloud tile streaming, and geodetic algorithms.',
    color: '#10b981',
    tag: 'v2.4.0-release',
  },
  {
    id: 'c2',
    branch: 'spectral',
    commit: 'b941cd2',
    author: 'Spectral Telemetry Team',
    role: 'Remote Sensing & Radiometry',
    desc: 'Calibrated Sentinel-2 Level-2A surface reflectance, bicubic anti-pixelation resampling, and index synthesis.',
    color: '#06b6d4',
    tag: 'spectral-core',
  },
  {
    id: 'c3',
    branch: 'hydro',
    commit: 'e5f2091',
    author: 'Hydrology & Watershed Lab',
    role: 'Catchment Modeling & SWAT Simulation',
    desc: 'Built dynamic SCS-CN runoff, evapotranspiration balance, vadose zone percolation, and SUFI-2 uncertainty models.',
    color: '#8b5cf6',
    tag: 'hydro-engine',
  },
  {
    id: 'c4',
    branch: 'ui',
    commit: '3d87a15',
    author: 'Geospatial Cartography Studio',
    role: 'UI/UX & Cartographic Rendering',
    desc: 'Engineered non-overlapping carto frames, responsive 19x zoom lens, sliding inspection loupe, and report dossier.',
    color: '#f59e0b',
    tag: 'carto-studio',
  },
]

export default function TeamGitDiagram() {
  const [selectedNode, setSelectedNode] = useState<string>('c1')
  const [is3D, setIs3D] = useState<boolean>(true)
  const active = NODES.find(n => n.id === selectedNode) || NODES[0]

  return (
    <section
      className="team-git-diagram-section"
      style={{
        margin: '28px auto 14px',
        maxWidth: 1040,
        padding: '20px 24px',
        background: '#0b131a',
        borderRadius: 16,
        border: '1px solid #1e293b',
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
        color: '#f8fafc',
      }}
      aria-label="Team Architecture & Git Topology"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#10b98122', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <GitBranch size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>SEVA·GIS Engineering Team Topology</span>
              <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: '#10b98122', color: '#34d399', border: '1px solid #059669', fontWeight: 600 }}>Git Graph</span>
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
              Modular branch contributions and architectural responsibilities
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setIs3D(!is3D)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: is3D ? '#1e293b' : '#0f172a',
              color: is3D ? '#38bdf8' : '#94a3b8',
              border: '1px solid #334155',
              transition: 'all 0.2s ease',
            }}
          >
            <Layers size={13} />
            <span>{is3D ? '3D Isometric View' : '2D Linear View'}</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18, alignItems: 'center' }}>
        {/* 3D / Isometric Git Graph Viewport */}
        <div
          style={{
            perspective: 900,
            padding: '16px 14px',
            background: 'radial-gradient(ellipse at 50% 50%, #131f2e 0%, #080f17 100%)',
            borderRadius: 12,
            border: '1px solid #1e293b',
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle grid pattern background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(#334155 0.8px, transparent 0.8px)',
              backgroundSize: '16px 16px',
              opacity: 0.25,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              transform: is3D ? 'rotateX(18deg) rotateY(-8deg) rotateZ(1deg) scale(0.96)' : 'none',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {NODES.map((n, i) => {
              const isSel = n.id === selectedNode
              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedNode(n.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${isSel ? n.color : '#33415544'}`,
                    boxShadow: isSel ? `0 6px 20px ${n.color}33, 0 0 10px ${n.color}22` : 'none',
                    transform: isSel ? 'translateZ(18px) scale(1.02)' : 'translateZ(0px)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {/* Git branch line & node dot */}
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: n.color,
                        boxShadow: `0 0 8px ${n.color}`,
                        border: '2px solid #0b131a',
                        flexShrink: 0,
                      }}
                    />
                    {i < NODES.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 6,
                          width: 2,
                          height: 22,
                          background: `linear-gradient(to bottom, ${n.color}, ${NODES[i + 1].color})`,
                          opacity: 0.6,
                        }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, color: isSel ? '#ffffff' : '#cbd5e1' }}>{n.author}</strong>
                      <code style={{ fontSize: 10, fontFamily: 'monospace', color: n.color, background: `${n.color}18`, padding: '1px 5px', borderRadius: 4 }}>
                        {n.commit}
                      </code>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.role}
                    </span>
                  </div>

                  <span style={{ fontSize: 10, color: '#64748b', border: '1px solid #334155', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                    {n.tag}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Member / Architecture Card */}
        <div
          style={{
            background: '#0f172a',
            border: `1.5px solid ${active.color}`,
            borderRadius: 12,
            padding: '18px 20px',
            boxShadow: `0 8px 24px ${active.color}18`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: active.color, background: `${active.color}1a`, padding: '3px 8px', borderRadius: 6 }}>
              {active.branch.toUpperCase()} BRANCH CONTRIBUTION
            </span>
            <code style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
              commit {active.commit}
            </code>
          </div>

          <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
            {active.author}
          </h4>
          <span style={{ fontSize: 12, fontWeight: 600, color: active.color, display: 'block', marginBottom: 10 }}>
            {active.role}
          </span>

          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.55 }}>
            {active.desc}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Verified Architecture Signature:</span>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} />
              <span>SEVA·GIS Certified</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
