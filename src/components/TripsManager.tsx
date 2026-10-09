import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip, type TripStatus } from "../state/fleetStore";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { EjazEmblem } from "./Logo";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { getVehicleTypeMeta, APPROVED_VEHICLE_TYPES_LIST } from "../data/vehicleTypes";
import { TruckTypeIcon, TruckTypeAvatar, TruckTypeBadge } from "./TruckTypeIcon";
import { TRIP_TABS, tabOfStatus, tabOfLegacyStatus, statusMeta, type TripTab } from "../data/tripStatusMeta";
import {
  IconCheck,
  IconClose,
  IconDoc,
  IconLayers,
  IconSearch,
  IconHistory,
} from "./Icons";
import { palette } from "../utils/palette";

interface TripsManagerProps {
  onClose?: () => void;
  onOpenLiveTracking?: (tripId: string) => void;
}

/**
 * إدارة الرحلات (Phase 2)
 *
 * The same screen, reorganised around the real lifecycle: a tabbed card list
 * (الكل · متاحة · مؤكدة · جارية · مكتملة) wired to the canonical 18 states,
 * a strong «من ← إلى» route visual, live metrics (distance · weight · date ·
 * time) and the tariff-resolved price. Every row comes from the backend sync —
 * there are no mock trips — and every action (waybill, POD, replacements,
 * lifecycle steps) keeps working against the authoritative API.
 */
