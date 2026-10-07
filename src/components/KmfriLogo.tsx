import React from 'react';

interface KmfriLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'emblem' | 'white' | 'horizontal';
  className?: string;
  subtitleClassName?: string;
}

export const KmfriLogo: React.FC<KmfriLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
  subtitleClassName = '',
}) => {
  // Height & scale maps matching standard responsive placements
  const scaleConfig = {
    xs: { emblemH: 26, textH: 'h-6', width: 140, letterSize: 'text-lg', subSize: 'text-[7.5px]' },
    sm: { emblemH: 34, textH: 'h-8', width: 180, letterSize: 'text-2xl', subSize: 'text-[9px]' },
    md: { emblemH: 44, textH: 'h-11', width: 230, letterSize: 'text-3xl', subSize: 'text-[11px]' },
    lg: { emblemH: 58, textH: 'h-14', width: 300, letterSize: 'text-4xl', subSize: 'text-xs' },
    xl: { emblemH: 74, textH: 'h-18', width: 380, letterSize: 'text-5xl', subSize: 'text-sm' },
  }[size];

  const isWhite = variant === 'white';
  const subtitleColor = isWhite ? '#f1f5f9' : 'var(--kmfri-logo-subtitle)';

  // Crisp Vector Emblem: Dual leaping fish circle + RV Mtafiti + Microscope + Mangrove
  const emblemSvg = (
    <svg
      height={scaleConfig.emblemH}
      viewBox="0 0 130 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none drop-shadow-xs"
    >
      <defs>
        <linearGradient id="logoWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <clipPath id="logoCircleClip">
          <circle cx="65" cy="65" r="46" />
        </clipPath>
      </defs>

      {/* Outer base glow */}
      <circle cx="65" cy="65" r="48" fill="#ffffff" stroke="#3b5bdb" strokeWidth="1" strokeOpacity="0.3" />

      {/* Inner circular clipping mask */}
      <g clipPath="url(#logoCircleClip)">
        {/* Sky */}
        <rect x="15" y="15" width="100" height="58" fill="#f0f9ff" />

        {/* Ocean Waves */}
        <path d="M 15 68 Q 35 60 55 66 T 95 64 T 115 68 L 115 115 L 15 115 Z" fill="url(#logoWaterGrad)" />
        <path d="M 15 78 Q 40 72 65 78 T 115 76 L 115 115 L 15 115 Z" fill="#0284c7" opacity="0.9" />
        <path d="M 15 90 Q 45 84 75 90 T 115 88 L 115 115 L 15 115 Z" fill="#0369a1" />

        {/* Foam Highlights */}
        <path d="M 38 70 Q 43 66 48 70 Q 53 66 58 70" stroke="#ffffff" strokeWidth="1.2" fill="none" />
        <path d="M 72 69 Q 77 65 82 69 Q 87 65 92 69" stroke="#ffffff" strokeWidth="1.2" fill="none" />

        {/* RV Mtafiti Research Vessel in center */}
        <g id="centerShip">
          <line x1="65" y1="38" x2="65" y2="44" stroke="#3b5bdb" strokeWidth="2" />
          <line x1="61" y1="40" x2="69" y2="40" stroke="#3b5bdb" strokeWidth="1.5" />
          <circle cx="65" cy="38" r="1.5" fill="#ef4444" />
          {/* Superstructure */}
          <rect x="57" y="44" width="16" height="12" rx="1.5" fill="#ffffff" stroke="#3b5bdb" strokeWidth="1.2" />
          <rect x="59" y="46" width="4" height="4" fill="#0284c7" />
          <rect x="65" y="46" width="4" height="4" fill="#0284c7" />
          {/* Deck & Hull */}
          <path d="M 52 56 L 78 56 L 76 61 L 54 61 Z" fill="#ffffff" stroke="#3b5bdb" strokeWidth="1.2" />
          <path d="M 46 61 L 84 61 L 77 74 Q 65 78 53 74 Z" fill="#3b5bdb" stroke="#1d4ed8" strokeWidth="1.2" />
          <path d="M 49 64 L 81 64" stroke="#ffffff" strokeWidth="1.2" />
        </g>

        {/* Optical Microscope on the left */}
        <g id="leftMicroscope" transform="translate(32, 41) scale(0.62)">
          <rect x="6" y="38" width="16" height="4" rx="1" fill="#0f172a" />
          <path d="M 18 38 C 22 30 20 18 14 12" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="6" y="8" width="5" height="13" rx="1" transform="rotate(28 6 8)" fill="#0f172a" />
          <circle cx="13" cy="23" r="2.5" fill="#3b5bdb" />
          <rect x="12" y="24" width="3" height="5" transform="rotate(28 12 24)" fill="#3b5bdb" />
          <rect x="7" y="28" width="11" height="2.5" rx="0.5" fill="#475569" />
        </g>

        {/* Mangrove Wetland Shoots on the right */}
        <g id="rightMangrove" transform="translate(82, 44) scale(0.65)">
          <ellipse cx="14" cy="12" rx="9" ry="7" fill="#15803d" />
          <ellipse cx="8" cy="8" rx="7" ry="5.5" fill="#16a34a" />
          <ellipse cx="20" cy="9" rx="6.5" ry="5" fill="#22c55e" />
          <ellipse cx="14" cy="6" rx="5" ry="4" fill="#4ade80" />
          <path d="M 14 16 L 14 26" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          <path d="M 14 23 Q 8 29 4 36" stroke="#92400e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M 14 23 Q 20 29 24 36" stroke="#92400e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M 13 25 Q 11 31 10 38" stroke="#78350f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M 15 25 Q 17 31 18 38" stroke="#78350f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* Top Blue Leaping Fish (Arches over top, clockwise) */}
      <g id="topBlueFish">
        <path d="M 22 52 C 24 20 62 10 96 18 C 112 22 122 32 126 44 C 118 38 106 28 86 24 C 58 20 32 32 22 52 Z" fill="#3b5bdb" />
        <path d="M 22 52 L 8 42 C 11 51 10 58 4 66 L 17 60 C 19 57 21 54 22 52 Z" fill="#3b5bdb" />
        <path d="M 126 44 C 129 49 127 54 120 58 C 120 52 116 49 113 47 Z" fill="#3b5bdb" />
        <circle cx="116" cy="38" r="3" fill="#ffffff" />
        <circle cx="116" cy="38" r="1.5" fill="#0f172a" />
        <path d="M 58 13 Q 72 6 86 13 Z" fill="#2563eb" />
        <path d="M 98 24 Q 106 20 110 28 Z" fill="#2563eb" />
      </g>

      {/* Bottom Black Leaping Fish (Arches under bottom, leftward) */}
      <g id="bottomBlackFish">
        <path d="M 108 78 C 106 110 68 120 34 112 C 18 108 8 98 4 86 C 12 92 24 102 44 106 C 72 110 98 98 108 78 Z" fill="#0a0a0a" />
        <path d="M 108 78 L 122 88 C 119 79 120 72 126 64 L 113 70 C 111 73 109 76 108 78 Z" fill="#0a0a0a" />
        <path d="M 4 86 C 1 81 3 76 10 72 C 10 78 14 81 17 83 Z" fill="#0a0a0a" />
        <circle cx="14" cy="92" r="3" fill="#ffffff" />
        <circle cx="14" cy="92" r="1.5" fill="#0f172a" />
        <path d="M 72 117 Q 58 124 44 117 Z" fill="#171717" />
        <path d="M 32 106 Q 24 110 20 102 Z" fill="#171717" />
      </g>
    </svg>
  );

  if (variant === 'emblem') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} title="Kenya Marine and Fisheries Research Institute">
        {emblemSvg}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {emblemSvg}

      {/* Typography: 3D Royal Blue KMFR / KMFRI + Kenya Marine and Fisheries Research Institute */}
      <div className="flex flex-col justify-center leading-none">
        <div
          className={`font-black tracking-tight ${scaleConfig.letterSize}`}
          style={{
            color: 'var(--kmfri-logo-word)',
            fontFamily: "'Arial Black', 'Impact', -apple-system, sans-serif",
            textShadow: '2px 3px 3px var(--kmfri-logo-shadow)',
            letterSpacing: '-0.03em',
          }}
        >
          KMFRI
        </div>
        <div
          className={`font-bold tracking-tight mt-0.5 sm:mt-1 ${scaleConfig.subSize} ${subtitleClassName}`}
          style={{
            color: subtitleColor,
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
          }}
        >
          Kenya Marine and Fisheries Research Institute
        </div>
      </div>
    </div>
  );
};
