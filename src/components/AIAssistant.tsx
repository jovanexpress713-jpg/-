import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import type { SessionUser } from "../utils/permissions";
import { apiClient } from "../services/apiClient";
import {
  saveChatMessageToFirestore,
  loadChatMessagesFromFirestore,
  clearChatMessagesFromFirestore,
} from "../services/cloudStore";
import { useToast } from "./Toast";
import {
  IconBolt,
  IconClose,
  IconTruck,
  IconSparkles,
  IconCheck,
} from "./Icons";

export interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  /** Signed-in user; drives the permission scope and Firestore conversation storage. */
  user?: SessionUser | null;
  /** Current console section (or "mobile"). */
  page?: string;
  /** Console persona being previewed: admin | driver | shipper | owner. */
  persona?: string;
  onSelectTrip?: (tripId: string) => void;
}

export type GeminiModelId = "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.1-flash-lite";

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  modelUsed?: string;
  agentRole?: string;
  timestamp: string;
}

interface RoleDefinition {
  id: string;
  titleAr: string;
  titleEn: string;
  titleUr: string;
  recommendedModel: GeminiModelId;
  descAr: string;
  descEn: string;
  descUr: string;
}

const ROLES: RoleDefinition[] = [
  {
    id: "dispatcher",
    titleAr: "مرحّل العمليات والأسطول",
    titleEn: "Fleet Operations Dispatcher",
    titleUr: "آپریشنز اور فلیٹ ڈسپیچر",
    recommendedModel: "gemini-3.8-flash",
    descAr: "تتبع الرحلات المباشر، معالجة التأخيرات، والتنسيق الفوري بين السائقين والعملاء",
    descEn: "Live trip tracking, delay resolutions, and driver-customer coordination",
    descUr: "براہ راست ٹرپ ٹریکنگ، تاخیر کا حل، اور ڈرائیور و کسٹمر رابطہ کاری",
  },
  {
    id: "optimizer",
    titleAr: "خبير المسارات والتحليل المعقد",
    titleEn: "Complex Route & Logistics Optimizer",
    titleUr: "پیچیدہ روٹ اور لاجسٹکس ماہر",
    recommendedModel: "gemini-4-argon",
    descAr: "مهام استدلالية معقدة، تخطيط المسارات الكبرى، وتحسين كفاءة الحمولة والوقود",
    descEn: "Advanced reasoning, macro-corridor routing, payload and fuel yield optimization",
    descUr: "پیچیدہ روٹ پلاننگ، کارگو اور ایندھن کی کارکردگی کی بہتری",
  },
  {
    id: "field",
    titleAr: "المساعد الميداني السريع",
    titleEn: "Instant Field & Driver Assistant",
    titleUr: "فوری فیلڈ اور ڈرائیور معاون",
    recommendedModel: "gemini-3.1-flash-lite",
    descAr: "إجابات فورية موجزة لبوالص الشحن، أكواد التسليم POD، وفحص درجات الحرارة",
    descEn: "Rapid answers for BOLs, delivery confirmation codes, and quick telemetry",
    descUr: "بلٹی، ڈلیوری کوڈز اور ٹیلی میٹری کے فوری جوابات",
  },
  {
    id: "finance",
    titleAr: "مستشار التعرفة والمالية",
    titleEn: "Tariff & Financial Specialist",
    titleUr: "ٹیرف اور مالیاتی مشیر",
    recommendedModel: "gemini-3.8-flash",
    descAr: "حساب تكلفة الكيلومتر، تدقيق أسعار الرحلات، ومطابقة دفتر التعرفة الرسمي",
    descEn: "Corridor pricing audits, driver settlements, and tariff rate validation",
    descUr: "فی کلومیٹر لاگت، ٹرپ کے حسابات اور سرکاری ٹیرف کی توثیق",
  },
];