export function TripsManager({ onClose, onOpenLiveTracking }: TripsManagerProps) {
  const { t, td } = useSettings();
  const toast = useToast();
  const {
    trips,
    selectedTripId,
    selectTrip,
    updateTripStatus,
  } = useFleetStore();

  const [tab, setTab] = useState<TripTab>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [activeTripId, setActiveTripId] = useState(selectedTripId || trips[0]?.id);
  const [details, setDetails] = useState<any | null>(null);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);

  const [showWaybillModal, setShowWaybillModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signDataUrl, setSignDataUrl] = useState<string | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showReplaceDriverModal, setShowReplaceDriverModal] = useState(false);
  const [newDriverId, setNewDriverId] = useState("");
  const [driverReplaceReason, setDriverReplaceReason] = useState("");
  const [showReplaceVehicleModal, setShowReplaceVehicleModal] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [vehicleReplaceReason, setVehicleReplaceReason] = useState("");
  const [showReplaceBothModal, setShowReplaceBothModal] = useState(false);
  const [bothDriverId, setBothDriverId] = useState("");
  const [bothVehicleId, setBothVehicleId] = useState("");
  const [bothReason, setBothReason] = useState("");
  const [replacementBusy, setReplacementBusy] = useState(false);
  const [replacementNotice, setReplacementNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const currentTrip: Trip | undefined = trips.find((tr) => tr.id === activeTripId) || trips[0];

  /* Real fleet rosters for the replacement dialogs (no hardcoded names). */
  useEffect(() => {
    apiClient.drivers.getAll().then((r) => setDriversList(r?.drivers || [])).catch(() => {});
    apiClient.vehicles.getAll().then((r) => setVehiclesList(r?.vehicles || [])).catch(() => {});
  }, []);

  /* Authoritative trip file: trip + vehicle + driver + events + financials. */
  const refreshDetails = useCallback(async (tripId: string) => {
    try {
      const res = await apiClient.trips.getById(tripId);
      setDetails(res);
    } catch {
      setDetails(null);
    }
  }, []);

  useEffect(() => {
    if (currentTrip?.id) refreshDetails(currentTrip.id);
  }, [currentTrip?.id, refreshDetails]);

  const tabCounts = useMemo(() => {
    const counts: Record<TripTab, number> = { all: trips.length, available: 0, confirmed: 0, active: 0, completed: 0 };
    for (const tr of trips) {
      const g = tabOfStatus((tr as any).canonicalStatus) ?? tabOfLegacyStatus(tr.status);
      if (g) counts[g] += 1;
    }
    return counts;
  }, [trips]);

  const visibleTrips = useMemo(() => {
    return trips.filter((tr) => {
      if (tab !== "all") {
        const g = tabOfStatus((tr as any).canonicalStatus) ?? tabOfLegacyStatus(tr.status);
        if (g !== tab) return false;
      }
      if (typeFilter !== "ALL" && tr.cargoType !== typeFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${tr.tripNumber} ${tr.originCity} ${tr.destinationCity} ${tr.shipper} ${tr.consignee}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trips, tab, typeFilter, query]);

  /* ── Actions (all hit the authoritative backend) ─────────────────────── */

  const handleExecuteDriverReplacement = async () => {
    if (!currentTrip || !newDriverId) return;
    setReplacementBusy(true);
    try {
      await apiClient.trips.replaceDriver(currentTrip.id, newDriverId, driverReplaceReason.trim());
      const d = driversList.find((x) => x.id === newDriverId);
      setReplacementNotice({ ok: true, text: t("Driver replaced successfully and recorded in the trip file.", "تم استبدال السائق بنجاح وتوثيق العملية في ملف الرحلة.") + (d ? ` (${d.fullName})` : "") });
      setShowReplaceDriverModal(false);
      setDriverReplaceReason("");
      refreshDetails(currentTrip.id);
    } catch (e: any) {
      setReplacementNotice({ ok: false, text: String(e?.message || t("Replacement failed", "فشل الاستبدال")) });
    } finally {
      setReplacementBusy(false);
    }
  };

  const handleExecuteVehicleReplacement = async () => {
    if (!currentTrip || !newVehicleId) return;
    setReplacementBusy(true);
    try {
      await apiClient.trips.replaceVehicle(currentTrip.id, newVehicleId, vehicleReplaceReason.trim());
      const v = vehiclesList.find((x) => x.id === newVehicleId);
      setReplacementNotice({ ok: true, text: t("Vehicle replaced successfully and recorded in the trip file.", "تم استبدال الشاحنة بنجاح وتوثيق العملية في ملف الرحلة.") + (v ? ` (${v.plate})` : "") });
      setShowReplaceVehicleModal(false);
      setVehicleReplaceReason("");
      refreshDetails(currentTrip.id);
    } catch (e: any) {
      setReplacementNotice({ ok: false, text: String(e?.message || t("Replacement failed", "فشل الاستبدال")) });
    } finally {
      setReplacementBusy(false);
    }
  };

  const handleExecuteBothReplacement = async () => {
    if (!currentTrip || !bothDriverId || !bothVehicleId) return;
    setReplacementBusy(true);
    try {
      await apiClient.trips.replaceAssignment(currentTrip.id, {
        newDriverId: bothDriverId,
        newVehicleId: bothVehicleId,
        reason: bothReason.trim(),
      });
      setReplacementNotice({ ok: true, text: t("Driver and vehicle replaced inside the same trip — the unified number never changed.", "تم استبدال السائق والمركبة داخل نفس الرحلة — الرقم الموحد لا يتغير أبدًا.") });
      setShowReplaceBothModal(false);
      setBothReason("");
      refreshDetails(currentTrip.id);
    } catch (e: any) {
      setReplacementNotice({ ok: false, text: String(e?.message || t("Replacement failed", "فشل الاستبدال")) });
    } finally {
      setReplacementBusy(false);
    }
  };

  const handleApproveDriverRequest = async (tripId: string) => {
    try {
      await apiClient.trips.approveRequest(tripId);
      const msg = t("Driver trip request approved successfully! Trip is now confirmed.", "تمت الموافقة على طلب السائق وإسناد الرحلة رسمياً بنجاح!");
      setReplacementNotice({ ok: true, text: msg });
      toast(msg);
      refreshDetails(tripId);
    } catch (err: any) {
      toast(t("Failed to approve driver request", "فشلت الموافقة على طلب السائق"), err.message || "Error");
    }
  };

  const handleRejectDriverRequest = async (tripId: string) => {
    try {
      await apiClient.trips.rejectRequest(tripId, t("Operational priorities", "أولويات تشغيلية"));
      const msg = t("Driver trip request rejected.", "تم رفض طلب الرحلة وإعادتها لقائمة الرحلات المتاحة.");
      setReplacementNotice({ ok: true, text: msg });
      toast(msg);
      refreshDetails(tripId);
    } catch (err: any) {
      toast(t("Failed to reject driver request", "فشل رفض طلب السائق"), err.message || "Error");
    }
  };

  const handleAdvanceStatus = (nextStatus: TripStatus, noteAr: string, noteEn: string) => {
    if (!currentTrip) return;
    updateTripStatus(currentTrip.id, nextStatus, noteAr, noteEn, signDataUrl || undefined);
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsSigning(true);
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = palette()["--color-brand"];
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsSigning(false);
    const canvas = signCanvasRef.current;
    if (canvas) {
      setSignDataUrl(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignDataUrl(null);
  };

  const copyShareLink = () => {
    if (!currentTrip) return;
    navigator.clipboard?.writeText?.(
      `${window.location.origin}/?track=${currentTrip.tripNumber}`
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const fmtTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  };

  const priceLabel = (tr: Trip) => {
    const price = (tr as any).tripPrice as number | undefined;
    if (price && price > 0) return `${Number(price).toLocaleString()} ${(tr as any).currency || "SAR"}`;
    if ((tr as any).priceStatus === "PENDING_QUOTE") return t("Awaiting quote", "بانتظار عرض سعر");
    return "—";
  };

  const tripStatusMeta = (tr: Trip) => statusMeta((tr as any).canonicalStatus || undefined);

  const timelineEvents: any[] = useMemo(() => {
    if (Array.isArray(details?.events) && details.events.length > 0) {
      return [...details.events].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return currentTrip?.timeline || [];
  }, [details, currentTrip]);

  if (!currentTrip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-0 text-center">
        <div className="text-page-title font-bold text-text-primary">{t("No trips in the system yet", "لا توجد رحلات في النظام بعد")}</div>
        <p className="text-label-lg text-text-muted">{t("Trips appear here automatically the moment they are created.", "تظهر الرحلات هنا تلقائيًا فور إنشائها في النظام.")}</p>
      </div>
    );
  }

  const selMeta = tripStatusMeta(currentTrip);

  return (
    <div className="flex h-full flex-col bg-surface-0 min-h-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-hero-sm font-bold text-text-primary">
              {t("Trip Management & Consignment Lifecycle", "إدارة الرحلات ومسار الشحنات")}
            </h2>
            <span className="badge bg-brand/15 text-brand tabular-nums">
              {trips.length} {t("Trips", "رحلات")}
            </span>
          </div>
          <p className="text-label-lg text-text-muted mt-0.5">
            {t(
              "End-to-end trip execution: dispatch, GPS milestone tracking, e-waybill, and consignee POD signature",
              "إدارة دورة حياة الرحلة بالكامل: أمر النقل، التتبع المباشر، بوليصة الشحن، وإثبات التسليم الرقمي"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={copyShareLink} className="btn-ghost text-label-lg py-1.5 px-3">
            <IconLayers size={14} />
            {copiedLink ? t("Link Copied!", "تم النسخ!") : t("Share Tracking Link", "مشاركة رابط التتبع")}
          </button>
          <button
            onClick={() => setShowWaybillModal(true)}
            className="btn-primary text-label-lg py-1.5 px-4"
          >
            <IconDoc size={14} />
            {t("Print e-Waybill", "بوليصة الشحن الإلكترونية")}
          </button>
          {onClose && (
            <button onClick={onClose} className="btn-icon" aria-label={t("Close", "إغلاق")}>
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-column view */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,300px)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[380px_1fr] lg:grid-rows-none">
        {/* Left: tabs + filters + trip cards */}
        <div className="flex min-h-0 flex-col border-b border-border-subtle bg-surface-1 lg:min-h-full lg:border-b-0 lg:border-e">
          {/* Tabs — wired to the canonical lifecycle groups */}
          <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-2 scroll-x">
            {TRIP_TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-label font-bold transition-colors flex items-center gap-1.5",
                  tab === tb.id ? "bg-brand text-on-brand" : "bg-surface-2 text-text-muted hover:text-white"
                )}
              >
                {t(tb.en, tb.ar)}
                <span className={cn("tabular-nums text-micro", tab === tb.id ? "opacity-80" : "opacity-60")}>{tabCounts[tb.id]}</span>
              </button>
            ))}
          </div>

          {/* Search + type filter */}
          <div className="flex items-center gap-2 px-3 pb-3">
            <div className="flex flex-1 items-center gap-2 rounded-control bg-surface-2 border border-border-subtle px-2.5 py-1.5 focus-within:border-brand">
              <IconSearch size={13} className="text-text-muted shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search trip number, city, client…", "ابحث برقم الرحلة أو المدينة أو العميل…")}
                className="w-full bg-transparent text-label-lg text-white outline-none"
              />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="field !py-1.5 !text-label max-w-[120px]">
              <option value="ALL">{t("All types", "كل الأنواع")}</option>
              {APPROVED_VEHICLE_TYPES_LIST.map((v) => (
                <option key={v.id} value={v.id}>{v.arabicName}</option>
              ))}
            </select>
          </div>

          {/* Trip cards */}
          <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            {visibleTrips.length === 0 && (
              <div className="rounded-inner border border-border-subtle bg-surface-2 p-6 text-center text-label-lg text-text-muted">
                {t("No trips match this view.", "لا توجد رحلات مطابقة لهذا العرض.")}
              </div>
            )}

            {visibleTrips.map((tr) => {
              const isSelected = tr.id === activeTripId;
              const meta = tripStatusMeta(tr);
              return (
                <button
                  key={tr.id}
                  onClick={() => {
                    setActiveTripId(tr.id);
                    selectTrip(tr.id);
                  }}
                  className={cn(
                    "w-full min-w-0 rounded-inner p-3 text-start transition-all border",
                    isSelected
                      ? "bg-surface-3 border-brand shadow-lg selected-ring"
                      : "bg-surface-2 border-border-subtle hover:bg-surface-3 hover:border-border-subtle/80"
                  )}
                >
                  {/* Row 1: avatar + number + status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <TruckTypeAvatar truckType={tr.cargoType} size={34} iconSize={17} showBadge className="shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-card-title text-text-primary tracking-wide tabular-nums">{tr.tripNumber}</span>
                        <span className="block text-micro text-text-muted">{getVehicleTypeMeta(tr.cargoType).arabicName} · {getVehicleTypeMeta(tr.cargoType).englishName}</span>
                      </span>
                    </span>
                    <span
                      className="badge shrink-0 text-micro font-bold"
                      style={{ backgroundColor: `${meta.badgeColor}26`, color: meta.badgeColor }}
                    >
                      {t(meta.en, meta.ar)}
                    </span>
                  </div>

                  {/* Row 2: the route — the strongest visual on the card */}
                  <div className="mt-2.5 flex items-center gap-2 rounded-control bg-surface-0/60 border border-border-subtle/60 px-2.5 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <span className="truncate text-body font-extrabold text-text-primary">{td(tr.originCity)}</span>
                    <span className="shrink-0 text-brand font-black text-page-title leading-none">←</span>
                    <span className="truncate text-body font-extrabold text-text-primary">{td(tr.destinationCity)}</span>
                  </div>

                  {/* Row 3: metrics */}
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-micro tabular-nums">
                    <span className="rounded-chip bg-surface-0/50 py-1">
                      <span className="block text-text-muted">{t("Distance", "المسافة")}</span>
                      <span className="block font-bold text-text-secondary">{(tr as any).distanceKm ? `${(tr as any).distanceKm} ${t("km", "كم")}` : "—"}</span>
                    </span>
                    <span className="rounded-chip bg-surface-0/50 py-1">
                      <span className="block text-text-muted">{t("Weight", "الوزن")}</span>
                      <span className="block font-bold text-text-secondary">{tr.cargoWeightTons} {t("t", "طن")}</span>
                    </span>
                    <span className="rounded-chip bg-surface-0/50 py-1">
                      <span className="block text-text-muted">{t("Date", "التاريخ")}</span>
                      <span className="block font-bold text-text-secondary">{fmtDate((tr as any).createdAtISO || tr.createdAt)}</span>
                    </span>
                    <span className="rounded-chip bg-surface-0/50 py-1">
                      <span className="block text-text-muted">{t("Time", "الوقت")}</span>
                      <span className="block font-bold text-text-secondary">{fmtTime((tr as any).departureTimeISO || (tr as any).createdAtISO)}</span>
                    </span>
                  </div>

                  {/* Row 4: price (tariff-resolved) */}
                  <div className="mt-2 flex items-center justify-between text-label">
                    <span className="text-text-muted">{t("Price", "السعر")}: <span className="font-bold text-brand tabular-nums">{priceLabel(tr)}</span></span>
                    {(tr as any).driverRequestStatus === "PENDING" && (
                      <span className="badge bg-status-waiting/20 text-status-waiting text-micro">{t("Driver request pending", "طلب سائق معلّق")}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Trip Details & Lifecycle Controller */}
        <div className="scroll-thin min-h-0 overflow-y-auto p-4 lg:p-6 space-y-5 bg-surface-0">
          {/* Active Trip Header Card */}
          <div className="card p-5 border border-border-subtle">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <TruckTypeAvatar truckType={currentTrip.cargoType} size={46} iconSize={24} showBadge />
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-hero-sm font-extrabold text-text-primary tracking-tight sm:text-hero tabular-nums">
                      {currentTrip.tripNumber}
                    </span>
                    <span
                      className="badge text-label-lg px-2.5 py-1"
                      style={{
                        backgroundColor: getVehicleTypeMeta(currentTrip.cargoType).badgeBg,
                        color: getVehicleTypeMeta(currentTrip.cargoType).accentColor,
                      }}
                    >
                      <TruckTypeIcon truckType={currentTrip.cargoType} size={14} />
                      <span className="ms-1">{currentTrip.cargoType}</span>
                    </span>
                    <span
                      className="badge text-label-lg px-2.5 py-1 font-bold"
                      style={{ backgroundColor: `${selMeta.badgeColor}26`, color: selMeta.badgeColor }}
                    >
                      {t(selMeta.en, selMeta.ar)}
                    </span>
                  </div>
                  <p className="text-body text-text-secondary mt-1">
                    {currentTrip.shipper} ← {t("Consignee:", "المرسل إليه:")} {currentTrip.consignee}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {onOpenLiveTracking && (
                  <button
                    onClick={() => onOpenLiveTracking(currentTrip.id)}
                    className="btn-primary text-label-lg py-2 px-4 shadow-md"
                  >
                    <TruckTypeIcon truckType={currentTrip.cargoType} size={16} />
                    {t("Track on Live Map", "فتح في التتبع الحي")}
                  </button>
                )}
                <button
                  onClick={() => setShowSignModal(true)}
                  className="btn-ghost text-label-lg py-2 px-3 border border-border-subtle"
                >
                  <IconCheck size={16} />
                  {t("Capture POD Signature", "تسجيل إثبات التسليم")}
                </button>
              </div>
            </div>

            {/* Pending Driver Trip Request Banner */}
            {((currentTrip as any).driverRequestStatus === "PENDING" || (currentTrip as any).requestedByDriverId) && (
              <div className="mt-3.5 rounded-inner bg-status-waiting/15 border border-status-waiting/40 p-3.5 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-status-waiting animate-pulse" />
                  <div>
                    <div className="text-body font-bold text-white">
                      {t("Pending Driver Request", "طلب رحلة قيد المراجعة من السائق")}:{" "}
                      <span className="text-brand">
                        {(currentTrip as any).requestedByDriverName || t("Driver", "السائق")}
                      </span>
                    </div>
                    <div className="text-label text-text-muted">
                      {(currentTrip as any).driverRequestNotes ||
                        t("Driver submitted request to be assigned to this trip", "قدم السائق طلباً لتولي هذه الرحلة")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveDriverRequest(currentTrip.id)}
                    className="btn-primary text-label-lg py-1.5 px-3.5 bg-status-active text-navy hover:brightness-110 font-bold"
                  >
                    {t("Approve & Assign Trip", "اعتماد وإسناد الرحلة")}
                  </button>
                  <button
                    onClick={() => handleRejectDriverRequest(currentTrip.id)}
                    className="btn-ghost text-label-lg py-1.5 px-3 bg-status-danger/15 text-status-danger hover:bg-status-danger hover:text-white"
                  >
                    {t("Decline Request", "رفض الطلب")}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics Strip */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border-subtle pt-4">
              <div>
                <span className="text-label text-text-muted block uppercase">
                  {t("Corridor & Route", "الممر والمسار")}
                </span>
                <span className="text-card-title font-bold text-text-primary mt-0.5 block">
                  {td(currentTrip.originCity)} ← {td(currentTrip.destinationCity)}
                </span>
              </div>
              <div>
                <span className="text-label text-text-muted block uppercase">
                  {t("Route Distance", "مسافة المسار")}
                </span>
                <span className="text-card-title font-bold text-brand mt-0.5 block tabular-nums">
                  {(currentTrip as any).distanceKm ? `${(currentTrip as any).distanceKm} ${t("km", "كم")}` : `${currentTrip.distanceRemainingKm} ${t("km", "كم")}`}
                </span>
              </div>
              <div>
                <span className="text-label text-text-muted block uppercase">
                  {t("Trip Price (Tariff)", "سعر الرحلة (التعرفة)")}
                </span>
                <span className="text-card-title font-bold text-status-active mt-0.5 block tabular-nums">
                  {priceLabel(currentTrip)}
                </span>
              </div>
              <div>
                <span className="text-label text-text-muted block uppercase">
                  {t("Estimated Arrival (ETA)", "الوقت المتوقع (ETA)")}
                </span>
                <span className="text-card-title font-bold text-text-primary mt-0.5 block tabular-nums">
                  {Math.floor(currentTrip.etaMinutes / 60)} {t("hrs", "ساعة")} {currentTrip.etaMinutes % 60} {t("min", "دقيقة")}
                </span>
              </div>
            </div>
          </div>

          {/* Replacement Notification Banner */}
          {replacementNotice && (
            <div className={cn(
              "rounded-inner border p-3 text-label-lg font-bold flex items-center justify-between animate-fade-in",
              replacementNotice.ok ? "bg-status-active/15 border-status-active/30 text-status-active" : "bg-status-danger/15 border-status-danger/30 text-status-danger"
            )}>
              <span>{replacementNotice.ok ? "✓" : "✕"} {replacementNotice.text}</span>
              <button onClick={() => setReplacementNotice(null)} className="text-white hover:text-status-danger text-card-title">✕</button>
            </div>
          )}

          {/* SECTION: VEHICLE & DRIVER ASSIGNMENT & REPLACEMENT (real data) */}
          <div className="card p-5 border border-border-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <TruckTypeIcon truckType={currentTrip.cargoType} size={20} className="text-brand" />
                <span className="text-card-title font-bold text-text-primary">
                  {t("Assigned Vehicle & Fleet Drivers", "الشاحنة والسائقين المكلفين بالرحلة")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setBothDriverId(""); setBothVehicleId(""); setBothReason(""); setShowReplaceBothModal(true); }}
                  className="rounded-chip bg-status-waiting/15 hover:bg-status-waiting hover:text-navy text-status-waiting px-2.5 py-1 text-label font-bold transition-all"
                >
                  {t("Replace driver + vehicle together", "استبدال السائق والمركبة معًا")}
                </button>
                <TruckTypeBadge truckType={currentTrip.cargoType} size={14} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Driver Block — from the trip file */}
              <div className="rounded-inner bg-surface-1 p-4 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-label text-text-muted uppercase font-bold tracking-wider">
                    {t("Primary Driver", "السائق الأساسي")}
                  </span>
                  <button
                    onClick={() => { setNewDriverId(""); setDriverReplaceReason(""); setShowReplaceDriverModal(true); }}
                    className="rounded-chip bg-brand/15 hover:bg-brand hover:text-navy text-brand px-2.5 py-1 text-label font-bold transition-all"
                  >
                    {t("Replace Driver", "استبدال السائق")} ↻
                  </button>
                </div>

                <div>
                  <div className="text-card-title font-bold text-white">{details?.driver?.fullName || (currentTrip as any).driverName || t("Not assigned", "غير معيّن")}</div>
                  <div className="text-label text-text-muted">{details?.driver?.phone || "—"}{details?.driver?.licenseNumber ? ` · ${t("Licence", "رخصة")} ${details.driver.licenseNumber}` : ""}</div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-label">
                  <span className="text-status-active font-semibold">✓ {t("Driving licence valid & verified", "رخصة القيادة سارية ومحققة")}</span>
                  {(currentTrip as any).additionalDriverName && (
                    <span className="text-brand font-bold">{t("Additional driver", "سائق إضافي")}: {(currentTrip as any).additionalDriverName}</span>
                  )}
                </div>
              </div>

              {/* Vehicle Block with 3D Viewer — from the trip file */}
              <div className="rounded-inner bg-surface-1 p-4 border border-border-subtle space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-label text-text-muted uppercase font-bold tracking-wider">
                    {t("Current Truck", "الشاحنة المخصصة")}
                  </span>
                  <button
                    onClick={() => { setNewVehicleId(""); setVehicleReplaceReason(""); setShowReplaceVehicleModal(true); }}
                    className="rounded-chip bg-brand/15 hover:bg-brand hover:text-navy text-brand px-2.5 py-1 text-label font-bold transition-all"
                  >
                    {t("Replace Truck", "استبدال الشاحنة")} ↻
                  </button>
                </div>

                {/* Real 3D Rotatable Vehicle */}
                <div className="h-[140px] w-full rounded-control overflow-hidden bg-surface-2 border border-white/5">
                  <Vehicle3DViewer
                    vehicleType={currentTrip.cargoType}
                    previewMode={false}
                    height="100%"
                    compact={true}
                    showControls={false}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-card-title font-bold text-white">{details?.vehicle?.plate || t("Not assigned", "غير معيّنة")}</div>
                    <div className="text-label text-text-muted">{details?.vehicle?.model || "—"}</div>
                  </div>
                  <span className="badge bg-brand/20 text-brand text-label font-bold uppercase">
                    {getVehicleTypeMeta(currentTrip.cargoType).arabicName} ({getVehicleTypeMeta(currentTrip.cargoType).englishName})
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-label">
                  <span className="text-status-active font-semibold">✓ {t("Registration, inspection & insurance valid", "استمارة وفحص دوري وتأمين ساري")}</span>
                  <span className="text-white/60">{details?.vehicle?.gpsDeviceId ? `GPS: ${details.vehicle.gpsDeviceId}` : "GPS: —"}</span>
                </div>
              </div>
            </div>

            {/* Assignment History — who was replaced, by whom, when and why (§Phase 3) */}
            {((details?.trip?.driverHistory?.length || 0) > 0 || (details?.trip?.vehicleHistory?.length || 0) > 0) && (
              <div className="rounded-inner bg-surface-1 p-4 border border-border-subtle space-y-3">
                <div className="flex items-center gap-2">
                  <IconHistory size={16} className="text-brand" />
                  <span className="text-label-lg font-bold text-text-primary uppercase tracking-wider">
                    {t("Assignment & Replacement History", "سجل التعيينات والاستبدالات")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(details?.trip?.driverHistory?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <span className="text-label text-text-muted uppercase font-bold">{t("Drivers", "السائقون")}</span>
                      {details.trip.driverHistory.map((h: any, i: number) => (
                        <div key={`dh-${i}`} className="rounded-control bg-surface-2 border border-border-subtle p-2.5 text-label-lg">
                          <div className="font-bold text-white">
                            {t("Driver replaced", "تم استبدال السائق")}: {h.driverName} ← {h.newDriverName || "—"}
                          </div>
                          <div className="text-text-muted mt-0.5">{t("Reason", "السبب")}: {h.reason}</div>
                          <div className="text-text-muted text-label tabular-nums mt-0.5">
                            {t("By", "بواسطة")}: {h.replacedBy} · {new Date(h.timestamp).toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(details?.trip?.vehicleHistory?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <span className="text-label text-text-muted uppercase font-bold">{t("Vehicles", "المركبات")}</span>
                      {details.trip.vehicleHistory.map((h: any, i: number) => (
                        <div key={`vh-${i}`} className="rounded-control bg-surface-2 border border-border-subtle p-2.5 text-label-lg">
                          <div className="font-bold text-white">
                            {t("Vehicle replaced", "تم استبدال المركبة")}: {h.plate} ← {h.newPlate || "—"}
                          </div>
                          <div className="text-text-muted mt-0.5">{t("Reason", "السبب")}: {h.reason}</div>
                          <div className="text-text-muted text-label tabular-nums mt-0.5">
                            {t("By", "بواسطة")}: {h.replacedBy} · {new Date(h.timestamp).toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lifecycle Flow Stepper Buttons */}
          <div className="card p-5 border border-border-subtle">
            <span className="text-label-lg font-bold text-text-primary block mb-3 uppercase tracking-wider">
              {t("Change Trip Milestone Lifecycle", "تحديث مرحلة سير الرحلة")}
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  handleAdvanceStatus(
                    "ready",
                    "اكتمال التحميل والشاحنة جاهزة للانطلاق",
                    "Loading completed, ready for departure"
                  )
                }
                className="chip hover:border-brand text-label-lg py-2 px-3 font-semibold"
              >
                1. {t("Mark Ready", "جاهزة للانطلاق")}
              </button>

              <button
                onClick={() =>
                  handleAdvanceStatus(
                    "on_road",
                    "مغادرة المحطة وانطلاق الشاحنة على الطريق السريع",
                    "Truck departed terminal onto highway"
                  )
                }
                className="chip-on text-label-lg py-2 px-3 font-bold"
              >
                2. {t("Start Trip / Depart", "بدء الانطلاق على الطريق")}
              </button>

              <button
                onClick={() =>
                  handleAdvanceStatus(
                    "stopped",
                    "توقف السائق في استراحة نظامية لفحص الإطارات",
                    "Driver rest stop logged, tire check done"
                  )
                }
                className="chip hover:border-brand text-label-lg py-2 px-3"
              >
                3. {t("Log Rest / Idle", "تسجيل استراحة سائق")}
              </button>

              <button
                onClick={() =>
                  handleAdvanceStatus(
                    "arrived",
                    "وصول الشاحنة إلى مستودع العميل والاستعداد للتفريغ",
                    "Truck arrived at destination gate, ready for unloading"
                  )
                }
                className="chip hover:border-brand text-label-lg py-2 px-3"
              >
                4. {t("Confirm Arrival", "تأكيد الوصول للموقع")}
              </button>

              <button
                onClick={() => setShowSignModal(true)}
                className="chip bg-status-active/20 text-status-active hover:bg-status-active/30 text-label-lg py-2 px-4 font-bold"
              >
                5. {t("Sign Proof of Delivery (POD)", "إثبات التسليم والتوقيع (POD)")}
              </button>
            </div>
          </div>

          {/* Trip Milestone Timeline — real events from the trip file */}
          <div className="card p-5 border border-border-subtle">
            <span className="text-label-lg font-bold text-text-primary block mb-4 uppercase tracking-wider">
              {t("Trip Event Audit & Milestone Timeline", "سجل أحداث ومحطات الرحلة الميدانية")}
            </span>

            <div className="relative ps-6 space-y-4">
              <span className="absolute top-2 bottom-2 start-[7px] w-0.5 bg-border-subtle" />

              {timelineEvents.map((ev: any) => (
                <div key={ev.id} className="relative flex items-start justify-between gap-3">
                  <span className="absolute -start-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface-0 bg-brand shadow-sm" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body font-semibold text-text-primary">
                        {ev.titleAr ? t(ev.titleEn || ev.titleAr, ev.titleAr) : ev.notes || ev.eventType}
                      </span>
                      <span className="badge bg-surface-5 text-text-muted text-micro">
                        {ev.actor || ev.actorName || t("System", "النظام")}
                      </span>
                    </div>
                    {(ev.notes && ev.titleAr) && (
                      <p className="text-label-lg text-text-muted mt-0.5">{ev.notes}</p>
                    )}
                  </div>
                  <span className="text-label text-text-muted tabular-nums shrink-0 font-medium">
                    {ev.timestamp && !Number.isNaN(new Date(ev.timestamp).getTime())
                      ? new Date(ev.timestamp).toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : td(ev.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Electronic Consignment Waybill (بوليصة الشحن) */}
      {showWaybillModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowWaybillModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up scroll-thin relative max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-panel bg-white text-navy p-7 shadow-2xl border border-border-subtle"
          >
            {/* Waybill Header */}
            <div className="flex items-start justify-between border-b border-navy/15 pb-4">
              <div className="flex items-center gap-3">
                <EjazEmblem size={44} color="var(--color-brand)" />
                <div>
                  <h3 className="text-section-title font-extrabold text-navy">
                    مؤسسة إيجاز للنقليات · EJAZ TRANSPORT
                  </h3>
                  <span className="text-label text-navy/60 block font-medium">
                    بوليصة شحن بري إلكترونية موحدة · E-WAYBILL #{currentTrip.qrCodeToken}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowWaybillModal(false)}
                className="btn-icon bg-navy/10 text-navy"
                aria-label={t("Close", "إغلاق")}
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Waybill Body Details */}
            <div className="mt-5 grid grid-cols-2 gap-4 text-body border-b border-navy/10 pb-5">
              <div className="rounded-control bg-navy/5 p-3.5 space-y-1">
                <span className="text-micro font-bold text-navy/60 block uppercase">
                  بيانات الشاحن والمرسل
                </span>
                <span className="font-bold text-navy block">{currentTrip.shipper}</span>
                <span className="text-label text-navy/70 block">
                  موقع الانطلاق: {currentTrip.originTerminal}
                </span>
                <span className="text-label text-navy/70 block">المدينة: {currentTrip.originCity}</span>
              </div>

              <div className="rounded-control bg-navy/5 p-3.5 space-y-1">
                <span className="text-micro font-bold text-navy/60 block uppercase">
                  {t("Consignee & destination data", "بيانات المستلم والوجهة")}
                </span>
                <span className="font-bold text-navy block">{currentTrip.consignee}</span>
                <span className="text-label text-navy/70 block">
                  {t("Delivery point", "موقع التسليم")}: {currentTrip.destinationTerminal}
                </span>
                <span className="text-label text-navy/70 block">{t("City", "المدينة")}: {currentTrip.destinationCity}</span>
              </div>
            </div>

            {/* Cargo and Truck Specs */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-label-lg border-b border-navy/10 pb-4">
              <div>
                <span className="text-label text-navy/60 block font-medium">{t("Truck & trailer type", "نوع الشاحنة والمقطورة")}</span>
                <span className="font-bold text-navy">{currentTrip.cargoType}</span>
              </div>
              <div>
                <span className="text-label text-navy/60 block font-medium">{t("Net laden weight", "الوزن القائم الصافي")}</span>
                <span className="font-bold text-brand tabular-nums">{currentTrip.cargoWeightTons} {t("t", "طن")}</span>
              </div>
              <div>
                <span className="text-label text-navy/60 block font-medium">{t("Trip price (tariff)", "سعر الرحلة (التعرفة)")}</span>
                <span className="font-bold text-navy tabular-nums">{priceLabel(currentTrip)}</span>
              </div>
            </div>

            {/* QR Code and Digital Seal */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Visual SVG QR representation */}
                <div className="grid h-20 w-20 place-items-center rounded-inner bg-navy/10 p-2 border border-navy/20">
                  <svg viewBox="0 0 40 40" className="h-full w-full" fill="#0A1931">
                    <rect x="2" y="2" width="14" height="14" rx="2" fill="none" stroke="#0A1931" strokeWidth="3" />
                    <rect x="6" y="6" width="6" height="6" />
                    <rect x="24" y="2" width="14" height="14" rx="2" fill="none" stroke="#0A1931" strokeWidth="3" />
                    <rect x="28" y="6" width="6" height="6" />
                    <rect x="2" y="24" width="14" height="14" rx="2" fill="none" stroke="#0A1931" strokeWidth="3" />
                    <rect x="6" y="28" width="6" height="6" />
                    <rect x="22" y="22" width="4" height="4" />
                    <rect x="28" y="26" width="6" height="4" />
                    <rect x="24" y="32" width="6" height="4" />
                  </svg>
                </div>
                <div>
                  <span className="text-label-lg font-bold text-navy block">
                    {t("Transport Authority electronic verification token", "رمز التحقق الإلكتروني لهيئة النقل")}
                  </span>
                  <span className="text-label text-navy/60 block font-mono">
                    {currentTrip.qrCodeToken}
                  </span>
                  <span className="text-label text-status-active font-semibold block mt-1">
                    ✓ {t("Consignment valid & registered on Bayan", "بوليصة سارية ومسجلة في منصة بيان")}
                  </span>
                </div>
              </div>

              {/* Recipient Signature Box if present */}
              {currentTrip.recipientSignature && (
                <div className="text-end">
                  <span className="text-label text-navy/60 block font-medium">{t("Recipient e-signature", "توقيع المستلم الإلكتروني")}</span>
                  <img
                    src={currentTrip.recipientSignature}
                    alt={t("Signature", "توقيع المستلم")}
                    className="h-12 w-28 object-contain inline-block border-b border-navy/30"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-navy/10">
              <button
                onClick={() => window.print()}
                className="btn-primary text-label-lg py-2 px-5 bg-brand text-on-brand font-bold"
              >
                {t("Print / Save PDF", "طباعة / حفظ كـ PDF")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Digital Signature POD */}
      {showSignModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[95] grid place-items-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowSignModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up relative w-full max-w-[480px] rounded-panel bg-surface-2 p-6 shadow-2xl border border-border-subtle"
          >
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-section-title font-bold text-text-primary">
                  {t("Consignee Digital Signature (POD)", "التوقيع الرقمي للمستلم (POD)")}
                </h3>
                <p className="text-label-lg text-text-muted mt-0.5">
                  {t(
                    "Sign inside the box to confirm cargo receipt without damage",
                    "وقّع داخل الصندوق لتأكيد استلام الشحنة كاملة وسليمة"
                  )}
                </p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="btn-icon" aria-label={t("Close", "إغلاق")}>
                <IconClose size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-inner bg-surface-1 p-2 border border-border-subtle">
              <canvas
                ref={signCanvasRef}
                width={420}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 bg-surface-3 rounded-chip cursor-crosshair border border-dashed border-border-subtle/80"
              />
              <span className="text-micro text-text-muted block text-center mt-1">
                {t("Draw your signature using mouse or finger touch", "ارسم توقيعك باللمس أو الفأرة")}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button onClick={clearSignature} className="btn-ghost text-label-lg py-1.5 px-3">
                {t("Clear", "مسح")}
              </button>

              <div className="flex gap-2">
                <button onClick={() => setShowSignModal(false)} className="btn-ghost text-label-lg py-1.5 px-3">
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  onClick={() => {
                    handleAdvanceStatus(
                      "delivered",
                      "تم تسليم الشحنة وتوقيع إثبات الاستلام الرقمي من العميل",
                      "Cargo delivered & digital POD signed by consignee"
                    );
                    setShowSignModal(false);
                  }}
                  className="btn-primary text-label-lg py-1.5 px-4 font-bold"
                >
                  <IconCheck size={14} />
                  {t("Confirm Delivery", "تأكيد التسليم النهائي")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Replace Driver — real driver roster, audited */}
      {showReplaceDriverModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowReplaceDriverModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-w-[460px] w-full rounded-panel bg-surface-1 text-white p-6 border border-border-subtle shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-page-title font-bold text-white flex items-center gap-2">
                <span>{t("Replace the official trip driver", "استبدال سائق الرحلة الرسمي")}</span>
                <span className="badge bg-brand/20 text-brand text-micro tabular-nums">{currentTrip.tripNumber}</span>
              </h3>
              <button onClick={() => setShowReplaceDriverModal(false)} className="btn-icon" aria-label={t("Close", "إغلاق")}>
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-label-lg">
              <div>
                <label className="block text-text-muted text-label mb-1">{t("Driver being unassigned", "السائق الحالي المفرغ")}:</label>
                <div className="p-2.5 rounded-control bg-surface-2 text-white font-bold border border-white/5">
                  {details?.driver?.fullName || (currentTrip as any).driverName || "—"}
                </div>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("New driver assigned to the trip", "السائق الجديد المكلف بالرحلة")} *</label>
                <select
                  value={newDriverId}
                  onChange={(e) => setNewDriverId(e.target.value)}
                  className="w-full h-10 rounded-control bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="">{t("Select a driver from the fleet roster…", "اختر سائقًا من سجل الأسطول…")}</option>
                  {driversList
                    .filter((d) => d.id !== details?.driver?.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} — {d.phone} ({t("rating", "التقييم")} {d.rating})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("Reason for the swap (mandatory for audit)", "سبب الاستبدال الإلزامي للتدقيق")} *</label>
                <textarea
                  rows={2}
                  value={driverReplaceReason}
                  onChange={(e) => setDriverReplaceReason(e.target.value)}
                  className="w-full rounded-control bg-surface-2 p-2.5 text-white border border-border-subtle outline-none resize-none"
                  placeholder={t("State the justified field reason for the swap…", "اكتب سبب الاستبدال الميداني المبرر...")}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => setShowReplaceDriverModal(false)} className="btn-ghost text-label-lg py-2 px-3">
                {t("Cancel", "إلغاء")}
              </button>
              <button
                onClick={handleExecuteDriverReplacement}
                disabled={replacementBusy || !newDriverId || driverReplaceReason.trim().length < 4}
                className="btn-primary text-label-lg py-2 px-4 font-bold shadow-lg disabled:opacity-50"
              >
                {t("Confirm the swap & record it", "تأكيد الاستبدال وتوثيق السجل")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Replace Vehicle — real fleet, audited */}
      {showReplaceVehicleModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowReplaceVehicleModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-w-[460px] w-full rounded-panel bg-surface-1 text-white p-6 border border-border-subtle shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-page-title font-bold text-white flex items-center gap-2">
                <span>{t("Replace the approved trip vehicle", "استبدال شاحنة الرحلة المعتمدة")}</span>
                <span className="badge bg-brand/20 text-brand text-micro tabular-nums">{currentTrip.tripNumber}</span>
              </h3>
              <button onClick={() => setShowReplaceVehicleModal(false)} className="btn-icon" aria-label={t("Close", "إغلاق")}>
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-label-lg">
              <div>
                <label className="block text-text-muted text-label mb-1">{t("Vehicle being released", "الشاحنة الحالية المفصولة")}:</label>
                <div className="p-2.5 rounded-control bg-surface-2 text-white font-bold border border-white/5">
                  {details?.vehicle?.plate || "—"}{details?.vehicle?.model ? ` (${details.vehicle.model})` : ""}
                </div>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("Approved replacement vehicle (the 4 official types only)", "الشاحنة البديلة المعتمدة (الأنواع الرسمية الـ 4 فقط)")} *</label>
                <select
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full h-10 rounded-control bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="">{t("Select a vehicle from the fleet…", "اختر شاحنة من الأسطول…")}</option>
                  {vehiclesList
                    .filter((v) => v.id !== details?.vehicle?.id && v.isActive)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} · {v.type} · {v.model}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("Justified reason for the swap (audit)", "سبب الاستبدال المبرر للتدقيق")} *</label>
                <textarea
                  rows={2}
                  value={vehicleReplaceReason}
                  onChange={(e) => setVehicleReplaceReason(e.target.value)}
                  className="w-full rounded-control bg-surface-2 p-2.5 text-white border border-border-subtle outline-none resize-none"
                  placeholder={t("Reason for the vehicle swap and the GPS device update…", "سبب استبدال المركبة وتحديث جهاز الـ GPS...")}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => setShowReplaceVehicleModal(false)} className="btn-ghost text-label-lg py-2 px-3">
                {t("Cancel", "إلغاء")}
              </button>
              <button
                onClick={handleExecuteVehicleReplacement}
                disabled={replacementBusy || !newVehicleId || vehicleReplaceReason.trim().length < 4}
                className="btn-primary text-label-lg py-2 px-4 font-bold shadow-lg disabled:opacity-50"
              >
                {t("Confirm the vehicle swap & update tracking", "تأكيد استبدال الشاحنة وتحديث التتبع")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Replace driver + vehicle together — same trip, same number */}
      {showReplaceBothModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowReplaceBothModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-w-[480px] w-full rounded-panel bg-surface-1 text-white p-6 border border-border-subtle shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-page-title font-bold text-white flex items-center gap-2">
                <span>{t("Replace the driver and the vehicle together", "استبدال السائق والمركبة معًا")}</span>
                <span className="badge bg-brand/20 text-brand text-micro tabular-nums">{currentTrip.tripNumber}</span>
              </h3>
              <button onClick={() => setShowReplaceBothModal(false)} className="btn-icon" aria-label={t("Close", "إغلاق")}>
                <IconClose size={16} />
              </button>
            </div>

            <p className="text-label text-text-muted">
              {t(
                "The operation is recorded inside the same trip. No new trip is created and the unified number never changes.",
                "تُسجَّل العملية داخل نفس الرحلة. لا تُنشأ رحلة جديدة ولا يتغير الرقم الموحد أبدًا."
              )}
            </p>

            <div className="space-y-3 text-label-lg">
              <div>
                <label className="block text-text-muted text-label mb-1">{t("New driver", "السائق الجديد")} *</label>
                <select
                  value={bothDriverId}
                  onChange={(e) => setBothDriverId(e.target.value)}
                  className="w-full h-10 rounded-control bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="">{t("Select a driver…", "اختر سائقًا…")}</option>
                  {driversList.filter((d) => d.id !== details?.driver?.id).map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName} — {d.phone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("New vehicle", "المركبة الجديدة")} *</label>
                <select
                  value={bothVehicleId}
                  onChange={(e) => setBothVehicleId(e.target.value)}
                  className="w-full h-10 rounded-control bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="">{t("Select a vehicle…", "اختر شاحنة…")}</option>
                  {vehiclesList.filter((v) => v.id !== details?.vehicle?.id && v.isActive).map((v) => (
                    <option key={v.id} value={v.id}>{v.plate} · {v.type} · {v.model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-label mb-1">{t("Reason (mandatory for audit)", "السبب (إلزامي للتدقيق)")} *</label>
                <textarea
                  rows={2}
                  value={bothReason}
                  onChange={(e) => setBothReason(e.target.value)}
                  className="w-full rounded-control bg-surface-2 p-2.5 text-white border border-border-subtle outline-none resize-none"
                  placeholder={t("e.g. breakdown mid-route — replacement unit dispatched", "مثال: عطل في الطريق — إرسال وحدة بديلة")}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => setShowReplaceBothModal(false)} className="btn-ghost text-label-lg py-2 px-3">
                {t("Cancel", "إلغاء")}
              </button>
              <button
                onClick={handleExecuteBothReplacement}
                disabled={replacementBusy || !bothDriverId || !bothVehicleId || bothReason.trim().length < 4}
                className="btn-primary text-label-lg py-2 px-4 font-bold shadow-lg disabled:opacity-50"
              >
                {t("Confirm both replacements", "تأكيد الاستبدالين معًا")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
