import { useState } from "react";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { InteractiveMap } from "./InteractiveMap";
import {
  IconCheck,
  IconFuel,
  IconMessage,
  IconPhone,
  IconPin,
  IconThermo,
  IconTruck,
  IconTurnLeft,
  IconWeight,
} from "./Icons";

export function DriverPortal() {
  const { t } = useSettings();
  const { trips, selectedTripId, updateTripStatus, sendChatMessage } = useFleetStore();

  const driverTrip = trips.find((tr) => tr.id === selectedTripId) || trips[0];
  const [chatInput, setChatInput] = useState("");
  const [isCalling, setIsCalling] = useState(false);

  const handleAction = (status: any, noteAr: string, noteEn: string) => {
    updateTripStatus(driverTrip.id, status, noteAr, noteEn);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(driverTrip.id, chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-0 p-4 lg:p-6 space-y-6">
      {/* Top Driver Banner */}
      <div className="card p-5 border border-border-subtle bg-gradient-to-r from-surface-2 to-surface-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-on-brand font-extrabold text-page-title shadow-lg">
              ف.ق
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-section-title font-bold text-text-primary">
                  {t("Welcome, Captain Fahad Al-Qahtani", "مرحباً كابتن فهد القحطاني")}
                </h2>
                <span className="badge bg-status-active/20 text-status-active text-label">
                  {t("Active Duty", "على رأس العمل")}
                </span>
              </div>
              <p className="text-label-lg text-text-muted mt-0.5">
                {t(
                  "Assigned Truck: Mercedes-Benz Actros L 1863 · Plate: RJD 4821",
                  "الشاحنة المكلفة: مرسيدس بنز أكتروس L 1863 · اللوحة: ر ي د ٤٨٢١"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setIsCalling(true);
                setTimeout(() => setIsCalling(false), 2800);
              }}
              className="btn-ghost text-label-lg py-2 px-3.5 border border-border-subtle"
            >
              <IconPhone size={15} />
              {isCalling ? t("Calling Dispatch...", "جارٍ الاتصال بالعمليات...") : t("Emergency Hotline", "خط الطوارئ والعمليات")}
            </button>

            <button
              onClick={() =>
                handleAction(
                  "on_road",
                  "بدء انطلاق الشاحنة من الموقع الميداني",
                  "Driver departed terminal onto highway"
                )
              }
              className="btn-primary text-label-lg py-2 px-5 font-bold shadow-md"
            >
              <IconTruck size={16} />
              {t("Start Trip Departure", "بدء الانطلاق على الطريق")}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Navigation & Cargo Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Live Map & Navigation Guidance */}
        <div className="space-y-4 lg:col-span-2">
          {/* Turn-by-Turn Instruction Capsule */}
          <div className="card p-4 border border-brand/40 bg-brand/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-inner bg-brand text-on-brand shadow-md">
                <IconTurnLeft size={22} />
              </span>
              <div>
                <span className="text-label font-bold text-brand uppercase tracking-wider">
                  {t("Navigation Guidance", "التوجيه الملاحي المباشر")}
                </span>
                <h4 className="text-page-title font-bold text-text-primary mt-0.5">
                  {t(
                    "Turn left after 400m onto Highway 40 Express towards Taif",
                    "اتجه يساراً بعد ٤٠٠ م نحو طريق ٤٠ السريع باتجاه الطائف"
                  )}
                </h4>
              </div>
            </div>

            <div className="text-end shrink-0 tabular-nums">
              <span className="text-headline font-extrabold text-text-primary block">
                {driverTrip.speedKmH} {t("km/h", "كم/س")}
              </span>
              <span className="text-label text-text-muted">
                {t("Legal Limit: 90 km/h", "السرعة القصوى: ٩٠")}
              </span>
            </div>
          </div>

          {/* Interactive Live Map */}
          <InteractiveMap
            trip={driverTrip}
            className="h-[380px] w-full"
            accent
          />

          {/* Quick Field Status Actions */}
          <div className="card p-4 border border-border-subtle">
            <span className="text-label-lg font-bold text-text-primary block mb-3 uppercase tracking-wider">
              {t("Driver Field Actions", "إجراءات السائق الميدانية")}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() =>
                  handleAction(
                    "loading",
                    "تأكيد استلام أوراق الشحن وبدء التحميل في المستودع",
                    "Loading underway at terminal"
                  )
                }
                className="chip justify-center py-2.5 text-label-lg font-semibold"
              >
                {t("Confirm Loading", "تأكيد التحميل")}
              </button>

              <button
                onClick={() =>
                  handleAction(
                    "stopped",
                    "تسجيل استراحة نظامية للسائق وفحص الإطارات",
                    "Driver rest stop logged"
                  )
                }
                className="chip justify-center py-2.5 text-label-lg"
              >
                {t("Log Rest Stop", "تسجيل استراحة")}
              </button>

              <button
                onClick={() =>
                  handleAction(
                    "arrived",
                    "الوصول إلى بوابة مستودع العميل والاستعداد للتسليم",
                    "Arrived at destination"
                  )
                }
                className="chip justify-center py-2.5 text-label-lg font-semibold"
              >
                {t("Arrived at Gate", "تأكيد الوصول")}
              </button>

              <button
                onClick={() =>
                  handleAction(
                    "delivered",
                    "اكتمال تفريغ البضاعة وتسليمها للعميل",
                    "Cargo unloaded & delivered"
                  )
                }
                className="chip justify-center py-2.5 text-label-lg font-bold bg-status-active/20 text-status-active"
              >
                <IconCheck size={14} />
                {t("Complete Delivery", "إثبات التسليم")}
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Truck Telemetry & Dispatch Messaging */}
        <div className="space-y-4">
          {/* Truck Hardware Telemetry */}
          <div className="card p-5 border border-border-subtle space-y-4">
            <h4 className="text-card-title font-bold text-text-primary">
              {t("Truck Telemetry & Sensors", "مؤشرات الشاحنة والمستشعرات")}
            </h4>

            <div className="space-y-3 text-body">
              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <span className="flex items-center gap-2 text-text-muted">
                  <IconFuel size={16} />
                  {t("Fuel Tank", "خزان الوقود")}
                </span>
                <span className="font-bold tabular-nums text-text-primary">78% (640 L)</span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <span className="flex items-center gap-2 text-text-muted">
                  <IconThermo size={16} />
                  {t("Engine Temp", "حرارة المحرك")}
                </span>
                <span className="font-bold tabular-nums text-status-active">92 °C ({t("Optimal", "مثالية")})</span>
              </div>

              {driverTrip.cargoType === "reefer" && (
                <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                  <span className="flex items-center gap-2 text-text-muted">
                    <IconThermo size={16} />
                    {t("Reefer Box Temp", "حرارة الصندوق")}
                  </span>
                  <span className="font-bold tabular-nums text-brand">-18.5 °C</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <span className="flex items-center gap-2 text-text-muted">
                  <IconWeight size={16} />
                  {t("Payload Weight", "وزن الحمولة")}
                </span>
                <span className="font-bold tabular-nums text-text-primary">
                  {driverTrip.cargoWeightTons} {t("tons", "طن")} / {driverTrip.maxCapacityTons} {t("tons", "طن")}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-2 text-text-muted">
                  <IconPin size={16} />
                  {t("Remaining Run", "المسافة المتبقية")}
                </span>
                <span className="font-bold tabular-nums text-brand">
                  {driverTrip.distanceRemainingKm} {t("km", "كم")}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Dispatch Radio / Chat */}
          <div className="card p-5 border border-border-subtle flex flex-col h-[320px]">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <IconMessage size={16} className="text-brand" />
                <h4 className="text-body font-bold text-text-primary">
                  {t("Dispatch Operations Radio", "لاسلكي العمليات المباشر")}
                </h4>
              </div>
              <span className="badge bg-status-active/20 text-status-active text-micro">
                {t("Connected", "متصل")}
              </span>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto py-3 space-y-2.5 text-label-lg">
              <div className="rounded-inner bg-surface-3 p-2.5 text-text-secondary border border-border-subtle">
                <span className="text-micro text-brand font-bold block mb-1">
                  {t("Central Dispatch", "العمليات المركزية")} · ٠٧:٤٢ ص
                </span>
                <p>{t("Maintain 85 km/h cruise, road is clear ahead.", "حافظ على سرعة ٨٥ كم/س، الطريق سالك أمامك.")}</p>
              </div>

              <div className="rounded-inner bg-brand/15 p-2.5 text-text-primary border border-brand/30 ms-4">
                <span className="text-micro text-text-muted font-bold block mb-1">
                  {t("You (Driver)", "أنت (السائق)")} · ٠٧:٥١ ص
                </span>
                <p>{t("Copy that, passing Zalim oasis now.", "علم، أمر الآن بجوار واحة ظلم.")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder={t("Message operations...", "اكتب للعمليات...")}
                className="field text-label-lg py-1.5 px-3"
              />
              <button onClick={handleSendChat} className="btn-primary text-label-lg py-1.5 px-3.5">
                {t("Send", "إرسال")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
