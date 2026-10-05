import { useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { useVehicleAssets, type VehicleTypeAsset } from "../state/vehicleAssetStore";
import { APPROVED_VEHICLE_TYPES_LIST, normalizeVehicleType, type CanonicalVehicleTypeId } from "../data/vehicleTypes";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { TruckImage } from "./TruckImage";
import { CapacityTruck } from "./CapacityTruck";
import { TruckTypeIcon } from "./TruckTypeIcon";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { IconUpload, IconTruck, IconCheck, IconAlertCircle, IconClose, IconSearch } from "./Icons";

/**
 * EJAZ Transport — Official Vehicle Asset Management.
 *
 * Publishes the SINGLE SOURCE OF TRUTH for vehicle imagery and 3D models:
 *   Official Category Image  +  Official Category 3D Model  +  per-vehicle photograph
 *
 * Everything published here is instantly consumed by the Android application,
 * the fleet registry, vehicle add/edit screens, trip screens and shipment cards.
 */

const ALLOWED_MODEL_EXT = [".glb", ".gltf"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function VehicleAssetsManager() {
  const { t } = useSettings();
  const pushToast = useToast();
  const { registry, refresh, isLoading } = useVehicleAssets();
  const { trucks, trips } = useFleetStore();

  const [activeType, setActiveType] = useState<CanonicalVehicleTypeId>("curtain");
  const [show3DPreview, setShow3DPreview] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<"image" | "model" | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleDropId, setVehicleDropId] = useState<string | null>(null);

  const dropProps = (kind: "image" | "model") => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dropTarget !== kind) setDropTarget(kind);
    },
    onDragLeave: () => setDropTarget((current) => (current === kind ? null : current)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (kind === "image") {
        const target: ImageTarget = { kind: "type", type: activeType };
        setImageTarget(target);
        handleImagePicked(file, target);
      } else {
        setImageTarget(null);
        handleModelPicked(file);
      }
    },
  });

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleImageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageTarget, setImageTarget] = useState<{ kind: "type"; type: CanonicalVehicleTypeId } | { kind: "vehicle"; vehicleId: string } | null>(null);

  const asset: VehicleTypeAsset = registry.types[activeType];

  /** Every truck in the fleet is reachable, filtered by plate / model / category. */
  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter((v) =>
      `${v.plate} ${v.brand} ${v.model} ${registry.types[normalizeVehicleType(v.body)].arabicName} ${registry.types[normalizeVehicleType(v.body)].englishName}`
        .toLowerCase()
        .includes(q),
    );
  }, [trucks, vehicleQuery, registry]);

  type ImageTarget = { kind: "type"; type: CanonicalVehicleTypeId } | { kind: "vehicle"; vehicleId: string };

  const handleImagePicked = async (file: File, target: ImageTarget | null = imageTarget) => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (ext !== ".svg" && file.type !== "image/svg+xml") {
      setError(
        t(
          "Uploaded images must be in SVG format (.svg).",
          "يجب أن تكون الصور المرفوعة بصيغة SVG (.svg) لضمان دقة العرض الفائقة وعدم التأثير على الأداء.",
        ),
      );
      return;
    }
    if (file.size > registry.limits.maxImageBytes) {
      setError(
        t(
          `Image is larger than ${formatBytes(registry.limits.maxImageBytes)}.`,
          `حجم الصورة يتجاوز الحد المسموح ${formatBytes(registry.limits.maxImageBytes)}.`,
        ),
      );
      return;
    }

    setBusy("image");
    setError(null);
    try {
      const data = await readFileAsBase64(file);

      if (target?.kind === "vehicle") {
        await apiClient.vehicleAssets.publishVehicleImage(target.vehicleId, { data, fileName: file.name });
        const plate = trucks.find((v) => v.id === target.vehicleId)?.plate;
        pushToast(
          t("Vehicle photograph published — applied everywhere now", "تم نشر صورة المركبة — طُبِّقت على كل الشاشات فوراً"),
          plate,
        );
      } else {
        const type = target?.kind === "type" ? target.type : activeType;
        await apiClient.vehicleAssets.publishTypeImage(type, { data, fileName: file.name });
        pushToast(
          t("Official category image published — applied everywhere now", "تم نشر الصورة الرسمية للنوع — طُبِّقت على كل الشاشات فوراً"),
          APPROVED_VEHICLE_TYPES_LIST.find((x) => x.id === type)?.arabicName,
        );
      }

      await refresh();
      setImageTarget(null);
    } catch (err: any) {
      setError(err?.message || t("Upload failed", "فشل الرفع"));
    } finally {
      setBusy(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleModelPicked = async (file: File) => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!ALLOWED_MODEL_EXT.includes(ext)) {
      setError(t("Only GLB or glTF 2.0 files are accepted.", "يُقبل فقط ملف GLB أو glTF 2.0."));
      return;
    }
    if (file.size > registry.limits.maxModelBytes) {
      setError(
        t(
          `Model is larger than ${formatBytes(registry.limits.maxModelBytes)}.`,
          `حجم المجسم يتجاوز الحد المسموح ${formatBytes(registry.limits.maxModelBytes)}.`,
        ),
      );
      return;
    }

    setBusy("model");
    setError(null);
    try {
      const data = await readFileAsBase64(file);
      await apiClient.vehicleAssets.publishTypeModel(activeType, { data, fileName: file.name });
      pushToast(t("Official 3D model published", "تم نشر المجسم الرسمي ثلاثي الأبعاد"));
      await refresh();
      setShow3DPreview(true);
    } catch (err: any) {
      setError(err?.message || t("Model upload failed", "فشل رفع المجسم"));
    } finally {
      setBusy(null);
      if (modelInputRef.current) modelInputRef.current.value = "";
    }
  };

  const updateTransform = async (patch: { scale?: number; rotationY?: number; yOffset?: number }) => {
    setBusy("transform");
    try {
      await apiClient.vehicleAssets.updateModelTransform(activeType, patch);
      await refresh();
    } catch (err: any) {
      setError(err?.message || t("Could not update the model framing", "تعذر تحديث ضبط المجسم"));
    } finally {
      setBusy(null);
    }
  };

  const withdrawModel = async () => {
    setBusy("withdraw");
    try {
      await apiClient.vehicleAssets.withdrawTypeModel(activeType);
      pushToast(t("Model withdrawn — the official image is displayed instead", "تم سحب المجسم — ستُعرض الصورة الرسمية بدلاً منه"));
      await refresh();
    } catch (err: any) {
      setError(err?.message || t("Could not withdraw the model", "تعذر سحب المجسم"));
    } finally {
      setBusy(null);
    }
  };

  const removeVehiclePhoto = async (vehicleId: string) => {
    setBusy("vehicle-image");
    try {
      await apiClient.vehicleAssets.removeVehicleImage(vehicleId);
      await refresh();
      pushToast(t("Vehicle photograph removed — official asset restored", "تم حذف صورة المركبة — عاد الأصل الرسمي"));
    } catch (err: any) {
      setError(err?.message || t("Could not remove the photograph", "تعذر حذف الصورة"));
    } finally {
      setBusy(null);
    }
  };

  const publishedCount = APPROVED_VEHICLE_TYPES_LIST.filter((vt) => registry.types[vt.id].hasOfficialImage).length;
  const modelCount = APPROVED_VEHICLE_TYPES_LIST.filter((vt) => registry.types[vt.id].hasOfficialModel).length;

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-5 lg:px-6">
      {/* Header — matches the existing console header rhythm */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-extrabold text-text-primary">
            {t("Vehicle Assets (Official Source of Truth)", "أصول المركبات (المصدر الرسمي الموحد)")}
          </h1>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            {t(
              "The Android app and this control room read the same catalogue: one official image and one official 3D model per approved category.",
              "التطبيق ولوحة التحكم يقرآن نفس الكتالوج: صورة رسمية واحدة ومجسم ثلاثي الأبعاد واحد لكل نوع معتمد.",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 font-semibold text-text-secondary">
            {t("Official images", "صور رسمية")}: <span className="text-brand tabular-nums">{publishedCount}/4</span>
          </span>
          <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 font-semibold text-text-secondary">
            {t("3D models", "مجسمات 3D")}: <span className="text-brand tabular-nums">{modelCount}/4</span>
          </span>
          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 font-semibold text-text-secondary transition-colors hover:text-brand disabled:opacity-60"
          >
            {isLoading ? t("Refreshing…", "جارٍ التحديث…") : t("Refresh catalogue", "تحديث الكتالوج")}
          </button>
        </div>
      </div>

      {/* Operating procedure — the asset pipeline in three steps */}
      <div className="mb-4 grid gap-2 rounded-[14px] border border-border-subtle bg-surface-1 p-3 sm:grid-cols-3">
        {[
          {
            n: "1",
            ar: "اختر النوع المعتمد (سطحة · براد · جاف · ستارة)",
            en: "Pick the approved category",
          },
          {
            n: "2",
            ar: "اسحب صورة الشاحنة الأصلية وأفلتها في البطاقة — أو اضغط زر النشر واختر الملف",
            en: "Drag the original photograph into the card, or use the publish button",
          },
          {
            n: "3",
            ar: "بعد النشر تُحفظ النسخة الأصلية دون أي تعديل وتظهر فوراً في التطبيق ولوحة التحكم",
            en: "The untouched original is preserved and the asset goes live everywhere at once",
          },
        ].map((step) => (
          <div key={step.n} className="flex items-start gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-extrabold text-brand">
              {step.n}
            </span>
            <span className="text-[11.5px] leading-relaxed text-text-secondary">{t(step.en, step.ar)}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-status-danger/30 bg-status-danger/10 p-3 text-[12px] text-status-danger">
          <IconAlertCircle size={15} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <IconClose size={13} />
          </button>
        </div>
      )}

      {/* Category selector — exactly 4 approved types */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {APPROVED_VEHICLE_TYPES_LIST.map((vt) => {
          const entry = registry.types[vt.id];
          const isActive = activeType === vt.id;
          const typeTrips = trips.filter((trip) => normalizeVehicleType(trip.cargoType) === vt.id);
          const typeTrip = typeTrips.find((trip) => trip.cargoWeightTons > 0) ?? typeTrips[0];
          const typeLoadPercent = typeTrip && typeTrip.maxCapacityTons > 0
            ? Math.max(0, Math.min(100, typeTrip.cargoWeightTons / typeTrip.maxCapacityTons * 100))
            : 0;
          return (
            <button
              key={vt.id}
              onClick={() => setActiveType(vt.id)}
              aria-pressed={isActive}
              className={cn(
                "group overflow-hidden rounded-[14px] border bg-surface-1 text-start transition-all",
                isActive ? "border-brand/60 shadow-lg" : "border-border-subtle hover:border-brand/30",
              )}
            >
              <div className="relative overflow-hidden bg-surface-2 p-1">
                <CapacityTruck
                  key={`${vt.id}-${isActive}`}
                  pct={typeLoadPercent}
                  countUp={Boolean(typeTrip)}
                  truckType={vt.id}
                  label={t(vt.englishName, vt.arabicName)}
                  className="w-full"
                />
                <span
                  className={cn(
                    "absolute top-2 end-2 rounded-full px-2 py-[2px] text-[9.5px] font-bold backdrop-blur",
                    entry.hasOfficialImage ? "bg-status-active/20 text-status-active" : "bg-black/45 text-white/80",
                  )}
                >
                  {entry.hasOfficialImage ? t("OFFICIAL", "رسمية") : t("BASELINE", "أساسية")}
                </span>
                {entry.hasOfficialModel && (
                  <span className="absolute bottom-2 start-2 rounded-full bg-brand/85 px-2 py-[2px] text-[9.5px] font-bold text-on-brand">
                    3D
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-text-primary">{vt.arabicName}</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-muted"><span>{vt.categoryCode}</span><span style={{ color: vt.accentColor }}><TruckTypeIcon truckType={vt.id} size={16} /></span></span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-text-muted">{vt.englishName}</div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2 text-[10px]">
                  <span className="text-text-muted">{typeTrip ? `${typeTrip.cargoWeightTons.toLocaleString()} / ${typeTrip.maxCapacityTons} ${t("tons", "طن")}` : "—"}</span>
                  <strong className="tabular-nums text-text-primary">{typeTrip ? `${Math.round(typeLoadPercent)}%` : "—"}</strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active category workspace */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        {/* Left: official assets */}
        <div className="space-y-4">
          <section
            {...dropProps("image")}
            className={cn(
              "rounded-[16px] border bg-surface-1 p-4 transition-colors",
              dropTarget === "image" ? "border-brand bg-brand/5 ring-2 ring-brand/30" : "border-border-subtle",
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13.5px] font-bold text-text-primary">
                {t("Official reference image", "الصورة الرسمية للنوع")} · {asset.arabicName}
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold",
                  asset.hasOfficialImage ? "bg-status-active/15 text-status-active" : "bg-status-waiting/15 text-status-waiting",
                )}
              >
                {asset.hasOfficialImage ? t("Published", "منشورة") : t("Baseline asset", "أصل أساسي")}
              </span>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface-2">
              <TruckImage body={activeType} className="h-[190px] w-full object-cover" loading="eager" />
            </div>

            <dl className="mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("Public path", "المسار العام")}</dt>
                <dd className="truncate font-mono text-text-secondary">{asset.officialImage}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("Original file", "الملف الأصلي")}</dt>
                <dd className="truncate font-mono text-text-secondary">{asset.imageFileName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("Published at", "تاريخ النشر")}</dt>
                <dd className="font-mono text-text-secondary">
                  {asset.imageUpdatedAt ? new Date(asset.imageUpdatedAt).toLocaleString("ar-SA") : "—"}
                </dd>
              </div>
            </dl>

            <button
              onClick={() => {
                const target: ImageTarget = { kind: "type", type: activeType };
                setImageTarget(target);
                setError(null);
                imageInputRef.current?.click();
              }}
              disabled={busy === "image"}
              className="btn-primary mt-3 w-full gap-2 py-2.5 text-[12.5px] disabled:opacity-60"
            >
              <IconUpload size={15} />
              {busy === "image"
                ? t("Publishing…", "جارٍ النشر…")
                : asset.hasOfficialImage
                  ? t("Replace the official image", "استبدال الصورة الرسمية")
                  : t("Publish the official image", "نشر الصورة الرسمية")}
            </button>
            <p className="mt-2 text-[10.5px] leading-relaxed text-text-muted">
              {t(
                "Drop the file here, or use the button above. The uploaded file is preserved byte-for-byte as the original and is used across every screen without alteration.",
                "أفلت الملف هنا أو استخدم الزر أعلاه. يُحفظ الملف المرفوع كما هو بايت ببايت كنسخة أصلية، ويُستخدم في كل الشاشات دون أي تعديل على المركبة.",
              )}
            </p>
          </section>

          <section
            {...dropProps("model")}
            className={cn(
              "rounded-[16px] border bg-surface-1 p-4 transition-colors",
              dropTarget === "model" ? "border-brand bg-brand/5 ring-2 ring-brand/30" : "border-border-subtle",
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13.5px] font-bold text-text-primary">
                {t("Official 3D model (GLB / glTF)", "المجسم الرسمي ثلاثي الأبعاد (GLB / glTF)")}
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold",
                  asset.hasOfficialModel ? "bg-status-active/15 text-status-active" : "bg-status-waiting/15 text-status-waiting",
                )}
              >
                {asset.hasOfficialModel ? t("Interactive 3D", "مجسم تفاعلي") : t("Not published", "غير منشور")}
              </span>
            </div>

            {asset.hasOfficialModel ? (
              <div className="space-y-3">
                <dl className="space-y-1 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">{t("File", "الملف")}</dt>
                    <dd className="truncate font-mono text-text-secondary">{asset.model.fileName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">{t("Size", "الحجم")}</dt>
                    <dd className="font-mono text-text-secondary">{formatBytes(asset.model.sizeBytes)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">SHA-256</dt>
                    <dd className="truncate font-mono text-text-secondary">{asset.model.sha256?.slice(0, 20)}…</dd>
                  </div>
                </dl>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {[
                    { key: "scale" as const, label: t("Scale", "الحجم"), min: 0.2, max: 4, step: 0.05, value: asset.model.scale },
                    { key: "rotationY" as const, label: t("Heading °", "زاوية الاتجاه"), min: -180, max: 180, step: 5, value: asset.model.rotationY },
                    { key: "yOffset" as const, label: t("Height offset", "ارتفاع"), min: -3, max: 3, step: 0.05, value: asset.model.yOffset },
                  ].map((ctl) => (
                    <label key={ctl.key} className="block">
                      <span className="mb-1 flex items-center justify-between text-[10.5px] font-semibold text-text-secondary">
                        {ctl.label}
                        <span className="font-mono text-text-muted">{Number(ctl.value).toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={ctl.min}
                        max={ctl.max}
                        step={ctl.step}
                        defaultValue={ctl.value}
                        onMouseUp={(e) => updateTransform({ [ctl.key]: Number((e.target as HTMLInputElement).value) } as any)}
                        onTouchEnd={(e) => updateTransform({ [ctl.key]: Number((e.target as HTMLInputElement).value) } as any)}
                        className="w-full accent-[var(--color-brand)]"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setImageTarget(null);
                      modelInputRef.current?.click();
                    }}
                    disabled={busy === "model"}
                    className="btn-ghost flex-1 gap-2 border border-border-subtle py-2 text-[12px] disabled:opacity-60"
                  >
                    <IconUpload size={14} />
                    {t("Replace the model", "استبدال المجسم")}
                  </button>
                  <button
                    onClick={withdrawModel}
                    disabled={busy === "withdraw"}
                    className="btn-ghost gap-2 border border-status-danger/30 py-2 text-[12px] text-status-danger hover:bg-status-danger/10 disabled:opacity-60"
                  >
                    <IconClose size={14} />
                    {t("Withdraw", "سحب")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-[12px] border border-status-waiting/25 bg-status-waiting/8 p-3 text-[11.5px] leading-relaxed text-status-waiting">
                  <IconAlertCircle size={15} className="mt-[1px] shrink-0" />
                  <span>
                    {t(
                      "No GLB/glTF has been published for this category yet. The viewer shows the official reference photograph with a clear label — no simulated 3D is ever presented as real.",
                      "لم يُنشر مجسم GLB/glTF لهذا النوع بعد. يعرض العارض الصورة الرسمية مع وسم واضح — ولا يُقدَّم أي تأثير محاكاة على أنه مجسم حقيقي.",
                    )}
                  </span>
                </div>
                <button
                  onClick={() => modelInputRef.current?.click()}
                  disabled={busy === "model"}
                  className="btn-primary w-full gap-2 py-2.5 text-[12.5px] disabled:opacity-60"
                >
                  <IconUpload size={15} />
                  {busy === "model" ? t("Uploading…", "جارٍ الرفع…") : t("Publish the official 3D model", "نشر المجسم الرسمي")}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Right: live viewer + per-vehicle photographs */}
        <div className="space-y-4">
          <section className="rounded-[16px] border border-border-subtle bg-surface-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13.5px] font-bold text-text-primary">
                {t("Live asset preview", "معاينة مباشرة للأصل")}
              </h2>
              <button
                onClick={() => setShow3DPreview((v) => !v)}
                className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[10.5px] font-semibold text-text-secondary transition-colors hover:text-brand"
              >
                {show3DPreview ? t("Show image", "عرض الصورة") : t("Show viewer", "عرض المجسم")}
              </button>
            </div>

            <div className="h-[340px] overflow-hidden rounded-[12px] border border-border-subtle">
              {show3DPreview ? (
                <Vehicle3DViewer vehicleType={activeType} height="100%" showControls />
              ) : (
                <TruckImage body={activeType} className="h-full w-full object-contain p-4" loading="eager" />
              )}
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-text-muted">
              {t(
                "This is the exact asset rendered by the Android app and every console screen for this category.",
                "هذا هو نفس الأصل المعروض في تطبيق الأندرويد وكل شاشات لوحة التحكم لهذا النوع.",
              )}
            </p>
          </section>

          <section className="rounded-[16px] border border-border-subtle bg-surface-1 p-4">
            <h2 className="mb-1 text-[13.5px] font-bold text-text-primary">
              {t("Vehicle photographs", "صور المركبات الفعلية")}
            </h2>
            <p className="mb-3 text-[11px] leading-relaxed text-text-muted">
              {t(
                "Upload a photograph for any truck in the fleet — it replaces the category image for that unit only and is applied on every screen the moment it is published. Drag a file onto a card, or use its upload button.",
                "ارفع صورة لأي شاحنة في الأسطول — تحل محل صورة النوع لهذه المركبة فقط وتُطبَّق على كل الشاشات لحظة النشر. أفلت الملف على البطاقة أو استخدم زر الرفع.",
              )}
            </p>

            <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-1.5">
              <IconSearch size={14} className="shrink-0 text-text-muted" />
              <input
                value={vehicleQuery}
                onChange={(e) => setVehicleQuery(e.target.value)}
                placeholder={t("Search by plate, model or type…", "ابحث باللوحة أو الموديل أو النوع…")}
                className="w-full bg-transparent text-[11.5px] text-text-primary outline-none placeholder:text-text-muted"
              />
              {vehicleQuery && (
                <button
                  onClick={() => setVehicleQuery("")}
                  className="shrink-0 text-text-muted transition-colors hover:text-brand"
                  title={t("Clear", "مسح")}
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            <div className="scroll-thin grid max-h-[420px] gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
              {filteredVehicles.map((v) => {
                const published = registry.vehicles[v.id]?.url;
                const typeId = normalizeVehicleType(v.body);
                return (
                  <div
                    key={v.id}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes("Files")) return;
                      e.preventDefault();
                      setVehicleDropId(v.id);
                    }}
                    onDragLeave={() => setVehicleDropId((cur) => (cur === v.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setVehicleDropId(null);
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      const target: ImageTarget = { kind: "vehicle", vehicleId: v.id };
                      setImageTarget(target);
                      handleImagePicked(file, target);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[12px] border bg-surface-2 p-2.5 transition-colors",
                      vehicleDropId === v.id ? "border-brand bg-brand/10 ring-1 ring-brand/40" : "border-border-subtle",
                    )}
                  >
                    <div className="h-11 w-14 shrink-0 overflow-hidden rounded-[8px] bg-surface-3">
                      <TruckImage vehicle={v as any} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-bold text-text-primary">{v.model}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        <span className="font-mono">{v.plate}</span>
                        <span>·</span>
                        <span>{registry.types[typeId].arabicName}</span>
                        {published && (
                          <span className="rounded-full bg-status-active/15 px-1.5 py-[1px] text-[9px] font-bold text-status-active">
                            {t("custom", "خاصة")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          const target: ImageTarget = { kind: "vehicle", vehicleId: v.id };
                          setImageTarget(target);
                          setError(null);
                          vehicleImageInputRef.current?.click();
                        }}
                        disabled={busy === "image"}
                        className="inline-flex items-center gap-1 rounded-[8px] border border-brand/40 px-2 py-1 text-[10.5px] font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand disabled:opacity-50"
                        title={t("Publish a photograph for this vehicle", "نشر صورة لهذه المركبة")}
                      >
                        <IconUpload size={12} />
                        {published ? t("Replace", "تبديل") : t("Upload", "رفع")}
                      </button>
                      {published && (
                        <button
                          onClick={() => removeVehiclePhoto(v.id)}
                          className="rounded-[8px] border border-status-danger/25 p-1.5 text-status-danger transition-colors hover:bg-status-danger/10"
                          title={t("Remove and restore the official asset", "حذف وإعادة الأصل الرسمي")}
                        >
                          <IconClose size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[16px] border border-border-subtle bg-surface-1 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-text-primary">
              <IconCheck size={15} className="text-brand" />
              {t("How this propagates", "كيف ينتشر هذا الأصل")}
            </h2>
            <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-text-secondary">
              {[
                t("Android application (driver & client modes)", "تطبيق الأندرويد (وضع السائق والعميل)"),
                t("Fleet registry cards and vehicle details", "بطاقات الأسطول وتفاصيل المركبة"),
                t("Add vehicle / edit vehicle screens", "شاشات إضافة وتعديل المركبة"),
                t("Trips and shipments wherever the vehicle is shown", "الرحلات والشحنات عند عرض المركبة"),
                t("Reports and the operational dashboard", "التقارير ولوحة العمليات"),
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-border-subtle bg-surface-2 p-2.5 text-[11px] text-text-muted">
              <IconTruck size={14} className="text-brand" />
              <span>
                {t("Approved categories: Flatbed · Refrigerated · Dry Van · Curtainsider — and no fifth type.", "الأنواع المعتمدة: سطحة · براد · جاف · ستارة — ولا نوع خامس.")}
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Hidden pickers */}
      <input
        ref={imageInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImagePicked(file);
        }}
      />
      <input
        ref={vehicleImageInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImagePicked(file);
        }}
      />
      <input
        ref={modelInputRef}
        type="file"
        accept={ALLOWED_MODEL_EXT.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleModelPicked(file);
        }}
      />
    </div>
  );
}
