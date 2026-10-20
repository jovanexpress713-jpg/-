import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

const router = Router();

// Allowed models as specified by requirements
export const ALLOWED_MODELS = {
  COMPLEX: "gemini-4-argon",
  GENERAL: "gemini-3.8-flash",
  FAST: "gemini-3.1-flash-lite",
} as const;

export type SupportedModel = (typeof ALLOWED_MODELS)[keyof typeof ALLOWED_MODELS];

export const SYSTEM_ROLE_INSTRUCTIONS: Record<string, string> = {
  dispatcher: `أنت "مرحّل العمليات ومراقب الأسطول" في منصة مؤسسة إيجاز للنقليات (EJAZ Transport) في المملكة العربية السعودية.
مهمتك:
- إدارة وتتبع أسطول الشاحنات الثقيلة (سطحة، براد، جاف، ستارة) عبر جميع مسارات ومدن المملكة (الرياض، جدة، الدمام، القصيم، مكة، المدينة، أبها، الجبيل وغيرها).
- التعامل مع تنبيهات التأخير، درجات حرارة شاحنات البراد الحساسة، أعطال المركبات، وإعادة توجيه المسارات فورياً.
- التنسيق المحترف مع السائقين والعملاء بأسلوب رسمي وواضح ومختصر باللغة العربية مع دعم المصطلحات الإنجليزية عند الحاجة.
- تقديم إرشادات دقيقة خطوة بخطوة لكل عملية تشغيلية.`,

  optimizer: `أنت "خبير اللوجستيات وتحسين المسارات المعقدة" في مؤسسة إيجاز للنقليات (EJAZ Transport).
مهمتك:
- تحليل المسارات البرية الكبرى وسيناريوهات التوزيع المعقدة بين موانئ ومستودعات ومصانع المملكة.
- تحسين نسب استغلال الحمولة (Payload Utilisation) وكفاءة استهلاك الوقود.
- وضع خطط بديلة في حالات الازدحام أو الإغلاقات أو الأعطال الميدانية لشاحنات الـ 32 طن والـ 25 طن.
- تقديم تحليلات رياضية ولوجستية عميقة مبنية على المعطيات الميدانية والواقع التشغيلي.`,

  field: `أنت "المساعد الميداني السريع" للسائقين ومشرفي النقل في مؤسسة إيجاز للنقليات (EJAZ Transport).
مهمتك:
- تقديم إجابات فورية وموجزة ومباشرة لخدمة السائقين على الطريق.
- المساعدة في متطلبات بوالص الشحن (BOL)، أكواد تسليم البضائع (POD)، أختام التخليص، وقراءات الحساسات.
- الرد السريع بإجراءات موجزة ومحددة لتوفير الوقت على السائق أثناء القيادة والتفريغ.`,

  finance: `أنت "مستشار التعرفة والحسابات المالية" في مؤسسة إيجاز للنقليات (EJAZ Transport).
مهمتك:
- مطابقة أسعار الرحلات مع دفتر التعرفة المعتمد حسب نوع الشاحنة (سطحة، براد، جاف، ستارة) والمسافة المقطوعة (كم).
- تدقيق حسابات الرحلات، تكاليف السائقين، الفواتير، ومطالبات الأضرار أو التلفيات.
- تقديم توضيحات تسعير دقيقة وشفافة بالريال السعودي (SAR).`,
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

interface ChatMessageInput {
  role: "user" | "model" | "assistant" | "system";
  text: string;
}

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      model = ALLOWED_MODELS.GENERAL,
      agentRole = "dispatcher",
      customSystemInstruction,
      operationalContext,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "يجب تقديم مصفوفة رسائل صالحة للمحادثة.",
        code: "INVALID_MESSAGES",
      });
    }

    // Determine model
    let selectedModel = model;
    if (model === "gemini-4-argon" || model === "complex") {
      selectedModel = ALLOWED_MODELS.COMPLEX;
    } else if (model === "gemini-3.1-flash-lite" || model === "fast") {
      selectedModel = ALLOWED_MODELS.FAST;
    } else if (model === "gemini-3.8-flash" || model === "general") {
      selectedModel = ALLOWED_MODELS.GENERAL;
    }

    // Build system instruction
    const baseInstruction =
      customSystemInstruction ||
      SYSTEM_ROLE_INSTRUCTIONS[agentRole] ||
      SYSTEM_ROLE_INSTRUCTIONS.dispatcher;

    const fullSystemInstruction = operationalContext
      ? `${baseInstruction}\n\n[السياق التشغيلي اللحظي للأسطول]:\n${typeof operationalContext === "string" ? operationalContext : JSON.stringify(operationalContext, null, 2)}`
      : baseInstruction;

    const ai = getGeminiClient();

    if (!ai) {
      // Fallback response with informative guidance when API key is pending
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.text || "";
      return res.json({
        text: `[مساعد إيجاز الذكي (${selectedModel})]\n\nتم استقبال استفسارك: "${lastUserMsg}"\n\nنظام المحادثة جاهز. يرجى التأكد من تهيئة مفتاح GEMINI_API_KEY للاستفادة الكاملة من قدرات نموذج ${selectedModel}.`,
        modelUsed: selectedModel,
        agentRole,
        persisted: true,
      });
    }

    // Format messages for @google/genai contents
    // Converts input format to contents array where role is 'user' | 'model'
    const contents = messages
      .filter((m: ChatMessageInput) => m.text && m.text.trim().length > 0)
      .map((m: ChatMessageInput) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

    if (contents.length === 0) {
      return res.status(400).json({ error: "لا توجد رسالة صالحة للإرسال." });
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction: fullSystemInstruction,
      },
    });

    const replyText = response.text || "تمت معالجة الطلب بنجاح.";

    return res.json({
      text: replyText,
      modelUsed: selectedModel,
      agentRole,
      persisted: true,
    });
  } catch (error: any) {
    console.error("[Gemini Chat Route Error]:", error);
    const errorMessage = error?.message || "تعذّر الاتصال بنموذج Gemini الذكي.";
    return res.status(500).json({
      error: errorMessage,
      code: "GEMINI_ERROR",
    });
  }
});

