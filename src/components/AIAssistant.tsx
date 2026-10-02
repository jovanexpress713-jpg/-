import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import {
  IconBolt,
  IconCheck,
  IconClose,
  IconSearch,
  IconTruck,
  IconArrowRight,
} from "./Icons";

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
}

export function AIAssistant({ isOpen, onClose, onSelectTrip }: AIAssistantProps) {
  const { t } = useSettings();
  const {
    trips,
    trucks,
    setSearchQuery,
    selectTrip,
  } = useFleetStore();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"recommendations" | "ask" | "fleet_analysis">("recommendations");
  const [customResponse, setCustomResponse] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  // Compute live metrics for AI insights
  const avgUtilization = (
    trips.reduce((acc, tr) => acc + (tr.cargoWeightTons / tr.maxCapacityTons) * 100, 0) /
    (trips.length || 1)
  ).toFixed(1);

  // Quick suggestions prompt chips
  const PROMPTS = [
    { ar: "أين الشاحنات المتجهة إلى جدة؟", en: "Where are the trucks heading to Jeddah?" },
    { ar: "أظهر الشاحنات الشاغرة في الرياض", en: "Show idle trucks in Riyadh" },
    { ar: "ما هي الرحلات المعرضة للتأخير؟", en: "Which trips are at risk of delay?" },
    { ar: "فحص شحنات التبريد والمواد الغذائية", en: "Audit cold chain & reefer shipments" },
  ];

  const handleAsk = (userQuery: string) => {
    if (!userQuery.trim()) return;
    setIsThinking(true);
    setCustomResponse(null);

    // Parse natural language intent
    setTimeout(() => {
      setIsThinking(false);
      const lower = userQuery.toLowerCase();

      if (lower.includes("جدة") || lower.includes("jeddah")) {
        const matching = trips.filter((tr) => tr.destinationCity.includes("جدة") || tr.originCity.includes("جدة"));
        setSearchQuery("جدة");
        setCustomResponse(
          t(
            `Found ${matching.length} active consignments on the Jeddah corridor. Actros EZ-10482 is currently at km 417 cruising at 87 km/h, estimated arrival in 3.5 hours.`,
            `تم العثور على ${matching.length} شحنات نشطة على ممر جدة. الشاحنة أكتروس EZ-10482 حالياً عند الكيلو ٤١٧ بسرعة ٨٧ كم/س، وستصل خلال ٣ ساعات ونصف.`
          )
        );
      } else if (lower.includes("شاغر") || lower.includes("رياض") || lower.includes("idle") || lower.includes("riyadh")) {
        setSearchQuery("الرياض");
        setCustomResponse(
          t(
            `3 heavy units are idle in Riyadh Mega Yard: Volvo FM 460 (Plate RYD 7714) and DAF XF 480. Recommended: Assign Volvo FM 460 to the pending Buraydah distribution order to boost utilization by 12%.`,
            `توجد ٣ شاحنات شاغرة في ساحة الرياض المركزية: فولفو FM 460 (لوحة ر ي د ٧٧١٤) وداف XF. التوصية: تكليف فولفو بشحنة بريدة المعلقة لرفع نسبة استغلال الأسطول بمعدل ١٢٪.`
          )
        );
      } else if (lower.includes("تأخير") || lower.includes("delay")) {
        setSearchQuery("EZ-10482");
        setCustomResponse(
          t(
            `Trip EZ-10482 experienced a 15-minute speed drop near Al Quwayiyah due to highway maintenance. Dynamic ETA has adjusted to 11:45 AM. Consignee has been automatically notified.`,
            `الرحلة EZ-10482 تعرضت لتباطؤ مؤقت لمدة ١٥ دقيقة قرب القويعية بسبب أعمال صيانة بالطريق السريع. تم تحديث موعد الوصول التلقائي إلى ١١:٤٥ ص وإرسال إشعار للمستلم.`
          )
        );
      } else if (lower.includes("تبريد") || lower.includes("reefer") || lower.includes("حرارة")) {
        setSearchQuery("reefer");
        setCustomResponse(
          t(
            `Refrigerated trips audited: SADAFCO cold consignment EZ-10483 maintains -18.5°C (Target -18.0°C). Sensor logs 100% compliant with Saudi SFDA standards.`,
            `تم فحص شحنات التبريد: شحنة سدافكو EZ-10483 تسجل حرارة -18.5°C (المستهدف -18.0°C). جميع قراءات الحساسات مطابقة لاشتراطات هيئة الغذاء والدواء السعودية.`
          )
        );
      } else {
        setCustomResponse(
          t(
            `AI analyzed the fleet of 14 trucks and 7 live trips. Fleet health index: 94/100. On-time delivery forecast: 96.2%. No critical telemetry alerts recorded in the past hour.`,
            `قام الذكاء الاصطناعي بتحليل الأسطول المكون من ١٤ شاحنة و٧ رحلات حية. مؤشر الكفاءة التشغيلية: ٩٤٪، والالتزام المتوقع بالمواعيد ٩٦.٢٪ دون تسجيل أي انحرافات حرجة.`
          )
        );
      }
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[85] grid place-items-center bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up scroll-thin relative max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-[20px] bg-surface-2 p-6 shadow-2xl border border-border-subtle"
        style={{
          boxShadow: "0 30px 90px -20px color-mix(in oklab, var(--color-brand) 30%, transparent)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand text-on-brand shadow-lg">
              <IconBolt size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-bold text-text-primary">
                  {t("EJAZ AI Logistics Assistant", "مساعد إيجاز الذكي للوجستيات")}
                </h3>
                <span className="badge bg-status-active/20 text-status-active text-[10px]">
                  {t("Online · Live", "متصل · مباشر")}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                {t(
                  "Predictive operations, smart dispatching, and dynamic fleet analytics",
                  "تحليلات تنبؤية للأسطول، توزيع الرحلات الذكي، وإدارة المخاطر التشغيلية"
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <IconClose size={17} />
          </button>
        </div>

        {/* Tab selection */}
        <div className="mt-4 flex items-center gap-1 rounded-full bg-surface-3 p-1">
          {[
            { id: "recommendations", label: t("Smart Recommendations", "توصيات التشغيل الحية") },
            { id: "ask", label: t("Natural Language Query", "الاستعلام الذكي") },
            { id: "fleet_analysis", label: t("Predictive Fleet Health", "التحليل التنبؤي") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 rounded-full py-2 text-[12px] font-medium transition-all active:scale-95 text-center",
                activeTab === tab.id
                  ? "bg-brand text-on-brand font-bold shadow-md"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Smart Operational Recommendations */}
        {activeTab === "recommendations" && (
          <div className="mt-5 space-y-3.5">
            {/* Recommendation 1: Dispatch Idle Truck */}
            <div className="rounded-[14px] bg-surface-3 p-4 border border-border-subtle hover:border-brand/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-status-waiting/20 text-status-waiting">
                    <IconTruck size={20} />
                  </span>
                  <div>
                    <span className="text-[10.5px] font-bold text-status-waiting uppercase tracking-wider">
                      {t("Fleet Utilization Optimization", "فرصة رفع استغلال الأسطول")}
                    </span>
                    <h4 className="text-[14px] font-semibold text-text-primary mt-0.5">
                      {t(
                        `3 idle trucks in Riyadh. Assign Volvo FM 460 to pending Buraydah route.`,
                        `توجد ٣ شاحنات متوقفة بالرياض. يوصى بتكليف شاحنة فولفو FM 460 بشحنة بريدة.`
                      )}
                    </h4>
                    <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                      {t(
                        "Payload demand: 18 tons general cargo. Expected revenue impact: +SAR 4,200. Empty running reduced by 85 km.",
                        "حمولة بضائع عامة مطلوبة: ١٨ طناً. العائد التقديري الإضافي: ٤,٢٠٠ ر.س. تقليل حركة الشاحنة الفارغة بمقدار ٨٥ كم."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-border-subtle/60 pt-3">
                <button
                  onClick={() => {
                    setSearchQuery("v6");
                    onClose();
                  }}
                  className="btn-ghost text-[11.5px] py-1.5 px-3"
                >
                  {t("Inspect Truck", "فحص الشاحنة")}
                </button>
                <button
                  onClick={() => {
                    const newTrip = trips[0];
                    if (newTrip && onSelectTrip) onSelectTrip(newTrip.id);
                    onClose();
                  }}
                  className="btn-primary text-[11.5px] py-1.5 px-4"
                >
                  <IconCheck size={14} />
                  {t("Execute Dispatch", "اعتماد التكليف فوراً")}
                </button>
              </div>
            </div>

            {/* Recommendation 2: Delay Risk Mitigation */}
            <div className="rounded-[14px] bg-surface-3 p-4 border border-border-subtle hover:border-brand/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand">
                    <IconBolt size={20} />
                  </span>
                  <div>
                    <span className="text-[10.5px] font-bold text-brand uppercase tracking-wider">
                      {t("Dynamic ETA & Delay Mitigation", "تنبؤ وتفادي تأخير الوصول")}
                    </span>
                    <h4 className="text-[14px] font-semibold text-text-primary mt-0.5">
                      {t(
                        "Trip EZ-10482 on Highway 40 has 22 min buffer. Maintain 88 km/h.",
                        "الرحلة EZ-10482 على طريق ٤٠ تملك فائض ٢٢ دقيقة. حافظ على سرعة ٨٨ كم/س."
                      )}
                    </h4>
                    <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                      {t(
                        "Driver Fahad Al-Qahtani was alerted about temporary bottleneck near Bahrah. Rerouting via Highway 40 bypass saves 14 minutes.",
                        "تم إشعار السائق فهد القحطاني عن نقطة ازدحام عابرة قرب بحرة. الالتفاف عبر طريق الدائري يوفر ١٤ دقيقة."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-border-subtle/60 pt-3">
                <button
                  onClick={() => {
                    selectTrip("trip-1");
                    if (onSelectTrip) onSelectTrip("trip-1");
                    onClose();
                  }}
                  className="btn-primary text-[11.5px] py-1.5 px-4"
                >
                  {t("View Trip on Live Map", "عرض الرحلة على الخريطة")}
                  <IconArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Recommendation 3: Cold Chain Safety Audit */}
            <div className="rounded-[14px] bg-surface-3 p-4 border border-border-subtle">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-status-active/20 text-status-active">
                  <IconCheck size={20} />
                </span>
                <div>
                  <span className="text-[10.5px] font-bold text-status-active uppercase tracking-wider">
                    {t("Cold Chain Certification", "سلامة سلسلة التبريد")}
                  </span>
                  <h4 className="text-[14px] font-semibold text-text-primary mt-0.5">
                    {t(
                      "Reefer Actros EZ-10483 temperature stabilized at -18.5°C.",
                      "حرارة شاحنة المبرّد EZ-10483 مستقرة تماماً عند -18.5°C."
                    )}
                  </h4>
                  <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                    {t(
                      "Continuous telemetry streaming verified. Electronic delivery certificate ready for consignee digital signature upon arrival in Riyadh.",
                      "تم التحقق من استمرار تدفق بيانات الحساسات. شهادة التسليم الإلكترونية جاهزة لتوقيع العميل فور الوصول للرياض."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Natural Language Smart Search & Query */}
        {activeTab === "ask" && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-surface-3 p-2 border border-border-subtle focus-within:border-brand">
              <IconSearch size={18} className="text-text-muted ps-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk(query)}
                placeholder={t(
                  "Ask in Arabic or English: 'Where are Jeddah trucks?', 'Delayed trips'...",
                  "اسأل بالعربية: 'أين شاحنات جدة؟'، 'شاحنات الرياض الشاغرة'..."
                )}
                className="w-full bg-transparent text-[13px] text-text-primary outline-none px-2"
              />
              <button
                onClick={() => handleAsk(query)}
                disabled={isThinking}
                className="btn-primary text-[12px] py-2 px-4 shrink-0"
              >
                {isThinking ? t("Analyzing...", "جارٍ التحليل...") : t("Ask AI", "اسأل الذكاء")}
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div>
              <span className="text-[11px] text-text-muted block mb-2 font-medium">
                {t("Quick Suggested Prompts:", "استعلامات سريعة مقترحة:")}
              </span>
              <div className="flex flex-wrap gap-2">
                {PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(p.ar);
                      handleAsk(p.ar);
                    }}
                    className="chip hover:border-brand/40 text-[11.5px] py-1.5 px-3"
                  >
                    {t(p.en, p.ar)}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Response Display */}
            {customResponse && (
              <div className="animate-fade-up rounded-[16px] bg-brand/10 border border-brand/30 p-4 text-text-primary">
                <div className="flex items-center gap-2 mb-2 font-bold text-brand text-[13px]">
                  <IconBolt size={16} />
                  <span>{t("AI Dispatch Intelligence Answer:", "إجابة المساعد الذكي:")}</span>
                </div>
                <p className="text-[13px] leading-relaxed">{customResponse}</p>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={() => {
                      onClose();
                    }}
                    className="btn-primary text-[11.5px] py-1.5 px-4"
                  >
                    {t("View Filtered Results in Console", "مشاهدة النتائج المفلترة باللوحة")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Predictive Fleet Health & Analytics */}
        {activeTab === "fleet_analysis" && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <span className="text-[10px] text-text-muted block uppercase">
                  {t("Fleet Utilization", "معدل استغلال الأسطول")}
                </span>
                <span className="text-[22px] font-bold text-brand tabular-nums">{avgUtilization}%</span>
                <span className="text-[10.5px] text-status-active block mt-0.5">
                  +4.2% {t("vs last week", "مقارنة بالأسبوع الماضي")}
                </span>
              </div>

              <div className="card p-3 text-center">
                <span className="text-[10px] text-text-muted block uppercase">
                  {t("On-Time Probability", "توقع الالتزام بالمواعيد")}
                </span>
                <span className="text-[22px] font-bold text-status-active tabular-nums">96.8%</span>
                <span className="text-[10.5px] text-text-muted block mt-0.5">
                  {trips.length} {t("active trips tracked", "رحلات مراقبة")}
                </span>
              </div>

              <div className="card p-3 text-center">
                <span className="text-[10px] text-text-muted block uppercase">
                  {t("Reefer Safety Index", "مؤشر سلامة التبريد")}
                </span>
                <span className="text-[22px] font-bold text-text-primary tabular-nums">100%</span>
                <span className="text-[10.5px] text-status-active block mt-0.5">
                  {t("0 temperature deviations", "صفر انحرافات حرارية")}
                </span>
              </div>
            </div>

            <div className="card p-4 space-y-2">
              <span className="text-[12px] font-bold text-text-primary block">
                {t("Active Fleet Summary & AI Assessment", "تقرير الذكاء الاصطناعي الشامل للأسطول")}
              </span>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                {t(
                  `Currently, ${trucks.length} heavy tractor units are managed. ${trips.filter(t => t.status === "on_road").length} are moving smoothly along key corridors (Highway 40, Highway 80, Highway 15, and Highway 65). Average corridor speed is 84 km/h with zero safety violations. Fuel burn is 3.1% below monthly target.`,
                  `يدير النظام حالياً ${trucks.length} شاحنة ثقيلة. منها ${trips.filter(t => t.status === "on_road").length} شاحنات على الطرق السريعة (طريق ٤٠، طريق ٨٠، طريق ١٥، طريق ٦٥). متوسط السرعة ٨٤ كم/س دون أي مخالفات مرورية، واستهلاك الوقود أقل من المستهدف الشهري بـ ٣.١٪.`
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
