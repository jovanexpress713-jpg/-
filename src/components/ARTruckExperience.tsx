import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "../data/types";
import { useSettings } from "../settings";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { getRealityAsset, loadPercent, clampTelemetry } from "../data/vehicleReality";
import { detectARSupport, startARSession } from "./ar/webxr";
import type { ARSessionLike } from "./ar/types";

interface ARTruckExperienceProps {
  vehicle: Vehicle;
  onClose: () => void;
}

export function ARTruckExperience({ vehicle, onClose }: ARTruckExperienceProps) {
  const { t } = useSettings();
  const { registry } = useVehicleAssets();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ARSessionLike | null>(null);
  const [support, setSupport] = useState<{ supported: boolean; reason: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const reality = getRealityAsset(vehicle, registry);
  const load = clampTelemetry(loadPercent(vehicle));
  const fuel = clampTelemetry(vehicle.fuel);

  useEffect(() => {
    let cancelled = false;
    detectARSupport().then((result) => {
      if (!cancelled) setSupport(result);
    });
    return () => {
      cancelled = true;
      void sessionRef.current?.end();
    };
  }, []);

  const enterAR = async () => {
    if (!canvasRef.current || !reality.modelUrl) return;
    setStarting(true);
    setError(null);
    try {
      const session = await startARSession({ canvas: canvasRef.current, modelUrl: reality.modelUrl });
      sessionRef.current = session;
      setStarted(true);
      session.addEventListener("end", () => {
        sessionRef.current = null;
        setStarted(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("AR session could not start", "تعذر تشغيل الواقع المعزز"));
    } finally {
      setStarting(false);
    }
  };

  const exitAR = async () => {
    await sessionRef.current?.end();
    sessionRef.current = null;
    setStarted(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 text-white">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pointer-events-none">
        <div className="pointer-events-auto max-w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">EJAZ · AR REALITY</div>
          <div className="mt-1 text-lg font-bold">{vehicle.brand} {vehicle.model}</div>
          <div className="mt-1 text-sm text-white/60">{vehicle.plate} · {reality.bodyLabelAr}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 p-2"><span className="text-white/45">الحمولة</span><strong className="mt-1 block text-sm">{Math.round(load)}%</strong></div>
            <div className="rounded-xl bg-white/5 p-2"><span className="text-white/45">الوقود</span><strong className="mt-1 block text-sm">{Math.round(fuel)}%</strong></div>
            <div className="rounded-xl bg-white/5 p-2"><span className="text-white/45">السرعة</span><strong className="mt-1 block text-sm">{vehicle.speed} km/h</strong></div>
            <div className="rounded-xl bg-white/5 p-2"><span className="text-white/45">المتبقي</span><strong className="mt-1 block text-sm">{Math.round(vehicle.milesLeft)} mi</strong></div>
          </div>
        </div>
        <button onClick={started ? exitAR : onClose} className="pointer-events-auto min-h-11 rounded-full border border-white/15 bg-black/60 px-4 text-sm font-semibold backdrop-blur-xl">
          {started ? t("Exit AR", "خروج من AR") : t("Close", "إغلاق")}
        </button>
      </div>

      {!started && (
        <div className="absolute inset-0 grid place-items-center p-5">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 p-6 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/15 text-orange-400">AR</div>
            <h2 className="mt-4 text-xl font-bold">{t("Place the truck in your space", "ضع الشاحنة داخل مساحتك")}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {support?.supported ? support.reason : t("Checking device AR support…", "جارٍ فحص دعم الواقع المعزز…")}
            </p>

            {!reality.modelUrl && (
              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-start text-xs leading-5 text-amber-100">
                {t("A published official GLB/GLTF model is required for true AR. The system will not present a procedural truck as an official manufacturer model.", "يلزم رفع نموذج GLB/GLTF رسمي لتشغيل AR الحقيقي. النظام لن يقدم مجسماً إجرائياً على أنه شاحنة أصلية من الشركة المصنعة.")}
              </div>
            )}
            {error && <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
            <button
              onClick={enterAR}
              disabled={!support?.supported || !reality.modelUrl || starting}
              className="mt-5 min-h-12 w-full rounded-2xl bg-orange-500 px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting ? t("Starting…", "جارٍ التشغيل…") : t("Start real AR", "تشغيل AR الحقيقي")}
            </button>
            <div className="mt-3 text-[11px] text-white/40">{reality.isOfficialModel ? t("Official 3D asset", "نموذج ثلاثي الأبعاد رسمي") : t("Official 3D model not published", "لم يتم نشر النموذج الرسمي بعد")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
