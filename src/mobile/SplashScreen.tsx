import { useSettings } from "../settings";

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

export function SplashScreen({ replayKey = 0 }: { replayKey?: number }) {
  const { t } = useSettings();
  return (
    <div
      key={replayKey}
      className="relative h-full w-full overflow-hidden bg-navy"
      onClick={() => window.dispatchEvent(new CustomEvent("ejaz-replay"))}
    >
      <SquareField />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
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

        <div className="animate-fade-in mt-7 text-center" style={{ animationDelay: "1.35s" }}>
          <div className="text-[27px] leading-none font-semibold text-white">EJAZ</div>
          <div className="mt-2 text-[12px] tracking-[0.22em] text-brand uppercase">
            {t("Establishment Ejaz Transport", "مؤسسة إيجاز للنقليات")}
          </div>
          <div className="mt-1 text-[11px] text-white/50">
            {t("Heavy Fleet Tracking", "تتبع أسطول النقل الثقيل")}
          </div>
        </div>

        <div
          className="animate-fade-in absolute bottom-12 text-[10.5px] tracking-wide text-white/45"
          style={{ animationDelay: "2s" }}
        >
          {t("Tap to replay", "اضغط لإعادة العرض")}
        </div>
      </div>
    </div>
  );
}
