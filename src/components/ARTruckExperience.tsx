import { useEffect, useMemo, useRef, useState } from "react";
import type { Vehicle } from "../data/types";
import { useSettings } from "../settings";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { getRealityAsset, loadPercent, clampTelemetry, etaLabel } from "../data/vehicleReality";
import { detectARSupport, startARSession } from "./ar/webxr";
import type { ARSessionLike } from "./ar/types";

interface ARTruckExperienceProps { vehicle: Vehicle; onClose: () => void; }
type SceneMode = "live" | "desert" | "rain" | "night";

function Gauge({ label, value, unit, progress }: { label: string; value: string; unit?: string; progress: number }) {
  const pct = clampTelemetry(progress);
  return <div className="rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-white/45">{label}</span><span className="text-xs font-bold text-white/85">{value}{unit}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} /></div></div>;
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
  const [sceneMode, setSceneMode] = useState<SceneMode>("live");
  const reality = getRealityAsset(vehicle, registry);
  const load = clampTelemetry(loadPercent(vehicle));
  const fuel = clampTelemetry(vehicle.fuel);
  const moving = vehicle.status === "active" && Number(vehicle.speed) > 0;
  const temp = Number(vehicle.engineTemp);

  useEffect(() => {
    let cancelled = false;
    detectARSupport().then((result) => { if (!cancelled) setSupport(result); });
    return () => { cancelled = true; void sessionRef.current?.end(); };
  }, []);

  const enterAR = async () => {
    if (!canvasRef.current || !reality.isOfficialModel || !reality.modelUrl) return;
    setStarting(true); setError(null);
    try {
      const session = await startARSession({ canvas: canvasRef.current, modelUrl: reality.modelUrl });
      sessionRef.current = session;
      setStarted(true);
      session.addEventListener("end", () => { sessionRef.current = null; setStarted(false); });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("AR session could not start", "تعذر تشغيل الواقع المعزز"));
    } finally { setStarting(false); }
  };

  const exitAR = async () => { await sessionRef.current?.end(); sessionRef.current = null; setStarted(false); };
  const sceneLabels = useMemo(() => ({ live: t("Live", "حي"), desert: t("Desert", "صحراوي"), rain: t("Rain", "مطر"), night: t("Night", "ليل") }), [t]);
  const sceneClass = sceneMode === "rain" ? "bg-[linear-gradient(180deg,rgba(37,99,235,.16),transparent_55%)]" : sceneMode === "night" ? "bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,.18),transparent_40%),rgba(2,6,23,.22)]" : sceneMode === "desert" ? "bg-[radial-gradient(circle_at_65%_20%,rgba(245,158,11,.18),transparent_42%)]" : "bg-transparent";

  return <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    <div className={`absolute inset-0 pointer-events-none transition-all duration-700 ${sceneClass}`} />

    {sceneMode === "rain" && <div className="pointer-events-none absolute inset-0 opacity-25"><div className="absolute inset-[-30%] rotate-[12deg] bg-[repeating-linear-gradient(105deg,transparent_0,transparent_13px,rgba(191,219,254,.8)_14px,transparent_16px)] animate-pulse" /></div>}
    {sceneMode === "desert" && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgba(180,83,9,.16))]" />}

    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-[min(92vw,430px)] rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
        <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-400">EJAZ · AR REALITY COCKPIT</div>
        <div className="mt-1 text-lg font-bold">{vehicle.brand} {vehicle.model}</div>
        <div className="mt-1 text-sm text-white/55">{vehicle.plate} · {reality.bodyLabelAr}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Gauge label={t("Payload", "الحمولة")} value={`${Math.round(load)}%`} progress={load} />
          <Gauge label={t("Fuel", "الوقود")} value={`${Math.round(fuel)}%`} progress={fuel} />
          <Gauge label={t("Speed", "السرعة")} value={String(Math.round(Number(vehicle.speed) || 0))} unit=" km/h" progress={Math.min(100, Number(vehicle.speed) / 1.2)} />
          <Gauge label={t("Engine", "المحرك")} value={String(Math.round(temp))} unit="°" progress={Math.min(100, Math.max(0, (temp - 60) * 2.5))} />
        </div>
      </div>
      <button onClick={started ? exitAR : onClose} className="pointer-events-auto min-h-11 rounded-full border border-white/15 bg-black/60 px-4 text-sm font-semibold backdrop-blur-xl">{started ? t("Exit AR", "خروج من AR") : t("Close", "إغلاق")}</button>
    </div>

    <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 pointer-events-none">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/65 p-3 shadow-2xl backdrop-blur-2xl pointer-events-auto">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-[.14em] text-white/40">{t("Vehicle state", "حالة المركبة")}</div><div className="mt-1 text-sm font-bold">{moving ? t("Moving", "تتحرك") : t("Stopped", "متوقفة")}</div></div>
          <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-[.14em] text-white/40">{t("ETA", "الوصول")}</div><div className="mt-1 text-sm font-bold">{etaLabel(vehicle.etaMinutes)}</div></div>
          <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-[.14em] text-white/40">{t("Distance", "المسافة")}</div><div className="mt-1 text-sm font-bold">{Math.round(Number(vehicle.milesLeft) || 0)} mi</div></div>
          <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-[.14em] text-white/40">{t("Capacity", "السعة")}</div><div className="mt-1 text-sm font-bold">{Math.max(0, Math.round(100 - load))}% {t("free", "متاح")}</div></div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          {(Object.keys(sceneLabels) as SceneMode[]).map((id) => <button key={id} onClick={() => setSceneMode(id)} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${sceneMode === id ? "bg-orange-400 text-black" : "bg-white/5 text-white/65"}`}>{sceneLabels[id]}{id !== "live" && <span className="ms-1 text-[9px] opacity-60">SIM</span>}</button>)}
        </div>
      </div>
    </div>

    {!started && <div className="absolute inset-0 grid place-items-center p-5 pointer-events-none"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/75 p-6 text-center shadow-2xl backdrop-blur-2xl pointer-events-auto">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-500/15 text-orange-400">AR</div>
      <h2 className="mt-4 text-xl font-bold">{t("Place the truck in your space", "ضع الشاحنة داخل مساحتك")}</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">{support?.supported ? support.reason : t("Checking device AR support…", "جارٍ فحص دعم الواقع المعزز…")}</p>
      {!reality.isOfficialModel && <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-start text-xs leading-5 text-amber-100">{t("A published official GLB/GLTF model is required for true AR. The system will not present a procedural truck as an official manufacturer model.", "يلزم رفع نموذج GLB/GLTF رسمي لتشغيل AR الحقيقي. النظام لن يقدم مجسماً إجرائياً على أنه شاحنة أصلية من الشركة المصنعة.")}</div>}
      {error && <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
      <button onClick={enterAR} disabled={!support?.supported || !reality.isOfficialModel || starting} className="mt-5 min-h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{starting ? t("Starting…", "جارٍ التشغيل…") : t("Start real AR", "تشغيل AR الحقيقي")}</button>
      <div className="mt-3 text-[11px] text-white/40">{reality.isOfficialModel ? t("Official 3D asset", "نموذج ثلاثي الأبعاد رسمي") : t("Official 3D model not published", "لم يتم نشر النموذج الرسمي بعد")}</div>
    </div></div>}
  </div>;
}
