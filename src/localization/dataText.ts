/**
 * Data-layer text localisation (§6, §8, §9).
 *
 * The operational records — trips, alerts, chat messages, timeline events — are
 * authored in Arabic because Arabic is the canonical ledger language. The UI
 * chrome is translated through the dictionary, but a value like the alert
 * timestamp «منذ ٢٥ دقيقة» or the city «الرياض» is *data*, so it used to survive
 * untranslated into an English or Urdu session.
 *
 * `localizeDataText` closes that gap: it converts the numerals, translates the
 * time/date idioms, the Saudi city and facility names and the operational
 * vocabulary, and returns English or Urdu text. It never invents a translation
 * for an unknown sentence — an unmatched value is returned numerals-normalised
 * rather than machine-garbled.
 */

export type DataLang = "ar" | "en" | "ur";

/* ── Numerals ─────────────────────────────────────────────────────────────── */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** ٠٨:٠٠ → 08:00 · ۱۲ → 12 (Arabic-Indic and extended-Indic digits). */
export function westernDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : EXTENDED_INDIC.indexOf(d));
  });
}

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/** Saudi cities and the facilities the fleet actually names. */
const PLACES: Record<string, { en: string; ur: string }> = {
  "الرياض": { en: "Riyadh", ur: "ریاض" },
  "جدة": { en: "Jeddah", ur: "جدہ" },
  "الدمام": { en: "Dammam", ur: "دمام" },
  "مكة المكرمة": { en: "Makkah", ur: "مکہ" },
  "مكة": { en: "Makkah", ur: "مکہ" },
  "المدينة المنورة": { en: "Madinah", ur: "مدینہ" },
  "المدينة": { en: "Madinah", ur: "مدینہ" },
  "الجبيل": { en: "Jubail", ur: "جبیل" },
  "تبوك": { en: "Tabuk", ur: "تبوک" },
  "الطائف": { en: "Taif", ur: "طائف" },
  "أبها": { en: "Abha", ur: "ابھا" },
  "نيوم": { en: "NEOM", ur: "نیوم" },
  "حائل": { en: "Hail", ur: "حائل" },
  "بريدة": { en: "Buraydah", ur: "بریدہ" },
  "ينبع": { en: "Yanbu", ur: "ینبع" },
  "الهفوف": { en: "Hofuf", ur: "ہفوف" },
  "الأحساء": { en: "Al Ahsa", ur: "الاحساء" },
  "خميس مشيط": { en: "Khamis Mushait", ur: "خمیس مشیط" },
  "القويعية": { en: "Al Quwayiyah", ur: "القویعیہ" },
  "ظلم": { en: "Zalim", ur: "ظلم" },
  "الدائري": { en: "the Ring Road", ur: "رنگ روڈ" },
  "طريق ٤٠": { en: "Highway 40", ur: "ہائی وے 40" },
  "طريق ٤٠ السريع": { en: "Highway 40", ur: "ہائی وے 40" },
  "مستودع الرياض المركزي": { en: "Riyadh Central Warehouse", ur: "ریاض مرکزی گودام" },
  "ميناء جدة الإسلامي": { en: "Jeddah Islamic Port", ur: "جدہ اسلامی بندرگاہ" },
  "الميناء الجاف": { en: "the dry port", ur: "خشک بندرگاہ" },
  "مدينة الجبيل الصناعية": { en: "Jubail Industrial City", ur: "جبیل صنعتی شہر" },
  "مصفاة الجبيل": { en: "Jubail refinery", ur: "جبیل ریفائنری" },
  "مصنع سدافكو": { en: "SADAFCO plant", ur: "سدافکو فیکٹری" },
  "محطة تبريد الهفوف": { en: "Hofuf cooling station", ur: "ہفوف کولنگ اسٹیشن" },
  "استراحة ظلم": { en: "Zalim rest stop", ur: "ظلم آرام گاہ" },
  "مركز الفحص الدوري": { en: "periodic inspection centre", ur: "متواتر معائنہ مرکز" },
  "الورشة": { en: "the workshop", ur: "ورکشاپ" },
};

