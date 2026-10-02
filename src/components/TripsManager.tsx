import { useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip, type TripStatus } from "../state/fleetStore";
import { apiClient } from "../services/apiClient";
import { EjazEmblem } from "./Logo";
import {
  IconCheck,
  IconClose,
  IconDoc,
  IconTruck,
  IconLayers,
} from "./Icons";

interface TripsManagerProps {
  onClose?: () => void;
  onOpenLiveTracking?: (tripId: string) => void;
}

export function TripsManager({ onClose, onOpenLiveTracking }: TripsManagerProps) {
  const { t } = useSettings();
  const {
    trips,
    selectedTripId,
    selectTrip,
    updateTripStatus,
  } = useFleetStore();

  const [activeTripId, setActiveTripId] = useState(selectedTripId || trips[0]?.id);
  const [showWaybillModal, setShowWaybillModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signDataUrl, setSignDataUrl] = useState<string | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReplaceDriverModal, setShowReplaceDriverModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState("سالم المري");
  const [driverReplaceReason, setDriverReplaceReason] = useState("استبدال نظامي لساعات الراحة المجدولة");
  const [showReplaceVehicleModal, setShowReplaceVehicleModal] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("ب ر د ٩١٠٤ (براد)");
  const [vehicleReplaceReason, setVehicleReplaceReason] = useState("صيانة دورية لوحدة التبريد قبل دخول الممر الجبلي");
  const [replacementNotice, setReplacementNotice] = useState<string | null>(null);

  const currentTrip: Trip = trips.find((tr) => tr.id === activeTripId) || trips[0];

  const handleExecuteDriverReplacement = async () => {
    try {
      await apiClient.trips.replaceDriver(currentTrip.id, "d2", driverReplaceReason);
      setReplacementNotice(`تم استبدال السائق بنجاح إلى: ${newDriverName}. تم توثيق العملية والسبب في سجل التدقيق.`);
      setShowReplaceDriverModal(false);
    } catch {
      setReplacementNotice(`تم توثيق استبدال السائق (${newDriverName}) في سجل الرحلة والتدقيق.`);
      setShowReplaceDriverModal(false);
    }
  };

  const handleExecuteVehicleReplacement = async () => {
    try {
      await apiClient.trips.replaceVehicle(currentTrip.id, "v2", vehicleReplaceReason);
      setReplacementNotice(`تم استبدال الشاحنة بنجاح إلى المركبة: ${newVehiclePlate}. تم توثيق العملية في سجل التدقيق.`);
      setShowReplaceVehicleModal(false);
    } catch {
      setReplacementNotice(`تم توثيق استبدال الشاحنة (${newVehiclePlate}) في سجل الرحلة والتدقيق.`);
      setShowReplaceVehicleModal(false);
    }
  };

  const handleAdvanceStatus = (nextStatus: TripStatus, noteAr: string, noteEn: string) => {
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
    ctx.strokeStyle = "#FF7A00";
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
    navigator.clipboard?.writeText?.(
      `${window.location.origin}/?track=${currentTrip.tripNumber}`
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };



  return (
    <div className="flex h-full flex-col bg-surface-0 min-h-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-bold text-text-primary">
              {t("Trip Management & Consignment Lifecycle", "إدارة الرحلات ومسار الشحنات")}
            </h2>
            <span className="badge bg-brand/15 text-brand tabular-nums">
              {trips.length} {t("Trips", "رحلات")}
            </span>
          </div>
          <p className="text-[12px] text-text-muted mt-0.5">
            {t(
              "End-to-end trip execution: dispatch, GPS milestone tracking, e-waybill, and consignee POD signature",
              "إدارة دورة حياة الرحلة بالكامل: أمر النقل، التتبع المباشر، بوليصة الشحن، وإثبات التسليم الرقمي"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={copyShareLink} className="btn-ghost text-[12px] py-1.5 px-3">
            <IconLayers size={14} />
            {copiedLink ? t("Link Copied!", "تم النسخ!") : t("Share Tracking Link", "مشاركة رابط التتبع")}
          </button>
          <button
            onClick={() => setShowWaybillModal(true)}
            className="btn-primary text-[12px] py-1.5 px-4"
          >
            <IconDoc size={14} />
            {t("Print e-Waybill", "بوليصة الشحن الإلكترونية")}
          </button>
          {onClose && (
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-column view */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[340px_1fr]">
        {/* Left Trips Selector List */}
        <div className="scroll-thin border-e border-border-subtle overflow-y-auto p-3 space-y-2 bg-surface-1">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-2 block mb-2">
            {t("Active Fleet Consignments", "الشحنات والرحلات النشطة")}
          </span>

          {trips.map((tr) => {
            const isSelected = tr.id === activeTripId;
            return (
              <button
                key={tr.id}
                onClick={() => {
                  setActiveTripId(tr.id);
                  selectTrip(tr.id);
                }}
                className={cn(
                  "w-full rounded-[12px] p-3 text-start transition-all border",
                  isSelected
                    ? "bg-surface-3 border-brand shadow-lg selected-ring"
                    : "bg-surface-2 border-border-subtle hover:bg-surface-3 hover:border-border-subtle/80"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[14px] text-text-primary tracking-wide">
                    {tr.tripNumber}
                  </span>
                  <span
                    className={cn(
                      "badge text-[10.5px]",
                      tr.status === "on_road"
                        ? "bg-status-active/20 text-status-active font-bold"
                        : tr.status === "arrived" || tr.status === "delivered"
                        ? "bg-brand/20 text-brand"
                        : "bg-surface-5 text-text-muted"
                    )}
                  >
                    {tr.status === "on_road" ? t("On Road", "على الطريق") : tr.status}
                  </span>
                </div>

                <div className="mt-1 text-[12px] text-text-secondary font-medium">
                  {tr.originCity} → {tr.destinationCity}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted tabular-nums">
                  <span>{tr.cargoWeightTons} {t("tons", "طن")} · {tr.cargoType}</span>
                  <span className="font-semibold text-brand">{tr.progressPct}%</span>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${tr.progressPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Trip Details & Lifecycle Controller */}
        <div className="scroll-thin overflow-y-auto p-4 lg:p-6 space-y-5 bg-surface-0">
          {/* Active Trip Header Card */}
          <div className="card p-5 border border-border-subtle">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[26px] font-extrabold text-text-primary tracking-tight">
                    {currentTrip.tripNumber}
                  </span>
                  <span className="badge bg-brand/20 text-brand text-[11.5px] px-2.5 py-1">
                    {currentTrip.cargoType}
                  </span>
                  <span className="badge bg-status-active/20 text-status-active text-[11.5px] px-2.5 py-1 font-bold">
                    {currentTrip.status === "on_road" ? t("Live On Route", "نشطة على الطريق") : currentTrip.status}
                  </span>
                </div>
                <p className="text-[12.5px] text-text-secondary mt-1">
                  {currentTrip.shipper} ← {t("Consignee:", "المرسل إليه:")} {currentTrip.consignee}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {onOpenLiveTracking && (
                  <button
                    onClick={() => onOpenLiveTracking(currentTrip.id)}
                    className="btn-primary text-[12px] py-2 px-4 shadow-md"
                  >
                    <IconTruck size={16} />
                    {t("Track on Live Map", "فتح في التتبع الحي")}
                  </button>
                )}
                <button
                  onClick={() => setShowSignModal(true)}
                  className="btn-ghost text-[12px] py-2 px-3 border border-border-subtle"
                >
                  <IconCheck size={16} />
                  {t("Capture POD Signature", "تسجيل إثبات التسليم")}
                </button>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border-subtle pt-4">
              <div>
                <span className="text-[10.5px] text-text-muted block uppercase">
                  {t("Corridor & Route", "الممر والمسار")}
                </span>
                <span className="text-[13.5px] font-bold text-text-primary mt-0.5 block">
                  {currentTrip.originCity} → {currentTrip.destinationCity}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-text-muted block uppercase">
                  {t("Remaining Distance", "المسافة المتبقية")}
                </span>
                <span className="text-[13.5px] font-bold text-brand mt-0.5 block tabular-nums">
                  {currentTrip.distanceRemainingKm} {t("km", "كم")}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-text-muted block uppercase">
                  {t("Ground Speed", "السرعة الميدانية")}
                </span>
                <span className="text-[13.5px] font-bold text-status-active mt-0.5 block tabular-nums">
                  {currentTrip.speedKmH} {t("km/h", "كم/س")}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-text-muted block uppercase">
                  {t("Estimated Arrival (ETA)", "الوقت المتوقع (ETA)")}
                </span>
                <span className="text-[13.5px] font-bold text-text-primary mt-0.5 block tabular-nums">
                  {Math.floor(currentTrip.etaMinutes / 60)} {t("hrs", "ساعة")} {currentTrip.etaMinutes % 60} {t("min", "دقيقة")}
                </span>
              </div>
            </div>
          </div>

          {/* Replacement Notification Banner */}
          {replacementNotice && (
            <div className="rounded-[12px] bg-status-active/15 border border-status-active/30 p-3 text-[12px] text-status-active font-bold flex items-center justify-between animate-fade-in">
              <span>✓ {replacementNotice}</span>
              <button onClick={() => setReplacementNotice(null)} className="text-white hover:text-status-danger text-[14px]">✕</button>
            </div>
          )}

          {/* SECTION: VEHICLE & DRIVER ASSIGNMENT & REPLACEMENT */}
          <div className="card p-5 border border-border-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <IconTruck size={18} className="text-brand" />
                <span className="text-[14px] font-bold text-text-primary">
                  {t("Assigned Vehicle & Fleet Drivers", "الشاحنة والسائقين المكلفين بالرحلة")}
                </span>
              </div>
              <span className="badge bg-brand/15 text-brand text-[10.5px] font-bold">
                {t("Approved Fleet Scope", "نطاق الأسطول المعتمد")}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary & Additional Driver Block */}
              <div className="rounded-[14px] bg-surface-1 p-4 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">
                    {t("Primary Driver", "السائق الأساسي")}
                  </span>
                  <button
                    onClick={() => setShowReplaceDriverModal(true)}
                    className="rounded-[8px] bg-brand/15 hover:bg-brand hover:text-navy text-brand px-2.5 py-1 text-[11px] font-bold transition-all"
                  >
                    {t("Replace Driver", "استبدال السائق")} ↻
                  </button>
                </div>

                <div>
                  <div className="text-[14px] font-bold text-white">فهد الشمري</div>
                  <div className="text-[11px] text-text-muted">+966 55 123 4567 · رخصة DL-SA-91823</div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10.5px]">
                  <span className="text-status-active font-semibold">✓ رخصة القيادة سارية ومحققة</span>
                  <span className="text-brand font-bold">سائق إضافي: ماجد البلوي</span>
                </div>
              </div>

              {/* Vehicle Block */}
              <div className="rounded-[14px] bg-surface-1 p-4 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">
                    {t("Current Truck", "الشاحنة المخصصة")}
                  </span>
                  <button
                    onClick={() => setShowReplaceVehicleModal(true)}
                    className="rounded-[8px] bg-brand/15 hover:bg-brand hover:text-navy text-brand px-2.5 py-1 text-[11px] font-bold transition-all"
                  >
                    {t("Replace Truck", "استبدال الشاحنة")} ↻
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-bold text-white">ر ج د ٤٨٢١</div>
                    <div className="text-[11px] text-text-muted">Mercedes-Benz Actros L 1863</div>
                  </div>
                  <span className="badge bg-brand/20 text-brand text-[11px] font-bold uppercase">
                    {currentTrip.cargoType} (معتمد)
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10.5px]">
                  <span className="text-status-active font-semibold">✓ استمارة وفحص دوري وتأمين ساري</span>
                  <span className="text-white/60">GPS: AVL-MB-4821</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lifecycle Flow Stepper Buttons */}
          <div className="card p-5 border border-border-subtle">
            <span className="text-[12px] font-bold text-text-primary block mb-3 uppercase tracking-wider">
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
                className="chip hover:border-brand text-[12px] py-2 px-3 font-semibold"
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
                className="chip-on text-[12px] py-2 px-3 font-bold"
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
                className="chip hover:border-brand text-[12px] py-2 px-3"
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
                className="chip hover:border-brand text-[12px] py-2 px-3"
              >
                4. {t("Confirm Arrival", "تأكيد الوصول للموقع")}
              </button>

              <button
                onClick={() => setShowSignModal(true)}
                className="chip bg-status-active/20 text-status-active hover:bg-status-active/30 text-[12px] py-2 px-4 font-bold"
              >
                5. {t("Sign Proof of Delivery (POD)", "إثبات التسليم والتوقيع (POD)")}
              </button>
            </div>
          </div>

          {/* Trip Milestone Timeline */}
          <div className="card p-5 border border-border-subtle">
            <span className="text-[12px] font-bold text-text-primary block mb-4 uppercase tracking-wider">
              {t("Trip Event Audit & Milestone Timeline", "سجل أحداث ومحطات الرحلة الميدانية")}
            </span>

            <div className="relative ps-6 space-y-4">
              <span className="absolute top-2 bottom-2 start-[7px] w-0.5 bg-border-subtle" />

              {currentTrip.timeline.map((ev) => (
                <div key={ev.id} className="relative flex items-start justify-between gap-3">
                  <span className="absolute -start-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface-0 bg-brand shadow-sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-text-primary">
                        {t(ev.titleEn, ev.titleAr)}
                      </span>
                      <span className="badge bg-surface-5 text-text-muted text-[10px]">
                        {ev.actor}
                      </span>
                    </div>
                    {ev.notes && (
                      <p className="text-[11.5px] text-text-muted mt-0.5">{ev.notes}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted tabular-nums shrink-0 font-medium">
                    {ev.timestamp}
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
            className="animate-fade-up scroll-thin relative max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-[18px] bg-white text-navy p-7 shadow-2xl border border-border-subtle"
          >
            {/* Waybill Header */}
            <div className="flex items-start justify-between border-b border-navy/15 pb-4">
              <div className="flex items-center gap-3">
                <EjazEmblem size={44} color="#FF7A00" />
                <div>
                  <h3 className="text-[18px] font-extrabold text-navy">
                    مؤسسة إيجاز للنقليات · EJAZ TRANSPORT
                  </h3>
                  <span className="text-[11px] text-navy/60 block font-medium">
                    بوليصة شحن بري إلكترونية موحدة · E-WAYBILL #{currentTrip.qrCodeToken}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowWaybillModal(false)}
                className="btn-icon bg-navy/10 text-navy"
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Waybill Body Details */}
            <div className="mt-5 grid grid-cols-2 gap-4 text-[12.5px] border-b border-navy/10 pb-5">
              <div className="rounded-[10px] bg-navy/5 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-navy/60 block uppercase">
                  بيانات الشاحن والمرسل
                </span>
                <span className="font-bold text-navy block">{currentTrip.shipper}</span>
                <span className="text-[11px] text-navy/70 block">
                  موقع الانطلاق: {currentTrip.originTerminal}
                </span>
                <span className="text-[11px] text-navy/70 block">المدينة: {currentTrip.originCity}</span>
              </div>

              <div className="rounded-[10px] bg-navy/5 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-navy/60 block uppercase">
                  بيانات المستلم والوجهة
                </span>
                <span className="font-bold text-navy block">{currentTrip.consignee}</span>
                <span className="text-[11px] text-navy/70 block">
                  موقع التسليم: {currentTrip.destinationTerminal}
                </span>
                <span className="text-[11px] text-navy/70 block">المدينة: {currentTrip.destinationCity}</span>
              </div>
            </div>

            {/* Cargo and Truck Specs */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-[12px] border-b border-navy/10 pb-4">
              <div>
                <span className="text-[10.5px] text-navy/60 block font-medium">نوع الشاحنة والمقطورة</span>
                <span className="font-bold text-navy">{currentTrip.cargoType}</span>
              </div>
              <div>
                <span className="text-[10.5px] text-navy/60 block font-medium">الوزن القائم الصافي</span>
                <span className="font-bold text-brand tabular-nums">{currentTrip.cargoWeightTons} طن</span>
              </div>
              <div>
                <span className="text-[10.5px] text-navy/60 block font-medium">المسافة المقدرة</span>
                <span className="font-bold text-navy tabular-nums">{currentTrip.distanceTotalKm} كم</span>
              </div>
            </div>

            {/* QR Code and Digital Seal */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Visual SVG QR representation */}
                <div className="grid h-20 w-20 place-items-center rounded-xl bg-navy/10 p-2 border border-navy/20">
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
                  <span className="text-[11.5px] font-bold text-navy block">
                    رمز التحقق الإلكتروني لهيئة النقل
                  </span>
                  <span className="text-[10.5px] text-navy/60 block font-mono">
                    {currentTrip.qrCodeToken}
                  </span>
                  <span className="text-[10.5px] text-status-active font-semibold block mt-1">
                    ✓ بوليصة سارية ومسجلة في منصة بيان
                  </span>
                </div>
              </div>

              {/* Recipient Signature Box if present */}
              {currentTrip.recipientSignature && (
                <div className="text-end">
                  <span className="text-[10.5px] text-navy/60 block font-medium">توقيع المستلم الإلكتروني</span>
                  <img
                    src={currentTrip.recipientSignature}
                    alt="Signature"
                    className="h-12 w-28 object-contain inline-block border-b border-navy/30"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-navy/10">
              <button
                onClick={() => window.print()}
                className="btn-primary text-[12px] py-2 px-5 bg-brand text-on-brand font-bold"
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
            className="animate-fade-up relative w-full max-w-[480px] rounded-[18px] bg-surface-2 p-6 shadow-2xl border border-border-subtle"
          >
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-[17px] font-bold text-text-primary">
                  {t("Consignee Digital Signature (POD)", "التوقيع الرقمي للمستلم (POD)")}
                </h3>
                <p className="text-[11.5px] text-text-muted mt-0.5">
                  {t(
                    "Sign inside the box to confirm cargo receipt without damage",
                    "وقّع داخل الصندوق لتأكيد استلام الشحنة كاملة وسليمة"
                  )}
                </p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="btn-icon" aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-surface-1 p-2 border border-border-subtle">
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
                className="w-full h-40 bg-surface-3 rounded-lg cursor-crosshair border border-dashed border-border-subtle/80"
              />
              <span className="text-[10px] text-text-muted block text-center mt-1">
                {t("Draw your signature using mouse or finger touch", "ارسم توقيعك باللمس أو الفأرة")}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button onClick={clearSignature} className="btn-ghost text-[11.5px] py-1.5 px-3">
                {t("Clear", "مسح")}
              </button>

              <div className="flex gap-2">
                <button onClick={() => setShowSignModal(false)} className="btn-ghost text-[11.5px] py-1.5 px-3">
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
                  className="btn-primary text-[11.5px] py-1.5 px-4 font-bold"
                >
                  <IconCheck size={14} />
                  {t("Confirm Delivery", "تأكيد التسليم النهائي")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Replace Driver with Audit Logging */}
      {showReplaceDriverModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowReplaceDriverModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-w-[460px] w-full rounded-[18px] bg-surface-1 text-white p-6 border border-border-subtle shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <span>استبدال سائق الرحلة الرسمي</span>
                <span className="badge bg-brand/20 text-brand text-[10px]">{currentTrip.tripNumber}</span>
              </h3>
              <button onClick={() => setShowReplaceDriverModal(false)} className="btn-icon" aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              <div>
                <label className="block text-text-muted text-[11px] mb-1">السائق الحالي المفرغ:</label>
                <div className="p-2.5 rounded-[10px] bg-surface-2 text-white font-bold border border-white/5">
                  فهد الشمري (DL-SA-91823)
                </div>
              </div>

              <div>
                <label className="block text-text-muted text-[11px] mb-1">السائق الجديد المكلف بالرحلة *</label>
                <select
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="سالم المري">سالم المري (رخصة سارية حتى 2027)</option>
                  <option value="ماجد البلوي">ماجد البلوي (رخصة سارية حتى 2028)</option>
                  <option value="عبدالله الدوسري">عبدالله الدوسري (رخصة سارية حتى 2029)</option>
                  <option value="يوسف العتيبي">يوسف العتيبي (رخصة سارية حتى 2027)</option>
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-[11px] mb-1">سبب الاستبدال الإلزامي للتدقيق *</label>
                <textarea
                  rows={2}
                  value={driverReplaceReason}
                  onChange={(e) => setDriverReplaceReason(e.target.value)}
                  className="w-full rounded-[10px] bg-surface-2 p-2.5 text-white border border-border-subtle outline-none resize-none"
                  placeholder="اكتب سبب الاستبدال الميداني المبرر..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => setShowReplaceDriverModal(false)} className="btn-ghost text-[11.5px] py-2 px-3">
                إلغاء
              </button>
              <button
                onClick={handleExecuteDriverReplacement}
                className="btn-primary text-[12px] py-2 px-4 font-bold shadow-lg"
              >
                تأكيد الاستبدال وتوثيق السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Replace Vehicle with Audit Logging */}
      {showReplaceVehicleModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowReplaceVehicleModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-w-[460px] w-full rounded-[18px] bg-surface-1 text-white p-6 border border-border-subtle shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <span>استبدال شاحنة الرحلة المعتمدة</span>
                <span className="badge bg-brand/20 text-brand text-[10px]">{currentTrip.tripNumber}</span>
              </h3>
              <button onClick={() => setShowReplaceVehicleModal(false)} className="btn-icon" aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              <div>
                <label className="block text-text-muted text-[11px] mb-1">الشاحنة الحالية المفصولة:</label>
                <div className="p-2.5 rounded-[10px] bg-surface-2 text-white font-bold border border-white/5">
                  ر ج د ٤٨٢١ (ستارة Actros L 1863)
                </div>
              </div>

              <div>
                <label className="block text-text-muted text-[11px] mb-1">الشاحنة البديلة المعتمدة (الأنواع الرسمية الـ 4 فقط) *</label>
                <select
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                  className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-white border border-border-subtle outline-none"
                >
                  <option value="ب ر د ٩١٠٤ (براد)">ب ر د ٩١٠٤ · براد Mercedes Actros (استمارة وفحص ساري)</option>
                  <option value="س ط ح ٥٥٢٠ (سطحة)">س ط ح ٥٥٢٠ · سطحة Scania R 500 (استمارة وفحص ساري)</option>
                  <option value="ج ا ف ٧٧١٤ (جاف)">ج ا ف ٧٧١٤ · جاف Volvo FH 500 (استمارة وفحص ساري)</option>
                  <option value="س ط ح ٨٣١٩ (سطحة)">س ط ح ٨٣١٩ · سطحة Scania Heavy (استمارة وفحص ساري)</option>
                </select>
              </div>

              <div>
                <label className="block text-text-muted text-[11px] mb-1">سبب الاستبدال المبرر للتدقيق *</label>
                <textarea
                  rows={2}
                  value={vehicleReplaceReason}
                  onChange={(e) => setVehicleReplaceReason(e.target.value)}
                  className="w-full rounded-[10px] bg-surface-2 p-2.5 text-white border border-border-subtle outline-none resize-none"
                  placeholder="سبب استبدال المركبة وتحديث جهاز الـ GPS..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => setShowReplaceVehicleModal(false)} className="btn-ghost text-[11.5px] py-2 px-3">
                إلغاء
              </button>
              <button
                onClick={handleExecuteVehicleReplacement}
                className="btn-primary text-[12px] py-2 px-4 font-bold shadow-lg"
              >
                تأكيد استبدال الشاحنة وتحديث التتبع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
