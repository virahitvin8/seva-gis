import React, { useState, useEffect } from 'react';
import SevaLogo from '../brand/SevaLogo';

interface DispersionLoaderProps {
  onComplete?: () => void;
  autoDismissMs?: number;
}

export const DispersionLoader: React.FC<DispersionLoaderProps> = ({
  onComplete,
  autoDismissMs = 2400,
}) => {
  const [progress, setProgress] = useState(15);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round(15 + (elapsed / autoDismissMs) * 85));
      setProgress(pct);

      if (elapsed >= autoDismissMs) {
        clearInterval(interval);
        setTimeout(() => {
          setIsVisible(false);
          if (onComplete) onComplete();
        }, 300);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [autoDismissMs, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      id="dispersionLoader"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040b11] transition-opacity duration-700"
      style={{ opacity: progress >= 100 ? 0 : 1 }}
    >
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Pulsing Radial Shockwave Rings */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-ping" />
        <div className="absolute inset-4 rounded-full border-2 border-cyan-400/40 animate-pulse" />
        <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/15 to-transparent blur-xl" />

        {/* Center Official Emblem */}
        <div className="relative z-10 drop-shadow-[0_0_25px_rgba(16,185,129,0.55)]">
          <SevaLogo size={112} className="w-28 h-28" />
        </div>
      </div>

      <div className="mt-4 text-center max-w-md px-6 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-white">SEVA</span>
          <span className="text-2xl font-extrabold tracking-tight text-emerald-400">.GIS</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
            v1.0 OPEN DESIGN
          </span>
        </div>

        <p className="text-sm text-cyan-300 font-medium">
          Dispersing Spectral Lattice &amp; Initializing Clockwise Parameter Engine…
        </p>

        {/* Dynamic Progress Bar */}
        <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto mt-3">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400 font-mono pt-1">
          Sentinel-2 L2A • EPSG:4326 / UTM • Traceable Science
        </p>
      </div>
    </div>
  );
};

export default DispersionLoader;