/** Operational vocabulary that appears inside data sentences. */
const TERMS: Record<string, { en: string; ur: string }> = {
  "الشاحنة": { en: "the truck", ur: "ٹرک" },
  "شاحنة": { en: "a truck", ur: "ٹرک" },
  "الرحلة": { en: "the trip", ur: "ٹرپ" },
  "الرحلات": { en: "trips", ur: "ٹرپس" },
  "الشحنة": { en: "the shipment", ur: "کھیپ" },
  "الشحنات": { en: "shipments", ur: "کھیپ" },
  "السائق": { en: "the driver", ur: "ڈرائیور" },
  "العميل": { en: "the client", ur: "کلائنٹ" },
  "المستودع": { en: "the warehouse", ur: "گودام" },
  "التسليم": { en: "delivery", ur: "ترسیل" },
  "وصلت": { en: "arrived", ur: "پہنچ گیا" },
  "مستودع": { en: "warehouse", ur: "گودام" },
  "إلى": { en: "to", ur: "کو" },
  "من": { en: "from", ur: "سے" },
  "في": { en: "at", ur: "میں" },
  "على": { en: "on", ur: "پر" },
  "مع": { en: "with", ur: "کے ساتھ" },
  "تم": { en: "done", ur: "مکمل" },
  "بدء": { en: "start of", ur: "آغاز" },
  "بداية": { en: "start", ur: "آغاز" },
  "نهاية": { en: "end", ur: "اختتام" },
  "الموقع": { en: "the site", ur: "مقام" },
  "الطلب": { en: "the request", ur: "درخواست" },
  "الآن": { en: "now", ur: "ابھی" },
  "بنجاح": { en: "successfully", ur: "کامیابی سے" },
  "و": { en: "and", ur: "اور" },
  "انطلقت": { en: "departed", ur: "روانہ ہوا" },
  "تأخير": { en: "delay", ur: "تاخیر" },
  "تأخرت": { en: "is delayed", ur: "تاخیر کا شکار" },
  "اكتمل": { en: "completed", ur: "مکمل" },
  "اكتمال": { en: "completion", ur: "تکمیل" },
  "التحميل": { en: "loading", ur: "لوڈنگ" },
  "التفريغ": { en: "unloading", ur: "اتارنے" },
  "الحرارة": { en: "temperature", ur: "درجہ حرارت" },
  "درجة حرارة الصندوق": { en: "box temperature", ur: "باکس کا درجہ حرارت" },
  "الصندوق": { en: "the box", ur: "باکس" },
  "الصهريج": { en: "the tanker", ur: "ٹینکر" },
  "القلاب": { en: "the tipper", ur: "ڈمپر" },
  "السطحة": { en: "the flatbed", ur: "فلیٹ بیڈ" },
  "البراد": { en: "the reefer", ur: "ریفریجریٹر" },
  "ستارة": { en: "curtain", ur: "پردہ" },
  "أسمنت": { en: "cement", ur: "سیمنٹ" },
  "حديد": { en: "steel", ur: "اسٹیل" },
  "مواد خطرة": { en: "hazardous materials", ur: "خطرناک مواد" },
  "شهادة": { en: "certificate", ur: "سرٹیفکیٹ" },
  "رخصة": { en: "licence", ur: "لائسنس" },
  "الفحص الدوري": { en: "periodic inspection", ur: "متواتر معائنہ" },
  "الوقود": { en: "fuel", ur: "ایندھن" },
  "الديزل": { en: "diesel", ur: "ڈیزل" },
  "الميزان": { en: "weighbridge", ur: "کانٹا" },
  "الجمركي": { en: "customs", ur: "کسٹمز" },
  "الأختام": { en: "seals", ur: "سِیل" },
  "استلام": { en: "receipt", ur: "وصولی" },
  "جاري المتابعة": { en: "under monitoring", ur: "زیرِ نگرانی" },
  "اليوم": { en: "today", ur: "آج" },
  "أمس": { en: "yesterday", ur: "کل" },
  "صباح الخير": { en: "good morning", ur: "صبح بخیر" },
  "غرفة العمليات": { en: "the operations room", ur: "آپریشنز روم" },
  "المركزي": { en: "central", ur: "مرکزی" },
  "السائق فهد القحطاني": { en: "the driver Fahd Al-Qahtani", ur: "ڈرائیور فہد القحطانی" },
};

