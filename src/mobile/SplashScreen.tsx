import { useSettings } from "../settings";
import { useBranding } from "../state/brandingStore";

function SquareField() {
  return (
    <div
      className="absolute inset-[-12%] rotate-[8deg]"
      style={{
        maskImage:
          "radial-gradient(circle at 50% 45%, #000 18%, rgba(0,0,0,0.35) 52%, transparent 78%)",
        WebkitMaskImage:
          "radial-gradient(circle at 50% 45%, #000 18%, rgba(0,0,0,0.35) 52%, transparent 78%)",
      }}
    >
      <div
        className="grid h-full w-full grid-cols-9 gap-[9px]"
        style={{ gridTemplateRows: "repeat(17, minmax(0, 1fr))" }}
      >
        {Array.from({ length: 9 * 17 }).map((_, i) => (
          <span
            key={i}
            className="rounded-[7px] border border-white/10"
            style={{ opacity: 0.35 + ((i * 37) % 60) / 100 }}
          />
        ))}
      </div>
    </div>
  );
}

export function SplashScreen({
  replayKey = 0,
  onContinue,
}: {
  /** Remount key — retained so a caller can replay the intro animation. */
  replayKey?: number;
  /** "اضغط للمتابعة": the single transition out of the welcome screen. */
  onContinue?: () => void;
}) {
  const { t } = useSettings();
  /** A published login logo replaces the vector mark; default keeps the design. */
  const { loginLogo, branding } = useBranding();

  const handleTap = () => {
    onContinue?.();
  };

  return (
    <div
      key={replayKey}
      className="relative h-full w-full overflow-hidden bg-navy cursor-pointer select-none"
      onClick={handleTap}
    >
      <SquareField />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
        {loginLogo ? (
          <img
            src={loginLogo}
            alt={branding.officialNameAr}
            className="h-[132px] w-auto max-w-[300px] object-contain"
            style={{
              animation:
                "logo-in 0.9s cubic-bezier(0.22,0.61,0.36,1) both, logo-float 4.5s ease-in-out 0.9s infinite",
            }}
          />
        ) : (
        <svg width="86" height="86" viewBox="0 0 86 86" fill="none">
          <rect
            x="6"
            y="6"
            width="74"
            height="74"
            rx="24"
            stroke="var(--color-brand)"
            strokeWidth="2.6"
            strokeDasharray="300"
            className="animate-draw"
            style={{ ["--dash" as string]: "300" }}
          />
          <g className="animate-fade-in" style={{ animationDelay: "1.1s" }}>
            <path
              d="M24 38h20v13H24z"
              stroke="var(--color-brand)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M44 43h6l6 6v2h-12z"
              stroke="var(--color-brand)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="31" cy="55.5" r="3" stroke="var(--color-brand)" strokeWidth="2.6" />
            <circle cx="51" cy="55.5" r="3" stroke="var(--color-brand)" strokeWidth="2.6" />
          </g>
        </svg>
        )}

        <div className="animate-fade-in mt-8 text-center" style={{ animationDelay: "1.35s" }}>
          <div className="text-[12px] text-white/70">
            {t("Heavy Fleet Tracking & Logistics", "تتبع أسطول النقل الثقيل واللوجستيات", "ہیوی فلیٹ ٹریکنگ اور لاجسٹکس")}
          </div>

          {/* Interactive Continue Action */}
          <div className="mt-8 animate-fade-in" style={{ animationDelay: "1.6s" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onContinue) onContinue();
              }}
              className="group relative inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-[12px] font-bold text-navy shadow-lg shadow-brand/25 transition-all hover:bg-brand-soft hover:scale-105 active:scale-95"
            >
              <span>{t("Tap to Continue", "اضغط للمتابعة", "جاری رکھنے کے لیے دبائیں")}</span>
              <span className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">➔</span>
            </button>
          </div>
        </div>

        <div
          className="animate-fade-in absolute bottom-8 text-[10.5px] tracking-wide text-white/40"
          style={{ animationDelay: "2s" }}
        >
          {t("Tap anywhere to enter application", "اضغط في أي مكان للدخول للتطبيق", "داخل ہونے کے لیے کہیں بھی دبائیں")}
        </div>
      </div>
    </div>
  );
}

