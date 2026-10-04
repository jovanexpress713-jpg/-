import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { InteractiveMap } from "./InteractiveMap";
import { EjazEmblem } from "./Logo";
import {
  IconClose,
  IconDoc,
  IconThermo,
  IconMessage,
  IconLayers,
} from "./Icons";

export function ShipperPortal() {
  const { t, td } = useSettings();
  const { trips, selectedTripId, selectTrip, sendChatMessage } = useFleetStore();

  const [activeTripId, setActiveTripId] = useState(selectedTripId || trips[0]?.id);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatText, setChatText] = useState("");

  const activeTrip = trips.find((tr) => tr.id === activeTripId) || trips[0];

  const handleCopyLink = () => {
    navigator.clipboard?.writeText?.(`${window.location.origin}/?track=${activeTrip.tripNumber}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleSendSupportChat = () => {
    if (!chatText.trim()) return;
    sendChatMessage(activeTrip.id, chatText.trim());
    setChatText("");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-0 p-4 lg:p-6 space-y-6">
      {/* Top Customer Welcome Banner */}
      <div className="card p-5 border border-border-subtle bg-gradient-to-r from-surface-2 to-surface-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <EjazEmblem size={38} color="var(--color-brand)" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[19px] font-bold text-text-primary">
                  {t("Client Consignment Tracking Portal", "بوابة تتبع الشحنات للعملاء والشركاء")}
                </h2>
                <span className="badge bg-brand/20 text-brand text-[10.5px]">
                  {t("Verified Shipper", "شريك معتمد")}
                </span>
              </div>
              <p className="text-[12px] text-text-muted mt-0.5">
                {t(
                  "Real-time GPS tracking, electronic proof of delivery, and cargo condition telemetry",
                  "مراقبة لحظية للشاحنات على الطرق، وثائق التسليم الإلكترونية، وسلامة الحمولات"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="btn-ghost text-[12px] py-2 px-3.5 border border-border-subtle"
            >
              <IconDoc size={15} />
              {t("View Consignment QR", "رمز البوليصة QR")}
            </button>
            <button
              onClick={handleCopyLink}
              className="btn-primary text-[12px] py-2 px-4 shadow-md font-bold"
            >
              <IconLayers size={15} />
              {copiedLink ? t("Link Copied!", "تم نسخ الرابط!") : t("Share Live Link", "مشاركة رابط التتبع")}
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Active Freight Details & Interactive Map */}
        <div className="space-y-4 lg:col-span-2">
          {/* Active Freight Overview Card */}
          <div className="card p-5 border border-border-subtle">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[22px] font-extrabold text-text-primary tracking-tight">
                    {activeTrip.tripNumber}
                  </span>
                  <span className="badge bg-status-active/20 text-status-active font-bold text-[11px]">
                    {activeTrip.status === "on_road" ? t("On Road Live", "على الطريق مباشرة") : activeTrip.status}
                  </span>
                  <span className="badge bg-surface-5 text-text-muted text-[11px]">
                    {activeTrip.cargoType}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-text-secondary">
                  <strong>{activeTrip.originCity}</strong> ({activeTrip.originTerminal}) →{" "}
                  <strong>{activeTrip.destinationCity}</strong> ({activeTrip.destinationTerminal})
                </div>
              </div>

              <div className="text-end">
                <span className="text-[10.5px] text-text-muted uppercase block">
                  {t("Estimated Arrival (ETA)", "الوقت التقديري للوصول")}
                </span>
                <span className="text-[20px] font-extrabold text-brand tabular-nums block mt-0.5">
                  {Math.floor(activeTrip.etaMinutes / 60)} {t("hrs", "ساعة")} {activeTrip.etaMinutes % 60} {t("min", "دقيقة")}
                </span>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="mt-4 space-y-1.5 border-t border-border-subtle pt-3.5">
              <div className="flex items-center justify-between text-[11.5px] tabular-nums text-text-secondary">
                <span>
                  {t("Progress Covered:", "المسافة المقطوعة:")} {activeTrip.distanceCoveredKm} {t("km", "كم")}
                </span>
                <span className="font-bold text-brand">{activeTrip.progressPct}%</span>
                <span>
                  {t("Remaining:", "المتبقي:")} {activeTrip.distanceRemainingKm} {t("km", "كم")}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700"
                  style={{ width: `${activeTrip.progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Real Live Map with Truck Movement */}
          <InteractiveMap
            trip={activeTrip}
            className="h-[400px] w-full"
            accent
          />
        </div>

        {/* Right Col: Client Consignments List & Support Messaging */}
        <div className="space-y-4">
          {/* List of Shipments under Shipper Account */}
          <div className="card p-5 border border-border-subtle">
            <h4 className="text-[14px] font-bold text-text-primary mb-3">
              {t("My Active Shipments", "شحناتي المتعاقد عليها")} ({trips.length})
            </h4>

            <div className="space-y-2">
              {trips.slice(0, 4).map((tr) => {
                const isSelected = tr.id === activeTrip.id;
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
                        ? "bg-surface-3 border-brand shadow-sm"
                        : "bg-surface-2 border-border-subtle hover:bg-surface-3"
                    )}
                  >
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-bold text-text-primary">{tr.tripNumber}</span>
                      <span className="font-bold text-brand tabular-nums">{tr.progressPct}%</span>
                    </div>
                    <div className="text-[11.5px] text-text-muted mt-1">
                      {td(tr.originCity)} → {td(tr.destinationCity)} · {tr.cargoWeightTons} {t("t", "طن")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reefer / Sensitive Cargo Health Badge */}
          {activeTrip.cargoType === "reefer" && (
            <div className="card p-4 border border-border-subtle bg-surface-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/20 text-brand">
                    <IconThermo size={18} />
                  </span>
                  <div>
                    <span className="text-[11px] text-text-muted block">
                      {t("Live Cold Chain Sensor", "مستشعر التبريد المباشر")}
                    </span>
                    <span className="text-[15px] font-bold text-text-primary tabular-nums">
                      -18.5 °C ({t("Target: -18.0°C", "المستهدف: -18°C")})
                    </span>
                  </div>
                </div>
                <span className="badge bg-status-active/20 text-status-active font-semibold text-[10.5px]">
                  ✓ {t("Optimal", "سليم")}
                </span>
              </div>
            </div>
          )}

          {/* Direct Support & Operational Chat */}
          <div className="card p-5 border border-border-subtle flex flex-col h-[290px]">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <div className="flex items-center gap-2">
                <IconMessage size={16} className="text-brand" />
                <h4 className="text-[13px] font-bold text-text-primary">
                  {t("Ejaz Operations Live Support", "دعم عمليات إيجاز المباشر")}
                </h4>
              </div>
              <span className="badge bg-status-active/20 text-status-active text-[10px]">
                {t("Online", "متواجد")}
              </span>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto py-2.5 space-y-2 text-[12px]">
              <div className="rounded-xl bg-surface-3 p-2.5 text-text-secondary border border-border-subtle">
                <span className="text-[10px] text-brand font-bold block mb-0.5">
                  {t("Ejaz Support", "دعم إيجاز")}
                </span>
                <p>
                  {t(
                    "Welcome! Your consignment is currently on schedule and temperature monitored.",
                    "أهلاً بك! شحنتكم تسير وفق الموعد المعتمد مع استمرار فحص التبريد والوزن."
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendSupportChat()}
                placeholder={t("Inquire about delivery...", "استفسر عن موعد التسليم...")}
                className="field text-[12px] py-1.5 px-3"
              />
              <button onClick={handleSendSupportChat} className="btn-primary text-[12px] py-1.5 px-3.5">
                {t("Send", "إرسال")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal for Waybill */}
      {showQrModal && (
        <div
          className="animate-fade-in fixed inset-0 z-[95] grid place-items-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowQrModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up relative w-full max-w-[420px] rounded-[18px] bg-white text-navy p-6 shadow-2xl text-center"
          >
            <div className="flex justify-end">
              <button onClick={() => setShowQrModal(false)} className="btn-icon bg-navy/10 text-navy">
                <IconClose size={15} />
              </button>
            </div>

            <EjazEmblem size={44} color="var(--color-brand)" className="mx-auto" />
            <h3 className="text-[18px] font-extrabold mt-3">
              {t("Electronic Consignment Waybill QR", "رمز بوليصة الشحن الإلكترونية")}
            </h3>
            <p className="text-[12px] text-navy/60 mt-1">
              {t("Scan using camera to access public live tracking link", "امسح الرمز بكاميرا الجوال للوصول للتتبع المباشر")}
            </p>

            {/* QR Visual */}
            <div className="my-5 mx-auto grid h-48 w-48 place-items-center rounded-2xl bg-navy/5 p-4 border border-navy/15">
              <svg viewBox="0 0 40 40" className="h-full w-full" fill="var(--color-on-brand)">
                <rect x="2" y="2" width="14" height="14" rx="2" fill="none" stroke="var(--color-on-brand)" strokeWidth="3" />
                <rect x="6" y="6" width="6" height="6" />
                <rect x="24" y="2" width="14" height="14" rx="2" fill="none" stroke="var(--color-on-brand)" strokeWidth="3" />
                <rect x="28" y="6" width="6" height="6" />
                <rect x="2" y="24" width="14" height="14" rx="2" fill="none" stroke="var(--color-on-brand)" strokeWidth="3" />
                <rect x="6" y="28" width="6" height="6" />
                <rect x="22" y="22" width="4" height="4" />
                <rect x="28" y="26" width="6" height="4" />
                <rect x="24" y="32" width="6" height="4" />
                <rect x="18" y="8" width="4" height="6" />
                <rect x="8" y="18" width="6" height="4" />
              </svg>
            </div>

            <span className="font-mono font-bold text-navy text-[13px] block">
              {activeTrip.qrCodeToken}
            </span>

            <button
              onClick={() => setShowQrModal(false)}
              className="btn-primary w-full mt-5 py-2.5 bg-brand text-on-brand font-bold text-[13px]"
            >
              {t("Done", "تم")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