/** Whole-sentence idioms the operations data actually stores. */
const PHRASES: { match: RegExp; en: string; ur: string }[] = [
  { match: /^الآن$/, en: "Now", ur: "ابھی" },
  { match: /^اليوم\s*(.*)$/, en: "Today $1", ur: "آج $1" },
  { match: /^أمس\s*(.*)$/, en: "Yesterday $1", ur: "کل $1" },
  { match: /^مسجلة في الخادم$/, en: "Recorded on the server", ur: "سرور پر درج" },
  {
    match: /^منذ\s*(\d+)\s*(دقيقة|دقائق)$/,
    en: "$1 minutes ago",
    ur: "$1 منٹ قبل",
  },
  { match: /^منذ\s*(\d+)\s*(ساعة|ساعات)$/, en: "$1 hours ago", ur: "$1 گھنٹے قبل" },
  {
    match: /^منذ\s*(\d+)\s*(ثانية|ثواني)$/,
    en: "$1 seconds ago",
    ur: "$1 سیکنڈ قبل",
  },
  { match: /^(\d{1,2}:\d{2})\s*ص$/, en: "$1 AM", ur: "$1 صبح" },
  { match: /^(\d{1,2}:\d{2})\s*م$/, en: "$1 PM", ur: "$1 شام" },
  { match: /^(\d+)\s*كيلومتر$/, en: "$1 km", ur: "$1 کلومیٹر" },
  { match: /^(\d+)\s*كم\/س$/, en: "$1 km/h", ur: "$1 کلومیٹر فی گھنٹہ" },
];

/* ── Resolution ───────────────────────────────────────────────────────────── */

/**
 * Localise one data value. Arabic passes straight through (it is canonical),
 * unknown sentences are returned with normalised numerals rather than a broken
 * partial translation.
 */
export function localizeDataText(value: string | undefined | null, lang: DataLang): string {
  if (!value) return "";
  if (lang === "ar") return value;

  const normalised = westernDigits(value);
  const forms = lang === "en" ? "en" : "ur";

  /* 1. Whole-sentence idioms (relative times, "today 08:00 AM", …). */
  for (const phrase of PHRASES) {
    const m = normalised.match(phrase.match);
    if (m) {
      const target = lang === "en" ? phrase.en : phrase.ur;
      return applyClock(target.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? ""), lang);
    }
  }

  /* 2. Multi-word names first («مستودع الرياض المركزي»), longest key wins. The
        replaced span is wrapped in sentinels so the word pass below never
        re-reads the Urdu/English text it just produced. */
  const OPEN = "\uE000";
  const CLOSE = "\uE001";
  const table = Object.entries({ ...PLACES, ...TERMS }).sort((a, b) => b[0].length - a[0].length);
  let output = normalised;
  for (const [arabic, names] of table) {
    if (!arabic.includes(" ") || !output.includes(arabic)) continue;
    output = output.split(arabic).join(`${OPEN}${names[forms]}${CLOSE}`);
  }

  /* 3. Word by word, skipping the protected spans. */
  const lookup = new Map(table.filter(([k]) => !k.includes(" ")).map(([k, v]) => [k, v[forms]]));
  const ARABIC_RUN = /[\u0600-\u06FF\u0670-\u06D3]+/g;
  let unknown = 0;
  output = output
    .split(new RegExp(`(${OPEN}[^${CLOSE}]*${CLOSE})`))
    .map((part) => {
      if (part.startsWith(OPEN)) return part.slice(1, -1);
      return part.replace(ARABIC_RUN, (word) => {
        const hit = lookup.get(word);
        if (hit) return hit;
        unknown += 1;
        return word;
      });
    })
    .join("");

  output = applyClock(output, lang);

  const arabicTokens = normalised.match(ARABIC_RUN) ?? [];
  /* Everything understood — or nearly: use the translation. A half-translated
     sentence reads worse than the original, so a low match rate keeps the
     source text (already numerals-normalised) instead. */
  if (unknown === 0 || (arabicTokens.length >= 3 && unknown / arabicTokens.length <= 0.4)) {
    return output.replace(/\s{2,}/g, " ").trim();
  }
  return normalised;
}

/** "… 08:00 ص" → "… 08:00 AM" (English) / "… 08:00 صبح" (Urdu). */
function applyClock(text: string, lang: DataLang): string {
  return text
    .replace(/(\d{1,2}:\d{2})\s*ص(?!بح)/g, lang === "en" ? "$1 AM" : "$1 صبح")
    .replace(/(\d{1,2}:\d{2})\s*م(?!ر|ن)/g, lang === "en" ? "$1 PM" : "$1 شام");
}

/**
 * Localise a value that ships with an English twin (city, waypoint, terminal).
 * The twin wins when it exists; otherwise the Arabic form is localised.
 */
export function localizeDataPair(
  arabic: string | undefined | null,
  english: string | undefined | null,
  lang: DataLang,
): string {
  if (lang === "ar") return arabic ?? english ?? "";
  if (lang === "en") return english ?? localizeDataText(arabic, "en");
  if (english) return localizeDataText(english, "ur");
  return localizeDataText(arabic, "ur");
}
