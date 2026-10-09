import { useSettings } from "../settings";
import { useBranding } from "../state/brandingStore";
import { EjazEmblem } from "../components/Logo";

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
            className="rounded-chip border border-white/10"
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
        /* No published logo: the OFFICIAL EJAZ emblem carries the identity. */
        <div
          style={{
            animation:
              "logo-in 0.9s cubic-bezier(0.22,0.61,0.36,1) both, logo-float 4.5s ease-in-out 0.9s infinite",
          }}
        >
          <EjazEmblem size={92} color="var(--color-brand)" />
        </div>
        )}

        <div className="animate-fade-in mt-8 text-center" style={{ animationDelay: "1.35s" }}>
          <div className="text-label-lg text-white/70">
            {t("Heavy Fleet Tracking & Logistics", "تتبع أسطول النقل الثقيل واللوجستيات", "ہیوی فلیٹ ٹریکنگ اور لاجسٹکس")}
          </div>

          {/* Interactive Continue Action */}
          <div className="mt-8 animate-fade-in" style={{ animationDelay: "1.6s" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onContinue) onContinue();
              }}
              className="group relative inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-label-lg font-bold text-navy shadow-lg shadow-brand/25 transition-all hover:bg-brand-soft hover:scale-105 active:scale-95"
            >
              <span>{t("Tap to Continue", "اضغط للمتابعة", "جاری رکھنے کے لیے دبائیں")}</span>
              <span className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">➔</span>
            </button>
          </div>
        </div>

        <div
          className="animate-fade-in absolute bottom-8 text-label tracking-wide text-white/40"
          style={{ animationDelay: "2s" }}
        >
          {t("Tap anywhere to enter application", "اضغط في أي مكان للدخول للتطبيق", "داخل ہونے کے لیے کہیں بھی دبائیں")}
        </div>
      </div>
    </div>
  );
}

