import React from 'react';

interface SevaLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtext?: string;
}

export const SevaLogo: React.FC<SevaLogoProps> = ({
  className = 'w-10 h-10',
  size = 40,
  showText = false,
  subtext = 'Where Satellites Meet Soil',
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Official SEVA.GIS Emblem SVG (Pin + Blue Droplet + Dual Ascending Leaves) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SEVA.GIS Official Emblem"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
      >
        {/* Outer Shield-Pin */}
        <path
          d="M60 8C35.7 8 16 27.7 16 52C16 81.5 60 112 60 112C60 112 104 81.5 104 52C104 27.7 84.3 8 60 8Z"
          fill="#0A253B"
          stroke="url(#sevaPinGrad)"
          strokeWidth="5"
        />

        {/* Inner Dotted Circle */}
        <circle
          cx="60"
          cy="50"
          r="30"
          fill="#071624"
          stroke="#10B981"
          strokeWidth="2"
          strokeDasharray="4 3"
        />

        {/* Upper Blue Water Droplet */}
        <path
          d="M60 25C60 25 49 38 49 46C49 52.1 53.9 57 60 57C66.1 57 71 52.1 71 46C71 38 60 25 60 25Z"
          fill="url(#sevaDropGrad)"
        />

        {/* Left Green Leaf */}
        <path
          d="M58 73C41 73 33 58 35 44C47 45 57 55 58 73Z"
          fill="url(#sevaLeafLeft)"
        />

        {/* Right Lime-Green Leaf */}
        <path
          d="M62 73C79 73 87 58 85 44C73 45 63 55 62 73Z"
          fill="url(#sevaLeafRight)"
        />

        <defs>
          <linearGradient id="sevaPinGrad" x1="16" y1="8" x2="104" y2="112" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="0.5" stopColor="#10B981" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="sevaDropGrad" x1="49" y1="25" x2="71" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="sevaLeafLeft" x1="35" y1="44" x2="58" y2="73" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="sevaLeafRight" x1="85" y1="44" x2="62" y2="73" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A3E635" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xl tracking-tight text-white">SEVA</span>
            <span className="font-extrabold text-xl tracking-tight text-emerald-400">.GIS</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              v1.0
            </span>
          </div>
          {subtext && (
            <p className="text-xs text-slate-400 font-medium">{subtext}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SevaLogo;
