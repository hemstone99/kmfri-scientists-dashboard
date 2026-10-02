import React from 'react';

interface KmfriLogoProps {
  className?: string;
  showSubtitle?: boolean;
  lightText?: boolean;
  compactOnMobile?: boolean;
}

export const KmfriLogo: React.FC<KmfriLogoProps> = ({
  className = 'h-11',
  showSubtitle = true,
  lightText = false,
  compactOnMobile = false,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none max-w-full ${className}`}
      role="img"
      aria-label="KMFRI - Kenya Marine and Fisheries Research Institute"
    >
      {/* Official KMFRI Circular Crest Emblem */}
      <div className="relative h-full aspect-square shrink-0 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-slate-200/90 dark:ring-sky-400/40 flex items-center justify-center overflow-hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="8 4 160 160"
          className="w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="kmfriSeaGradEmblem"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <clipPath id="kmfriEmblemInnerClip">
              <circle cx="88" cy="84" r="52" />
            </clipPath>
          </defs>

          {/* Crisp White Medallion Base & Subtle Outer Ring */}
          <circle cx="88" cy="84" r="76" fill="#ffffff" />
          <circle
            cx="88"
            cy="84"
            r="53"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Inner Circle Water & Marine Symbols */}
          <g clipPath="url(#kmfriEmblemInnerClip)">
            <rect x="30" y="30" width="116" height="110" fill="#f8fafc" />
            <path
              d="M 32,84 Q 48,80 64,84 T 96,84 T 128,84 T 148,84 L 148,145 L 32,145 Z"
              fill="url(#kmfriSeaGradEmblem)"
            />
            <path
              d="M 42,95 Q 58,92 74,95 T 106,95 T 134,95"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M 48,107 Q 66,104 84,107 T 120,107"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="1.9"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 55,119 Q 75,116 95,119 T 118,119"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.75"
            />

            {/* Left: Scientific Microscope Silhouette */}
            <g fill="#0f172a">
              <path d="M 38,83 L 64,83 L 62,79 L 40,79 Z" />
              <path d="M 46,79 C 39,72 39,58 47,52 L 51,55 C 45,60 45,70 51,76 Z" />
              <rect
                x="48"
                y="42"
                width="6"
                height="18"
                rx="1"
                transform="rotate(-28 51 51)"
              />
              <rect
                x="45"
                y="38"
                width="8"
                height="4"
                rx="1"
                transform="rotate(-28 49 40)"
              />
              <rect
                x="54"
                y="58"
                width="4"
                height="8"
                rx="1"
                transform="rotate(15 56 62)"
              />
              <rect x="47" y="67" width="16" height="2.8" rx="1" />
            </g>

            {/* Center: Research Vessel / Ship Silhouette */}
            <g>
              <path
                d="M 68,72 L 108,72 L 102,87 L 74,87 Z"
                fill="#1d4ed8"
                stroke="#ffffff"
                strokeWidth="1.2"
              />
              <path d="M 74,56 L 102,56 L 104,72 L 72,72 Z" fill="#1e40af" />
              <rect x="76" y="60" width="9" height="6" rx="1" fill="#ffffff" />
              <rect x="91" y="60" width="9" height="6" rx="1" fill="#ffffff" />
              <rect x="83" y="48" width="10" height="8" rx="1" fill="#1d4ed8" />
              <rect x="86" y="43" width="4" height="6" fill="#1e3a8a" />
              <path
                d="M 70,86 Q 88,91 106,86"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            {/* Right: Coastal Mangrove Tree */}
            <g>
              <path
                d="M 122,74 C 117,82 114,91 113,98 M 123,74 C 121,84 120,92 120,100 M 125,74 C 127,83 129,92 131,99 M 124,78 C 118,86 126,88 125,97"
                fill="none"
                stroke="#6b3410"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M 123,76 L 123,65 M 123,69 L 116,62 M 123,68 L 130,61"
                fill="none"
                stroke="#5c2d0c"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="116" cy="60" r="6" fill="#16a34a" />
              <circle cx="124" cy="56" r="7" fill="#15803d" />
              <circle cx="131" cy="61" r="6" fill="#16a34a" />
              <circle cx="120" cy="63" r="5" fill="#22c55e" />
              <circle cx="127" cy="64" r="5" fill="#22c55e" />
            </g>
          </g>

          {/* TOP ARCHING BLUE FISH (#1e40af) */}
          <g fill="#1e40af">
            <path d="M 24,62 C 30,26 68,8 106,18 C 126,23 142,38 151,58 C 141,54 134,55 127,60 C 116,40 94,30 70,33 C 50,35 35,47 24,62 Z" />
            <path d="M 62,16 C 78,4 98,6 112,18 C 96,15 78,16 62,16 Z" />
            <path d="M 27,57 L 10,49 L 21,64 L 9,68 L 29,65 Z" />
            <path d="M 116,44 L 103,52 L 122,52 Z" />
            <path d="M 145,52 L 156,67 L 138,56 Z" />
            <circle cx="134" cy="46" r="3.2" fill="#ffffff" />
            <circle cx="135" cy="46" r="1.5" fill="#1e40af" />
          </g>

          {/* BOTTOM ARCHING DARK FISH (#0f172a) */}
          <g fill="#0f172a">
            <path d="M 146,105 C 138,140 102,158 64,149 C 42,143 25,126 17,102 C 27,106 35,105 42,100 C 52,122 74,134 98,132 C 118,130 134,119 146,105 Z" />
            <path d="M 65,148 C 82,160 104,158 116,144 C 100,148 82,149 65,148 Z" />
            <path d="M 142,110 L 160,100 L 148,116 L 161,124 L 139,116 Z" />
            <path d="M 54,119 L 68,111 L 48,111 Z" />
            <circle cx="34" cy="116" r="3.2" fill="#ffffff" />
            <circle cx="33" cy="116" r="1.5" fill="#0f172a" />
          </g>
        </svg>
      </div>

      {/* Crisp Institutional Typography Lockup */}
      <div className="flex flex-col justify-center min-w-0 leading-none">
        <span
          className={`font-extrabold tracking-wider text-lg sm:text-xl md:text-2xl leading-none ${
            lightText
              ? 'text-white'
              : 'text-[#1e3a8a] dark:text-white'
          }`}
        >
          KMFRI
        </span>
        {showSubtitle && (
          <span
            className={`mt-0.5 text-[10px] sm:text-[11px] font-semibold tracking-tight leading-tight truncate ${
              compactOnMobile ? 'hidden sm:block' : 'block'
            } ${
              lightText
                ? 'text-sky-200/95'
                : 'text-slate-600 dark:text-sky-200/90'
            }`}
          >
            Kenya Marine and Fisheries Research Institute
          </span>
        )}
      </div>
    </div>
  );
};
