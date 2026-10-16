import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { InteractiveMap } from "./InteractiveMap";
import { EjazEmblem } from "./Logo";
import { useToast } from "./Toast";
import { IconDoc, IconThermo, IconMessage } from "./Icons";

export function ShipperPortal() {
  const { t, td } = useSettings();
  const { trips, selectedTripId, selectTrip, sendChatMessage, chatMessages } = useFleetStore();
  const toast = useToast();

  const [activeTripId, setActiveTripId] = useState(selectedTripId || trips[0]?.id);
  const [copiedReference, setCopiedReference] = useState(false);
  const [chatText, setChatText] = useState("");

  const activeTrip = trips.find((tr) => tr.id === activeTripId) || trips[0];
  const activeMessages = chatMessages.filter((message) => message.tripId === activeTrip?.id);

  useEffect(() => {
    if (selectedTripId && trips.some((trip) => trip.id === selectedTripId)) {
      setActiveTripId(selectedTripId);
    } else if (!trips.some((trip) => trip.id === activeTripId)) {
      setActiveTripId(trips[0]?.id);
    }
  }, [activeTripId, selectedTripId, trips]);

  const handleCopyReference = async () => {
    if (!activeTrip) return;
    try {
      await navigator.clipboard.writeText(activeTrip.tripNumber);
      setCopiedReference(true);
      setTimeout(() => setCopiedReference(false), 2200);
    } catch {
      toast(t("Could not copy the trip reference", "تعذّر نسخ رقم الرحلة"), activeTrip.tripNumber);
    }
  };

  const handleSendSupportChat = () => {
    if (!activeTrip || !chatText.trim()) return;
    sendChatMessage(activeTrip.id, chatText.trim());
    setChatText("");
  };

  if (!activeTrip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-0 p-6 text-center">
        <h2 className="text-page-title font-bold text-text-primary">{t("No shipment data", "لا توجد بيانات شحنات")}</h2>
        <p className="max-w-lg text-body text-text-muted">{t("This persona preview has no trip records to show.", "لا تحتوي معاينة دور العميل على رحلات لعرضها حالياً.")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-0 p-4 lg:p-6 space-y-6">
      {/* Top Customer Welcome Banner */}
      <div className="card p-5 border border-border-subtle bg-gradient-to-r from-surface-2 to-surface-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <EjazEmblem size={38} color="var(--color-brand)" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-headline font-bold text-text-primary">
                  {t("Client Consignment Tracking Portal", "بوابة تتبع الشحنات للعملاء والشركاء")}
                </h2>
                <span className="badge bg-brand/20 text-brand text-label">
                  {t("Persona preview · sample records", "معاينة شخصية · سجلات عرض") }
                </span>
              </div>
              <p className="text-label-lg text-text-muted mt-0.5">
                {t(
                  "Preview of trip records — GPS and cargo sensors are not live in this persona screen",
                  "معاينة لسجلات الرحلات — لا يوجد بث GPS أو حساسات حية في شاشة الدور التجريبي"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReference}
              className="btn-ghost text-label-lg py-2 px-3.5 border border-border-subtle"
            >
              <IconDoc size={15} />
              {copiedReference ? t("Reference copied", "تم نسخ رقم الرحلة") : t("Copy trip reference", "نسخ رقم الرحلة")}
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
                  <span className="text-hero-sm font-extrabold text-text-primary tracking-tight">
                    {activeTrip.tripNumber}
                  </span>
                  <span className="badge bg-status-active/20 text-status-active font-bold text-label">
                    {activeTrip.status === "on_road" ? t("On road · preview data", "على الطريق · بيانات معاينة") : activeTrip.status}
                  </span>
                  <span className="badge bg-surface-5 text-text-muted text-label">
                    {activeTrip.cargoType}
                  </span>
                </div>
                <div className="mt-1 text-body text-text-secondary">
                  <strong>{activeTrip.originCity}</strong> ({activeTrip.originTerminal}) →{" "}
                  <strong>{activeTrip.destinationCity}</strong> ({activeTrip.destinationTerminal})
                </div>
              </div>

              <div className="text-end">
                <span className="text-label text-text-muted uppercase block">
                      {t("Estimated Arrival · preview", "وقت الوصول التقديري · معاينة")}
                </span>
                <span className="text-headline font-extrabold text-brand tabular-nums block mt-0.5">
                  {Math.floor(activeTrip.etaMinutes / 60)} {t("hrs", "ساعة")} {activeTrip.etaMinutes % 60} {t("min", "دقيقة")}
                </span>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="mt-4 space-y-1.5 border-t border-border-subtle pt-3.5">
              <div className="flex items-center justify-between text-label-lg tabular-nums text-text-secondary">
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
            <h4 className="text-card-title font-bold text-text-primary mb-3">
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
                      "w-full rounded-inner p-3 text-start transition-all border",
                      isSelected
                        ? "bg-surface-3 border-brand shadow-sm"
                        : "bg-surface-2 border-border-subtle hover:bg-surface-3"
                    )}
                  >
                    <div className="flex items-center justify-between text-body">
                      <span className="font-bold text-text-primary">{tr.tripNumber}</span>
                      <span className="font-bold text-brand tabular-nums">{tr.progressPct}%</span>
                    </div>
                    <div className="text-label-lg text-text-muted mt-1">
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
                  <span className="grid h-8 w-8 place-items-center rounded-chip bg-brand/20 text-brand">
                    <IconThermo size={18} />
                  </span>
                  <div>
                    <span className="text-label text-text-muted block">
                      {t("Cold-chain reading · preview", "قراءة سلسلة التبريد · معاينة")}
                    </span>
                    <span className="text-page-title font-bold text-text-primary tabular-nums">
                      {activeTrip.reeferTempC != null
                        ? `${activeTrip.reeferTempC} °C`
                        : t("No sensor reading", "لا توجد قراءة حساس")}
                      {activeTrip.targetTempC != null ? ` (${t("Target", "المستهدف")}: ${activeTrip.targetTempC}°C)` : ""}
                    </span>
                  </div>
                </div>
                <span className="badge bg-surface-5 text-text-muted font-semibold text-label">
                  {t("Not live", "غير مباشر")}
                </span>
              </div>
            </div>
          )}

          {/* Local-only chat preview — no message is sent to Operations. */}
          <div className="card p-5 border border-border-subtle flex flex-col h-[290px]">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <div className="flex items-center gap-2">
                <IconMessage size={16} className="text-brand" />
                <h4 className="text-body font-bold text-text-primary">
                  {t("Message preview", "معاينة الرسائل")}
                </h4>
              </div>
              <span className="badge bg-surface-5 text-text-muted text-micro">
                {t("Local only", "محلي فقط")}
              </span>
            </div>
            <p className="mt-2 text-micro text-text-muted">
              {t("Messages are stored in this browser preview only; they are not delivered to support.", "تُحفظ الرسائل في معاينة هذا المتصفح فقط ولا تُرسل إلى فريق الدعم.")}
            </p>

            <div className="scroll-thin flex-1 overflow-y-auto py-2.5 space-y-2 text-label-lg">
              {activeMessages.length ? activeMessages.map((message) => (
                <div key={message.id} className="rounded-inner bg-surface-3 p-2.5 text-text-secondary border border-border-subtle">
                  <span className="text-micro text-brand font-bold block mb-0.5">{message.senderName} · {message.timestamp}</span>
                  <p>{t(message.textAr, message.textEn)}</p>
                </div>
              )) : (
                <div className="grid h-full place-items-center text-center text-label text-text-muted">
                  {t("No preview messages yet.", "لا توجد رسائل معاينة بعد.")}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendSupportChat()}
                placeholder={t("Write a local preview message…", "اكتب رسالة للمعاينة…")}
                className="field text-label-lg py-1.5 px-3"
              />
              <button onClick={handleSendSupportChat} disabled={!chatText.trim()} className="btn-primary text-label-lg py-1.5 px-3.5 disabled:opacity-50">
                {t("Add", "إضافة")}
              </button>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