const MODELS: Array<{
  id: GeminiModelId;
  label: string;
  labelAr: string;
  labelUr: string;
  badge: string;
  badgeAr: string;
  badgeUr: string;
  desc: string;
  tone: string;
}> = [
  {
    id: "gemini-4-argon",
    label: "Gemini 4 Argon",
    labelAr: "آرجون ٤ المتقدم",
    labelUr: "آرجون 4 ایڈوانسڈ",
    badge: "Complex Tasks",
    badgeAr: "مهام معقدة",
    badgeUr: "پیچیدہ کام",
    desc: "أعلى قدرة منطقية واستدلالية للمسارات الصعبة والتخطيط التشغيلي",
    tone: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    labelAr: "فلاش ٣.٨ العام",
    labelUr: "فلیش 3.8 جنرل",
    badge: "General Tasks",
    badgeAr: "عام وافتراضي",
    badgeUr: "عمومی کام",
    desc: "متوازن وفائق الأداء لمتابعة الأسطول والعمليات اللوجستية اليومية",
    tone: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    labelAr: "فلاش لايت ٣.١ السريع",
    labelUr: "فلیش لائٹ 3.1 تیز",
    badge: "Fast Tasks",
    badgeAr: "فائق السرعة",
    badgeUr: "انتہائی تیز",
    desc: "استجابة فائقة السرعة للمعلومات الفورية والأكواد الميدانية",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
];

export function AIAssistant({
  isOpen,
  onClose,
  user = null,
  page = "overview",
  persona = "admin",
  onSelectTrip: _onSelectTrip,
}: AIAssistantProps) {
  const { t, tk, lang } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, alerts } = useFleetStore();

  const [activeRole, setActiveRole] = useState<string>("dispatcher");
  const [activeModel, setActiveModel] = useState<GeminiModelId>("gemini-3.8-flash");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Conversation thread
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Firestore thread id
  const conversationId = useMemo(
    () => `conv-${activeRole}-${user?.id || "guest"}`,
    [activeRole, user?.id]
  );

  const getRoleTitle = (roleId: string) => {
    const r = ROLES.find((item) => item.id === roleId);
    if (!r) return "";
    if (lang === "ar") return r.titleAr;
    if (lang === "ur") return r.titleUr;
    return r.titleEn;
  };

  const getRoleDesc = (roleId: string) => {
    const r = ROLES.find((item) => item.id === roleId);
    if (!r) return "";
    if (lang === "ar") return r.descAr;
    if (lang === "ur") return r.descUr;
    return r.descEn;
  };

  const getModelLabel = (modelId: string) => {
    const m = MODELS.find((item) => item.id === modelId);
    if (!m) return "";
    if (lang === "ar") return m.labelAr;
    if (lang === "ur") return m.labelUr;
    return m.label;
  };

  const getModelBadge = (modelId: string) => {
    const m = MODELS.find((item) => item.id === modelId);
    if (!m) return "";
    if (lang === "ar") return m.badgeAr;
    if (lang === "ur") return m.badgeUr;
    return m.badge;
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    } catch {
      return "";
    }
  };

  // When role changes, automatically suggest recommended model
  const handleRoleChange = (roleId: string) => {
    setActiveRole(roleId);
    const roleDef = ROLES.find((r) => r.id === roleId);
    if (roleDef) {
      setActiveModel(roleDef.recommendedModel);
    }
  };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load past conversation from Firestore or seed greeting
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const loadHistory = async () => {
      const uid = user?.id || "anonymous-user";
      try {
        const stored = await loadChatMessagesFromFirestore(uid, conversationId);
        if (active && stored && stored.length > 0) {
          setMessages(
            stored.map((m) => ({
              id: m.id || `msg-${Date.now()}`,
              role: m.role,
              text: m.text,
              modelUsed: m.modelUsed,
              agentRole: m.agentRole,
              timestamp: m.createdAt || new Date().toISOString(),
            }))
          );
          return;
        }
      } catch {
        /* proceed with local greeting */
      }

      if (active) {
        // Seed default welcoming message based on role and active language
        const roleDef = ROLES.find((r) => r.id === activeRole);
        const welcomeText =
          lang === "ar"
            ? `مرحباً بك في مركز الذكاء الاصطناعي لمؤسسة إيجاز للنقليات. أنا دوري الحالي: "${roleDef?.titleAr}".\n\nكيف يمكنني مساعدتك اليوم في تتبع الشاحنات، تحسين مسارات الرحلات، أو إدارة العمليات الميدانية؟`
            : lang === "ur"
              ? `ایجاز ٹرانسپورٹ کے مصنوعی ذہانت کے مرکز میں خوش آمدید۔ میرا موجودہ کردار: "${roleDef?.titleUr}".\n\nآج میں ٹرکوں کی ٹریکنگ، راستوں کی بہتری، یا فیلڈ آپریشنز میں آپ کی کیا مدد کر سکتا ہوں؟`
              : `Welcome to EJAZ Transport AI Operations. Current role: "${roleDef?.titleEn}".\n\nHow can I assist you with heavy fleet tracking, route optimization, or field operations today?`;

        setMessages([
          {
            id: `welcome-${activeRole}`,
            role: "model",
            text: welcomeText,
            modelUsed: activeModel,
            agentRole: activeRole,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [isOpen, activeRole, conversationId, user?.id, lang, activeModel]);

  // Keyboard shortcut ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Real operational context summary injected into the system prompt
  const operationalContext = {
    platform: "مؤسسة إيجاز للنقليات (EJAZ Transport)",
    user: {
      name: user?.fullName || "مشغل العمليات",
      role: user?.role || persona,
    },
    activeConsolePage: page,
    fleetSummary: {
      totalTrucks: trucks.length,
      activeTrucks: trucks.filter((t) => t.status === "active").length,
      totalDrivers: drivers.length,
      inTransitTrips: trips.filter((tr) => tr.status === "on_road").length,
      unresolvedAlerts: alerts.filter((a) => !a.resolved).length,
    },
    approvedTruckCategories: ["سطحة (Flatbed)", "براد (Refrigerated)", "جاف (Dry Van)", "ستارة (Curtainsider)"],
  };

  // Send message to Gemini via server API
  const handleSendMessage = async (textToSend?: string) => {
    const raw = textToSend !== undefined ? textToSend : inputText;
    const clean = raw.trim();
    if (!clean || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      text: clean,
      modelUsed: activeModel,
      agentRole: activeRole,
      timestamp: new Date().toISOString(),
    };

    const nextThread = [...messages, userMessage];
    setMessages(nextThread);
    setInputText("");
    setIsSending(true);

    const uid = user?.id || "anonymous-user";

    // Persist user message to Firestore
    void saveChatMessageToFirestore({
      id: userMessage.id,
      conversationId,
      userId: uid,
      role: "user",
      text: userMessage.text,
      modelUsed: activeModel,
      agentRole: activeRole,
      createdAt: userMessage.timestamp,
    }).catch(() => {});

    try {
      // Build multi-turn messages array
      const apiMessages = nextThread.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await apiClient.gemini.chat({
        messages: apiMessages,
        model: activeModel,
        agentRole: activeRole,
        operationalContext,
      });

      const modelMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "model",
        text: res.text,
        modelUsed: res.modelUsed || activeModel,
        agentRole: res.agentRole || activeRole,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, modelMessage]);

      // Persist model response to Firestore
      void saveChatMessageToFirestore({
        id: modelMessage.id,
        conversationId,
        userId: uid,
        role: "model",
        text: modelMessage.text,
        modelUsed: modelMessage.modelUsed,
        agentRole: modelMessage.agentRole,
        createdAt: modelMessage.timestamp,
      }).catch(() => {});
    } catch (error: any) {
      console.error("Gemini Assistant Error:", error);
      const fallbackText =
        lang === "ar"
          ? `تعذّر إكمال الاستجابة من نموذج ${activeModel}: ${error?.message || "يرجى التحقق من اتصال الخادم ومفتاح GEMINI_API_KEY."}`
          : lang === "ur"
            ? `ماڈل سے جواب حاصل نہیں ہو سکا: ${error?.message || "براہ کرم سرور کنکشن چیک کریں۔"}`
            : `Failed to complete request with ${activeModel}: ${error?.message || "Please verify server connectivity and GEMINI_API_KEY."}`;

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "model",
          text: fallbackText,
          modelUsed: activeModel,
          agentRole: activeRole,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    const uid = user?.id || "anonymous-user";
    try {
      await clearChatMessagesFromFirestore(uid, conversationId);
    } catch {
      /* ignore */
    }

    const roleDef = ROLES.find((r) => r.id === activeRole);
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: "model",
        text:
          lang === "ar"
            ? `تم مسح سجل المحادثة. أنا جاهز بصفتي: "${roleDef?.titleAr}". تفضل بطرح سؤالك.`
            : lang === "ur"
              ? `گفتگو کا ریکارڈ صاف کر دیا گیا ہے۔ میں "${roleDef?.titleUr}" کی حیثیت سے تیار ہوں۔ اپنا سوال پوچھیں۔`
              : `Conversation thread cleared. Operating as "${roleDef?.titleEn}". Please ask your question.`,
        modelUsed: activeModel,
        agentRole: activeRole,
        timestamp: new Date().toISOString(),
      },
    ]);

    toast(
      t("Chat thread cleared", "تم مسح المحادثة بنجاح", "گفتگو صاف کر دی گئی ہے"),
      t("Ready for fresh conversation", "تمت تهيئة سجل الرسائل الجديد", "نئی گفتگو کے لیے تیار")
    );
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick suggestion prompts
  const suggestions = [
    {
      label: t("Analyze Riyadh - Jeddah Corridor", "حلل مسار الرياض - جدة", "ریاض - جدہ کوریڈور کا تجزیہ"),
      prompt: t(
        "Analyze Riyadh to Jeddah corridor for a 25-ton curtainsider, suggest optimal rest stops and operational speed.",
        "حلل لي مسار الرياض إلى جدة لشاحنة ستارة 25 طن، واقترح نقاط التوقف الأمثل وأفضل سرعة تشغيلية.",
        "25 ٹن کرٹین سائیڈر کے لیے ریاض تا جدہ روٹ کا تجزیہ کریں، بہترین آرام گاہیں اور رفتار تجویز کریں۔"
      ),
      role: "optimizer",
      model: "gemini-4-argon" as const,
    },
    {
      label: t("Reefer Telemetry & Temp Alerts", "حالة شاحنات البراد وتنبيهات الحرارة", "ریفریجریٹڈ ٹرک اور درجہ حرارت الرٹس"),
      prompt: t(
        "Which reefer trucks are currently active? What are the latest cold-chain temperature readings?",
        "ما هي شاحنات البراد التي تعمل حالياً؟ وما هي أحدث قراءات درجات الحرارة لضمان سلامة سلسلة التبريد؟",
        "اس وقت کون سے ریفر ٹرکس فعال ہیں؟ کولڈ چین کے تازہ ترین درجہ حرارت کیا ہیں؟"
      ),
      role: "dispatcher",
      model: "gemini-3.8-flash" as const,
    },
    {
      label: t("POD Delivery Code Procedures", "إجراءات كود التسليم POD", "ڈلیوری تصدیقی طریقہ کار"),
      prompt: t(
        "What are the immediate field requirements for confirming port delivery and receiving a verified POD code?",
        "ما هي المتطلبات الفورية الميدانية لتأكيد تسليم شحنة في الميناء والحصول على كود POD المعتمد؟",
        "بندرگاہ پر ترسیل کی تصدیق اور تصدیقی کوڈ حاصل کرنے کے فوری فیلڈ تقاضے کیا ہیں؟"
      ),
      role: "field",
      model: "gemini-3.1-flash-lite" as const,
    },
    {
      label: t("Calculate Dammam - Qassim Trip Cost", "حساب تكلفة رحلة الدمام - القصيم", "دمام تا قسیم ٹرپ لاگت کا حساب"),
      prompt: t(
        "Calculate the price of a 32-ton flatbed truck from Dammam to Qassim according to the official EJAZ tariff rate card.",
        "احسب لي تكلفة شاحنة سطحة 32 طن من الدمام إلى القصيم وفق دفتر التعرفة المعتمد لمؤسسة إيجاز.",
        "سرکاری ٹیرف کے مطابق دمام سے قسیم تک 32 ٹن فلیٹ بیڈ ٹرک کی قیمت کا حساب لگائیں۔"
      ),
      role: "finance",
      model: "gemini-3.8-flash" as const,
    },
  ];

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[85] grid place-items-center bg-black/80 p-2 backdrop-blur-md sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="مساعد إيجاز الذكي عبر Gemini"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-card border border-border-strong bg-[#060e1d] shadow-2xl"
      >
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#09152b] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-gradient-to-tr from-brand to-orange-400 text-on-brand shadow-md">
              <IconSparkles size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-card-title font-extrabold text-white">
                  {tk("assistant.title")}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-micro font-bold text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse" />
                  {t("Multi-Turn Dispatcher", "ذكاء متعدد الجولات", "کثیر الجولاتی ذہانت")}
                </span>
              </div>
              <p className="truncate text-micro text-text-muted">
                {t("Heavy fleet intelligence powered by AI", "ذكاء متطور لأسطول الشاحنات الثقيلة", "بھاری فلیٹ کے لیے جدید ذہانت")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearHistory}
              title={t("Clear thread", "مسح المحادثة", "گفتگو صاف کریں")}
              className="rounded-inner border border-white/10 bg-surface-2/60 px-2.5 py-1 text-micro font-bold text-text-secondary hover:bg-surface-3 hover:text-white transition-colors"
            >
              {t("Clear", "مسح المحادثة", "صاف کریں")}
            </button>
            <button
              onClick={onClose}
              className="btn-icon shrink-0 rounded-inner text-text-muted hover:text-white hover:bg-surface-3"
              aria-label={tk("common.close")}
            >
              <IconClose size={17} />
            </button>
          </div>
        </div>

        {/* Roles Tabs Bar */}
        <div className="shrink-0 border-b border-white/10 bg-[#081326] px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-micro text-text-muted">
            <span className="font-bold uppercase tracking-wider">{t("Select Agent Role:", "اختر دور المساعد:", "کردار منتخب کریں:")}</span>
            <span className="text-brand font-semibold">
              {getRoleDesc(activeRole)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((role) => {
              const isSelected = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChange(role.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-inner px-2.5 py-1.5 text-label font-bold transition-all",
                    isSelected
                      ? "bg-brand text-on-brand shadow-md scale-101"
                      : "bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-white border border-white/5"
                  )}
                >
                  <IconTruck size={13} className="shrink-0" />
                  <span>{getRoleTitle(role.id)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selector Bar */}
        <div className="shrink-0 border-b border-white/10 bg-[#060e1d] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-micro font-bold text-text-muted uppercase tracking-wider">
              {t("Model Engine:", "محرك النموذج:", "ماڈل انجن:")}
            </span>
            <div className="flex flex-wrap gap-1">
              {MODELS.map((m) => {
                const isSelected = activeModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModel(m.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-micro font-bold transition-all border",
                      isSelected
                        ? "border-brand bg-brand/20 text-brand shadow-sm font-extrabold"
                        : "border-white/10 bg-surface-2/60 text-text-muted hover:text-white"
                    )}
                    title={m.desc}
                  >
                    <span>{getModelLabel(m.id)}</span>
                    <span className={cn("rounded-full px-1.5 py-0.2 text-micro", m.tone)}>
                      {getModelBadge(m.id)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-micro text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-active" />
            <span>{t("Firestore Persistence Active", "حفظ المحادثة نشط", "محفوظ شدہ گفتگو فعال")}</span>
          </div>
        </div>

        {/* Messages Thread (Scrollable) */}
        <div className="scroll-thin flex-1 space-y-3.5 overflow-y-auto p-4">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
              >
                <div className="mb-1 flex items-center gap-2 text-micro text-text-muted">
                  {!isUser ? (
                    <>
                      <span className="flex items-center gap-1 font-bold text-brand">
                        <IconSparkles size={11} />
                        {getRoleTitle(msg.agentRole || activeRole)}
                      </span>
                      {msg.modelUsed && (
                        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-micro text-text-secondary border border-white/5">
                          {getModelLabel(msg.modelUsed) || msg.modelUsed}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-bold text-text-secondary">
                      {user?.fullName || t("You", "أنت", "آپ")}
                    </span>
                  )}
                  <span>
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={cn(
                    "group relative max-w-[88%] rounded-card px-4 py-3 text-body leading-relaxed shadow-sm",
                    isUser
                      ? "bg-brand text-on-brand font-medium rounded-ee-micro"
                      : "bg-[#0c1a33] text-text-primary border border-white/10 rounded-es-micro"
                  )}
                >
                  <div className="whitespace-pre-wrap select-text">{msg.text}</div>

                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="absolute end-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-surface-3/80 p-1 text-text-muted hover:text-white"
                      title={t("Copy text", "نسخ النص", "متن نقل کریں")}
                    >
                      {copiedId === msg.id ? <IconCheck size={12} className="text-status-active" /> : <IconBolt size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex flex-col items-start animate-fade-in">
              <div className="mb-1 flex items-center gap-1.5 text-micro text-text-muted">
                <span className="font-bold text-brand">
                  {getModelLabel(activeModel)}
                </span>
                <span>{t("is thinking…", "يقوم بالتحليل والتفكير اللوجستي…", "تجزیہ جاری ہے…")}</span>
              </div>
              <div className="flex items-center gap-2 rounded-card rounded-es-micro border border-white/10 bg-[#0c1a33] px-4 py-3 text-brand">
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" style={{ animationDelay: "200ms" }} />
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" style={{ animationDelay: "400ms" }} />
                <span className="text-label font-bold ms-1 text-text-secondary">
                  {activeModel === "gemini-4-argon"
                    ? t("Deep Reasoning (Argon)…", "استدلال منطقي عميق…", "گہرا منطقی تجزیہ…")
                    : activeModel === "gemini-3.1-flash-lite"
                      ? t("Fast Retrieval…", "معالجة فائقة السرعة…", "فوری رسپانس…")
                      : t("Processing response…", "معالجة الرد والتحليل اللحظي…", "جواب تیار کیا جا رہا ہے…")}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="shrink-0 border-t border-white/5 bg-[#081326] px-3 py-2">
          <div className="mb-1 text-micro font-bold text-text-muted">
            {t("Suggested logistics queries:", "استفسارات مقترحة للمتابعة والتحليل:", "تجویز کردہ سوالات:")}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveRole(s.role);
                  setActiveModel(s.model);
                  void handleSendMessage(s.prompt);
                }}
                className="chip shrink-0 text-micro py-1 px-2.5 border border-white/10 hover:border-brand/50 text-text-secondary hover:text-white transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="shrink-0 border-t border-white/10 bg-[#09152b] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-center gap-2 rounded-card border border-white/15 bg-surface-2 px-3 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-inner"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeModel === "gemini-4-argon"
                  ? t("Ask a complex logistics or optimization problem…", "اطرح مسألة لوجستية أو تحليلاً معقداً…", "پیچیدہ لاجسٹکس یا روٹ اصلاح کا سوال پوچھیں…")
                  : activeModel === "gemini-3.1-flash-lite"
                    ? t("Quick query for instant response…", "استفسار سريع للاستجابة الفورية…", "فوری جواب کے لیے سوال لکھیں…")
                    : t("Type your message to EJAZ Assistant…", "اكتب استفسارك لمساعد إيجاز الذكي…", "ایجاز معاون کے لیے اپنا سوال لکھیں…")
              }
              disabled={isSending}
              className="flex-1 bg-transparent text-body text-white placeholder-text-muted outline-none"
            />

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="flex items-center gap-1.5 rounded-inner bg-brand px-4 py-2 text-label-lg font-bold text-on-brand shadow-md transition-all hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
            >
              <IconSparkles size={14} />
              <span>{isSending ? t("Thinking…", "جارٍ التحليل…", "سوچ جاری ہے…") : t("Send", "إرسال", "بھیجیں")}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
