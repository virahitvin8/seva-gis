import React, { useState } from 'react';
import { Camera, MapPin, X, ChevronUp, ChevronDown, CheckCircle2, User, Clock, FileText } from 'lucide-react';
import type { GroundScoutPayload } from '../lib/scoutBeaconService';

interface GroundTruthCardProps {
  beacon: GroundScoutPayload;
  onClose: () => void;
}

export const GroundTruthCard: React.FC<GroundTruthCardProps> = ({ beacon, onClose }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-40 w-80 max-w-[calc(100vw-32px)] bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden font-sans animate-fade-in text-xs">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold text-emerald-400 text-xs tracking-tight">GROUND TRUTH SCOUT BEACON</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-slate-400 hover:text-white rounded transition"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3 space-y-2.5">
          {/* Photo / Video */}
          {beacon.photoBase64 && (
            <div className="rounded-xl overflow-hidden border border-slate-800 relative group">
              <img src={beacon.photoBase64} alt="Ground Truth" className="w-full h-36 object-cover" />
              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] font-mono text-emerald-300 border border-emerald-500/40">
                ✓ Field Photo Verified
              </div>
            </div>
          )}
          {beacon.videoBase64 && (
            <div className="rounded-xl overflow-hidden border border-slate-800">
              <video src={beacon.videoBase64} controls className="w-full h-36 object-cover bg-black" />
            </div>
          )}

          {/* Metadata Block */}
          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 font-mono text-[11px] space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500 flex items-center gap-1">
                <MapPin size={11} className="text-emerald-400" /> Coords:
              </span>
              <span className="text-emerald-400 font-bold">
                {beacon.latitude.toFixed(5)}°N, {beacon.longitude.toFixed(5)}°E
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">DIGIPIN:</span>
              <span className="text-amber-400 font-bold">{beacon.digipin}</span>
            </div>
            {beacon.accuracy && (
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">GNSS Accuracy:</span>
                <span className="text-white">±{beacon.accuracy.toFixed(1)}m</span>
              </div>
            )}
            {beacon.scoutName && (
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 flex items-center gap-1">
                  <User size={11} /> Scout:
                </span>
                <span className="text-white">{beacon.scoutName}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {beacon.notes && (
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
              <FileText size={12} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="italic">"{beacon.notes}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroundTruthCard;
