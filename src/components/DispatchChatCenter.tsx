import { useState, useRef, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { useToast } from "./Toast";
import {
  IconChat,
  IconSearch,
  IconArrowRight,
} from "./Icons";

interface DispatchChatCenterProps {
  onOpenTrip?: (tripId: string) => void;
}

export function DispatchChatCenter({ onOpenTrip }: DispatchChatCenterProps) {
  const { t, td } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, chatMessages, sendChatMessage, selectTrip } = useFleetStore();

  const [activeTripId, setActiveTripId] = useState<string>(trips[0]?.id || "trip-1");
  const [inputText, setInputText] = useState("");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeTrip = trips.find((tr) => tr.id === activeTripId) || trips[0];
  const activeTruck = trucks.find((v) => v.id === activeTrip?.truckId);
  const activeDriver = drivers.find((d) => d.id === activeTrip?.driverId);

  // Filter messages for current selected trip
  const activeTripMessages = chatMessages.filter(
    (msg) => msg.tripId === activeTrip?.id || msg.tripId === "all",
  );

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTripMessages.length, activeTripId]);

  const handleSend = () => {
    if (!inputText.trim() || !activeTrip) return;
    const text = inputText.trim();
    sendChatMessage(activeTrip.id, text);
    setInputText("");
    toast(t("Message dispatched to driver", "تم إرسال التوجيه إلى كابتن الشاحنة"), activeTrip.tripNumber);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick dispatch canned phrases
  const QUICK_PHRASES = [
    { ar: "يرجى تأكيد الوصول لنقطة التفتيش والميزان", en: "Confirm arrival at weighbridge" },
    { ar: "تم استلام واعتماد بوليصة الشحن بنجاح", en: "Waybill received and verified" },
    { ar: "تنبيه تشغيلي: يرجى الالتزام بالسرعة المحددة", en: "Speed advisory notice" },
    { ar: "موافقة على فترة استراحة السائق المجدولة", en: "Approved scheduled driver rest" },
  ];

  const filteredTrips = trips.filter((tr) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      tr.tripNumber.toLowerCase().includes(q) ||
      tr.originCity.toLowerCase().includes(q) ||
      tr.destinationCity.toLowerCase().includes(q) ||
      tr.shipper.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-0">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-3.5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-brand/12 text-brand">
              <IconChat size={18} />
            </span>
            <div>
              <h1 className="text-[18px] font-bold text-text-primary lg:text-[20px]">
                {t("Dispatch & Highway Communications", "مركز التوجيه والاتصال الميداني")}
              </h1>
              <p className="text-[11.5px] text-text-secondary">
                {t(
                  "Real-time tactical communication channel between Operations dispatchers and highway captains",
                  "قناة التوجيه التكتيكي المباشر بين غرفة العمليات وكباتن الشاحنات على الطرق السريعة",
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-status-active animate-pulse" />
            <span className="text-[11.5px] font-semibold text-status-active">
              {t("Live Radio & Telemetry Link Active", "قناة التوجيه اللاسلكي نشطة")}
            </span>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Trip Channels List */}
        <aside className="w-full max-w-[320px] shrink-0 border-e border-border-subtle bg-surface-1 flex flex-col min-h-0">
          {/* Channel Search */}
          <div className="p-3 border-b border-border-subtle">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Filter trip channels...", "تصفية قنوات الرحلات...")}
                className="w-full rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 ps-8 text-[11.5px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
              />
              <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted">
                <IconSearch size={13} />
              </span>
            </div>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-thin">
            {filteredTrips.map((tr) => {
              const isSelected = tr.id === activeTrip?.id;
              const truck = trucks.find((v) => v.id === tr.truckId);
              const driver = drivers.find((d) => d.id === tr.driverId);
              const msgs = chatMessages.filter((m) => m.tripId === tr.id);
              const lastMsg = msgs[msgs.length - 1];

              return (
                <button
                  key={tr.id}
                  onClick={() => setActiveTripId(tr.id)}
                  className={cn(
                    "w-full rounded-[10px] p-3 text-start transition-all duration-150 border flex flex-col justify-between",
                    isSelected
                      ? "border-brand bg-brand/10 shadow-sm"
                      : "border-transparent bg-surface-2 hover:bg-surface-3",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-[12px] text-text-primary">
                      {tr.tripNumber}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted tabular-nums">
                      {lastMsg ? lastMsg.timestamp : "مباشر"}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-text-secondary">
                    <span className="font-semibold truncate">{driver?.name || "كابتن الشاحنة"}</span>
                    <span className="font-mono text-[10px] text-text-muted">{truck?.plate}</span>
                  </div>

                  <div className="mt-1 text-[10.5px] text-text-muted truncate">
                    {td(tr.originCity)} → {td(tr.destinationCity)}
                  </div>

                  {lastMsg && (
                    <div className="mt-1.5 truncate text-[10.5px] text-text-secondary border-t border-white/5 pt-1">
                      <span className="text-brand font-semibold me-1">
                        {lastMsg.from === "dispatch" ? t("Dispatch", "التوجيه") : t("Driver", "السائق")}:
                      </span>
                      <span>{t(lastMsg.textEn, lastMsg.textAr)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Side: Conversation View */}
        <main className="flex-1 flex flex-col min-h-0 bg-surface-0">
          {activeTrip ? (
            <>
              {/* Channel Header Banner */}
              <div className="shrink-0 border-b border-border-subtle bg-surface-2 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[14px] text-brand">
                      {activeTrip.tripNumber}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="font-semibold text-[13px] text-text-primary">
                      {activeDriver?.name || "كابتن الأسطول"}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="font-mono text-[12px] text-text-secondary">
                      {activeTruck?.plate}
                    </span>
                  </div>
                  <span className="hidden md:inline text-[11.5px] text-text-muted">
                    ({td(activeTrip.originCity)} → {td(activeTrip.destinationCity)})
                  </span>
                </div>

                {onOpenTrip && (
                  <button
                    onClick={() => {
                      selectTrip(activeTrip.id);
                      onOpenTrip(activeTrip.id);
                    }}
                    className="btn-ghost py-1 px-2.5 text-[11px] gap-1"
                  >
                    <span>{t("Trip Details", "تفاصيل الرحلة")}</span>
                    <IconArrowRight size={12} />
                  </button>
                )}
              </div>

              {/* Message Bubbles History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-thin">
                {/* Trip Initiation Notice */}
                <div className="mx-auto max-w-md rounded-full bg-surface-2 px-3 py-1 text-center text-[10.5px] text-text-muted border border-border-subtle">
                  {t(
                    `Encrypted dispatch session opened for Trip ${activeTrip.tripNumber}`,
                    `تم فتح جلسة التوجيه المشفرة للرحلة رقم ${activeTrip.tripNumber}`,
                  )}
                </div>

                {activeTripMessages.map((msg) => {
                  const isDispatch = msg.from === "dispatch";
                  const isSystem = msg.from === "system";

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="mx-auto max-w-sm rounded-[8px] bg-surface-3 p-2 text-center text-[11px] text-text-secondary border border-border-subtle"
                      >
                        <span className="block font-semibold text-brand mb-0.5">
                          {t("Automated Waypoint Alert", "إشعار نظام الملاحة التلقائي")}
                        </span>
                        <span>{t(msg.textEn, msg.textAr)}</span>
                        <span className="block font-mono text-[9px] text-text-muted mt-1 tabular-nums">
                          {td(msg.timestamp)}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[75%]",
                        isDispatch ? "ms-auto items-end" : "me-auto items-start",
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[10px] text-text-muted">
                        <span className="font-semibold text-text-secondary">{msg.senderName}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{td(msg.timestamp)}</span>
                      </div>
                      <div
                        className={cn(
                          /* Spec §4.7 — outgoing orange, incoming card-2. */
                          "rounded-inner px-3.5 py-2 text-[12.5px] leading-relaxed shadow-sm",
                          isDispatch
                            ? "bubble-out font-medium rounded-ee-sm"
                            : "bubble-in rounded-es-sm",
                        )}
                      >
                        {t(msg.textEn, msg.textAr)}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Phrases */}
              <div className="shrink-0 border-t border-border-subtle bg-surface-1 px-4 py-2 flex items-center gap-1.5 overflow-x-auto scroll-thin">
                <span className="text-[10.5px] text-text-muted shrink-0 me-1">
                  {t("Quick Directives", "توجيهات سريعة")}:
                </span>
                {QUICK_PHRASES.map((phrase, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      sendChatMessage(
                        activeTrip.id,
                        phrase.ar,
                      );
                      toast(t("Direct directive sent", "تم إرسال التوجيه السريع بنجاح"), phrase.ar);
                    }}
                    className="shrink-0 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-[10.5px] text-text-secondary hover:border-brand hover:text-text-primary transition-colors whitespace-nowrap"
                  >
                    {t(phrase.en, phrase.ar)}
                  </button>
                ))}
              </div>

              {/* Message Composer Input */}
              <div className="shrink-0 border-t border-border-subtle bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t(
                      `Type operational directive to ${activeDriver?.name || "driver"}...`,
                      `اكتب توجيهاً تشغيلياً لكابتن الرحلة (${activeDriver?.name || "السائق"})...`,
                    )}
                    className="flex-1 rounded-[10px] border border-border-subtle bg-surface-1 px-4 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="btn-primary py-2 px-4 text-[12px] font-bold disabled:opacity-40"
                  >
                    {t("Send Directive", "إرسال التوجيه")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-text-muted text-[13px]">
              {t("Select a trip channel to open dispatch communication", "اختر قناة رحلة لبدء التوجيه والاتصال")}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