// Provide list of available roles and models
router.get("/config", (_req: Request, res: Response) => {
  res.json({
    models: [
      {
        id: ALLOWED_MODELS.COMPLEX,
        name: "Gemini 4 Argon",
        tag: "Complex Tasks",
        tagAr: "للمهام والتحليلات المعقدة",
        description: "أعلى دقة منطقية واستدلالية للمسارات الصعبة والخطط التشغيلية",
      },
      {
        id: ALLOWED_MODELS.GENERAL,
        name: "Gemini 3.8 Flash",
        tag: "General Tasks",
        tagAr: "عام وافتراضي",
        description: "متوازن وعالي الكفاءة لمتابعة الأسطول والعمليات اليومية",
      },
      {
        id: ALLOWED_MODELS.FAST,
        name: "Gemini 3.1 Flash Lite",
        tag: "Fast Tasks",
        tagAr: "فائق السرعة للميدان",
        description: "استجابة فورية فائقة السرعة للمعلومات الميدانية وبوالص الشحن",
      },
    ],
    roles: [
      { id: "dispatcher", nameAr: "مرحّل العمليات والأسطول", nameEn: "Fleet Dispatcher", recommendedModel: ALLOWED_MODELS.GENERAL },
      { id: "optimizer", nameAr: "مهندس المسارات والتحليل المعقد", nameEn: "Route & Logistics Optimizer", recommendedModel: ALLOWED_MODELS.COMPLEX },
      { id: "field", nameAr: "المساعد الميداني السريع", nameEn: "Fast Field Assistant", recommendedModel: ALLOWED_MODELS.FAST },
      { id: "finance", nameAr: "مستشار التعرفة والمالية", nameEn: "Tariff & Finance Specialist", recommendedModel: ALLOWED_MODELS.GENERAL },
    ],
  });
});

export default router;
