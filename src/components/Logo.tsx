import { cn } from "../utils/cn";

/**
 * Official vector recreation of the Ejaz Transport (مؤسسة إيجاز للنقليات) logo
 * matching the user's provided identity:
 * - Speed lines on the rear
 * - Trailer body forming the Arabic calligraphy of "إيجاز"
 * - Modern heavy truck cab & wheel on the front right
 * - Ground speed streak
 * - Arabic text "إيجاز" and Latin text "EJAZ" underneath
 */
export function EjazEmblem({
  size = 64,
  className,
  color = "#FF7A00",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  const width = size * 1.5;
  const height = size;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-label="إيجاز للنقليات"
    >
      {/* 1) Dynamic rear speed lines */}
      <g stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity="0.95">
        <line x1="38" y1="56" x2="80" y2="56" />
        <line x1="32" y1="72" x2="74" y2="72" />
        <line x1="30" y1="88" x2="70" y2="88" />
      </g>

      {/* 2) Main truck silhouette with Arabic typography "إيجاز" in the trailer */}
      {/* Top streamlined roofline */}
      <path
        d="M68 54C80 34 110 32 170 32C215 32 230 35 240 40C246 43 248 50 252 56L262 76C265 82 268 88 266 98C265 106 250 110 240 110H234C232 118 226 126 215 130C202 134 190 126 186 116H166C160 118 150 126 138 126C120 126 80 124 55 124C48 124 52 112 56 102C60 92 65 72 68 54Z"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* Stylized Arabic Letters "إ يـ جـ ا ز" cutouts / solids inside the trailer */}
      {/* Alif (ا) rear pillar */}
      <path
        d="M60 112C64 96 72 70 80 50L92 50C85 70 78 96 74 112H60Z"
        fill={color}
      />
      {/* Ya (ي) / Jim (ج) bold middle body */}
      <path
        d="M98 48H122L112 80H176C186 80 190 70 194 50H208L198 88C194 102 184 108 170 108H106L98 48Z"
        fill={color}
      />
      {/* Dots underneath the Ya and Jim */}
      <rect x="122" y="112" width="10" height="8" rx="2" fill={color} />
      <rect x="136" y="112" width="10" height="8" rx="2" fill={color} />
      <rect x="156" y="112" width="11" height="8" rx="2" fill={color} />

      {/* Front modern European cab structure (Windshield, Visor, Grille, A-Pillar) */}
      <path
        d="M216 46C224 46 244 50 250 68H228C222 68 218 60 216 46Z"
        fill={color}
      />
      <path
        d="M232 74H262C264 82 263 90 260 94H236C232 94 230 84 232 74Z"
        fill={color}
      />
      {/* Front Wheel Arch & Wheel */}
      <circle
        cx="218"
        cy="124"
        r="18"
        fill="none"
        stroke={color}
        strokeWidth="6"
      />
      <circle cx="218" cy="124" r="7" fill={color} />

      {/* 3) Ground speed skid streaks */}
      <path
        d="M26 138C60 134 100 132 142 128L156 134C118 136 78 138 26 138Z"
        fill={color}
      />
      <path
        d="M85 133C115 130 148 128 178 126L184 130C154 132 122 133 85 133Z"
        fill={color}
      />

      {/* 4) Bottom Typography: Arabic "إيجاز" + Latin "EJAZ" */}
      <text
        x="150"
        y="170"
        textAnchor="middle"
        fontFamily="'Tajawal', 'Outfit', sans-serif"
        fontWeight="800"
        fontSize="28"
        fill={color}
        letterSpacing="2"
      >
        إيجاز
      </text>
      <text
        x="150"
        y="190"
        textAnchor="middle"
        fontFamily="'Outfit', sans-serif"
        fontWeight="700"
        fontSize="14"
        fill={color}
        letterSpacing="6"
      >
        EJAZ
      </text>
    </svg>
  );
}

/** Responsive Header / Dashboard Brand Logo */
export function BrandLogo({
  size = 36,
  showSub = true,
  sub,
  className,
  onClick,
}: {
  size?: number;
  showSub?: boolean;
  sub?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 select-none",
        onClick && "cursor-pointer transition-transform hover:scale-[1.02] active:scale-95",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <EjazEmblem size={size} color="var(--color-brand)" />
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-baseline gap-2">
          <span className="font-extrabold text-[18px] tracking-tight text-text-primary">
            إيجاز
          </span>
          <span className="font-bold text-[13px] tracking-widest text-brand">
            EJAZ
          </span>
        </div>
        {showSub && (
          <span className="text-[10.5px] font-medium text-text-muted tracking-wide">
            {sub || "مؤسسة إيجاز للنقليات · Since 2022"}
          </span>
        )}
      </div>
    </div>
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return <BrandLogo size={48} className={className} />;
}

// Fallback for legacy imports
export function Logo(props: any) {
  return <BrandLogo {...props} />;
}
