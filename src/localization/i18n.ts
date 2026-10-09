/**
 * EJAZ Transport — Central i18n key registry.
 *
 * Every string that belongs to the product shell (header, account menu,
 * settings center, assistant, notifications, login, navigation) lives here as a
 * single key with its Arabic / English / Urdu value in one place. Components
 * never embed literals for these surfaces: they call `tk("key")`.
 *
 * The legacy `t("English", "العربية", "اردو")` helper is still honoured for the
 * ~1000 pre-existing call sites (it now resolves Urdu through
 * `localization/ur.glossary.ts` so those screens are translated too), but every
 * NEW surface must use a key from this file.
 */

export type Lang = "ar" | "en" | "ur";

export interface MessageEntry {
  ar: string;
  en: string;
  ur: string;
}

export const MESSAGES = {
  /* ── Brand & shell ─────────────────────────────────────────────────── */
  "app.name": { ar: "إيجاز للنقليات", en: "EJAZ Transport", ur: "اعجاز ٹرانسپورٹ" },
  "app.shortName": { ar: "إيجاز", en: "EJAZ", ur: "اعجاز" },
  "app.tagline": { ar: "نقلكم .. مسؤوليتنا", en: "Your cargo.. our responsibility", ur: "آپ کا سامان.. ہماری ذمہ داری" },
  "app.subtitle": {
    ar: "إدارة أسطول النقل الثقيل والرحلات",
    en: "Heavy fleet & logistics control",
    ur: "ہیوی فلیٹ اور لاجسٹکس کنٹرول",
  },
  "app.enterprise": { ar: "منصة إيجاز للوجستيات", en: "EJAZ Enterprise Logistics Platform", ur: "اعجاز انٹرپرائز لاجسٹکس پلیٹ فارم" },
  "app.loading": { ar: "جارٍ تحميل المنصة…", en: "Loading the platform…", ur: "پلیٹ فارم لوڈ ہو رہا ہے…" },

  /* ── Navigation / sections ─────────────────────────────────────────── */
  "nav.operations": { ar: "التشغيل", en: "Operations", ur: "آپریشنز" },
  "nav.overview": { ar: "لوحة المؤشرات", en: "Logistics Dashboard", ur: "ڈیش بورڈ" },
  "nav.operationsCenter": { ar: "مركز العمليات", en: "Operations Center", ur: "آپریشنز سینٹر" },
  "nav.trips": { ar: "الرحلات", en: "Trips", ur: "ٹرپس" },
  "nav.shipments": { ar: "الشحنات", en: "Shipments", ur: "کھیپ" },
  "nav.tracking": { ar: "الخريطة المباشرة", en: "Live Map", ur: "لائیو نقشہ" },
  "nav.fleetGroup": { ar: "الأسطول", en: "Fleet", ur: "فلیٹ" },
  "nav.fleet": { ar: "الأسطول (٤ أنواع)", en: "Fleet (4 Types)", ur: "فلیٹ (چار اقسام)" },
  "nav.vehicleAssets": { ar: "أصول المركبات", en: "Vehicle Assets", ur: "گاڑیوں کے اثاثے" },
  "nav.drivers": { ar: "السائقون", en: "Drivers", ur: "ڈرائیورز" },
  "nav.customers": { ar: "العملاء", en: "Customers", ur: "گاہک / کلائنٹس" },
  "nav.customersHint": { ar: "إدارة حسابات وسجلات العملاء", en: "Manage customer profiles and accounts", ur: "کلائنٹس کے ریکارڈ کا انتظام" },
  "nav.registrations": { ar: "طلبات التسجيل", en: "Registration Requests", ur: "رجسٹریشن درخواستیں" },
  "nav.tariffs": { ar: "قائمة الأسعار والتعرفة", en: "Pricing & Tariffs", ur: "قیمتوں کی فہرست" },
  "nav.tariffsHint": { ar: "إدارة تعرفة النقل ديناميكيًا", en: "Manage dynamic freight tariffs", ur: "متحرک کرایہ فہرست کا انتظام" },
  "nav.insights": { ar: "التحليلات", en: "Insights", ur: "تجزیات" },
  "nav.reports": { ar: "التقارير والتدقيق", en: "Reports & Audit", ur: "رپورٹس اور آڈٹ" },
  "nav.analysis": { ar: "التحليلات التشغيلية", en: "Fleet Analytics", ur: "فلیٹ تجزیات" },
  "nav.history": { ar: "أرشيف الرحلات", en: "Trip Archive", ur: "ٹرپ آرکائیو" },
  "nav.identity": { ar: "الإعدادات والهوية", en: "Settings & Identity", ur: "سیٹنگز اور شناخت" },
  "nav.branding": { ar: "الهوية البصرية", en: "Branding", ur: "برانڈنگ" },
  "nav.chats": { ar: "المحادثات والتوجيه", en: "Chats & Dispatch", ur: "پیغامات اور ڈسپیچ" },
  "nav.settings": { ar: "الإعدادات", en: "Settings", ur: "سیٹنگز" },
  "nav.finance": { ar: "المالية والتسويات", en: "Finance & settlement", ur: "مالیات اور تصفیہ" },
  "perm.trips": { ar: "الرحلات", en: "Trips", ur: "ٹرپس" },
  "perm.fleetManage": { ar: "إدارة الأسطول", en: "Fleet management", ur: "فلیٹ مینجمنٹ" },
  "perm.drivers": { ar: "السائقون", en: "Drivers", ur: "ڈرائیورز" },
  "perm.registrations": { ar: "مراجعة التسجيل", en: "Registration review", ur: "رجسٹریشن جائزہ" },
  "perm.reports": { ar: "التقارير", en: "Reports", ur: "رپورٹس" },
  "perm.finance": { ar: "المالية", en: "Finance", ur: "مالیات" },
  "perm.branding": { ar: "الهوية البصرية", en: "Branding", ur: "برانڈنگ" },
  "perm.settings": { ar: "الإعدادات", en: "Settings", ur: "سیٹنگز" },
  "nav.ai": { ar: "مساعد إيجاز الذكي", en: "EJAZ AI Assistant", ur: "اعجاز اسسٹنٹ" },
  "nav.alerts": { ar: "التنبيهات المباشرة", en: "Smart Alerts", ur: "سمارٹ الرٹس" },
  "nav.quickCreate": { ar: "إنشاء سريع", en: "Quick create", ur: "فوری تخلیق" },
  "nav.createRequest": { ar: "إنشاء طلب جديد", en: "Create new request", ur: "نئی درخواست بنائیں" },
  "nav.createHint": { ar: "تشغيل، صيانة أو تقرير", en: "Dispatch, repair or report", ur: "ڈسپیچ، مرمت یا رپورٹ" },
  "nav.openMenu": { ar: "فتح قائمة التنقل", en: "Open navigation menu", ur: "نیویگیشن مینیو کھولیں" },
  "nav.closeMenu": { ar: "إغلاق القائمة", en: "Close menu", ur: "مینیو بند کریں" },
  "nav.opensWindow": { ar: "يفتح في نافذة", en: "Opens in a window", ur: "ونڈو میں کھلتا ہے" },

  /* ── Header ────────────────────────────────────────────────────────── */
  "header.assistant": { ar: "المساعد الذكي", en: "AI Assistant", ur: "اسسٹنٹ" },
  "header.assistantTitle": { ar: "فتح مساعد إيجاز الذكي", en: "Open the EJAZ AI assistant", ur: "اعجاز اسسٹنٹ کھولیں" },
  "header.notifications": { ar: "الإشعارات", en: "Notifications", ur: "اطلاعات" },
  "header.notificationsTitle": { ar: "فتح مركز الإشعارات", en: "Open the notifications center", ur: "اطلاعات مرکز کھولیں" },
  "header.search": { ar: "بحث سريع…", en: "Quick search…", ur: "فوری تلاش…" },
  "header.account": { ar: "قائمة الحساب", en: "Account menu", ur: "اکاؤنٹ مینیو" },
  "header.live": { ar: "شاحنات نشطة على الطريق", en: "trucks live on the road", ur: "ٹرکس سڑک پر فعال" },
  "header.viewControl": { ar: "لوحة التحكم والإدارة", en: "Control room & admin", ur: "کنٹرول روم اور ایڈمن" },
  "header.viewMobile": { ar: "تطبيق الجوال (سائق/عميل)", en: "Mobile app (driver/client)", ur: "موبائل ایپ (ڈرائیور/کلائنٹ)" },
  "header.viewLabel": { ar: "واجهة العمل", en: "Workspace", ur: "ورک اسپیس" },
  "header.signedInAs": { ar: "مسجل الدخول بصفة", en: "Signed in as", ur: "بطور سائن اِن" },
  "header.theme": { ar: "الوضع الفاتح/الداكن", en: "Light / dark mode", ur: "لائٹ / ڈارک موڈ" },
  "header.connectionOnline": { ar: "الخادم متصل ومستقر", en: "Server connected & healthy", ur: "سرور منسلک اور مستحکم ہے" },
  "header.connectionSlow": { ar: "استجابة الخادم بطيئة", en: "Server response is slow", ur: "سرور کا جواب سست ہے" },
  "header.connectionOffline": { ar: "تعذر الاتصال بالخادم", en: "Server unreachable", ur: "سرور سے رابطہ منقطع ہے" },
  "header.connectionChecking": { ar: "جارٍ فحص الاتصال…", en: "Checking connection…", ur: "کنکشن چیک ہو رہا ہے…" },
  "header.connectionPing": { ar: "زمن الاستجابة", en: "Latency", ur: "تاخیر" },
  "header.batteryLevel": { ar: "البطارية", en: "Battery", ur: "بیٹری" },
  "header.batteryCharging": { ar: "جارٍ الشحن", en: "Charging", ur: "چارج ہو رہا ہے" },

  /* ── Account menu ──────────────────────────────────────────────────── */
  "account.title": { ar: "الحساب والإعدادات", en: "Account & settings", ur: "اکاؤنٹ اور سیٹنگز" },
  "account.myAccount": { ar: "حسابي", en: "My account", ur: "میرا اکاؤنٹ" },
  "account.settings": { ar: "الإعدادات", en: "Settings", ur: "سیٹنگز" },
  "account.language": { ar: "اللغة", en: "Language", ur: "زبان" },
  "account.appearance": { ar: "المظهر", en: "Appearance", ur: "ظاہری شکل" },
  "account.switchAccount": { ar: "تبديل الحساب", en: "Switch account", ur: "اکاؤنٹ تبدیل کریں" },
  "account.switchHint": { ar: "تبديل فوري بين الحسابات التجريبية بدون كلمة مرور", en: "Instant switch between demo accounts — no password", ur: "بغیر پاس ورڈ ڈیمو اکاؤنٹس تبدیل کریں" },
  "account.help": { ar: "المساعدة والدعم", en: "Help & support", ur: "مدد اور معاونت" },
  "account.logout": { ar: "تسجيل الخروج", en: "Sign out", ur: "سائن آؤٹ" },
  "account.previewLogin": { ar: "معاينة شاشة تسجيل الدخول", en: "Preview the sign-in screen", ur: "سائن اِن اسکرین دیکھیں" },
  "account.role": { ar: "الصلاحية", en: "Role", ur: "کردار" },
  "account.email": { ar: "البريد الإلكتروني", en: "Email", ur: "ای میل" },
  "account.phone": { ar: "الهاتف", en: "Phone", ur: "فون" },
  "account.permissions": { ar: "الصلاحيات", en: "Permissions", ur: "اجازتیں" },
  "account.fullPermissions": { ar: "صلاحيات كاملة", en: "Full access", ur: "مکمل رسائی" },
  "account.notAllowed": { ar: "غير متاح لصلاحيتك", en: "Not available for your role", ur: "آپ کے کردار کے لیے دستیاب نہیں" },
  "account.sessionActive": { ar: "الجلسة نشطة", en: "Session active", ur: "سیشن فعال" },
  "account.copyEmail": { ar: "نسخ البريد الإلكتروني", en: "Copy email", ur: "ای میل کاپی کریں" },
  "account.copied": { ar: "تم النسخ", en: "Copied", ur: "کاپی ہو گیا" },

  /* ── Language & appearance ─────────────────────────────────────────── */
  "language.title": { ar: "لغة الواجهة", en: "Interface language", ur: "انٹرفیس زبان" },
  "language.choose": { ar: "اختر لغة العرض", en: "Choose display language", ur: "زبان منتخب کریں" },
  "language.current": { ar: "اللغة الحالية", en: "Current language", ur: "موجودہ زبان" },
  "language.applied": { ar: "تم تطبيق اللغة على كامل النظام", en: "Language applied across the whole system", ur: "زبان پورے نظام پر لاگو ہو گئی" },
  "language.ar": { ar: "العربية", en: "العربية", ur: "العربية" },
  "language.en": { ar: "English", en: "English", ur: "English" },
  "language.ur": { ar: "اردو", en: "اردو", ur: "اردو" },
  "language.arHint": { ar: "واجهة عربية بالكامل (RTL)", en: "Full Arabic interface (RTL)", ur: "مکمل عربی انٹرفیس (RTL)" },
  "language.enHint": { ar: "واجهة إنجليزية بالكامل (LTR)", en: "Full English interface (LTR)", ur: "مکمل انگریزی انٹرفیس (LTR)" },
  "language.urHint": { ar: "واجهة أردية بالكامل (RTL)", en: "Full Urdu interface (RTL)", ur: "مکمل اردو انٹرفیس (RTL)" },
  "theme.light": { ar: "الوضع الفاتح", en: "Light mode", ur: "لائٹ موڈ" },
  "theme.dark": { ar: "الوضع الداكن", en: "Dark mode", ur: "ڈارک موڈ" },
  "theme.system": { ar: "حسب النظام", en: "System", ur: "سسٹم کے مطابق" },
  "theme.lightHint": { ar: "خلفية بيضاء وكحلي — مناسب للنهار", en: "White & navy surfaces — ideal in daylight", ur: "سفید اور نیوی رنگ — دن کے لیے موزوں" },
  "theme.darkHint": { ar: "كحلي داكن مع برتقالي — مناسب لغرف التحكم", en: "Deep navy with orange — built for control rooms", ur: "گہرا نیوی اور نارنجی — کنٹرول روم کے لیے" },

  /* ── Settings center ───────────────────────────────────────────────── */
  "settings.title": { ar: "مركز الإعدادات", en: "Settings center", ur: "سیٹنگز سینٹر" },
  "settings.subtitle": { ar: "الحساب، إعدادات التطبيق، التطبيقات وإعدادات النظام", en: "Account, app settings, apps and system settings", ur: "اکاؤنٹ، ایپ سیٹنگز اور سسٹم سیٹنگز" },
  "settings.tabProfile": { ar: "حسابي", en: "My account", ur: "میرا اکاؤنٹ" },
  "settings.tabPreferences": { ar: "إعدادات التطبيق", en: "App settings", ur: "ایپ سیٹنگز" },
  "settings.tabNotifications": { ar: "الإشعارات", en: "Notifications", ur: "اطلاعات" },
  "settings.tabAssistant": { ar: "المساعد الذكي", en: "AI assistant", ur: "اسسٹنٹ" },
  "settings.tabHelp": { ar: "المساعدة والدعم", en: "Help & support", ur: "مدد اور معاونت" },
  "settings.tabApps": { ar: "التطبيقات", en: "Mobile apps", ur: "موبائل ایپس" },
  "settings.tabLoginPreview": { ar: "معاينة شاشة تسجيل الدخول", en: "Sign-in screen preview", ur: "سائن اِن اسکرین دیکھیں" },
  "settings.tabSystem": { ar: "إعدادات النظام", en: "System settings", ur: "سسٹم سیٹنگز" },
  "settings.accountSecurity": { ar: "الأمان والجلسات", en: "Security & sessions", ur: "سیکیورٹی اور سیشنز" },
  "settings.accountData": { ar: "بيانات الحساب", en: "Account data", ur: "اکاؤنٹ ڈیٹا" },
  "settings.appInfo": { ar: "معلومات التطبيق", en: "App information", ur: "ایپ کی معلومات" },
  "settings.timeTitle": { ar: "الوقت والتاريخ", en: "Time & date", ur: "وقت اور تاریخ" },
  "settings.appsHint": { ar: "افتح كل تطبيق بواجهته الصحيحة — كلاهما متصل بنفس النظام الخلفي", en: "Open each app in its own interface — both share the same backend", ur: "ہر ایپ اپنے انٹرفیس میں کھولیں — دونوں ایک ہی بیک اینڈ پر چلتی ہیں" },
  "settings.appsDriver": { ar: "تطبيق السائق", en: "Driver app", ur: "ڈرائیور ایپ" },
  "settings.appsClient": { ar: "تطبيق العميل", en: "Client app", ur: "کلائنٹ ایپ" },
  "settings.loginPreviewHint": { ar: "معاينة فقط — لا تحتوي على دخول للوحة التحكم أو التطبيقات", en: "Preview only — no control-room or app entry inside", ur: "صرف دیکھنے کے لیے — اندر کوئی داخلہ بٹن نہیں" },
  "settings.systemHint": { ar: "هوية المؤسسة، المستخدمون، الأدوار، الرحلات، الأسطول، GPS، المالية، المستندات، التقارير وسجل التدقيق", en: "Identity, users, roles, trips, fleet, GPS, finance, documents, reports and audit log", ur: "شناخت، صارفین، کردار، ٹرپس، فلیٹ، GPS، مالیات، دستاویزات، رپورٹس اور آڈٹ لاگ" },
  "settings.systemIdentity": { ar: "هوية المؤسسة", en: "Establishment identity", ur: "ادارتی شناخت" },
  "settings.systemUsers": { ar: "المستخدمون", en: "Users", ur: "صارفین" },
  "settings.systemStaff": { ar: "الموظفون", en: "Staff", ur: "عملہ" },
  "settings.systemDrivers": { ar: "السائقون", en: "Drivers", ur: "ڈرائیور" },
  "settings.systemCustomers": { ar: "العملاء والتجار", en: "Customers & merchants", ur: "کلائنٹس اور تاجر" },
  "settings.systemWarehouses": { ar: "المستودعات", en: "Warehouses", ur: "گودام" },
  "settings.systemAdmins": { ar: "الحسابات الإدارية", en: "Admin accounts", ur: "ایڈمن اکاؤنٹس" },
  "settings.systemRoles": { ar: "الأدوار والصلاحيات", en: "Roles & permissions (RBAC)", ur: "کردار اور اجازتیں (RBAC)" },
  "settings.systemTrips": { ar: "إعدادات الرحلات", en: "Trip settings", ur: "ٹرپ سیٹنگز" },
  "settings.systemFleet": { ar: "الأسطول", en: "Fleet", ur: "فلیٹ" },
  "settings.systemGps": { ar: "GPS والتتبع", en: "GPS & tracking", ur: "GPS اور ٹریکنگ" },
  "settings.systemFinance": { ar: "المالية", en: "Finance", ur: "مالیات" },
  "settings.systemDocuments": { ar: "المستندات", en: "Documents", ur: "دستاویزات" },
  "settings.systemReports": { ar: "التقارير", en: "Reports", ur: "رپورٹس" },
  "settings.systemAudit": { ar: "سجل التدقيق", en: "Audit log", ur: "آڈٹ لاگ" },
  "settings.tripNumberScheme": { ar: "نمط رقم الرحلة الموحد", en: "Unified trip number scheme", ur: "یونیفارم ٹرپ نمبر اسکیم" },
  "settings.tripStates": { ar: "حالات الرحلة والانتقالات", en: "Trip states & transitions", ur: "ٹرپ اسٹیٹس اور منتقلیاں" },
  "settings.gpsProvider": { ar: "مزود خدمة التتبع", en: "Telemetry provider", ur: "ٹیلی میٹری فراہم کنندہ" },
  "settings.profileTitle": { ar: "بيانات المستخدم الحالي", en: "Current user profile", ur: "موجودہ صارف پروفائل" },
  "settings.profileHint": { ar: "تُعرض البيانات بحسب صلاحياتك داخل النظام", en: "Data shown according to your permissions", ur: "ڈیٹا آپ کی اجازتوں کے مطابق دکھایا جاتا ہے" },
  "settings.notifTitle": { ar: "تفضيلات الإشعارات", en: "Notification preferences", ur: "اطلاعات کی ترجیحات" },
  "settings.notifHint": { ar: "لا يصل الإشعار إلا للدور أو المستخدم المسؤول عنه", en: "Each notification reaches only the responsible role or user", ur: "ہر اطلاع صرف متعلقہ کردار یا صارف تک پہنچتی ہے" },
  "settings.notifCritical": { ar: "التنبيهات الحرجة والحوادث", en: "Critical alerts & incidents", ur: "انتہائی اہم الرٹس اور واقعات" },
  "settings.notifOps": { ar: "تأخير الرحلات وتحديثات التشغيل", en: "Trip delays & operational updates", ur: "ٹرپ تاخیر اور آپریشنل اپڈیٹس" },
  "settings.notifDocs": { ar: "انتهاء الوثائق والتراخيص", en: "Document & permit expiry", ur: "دستاویزات اور اجازتوں کی میعاد" },
  "settings.notifDigest": { ar: "ملخص يومي على البريد", en: "Daily email digest", ur: "روزانہ ای میل خلاصہ" },
  "settings.assistantTitle": { ar: "سلوك مساعد إيجاز الذكي", en: "EJAZ assistant behaviour", ur: "اعجاز اسسٹنٹ کا رویہ" },
  "settings.assistantContext": { ar: "استخدام سياق الصفحة والرحلة الحالية", en: "Use current page & trip context", ur: "موجودہ صفحہ اور ٹرپ سیاق استعمال کریں" },
  "settings.assistantSuggest": { ar: "عرض اقتراحات ذكية تلقائيًا", en: "Show smart suggestions automatically", ur: "خودکار سمارٹ تجاویز دکھائیں" },
  "settings.assistantAudit": { ar: "تسجيل إجراءات المساعد في سجل التدقيق", en: "Record assistant actions in the audit log", ur: "اسسٹنٹ کے اقدامات آڈٹ لاگ میں درج کریں" },
  "settings.helpTitle": { ar: "مركز المساعدة والدعم", en: "Help & support desk", ur: "مدد اور معاونت ڈیسک" },
  "settings.helpOps": { ar: "غرفة العمليات (٢٤/٧)", en: "Operations room (24/7)", ur: "آپریشنز روم (24/7)" },
  "settings.helpEmail": { ar: "البريد المؤسسي", en: "Enterprise email", ur: "ادارتی ای میل" },
  "settings.helpVersion": { ar: "إصدار المنصة", en: "Platform version", ur: "پلیٹ فارم ورژن" },
  "settings.helpShortcuts": { ar: "اختصارات سريعة", en: "Quick shortcuts", ur: "فوری شارٹ کٹس" },
  "settings.saved": { ar: "تم حفظ الإعدادات", en: "Settings saved", ur: "سیٹنگز محفوظ ہو گئیں" },
  "settings.reset": { ar: "إعادة الضبط الافتراضي", en: "Restore defaults", ur: "ڈیفالٹ بحال کریں" },
  "settings.persistence": { ar: "تُحفظ تفضيلاتك تلقائيًا وتُستعاد عند الدخول التالي", en: "Your preferences are saved automatically and restored on your next sign-in", ur: "آپ کی ترجیحات خودکار محفوظ اور اگلی سائن اِن پر بحال ہوتی ہیں" },

  /* ── Notifications / alerts ────────────────────────────────────────── */
  "alerts.center": { ar: "مركز الإشعارات الذكية", en: "Smart notifications center", ur: "سمارٹ اطلاعات مرکز" },
  "alerts.subtitle": { ar: "تنبيهات مُوجَّهة للدور المسؤول فقط — مع منع التكرار والتصعيد", en: "Routed to the responsible role only — with deduplication and escalation", ur: "صرف متعلقہ کردار کو بھیجی جاتی ہیں — بغیر تکرار، تصعید کے ساتھ" },
  "alerts.unread": { ar: "غير مقروء", en: "Unread", ur: "نہ پڑھی گئی" },
  "alerts.all": { ar: "الكل", en: "All", ur: "تمام" },
  "alerts.empty": { ar: "لا توجد إشعارات مطابقة حاليًا", en: "No notifications match right now", ur: "اس وقت کوئی اطلاع موجود نہیں" },
  "alerts.emptyHint": { ar: "سيظهر هنا كل ما يستدعي إجراءً من صلاحيتك", en: "Anything that needs an action from your role will appear here", ur: "آپ کے کردار سے متعلق ہر ضروری اطلاع یہاں دکھائی دے گی" },
  "alerts.type": { ar: "النوع", en: "Type", ur: "قسم" },
  "alerts.severity": { ar: "الخطورة", en: "Severity", ur: "شدت" },
  "alerts.reason": { ar: "سبب التنبيه", en: "Why this fired", ur: "اطلاع کی وجہ" },
  "alerts.action": { ar: "الإجراء المطلوب", en: "Required action", ur: "مطلوبہ کارروائی" },
  "alerts.owner": { ar: "المسؤول", en: "Owner", ur: "ذمہ دار" },
  "alertOwner.operations": { ar: "غرفة العمليات", en: "Operations room", ur: "آپریشنز روم" },
  "alertOwner.dispatcher": { ar: "منسّق الحركة", en: "Dispatcher", ur: "ڈسپیچر" },
  "alertOwner.driver": { ar: "السائق", en: "Driver", ur: "ڈرائیور" },
  "alertOwner.maintenance": { ar: "الصيانة", en: "Maintenance", ur: "مینٹیننس" },
  "alertOwner.it": { ar: "تقنية المعلومات", en: "IT", ur: "آئی ٹی" },
  "alertOwner.client": { ar: "العميل", en: "Client", ur: "کلائنٹ" },
  "alerts.ack": { ar: "إقرار ومعالجة", en: "Acknowledge & resolve", ur: "تسلیم اور حل" },
  "alerts.ackBy": { ar: "تم الإقرار بواسطة", en: "Acknowledged by", ur: "تسلیم کرنے والا" },
  "alerts.escalate": { ar: "تصعيد للمسؤول الأعلى", en: "Escalate to a higher authority", ur: "اعلیٰ ذمہ دار کو بھیجیں" },
  "alerts.escalated": { ar: "تم التصعيد", en: "Escalated", ur: "تصعید ہو گئی" },
  "alerts.resolved": { ar: "تمت المعالجة", en: "Resolved", ur: "حل ہو گیا" },
  "alerts.inspectTrip": { ar: "فحص الرحلة", en: "Inspect trip", ur: "ٹرپ دیکھیں" },
  "alerts.ackToast": { ar: "تم الإقرار بالتنبيه وإغلاقه", en: "Alert acknowledged and closed", ur: "اطلاع تسلیم اور بند کر دی گئی" },
  "alerts.escalateToast": { ar: "تم تصعيد التنبيه إلى المسؤول الأعلى", en: "Alert escalated to the higher authority", ur: "اطلاع اعلیٰ ذمہ دار کو بھیج دی گئی" },
  "alerts.denied": { ar: "لا تملك صلاحية معالجة هذا التنبيه", en: "Your role cannot act on this notification", ur: "آپ کے کردار کو یہ اطلاع سنبھالنے کی اجازت نہیں" },
  "alerts.filterSeverity": { ar: "تصفية بالخطورة", en: "Filter by severity", ur: "شدت کے مطابق فلٹر" },
  "alerts.filterType": { ar: "تصفية بالنوع", en: "Filter by type", ur: "قسم کے مطابق فلٹر" },
  "alerts.markAllRead": { ar: "تحديد الكل كمقروء", en: "Mark all as read", ur: "سب کو پڑھا ہوا کریں" },
  "alerts.cooldown": { ar: "تكرار مثبَّط", en: "Deduplicated", ur: "تکرار روکی گئی" },

  "severity.info": { ar: "معلومة", en: "Info", ur: "معلومات" },
  "severity.low": { ar: "منخفض", en: "Low", ur: "کم" },
  "severity.medium": { ar: "متوسط", en: "Medium", ur: "درمیانی" },
  "severity.high": { ar: "عالٍ", en: "High", ur: "زیادہ" },
  "severity.critical": { ar: "حرج", en: "Critical", ur: "انتہائی اہم" },

  "alertType.delay": { ar: "تأخر رحلة", en: "Trip delay", ur: "ٹرپ تاخیر" },
  "alertType.off_route": { ar: "انحراف عن المسار", en: "Route deviation", ur: "راستے سے انحراف" },
  "alertType.idle": { ar: "توقف غير مبرر", en: "Unplanned stop", ur: "غیر متوقع قیام" },
  "alertType.temp": { ar: "حرارة التبريد", en: "Reefer temperature", ur: "کنٹینر درجہ حرارت" },
  "alertType.doc_expiry": { ar: "انتهاء وثائق", en: "Document expiry", ur: "دستاویز کی میعاد" },
  "alertType.speed": { ar: "تجاوز السرعة", en: "Speed violation", ur: "رفتار کی خلاف ورزی" },
  "alertType.utilization": { ar: "استغلال الأسطول", en: "Fleet utilisation", ur: "فلیٹ استعمال" },
  "alertType.gps": { ar: "إشارة التتبع", en: "GPS signal", ur: "جی پی ایس سگنل" },
  "alertType.api": { ar: "خدمة برمجية", en: "API service", ur: "اے پی آئی سروس" },
  "alertType.sync": { ar: "مزامنة البيانات", en: "Data sync", ur: "ڈیٹا مطابقت" },
  "alertType.auth": { ar: "تسجيل الدخول", en: "Sign-in security", ur: "سائن اِن سیکیورٹی" },
  "alertType.system": { ar: "صحة النظام", en: "System health", ur: "سسٹم کی صحت" },

  /* ── Assistant ─────────────────────────────────────────────────────── */
  "assistant.title": { ar: "مساعد إيجاز الذكي", en: "EJAZ smart assistant", ur: "اعجاز سمارٹ اسسٹنٹ" },
  "assistant.subtitle": { ar: "مساعد مرتبط بسياق النظام: دورك وصلاحياتك والصفحة الحالية والرحلة المفتوحة", en: "Context-aware: your role, permissions, current page and open trip", ur: "سیاق سے واقف: کردار، اجازتیں، موجودہ صفحہ اور کھلا ٹرپ" },
  "assistant.thinking": { ar: "جارٍ التحليل…", en: "Analyzing…", ur: "تجزیہ جاری…" },
  "assistant.ask": { ar: "اسأل مساعد إيجاز…", en: "Ask the EJAZ assistant…", ur: "اعجاز اسسٹنٹ سے پوچھیں…" },
  "assistant.send": { ar: "إرسال", en: "Send", ur: "بھیجیں" },
  "assistant.suggestions": { ar: "اقتراحات حسب الصفحة الحالية", en: "Suggestions for the current page", ur: "موجودہ صفحہ کے لیے تجاویز" },
  "assistant.insights": { ar: "المشاكل المكتشفة تلقائيًا", en: "Automatically detected issues", ur: "خودکار طور پر دریافت مسائل" },
  "assistant.noIssues": { ar: "لا توجد مشاكل تشغيلية في نطاق صلاحياتك الآن", en: "No operational issues inside your permission scope right now", ur: "آپ کی اجازت کے دائرے میں اس وقت کوئی مسئلہ نہیں" },
  "assistant.problem": { ar: "المشكلة", en: "Problem", ur: "مسئلہ" },
  "assistant.cause": { ar: "السبب المحتمل", en: "Probable cause", ur: "ممکنہ وجہ" },
  "assistant.impact": { ar: "الأثر", en: "Impact", ur: "اثر" },
  "assistant.owner": { ar: "المسؤول", en: "Responsible", ur: "ذمہ دار" },
  "assistant.suggested": { ar: "الإجراء المقترح", en: "Suggested action", ur: "تجویز کردہ کارروائی" },
  "assistant.next": { ar: "الخطوة التالية", en: "Next step", ur: "اگلا قدم" },
  "assistant.scope": { ar: "نطاق البيانات المتاح لك", en: "Data scope available to you", ur: "آپ کے لیے دستیاب ڈیٹا" },
  "assistant.denied": { ar: "هذا الطلب خارج نطاق صلاحياتك الحالية", en: "That request is outside your current permissions", ur: "یہ درخواست آپ کی اجازتوں سے باہر ہے" },
  "assistant.actEscalate": { ar: "إرسال تنبيه للمسؤول", en: "Alert the responsible role", ur: "ذمہ دار کو اطلاع بھیجیں" },
  "assistant.actAck": { ar: "إقرار ومتابعة", en: "Acknowledge & track", ur: "تسلیم اور نگرانی" },
  "assistant.acted": { ar: "تم تنفيذ الإجراء وتسجيله في سجل التدقيق", en: "Action executed and recorded in the audit log", ur: "کارروائی مکمل اور آڈٹ لاگ میں درج" },
  "assistant.needsConfirm": { ar: "إجراء حساس — يحتاج تأكيدًا", en: "Sensitive action — confirmation required", ur: "حساس کارروائی — تصدیق درکار" },
  "assistant.confirm": { ar: "تأكيد التنفيذ", en: "Confirm action", ur: "کارروائی کی تصدیق" },
  "assistant.contextUser": { ar: "المستخدم", en: "User", ur: "صارف" },
  "assistant.contextRole": { ar: "الدور", en: "Role", ur: "کردار" },
  "assistant.contextPage": { ar: "الصفحة", en: "Page", ur: "صفحہ" },
  "assistant.contextTrip": { ar: "الرحلة المفتوحة", en: "Open trip", ur: "کھلا ٹرپ" },
  "assistant.contextAlerts": { ar: "تنبيهات نشطة", en: "Active alerts", ur: "فعال اطلاعات" },
  "assistant.hintDriver": { ar: "اسأل عن رحلتك الحالية، الوجهة، أو أبلغ عن مشكلة", en: "Ask about your trip, destination, or report a problem", ur: "اپنے ٹرپ، منزل یا مسئلے کے بارے میں پوچھیں" },
  "assistant.hintClient": { ar: "اسأل عن حالة شحنتك، موعد التسليم، أو أرسل بلاغًا", en: "Ask about your shipment, ETA, or file a report", ur: "اپنی کھیپ، آمد کا وقت یا شکایت پوچھیں" },
  "assistant.hintAdmin": { ar: "اسأل عن التأخير، السائقين، المشاكل التشغيلية أو التقارير", en: "Ask about delays, drivers, operational issues or reports", ur: "تاخیر، ڈرائیور، مسائل یا رپورٹس پوچھیں" },

  /* ── Login / auth ──────────────────────────────────────────────────── */
  "login.title": { ar: "دخول غرفة التحكم", en: "Control room sign-in", ur: "کنٹرول روم سائن اِن" },
  "login.subtitle": { ar: "منصة موحدة لإدارة وتتبع أسطول النقل الثقيل", en: "Unified platform for heavy fleet operations & tracking", ur: "ہیوی فلیٹ آپریشنز کے لیے متحد پلیٹ فارم" },
  "login.email": { ar: "البريد الإلكتروني", en: "Work email", ur: "کام کا ای میل" },
  "login.password": { ar: "كلمة المرور", en: "Password", ur: "پاس ورڈ" },
  "login.remember": { ar: "تذكرني", en: "Remember me", ur: "مجھے یاد رکھیں" },
  "login.forgot": { ar: "نسيت كلمة المرور؟", en: "Forgot password?", ur: "پاس ورڈ بھول گئے؟" },
  "login.signIn": { ar: "الدخول إلى غرفة التحكم", en: "Sign in to the control room", ur: "کنٹرول روم میں سائن اِن" },
  "login.signingIn": { ar: "جارٍ التحقق…", en: "Authenticating…", ur: "تصدیق جاری…" },
  "login.instant": { ar: "دخول فوري بدون كلمة مرور", en: "Instant sign-in without a password", ur: "بغیر پاس ورڈ فوری سائن اِن" },
  "login.demoAccounts": { ar: "حسابات تجريبية بضغطة واحدة", en: "One-click demo accounts", ur: "ایک کلک ڈیمو اکاؤنٹس" },
  "login.manual": { ar: "أو الدخول يدويًا بالبيانات الرسمية", en: "Or sign in manually with your credentials", ur: "یا اپنی تفصیلات سے دستی سائن اِن" },
  "login.mobileApp": { ar: "فتح تطبيق السائق والعميل", en: "Open the driver / client mobile app", ur: "ڈرائیور/کلائنٹ موبائل ایپ کھولیں" },
  "login.secureNote": { ar: "الدخول مخصص للمصرح لهم فقط، وكل عملية دخول تُسجَّل في سجل التدقيق", en: "Authorized personnel only — every sign-in is written to the audit log", ur: "صرف مجاز افراد کے لیے — ہر سائن اِن آڈٹ لاگ میں درج ہوتا ہے" },
  "login.back": { ar: "العودة إلى غرفة التحكم", en: "Back to the control room", ur: "کنٹرول روم واپس" },
  "login.welcome": { ar: "أهلًا بعودتك", en: "Welcome back", ur: "خوش آمدید" },

  /* ── Common actions ────────────────────────────────────────────────── */
  "common.close": { ar: "إغلاق", en: "Close", ur: "بند کریں" },
  "common.save": { ar: "حفظ", en: "Save", ur: "محفوظ کریں" },
  "common.cancel": { ar: "إلغاء", en: "Cancel", ur: "منسوخ" },
  "common.search": { ar: "بحث", en: "Search", ur: "تلاش" },
  "common.retry": { ar: "إعادة المحاولة", en: "Retry", ur: "دوبارہ کوشش" },
  "common.refresh": { ar: "تحديث", en: "Refresh", ur: "تازہ کریں" },
  "common.copy": { ar: "نسخ", en: "Copy", ur: "کاپی" },
  "common.copied": { ar: "تم النسخ", en: "Copied", ur: "کاپی ہو گیا" },
  "common.offline": { ar: "غير متصل بالخادم", en: "Backend unreachable", ur: "بیک اینڈ دستیاب نہیں" },
  "common.online": { ar: "متصل", en: "Online", ur: "آن لائن" },
  "common.all": { ar: "الكل", en: "All", ur: "تمام" },
  "common.more": { ar: "المزيد", en: "More", ur: "مزید" },
  "common.open": { ar: "فتح", en: "Open", ur: "کھولیں" },
  "common.back": { ar: "رجوع", en: "Back", ur: "واپس" },
  "common.help": { ar: "مساعدة", en: "Help", ur: "مدد" },

  /* ── Assistant · detected issue catalogue ──────────────────────────────
     Every detected problem is rendered as: problem → probable cause → impact
     → responsible party → suggested action → next step (§20). */
  "assistant.issue.delay.title": { ar: "رحلة متأخرة عن الجدول", en: "Trip behind schedule", ur: "ٹرپ شیڈول سے پیچھے" },
  "assistant.issue.delay.cause": {
    ar: "انخفاض متوسط السرعة عن المخطط مع توقف قصير عند نقطة ازدحام",
    en: "Average speed below plan with a short stop at a congestion point",
    ur: "اوسط رفتار منصوبے سے کم اور بھیڑ کے مقام پر مختصر قیام",
  },
  "assistant.issue.delay.impact": { ar: "تأخر متوقع في التسليم وتأثير على التزام العميل", en: "Expected delivery slip and customer SLA impact", ur: "متوقع تاخیر اور گاہک کے معاہدے پر اثر" },
  "assistant.issue.delay.action": { ar: "إشعار المستلم وتحديث وقت الوصول في بوابة العميل", en: "Notify the consignee and refresh the ETA in the client portal", ur: "وصول کنندہ کو اطلاع دیں اور ETA اپ ڈیٹ کریں" },
  "assistant.issue.delay.next": { ar: "التواصل مع السائق عبر مركز التوجيه لتحديد سبب التباطؤ", en: "Contact the driver over dispatch to confirm the slowdown", ur: "ڈسپیچ کے ذریعے ڈرائیور سے رابطہ کریں" },

  "assistant.issue.stalled.title": { ar: "رحلة متوقفة بلا حركة", en: "Trip stalled", ur: "ٹرپ رکی ہوئی" },
  "assistant.issue.stalled.cause": { ar: "عدم تحديث الموقع أو توقف مطوّل في ساحة/استراحة", en: "No position updates or an extended yard/rest stop", ur: "مقام کی اپ ڈیٹ نہیں یا طویل قیام" },
  "assistant.issue.stalled.impact": { ar: "خطر على موعد التسليم وتعطّل خطة التوزيع التالية", en: "Delivery date at risk and the next dispatch plan is blocked", ur: "ترسیل کی تاریخ خطرے میں اور اگلا ڈسپیچ متاثر" },
  "assistant.issue.stalled.action": { ar: "طلب تحديث حالة إلزامي من السائق خلال ١٥ دقيقة", en: "Require a mandatory status update from the driver within 15 minutes", ur: "ڈرائیور سے ۱۵ منٹ میں حالت اپ ڈیٹ طلب کریں" },
  "assistant.issue.stalled.next": { ar: "تصعيد لغرفة العمليات عند عدم الاستجابة", en: "Escalate to the operations room if there is no response", ur: "جواب نہ ملنے پر آپریشنز روم کو بھیجیں" },

  "assistant.issue.status.title": { ar: "حالة قديمة لم تُحدَّث", en: "Stale trip status", ur: "پرانی ٹرپ حالت" },
  "assistant.issue.status.cause": { ar: "لم يُسجَّل انتقال المرحلة على النظام رغم تنفيذها ميدانيًا", en: "A lifecycle transition was executed in the field but never logged", ur: "مرحلہ میدان میں مکمل ہوا مگر نظام میں درج نہیں" },
  "assistant.issue.status.impact": { ar: "بيانات لوحة المؤشرات والتقارير غير دقيقة", en: "Dashboard figures and reports are inaccurate", ur: "ڈیش بورڈ اور رپورٹس کے اعداد غلط" },
  "assistant.issue.status.action": { ar: "تسجيل المرحلة الصحيحة من بوابة السائق أو من غرفة العمليات", en: "Log the correct stage from the driver portal or the operations room", ur: "ڈرائیور پورٹل یا آپریشنز روم سے درست مرحلہ درج کریں" },
  "assistant.issue.status.next": { ar: "مراجعة أرشيف الرحلة للتأكد من تسلسل المراحل", en: "Review the trip archive to confirm the milestone order", ur: "ٹرپ آرکائیو سے مراحل کی ترتیب جانچیں" },

  "assistant.issue.gps.title": { ar: "انقطاع في إشارة التتبع", en: "Telemetry signal gap", ur: "ٹیلی میٹری سگنل کی کمی" },
  "assistant.issue.gps.cause": { ar: "فقدان تغطية الشبكة أو إيقاف بث الموقع من الجهاز", en: "Network coverage loss or the device stopped broadcasting", ur: "نیٹ ورک نہ ہونا یا ڈیوائس سے نشریات بند" },
  "assistant.issue.gps.impact": { ar: "الخريطة المباشرة لا تعرض الموقع الحقيقي للشاحنة", en: "The live map no longer shows the vehicle's real position", ur: "لائیو نقشہ گاڑی کا حقیقی مقام نہیں دکھا رہا" },
  "assistant.issue.gps.action": { ar: "طلب إعادة تشغيل بث الموقع من تطبيق السائق", en: "Ask the driver to restart GPS broadcast in the app", ur: "ڈرائیور سے ایپ میں جی پی ایس دوبارہ شروع کرائیں" },
  "assistant.issue.gps.next": { ar: "الاعتماد على آخر موقع مؤكد في التسعير الزمني حتى رجوع الإشارة", en: "Base ETA on the last confirmed fix until the signal returns", ur: "سگنل واپس آنے تک آخری تصدیق شدہ مقام پر بھروسہ کریں" },

  "assistant.issue.api.title": { ar: "خدمة برمجية لا تستجيب", en: "A backend service is not responding", ur: "بیک اینڈ سروس جواب نہیں دے رہی" },
  "assistant.issue.api.cause": { ar: "انقطاع الاتصال بالخادم أو توقف مؤقت في بوابة الـAPI", en: "The server is unreachable or the API gateway stalled", ur: "سرور دستیاب نہیں یا API گیٹ وے رکا ہوا ہے" },
  "assistant.issue.api.impact": { ar: "تعذّر تحديث الرحلات والأصول والمصادقة حتى عودة الاتصال", en: "Trips, assets and authentication cannot refresh until it returns", ur: "واپسی تک ٹرپس، اثاثے اور تصدیق اپ ڈیٹ نہیں ہو سکتے" },
  "assistant.issue.api.action": { ar: "إعادة المحاولة ثم التحقق من /api/system/health", en: "Retry, then check /api/system/health", ur: "دوبارہ کوشش کریں، پھر /api/system/health دیکھیں" },
  "assistant.issue.api.next": { ar: "إبلاغ مهندس المنصة إذا استمر الانقطاع أكثر من ٥ دقائق", en: "Page the platform engineer if it lasts beyond 5 minutes", ur: "۵ منٹ سے زیادہ رہے تو پلیٹ فارم انجینئر کو اطلاع دیں" },

  "assistant.issue.notification.title": { ar: "فشل في تسليم إشعار", en: "A notification failed to deliver", ur: "اطلاع نہیں پہنچ سکی" },
  "assistant.issue.notification.cause": { ar: "عدم وجود مسؤول مطابق للدور أو رفض من قناة الإرسال", en: "No matching role owner, or the delivery channel rejected it", ur: "متعلقہ کردار نہیں ملا یا چینل نے مسترد کیا" },
  "assistant.issue.notification.impact": { ar: "قد لا يعلم المسؤول بالمشكلة في الوقت المناسب", en: "The responsible party may not learn about the issue in time", ur: "ذمہ دار کو وقت پر معلوم نہیں ہوگا" },
  "assistant.issue.notification.action": { ar: "إعادة توجيه الإشعار للدور المسؤول وتصعيده عند التكرار", en: "Re-route to the owning role and escalate on repeat failures", ur: "متعلقہ کردار کو دوبارہ بھیجیں اور دہرائی پر تصعید کریں" },
  "assistant.issue.notification.next": { ar: "التحقق من سجل الإشعارات في مركز الإشعارات", en: "Verify delivery in the notifications center log", ur: "اطلاعات مرکز میں لاگ چیک کریں" },

  "assistant.issue.sync.title": { ar: "عدم تطابق في المزامنة", en: "Synchronisation mismatch", ur: "مطابقت میں فرق" },
  "assistant.issue.sync.cause": { ar: "تعديل محلي لم يُرسل للخادم بسبب انقطاع مؤقت", en: "A local change never reached the server during an outage", ur: "مقامی تبدیلی بندش کے دوران سرور تک نہیں پہنچی" },
  "assistant.issue.sync.impact": { ar: "بيانات غير متطابقة بين الواجهة والسجل المركزي", en: "The UI and the central record disagree", ur: "انٹرفیس اور مرکزی ریکارڈ میں فرق" },
  "assistant.issue.sync.action": { ar: "إعادة مزامنة الرحلات من الشريط العلوي ثم مقارنة الأرشيف", en: "Re-sync trips from the toolbar, then compare with the archive", ur: "ٹول بار سے دوبارہ مطابقت کریں پھر آرکائیو سے موازنہ" },
  "assistant.issue.sync.next": { ar: "تسجيل الفرق في سجل التدقيق إن استمر", en: "Record the difference in the audit log if it persists", ur: "برقرار رہے تو آڈٹ لاگ میں درج کریں" },

  "assistant.issue.auth.title": { ar: "محاولة دخول غير مكتملة", en: "An incomplete sign-in attempt", ur: "نامکمل سائن اِن کوشش" },
  "assistant.issue.auth.cause": { ar: "انتهاء صلاحية الجلسة أو رفض بيانات الدخول", en: "Expired session token or rejected credentials", ur: "سیشن ختم یا تفصیلات مسترد" },
  "assistant.issue.auth.impact": { ar: "تعذّر الوصول للشاشات والواجهات المحمية", en: "Protected screens and endpoints are unreachable", ur: "محفوظ اسکرینیں دستیاب نہیں" },
  "assistant.issue.auth.action": { ar: "إعادة تسجيل الدخول أو تحديث الجلسة من قائمة الحساب", en: "Sign in again, or refresh the session from the account menu", ur: "دوبارہ سائن اِن کریں یا اکاؤنٹ مینیو سے سیشن تازہ کریں" },
  "assistant.issue.auth.next": { ar: "مراجعة سجل التدقيق الأمني في حال تكرار المحاولات", en: "Review the security audit trail if attempts repeat", ur: "کوششیں دہرائیں تو سیکیورٹی آڈٹ دیکھیں" },

  "assistant.issue.data.title": { ar: "بيانات ناقصة في سجل رحلة", en: "Incomplete trip record", ur: "ادھورا ٹرپ ریکارڈ" },
  "assistant.issue.data.cause": { ar: "حقوق مطلوبة غير مُعبّأة (بوليصة، وزن، توقيع مستلم)", en: "Required fields are empty (waybill, weight, consignee signature)", ur: "لازمی خانے خالی (بارنامہ، وزن، دستخط)" },
  "assistant.issue.data.impact": { ar: "تعذّر إصدار إثبات التسليم أو إقفال الرحلة", en: "POD cannot be issued and the trip cannot be closed", ur: "POD جاری نہیں اور ٹرپ بند نہیں ہو سکتا" },
  "assistant.issue.data.action": { ar: "إكمال الحقول الناقصة من تفاصيل الرحلة", en: "Complete the missing fields from the trip details", ur: "ٹرپ تفصیلات سے ادھورے خانے مکمل کریں" },
  "assistant.issue.data.next": { ar: "إعادة محاولة الإقفال ثم التحقق من أرشيف الرحلات", en: "Retry the closure, then verify in the trip archive", ur: "بندش دوبارہ کریں پھر آرکائیو دیکھیں" },

  "assistant.issue.temp.title": { ar: "انحراف في حرارة التبريد", en: "Reefer temperature drift", ur: "ریفر درجہ حرارت میں فرق" },
  "assistant.issue.temp.cause": { ar: "تغيّر قراءة الحساس أو توقف وحدة التبريد لحظيًا", en: "Sensor drift or a brief refrigeration unit pause", ur: "سینسر کا فرق یا ریفر یونٹ کا مختصر قیام" },
  "assistant.issue.temp.impact": { ar: "خطر على سلامة الشحنة المبردة واشتراطات الجهات الرقابية", en: "Cargo integrity and regulatory compliance are at risk", ur: "کھیپ کی سلامتی اور ضوابط خطرے میں" },
  "assistant.issue.temp.action": { ar: "تأكيد القراءة مع السائق وتوثيقها في سجل الرحلة", en: "Confirm the reading with the driver and log it on the trip", ur: "ڈرائیور سے تصدیق کرائیں اور ٹرپ میں درج کریں" },
  "assistant.issue.temp.next": { ar: "تصعيد للمشرف الفني عند استمرار الانحراف", en: "Escalate to the technical supervisor if the drift persists", ur: "برقرار رہے تو ٹیکنیکل سپروائزر کو بھیجیں" },

  "assistant.issue.docs.title": { ar: "وثيقة على وشك الانتهاء", en: "A document is about to expire", ur: "دستاویز کی میعاد قریب" },
  "assistant.issue.docs.cause": { ar: "عدم تجديد الترخيص أو شهادة الفحص قبل التاريخ النظامي", en: "The permit or inspection certificate was not renewed in time", ur: "لائسنس یا سرٹیفکیٹ وقت پر تجدید نہیں ہوا" },
  "assistant.issue.docs.impact": { ar: "خطر إيقاف المركبة عن العمل عند أي تفتيش", en: "The unit risks being grounded at an inspection", ur: "جانچ پر گاڑی روکنے کا خطرہ" },
  "assistant.issue.docs.action": { ar: "جدولة التجديد مع الورشة وتحديث الوثيقة في النظام", en: "Schedule renewal with the workshop and update the record", ur: "ورکشاپ سے تجدید شیڈول کریں اور ریکارڈ اپ ڈیٹ کریں" },
  "assistant.issue.docs.next": { ar: "متابعة الطلب أسبوعيًا حتى الإغلاق", en: "Track the request weekly until it closes", ur: "بندش تک ہفتہ وار نگرانی" },

  "assistant.issue.utilization.title": { ar: "شاحنة جاهزة دون تكليف", en: "An available truck without an assignment", ur: "دستیاب ٹرک بغیر ڈیوٹی" },
  "assistant.issue.utilization.cause": { ar: "عدم ربط الشاحنة بأي رحلة قادمة في خطة التشغيل", en: "The unit is not linked to any upcoming trip in the plan", ur: "یونٹ کسی آنے والے ٹرپ سے منسلک نہیں" },
  "assistant.issue.utilization.impact": { ar: "تآكل في العائد وإطارات فارغة غير ضرورية", en: "Revenue erosion and avoidable empty running", ur: "آمدنی میں کمی اور خالی سفر" },
  "assistant.issue.utilization.action": { ar: "توزيع الشاحنة على أقرب حمولة معلّقة من مركز العمليات", en: "Assign it to the nearest pending load from the ops center", ur: "آپریشنز سینٹر سے قریب ترین لوڈ دیں" },
  "assistant.issue.utilization.next": { ar: "تأكيد الانطلاق وتسجيل الرحلة على الخادم", en: "Confirm departure and log the trip on the server", ur: "روانگی کی تصدیق اور ٹرپ سرور پر درج کریں" },

  "assistant.issue.system.title": { ar: "خلل تشغيلي في النظام", en: "A system-level fault", ur: "سسٹم میں خرابی" },
  "assistant.issue.system.cause": { ar: "استثناء برمجي أثناء تنفيذ العملية", en: "A runtime exception while the operation was executing", ur: "کارروائی کے دوران استثناء" },
  "assistant.issue.system.impact": { ar: "قد تتوقف عملية واحدة دون بقية النظام", en: "One operation may fail while the rest keeps running", ur: "ایک کارروائی رک سکتی ہے" },
  "assistant.issue.system.action": { ar: "إعادة تنفيذ العملية ومراجعة سجل التدقيق", en: "Retry the operation and review the audit trail", ur: "کارروائی دوبارہ کریں اور آڈٹ دیکھیں" },
  "assistant.issue.system.next": { ar: "إبلاغ مهندس المنصة مع رقم العملية والوقت", en: "Report to the platform engineer with the operation id and time", ur: "آپریشن نمبر اور وقت کے ساتھ انجینئر کو اطلاع دیں" },

  "assistant.severityLabel": { ar: "مستوى الخطورة", en: "Severity", ur: "شدت" },
  "assistant.issuesCount": { ar: "{count} مشاكل نشطة في نطاقك", en: "{count} active issues in your scope", ur: "آپ کے دائرے میں {count} فعال مسائل" },
  "assistant.ownerOps": { ar: "غرفة العمليات", en: "Operations room", ur: "آپریشنز روم" },
  "assistant.ownerDispatcher": { ar: "مسؤول التوجيه", en: "Dispatch officer", ur: "ڈسپیچ افسر" },
  "assistant.ownerDriver": { ar: "السائق الميداني", en: "Field driver", ur: "فیلڈ ڈرائیور" },
  "assistant.ownerMaintenance": { ar: "مشرف الصيانة", en: "Maintenance supervisor", ur: "مینٹیننس سپروائزر" },
  "assistant.ownerIT": { ar: "مهندس المنصة", en: "Platform engineer", ur: "پلیٹ فارم انجینئر" },
  "assistant.ownerClient": { ar: "خدمة العملاء", en: "Customer service", ur: "کسٹمر سروس" },

  /* ── Assistant · answers ───────────────────────────────────────────── */
  "assistant.answer.greeting": {
    ar: "مرحبًا {name}. دورك {role} والصفحة الحالية {page}. اسألني عن الرحلات، التأخير، السائقين أو التنبيهات المفتوحة.",
    en: "Hello {name}. You are signed in as {role}, currently on {page}. Ask me about trips, delays, drivers or open alerts.",
    ur: "خوش آمدید {name}۔ آپ {role} ہیں اور {page} پر ہیں۔ ٹرپس، تاخیر، ڈرائیورز یا اطلاعات کے بارے میں پوچھیں۔",
  },
  "assistant.answer.denied": {
    ar: "لا أملك صلاحية الوصول لهذه البيانات بحسابك الحالي ({role}). أستطيع مساعدتك في نطاق صلاحياتك فقط.",
    en: "That data is outside your current permissions ({role}). I can only help inside your authorised scope.",
    ur: "یہ ڈیٹا آپ کی اجازتوں ({role}) سے باہر ہے۔ میں صرف آپ کے دائرے میں مدد کر سکتا ہوں۔",
  },
  "assistant.answer.noTrip": {
    ar: "لا توجد رحلة مفتوحة الآن. اختر رحلة من إدارة الرحلات وسأعرض تفاصيلها كاملة.",
    en: "No trip is open right now. Pick one in Trips and I will break it down for you.",
    ur: "ابھی کوئی ٹرپ کھلا نہیں۔ ٹرپس میں ایک منتخب کریں، میں تفصیل بتاؤں گا۔",
  },
  "assistant.answer.tripStatus": {
    ar: "الرحلة {trip} من {origin} إلى {destination}: الحالة {status}، السرعة {speed}، تبقّى {remaining} كم، والوصول المتوقع بعد {eta} دقيقة.",
    en: "Trip {trip} from {origin} to {destination}: status {status}, speed {speed}, {remaining} km remaining, ETA in {eta} minutes.",
    ur: "ٹرپ {trip} از {origin} تا {destination}: حالت {status}، رفتار {speed}، باقی {remaining} کلومیٹر، آمد {eta} منٹ میں۔",
  },
  "assistant.answer.delays": {
    ar: "{count} رحلة عليها خطر تأخير: {list}",
    en: "{count} trips carry delay risk: {list}",
    ur: "{count} ٹرپس تاخیر کے خطرے میں: {list}",
  },
  "assistant.answer.noDelays": {
    ar: "لا توجد رحلات متأخرة أو معرّضة للتأخير حاليًا في نطاق صلاحياتك.",
    en: "No delayed or at-risk trips right now inside your scope.",
    ur: "آپ کے دائرے میں اس وقت کوئی تاخیر والا ٹرپ نہیں۔",
  },
  "assistant.answer.driver": {
    ar: "السائق {name} مسؤول عن الرحلة {trip}، هاتفه {phone}، وتقييمه {rating} من ٥.",
    en: "Driver {name} is on trip {trip}, phone {phone}, rated {rating} of 5.",
    ur: "ڈرائیور {name} ٹرپ {trip} پر ہے، فون {phone}، درجہ {rating}/5۔",
  },
  "assistant.answer.truck": {
    ar: "المركبة {plate} ({body}) مخصصة للرحلة {trip}، سعتها {capacity} طن والحمولة الحالية {load} طن.",
    en: "Vehicle {plate} ({body}) serves trip {trip}: capacity {capacity} t, current load {load} t.",
    ur: "گاڑی {plate} ({body}) ٹرپ {trip} پر: گنجائش {capacity} ٹن، موجودہ وزن {load} ٹن۔",
  },
  "assistant.answer.alerts": {
    ar: "لديك {count} تنبيه نشط: {list}",
    en: "You have {count} active notifications: {list}",
    ur: "آپ کے پاس {count} فعال اطلاعات: {list}",
  },
  "assistant.answer.noAlerts": {
    ar: "لا توجد تنبيهات نشطة موجهة لدورك الآن — كل الرحلات داخل الحدود الطبيعية.",
    en: "No active notifications for your role right now — every trip is within normal limits.",
    ur: "آپ کے کردار کے لیے کوئی اطلاع نہیں — تمام ٹرپس معمول کے مطابق ہیں۔",
  },
  "assistant.answer.shipment": {
    ar: "الشحنة {shipment} للعميل {client}: {status}، وتبقّى {remaining} كم حتى {destination}.",
    en: "Shipment {shipment} for {client}: {status}, {remaining} km to {destination}.",
    ur: "کھیپ {shipment} برائے {client}: {status}، {destination} تک {remaining} کلومیٹر۔",
  },
  "assistant.answer.nextStep": {
    ar: "الخطوة التالية المقترحة: {action}",
    en: "Suggested next step: {action}",
    ur: "تجویز کردہ اگلا قدم: {action}",
  },
  "assistant.answer.capability": {
    ar: "أستطيع: متابعة الرحلات والشحنات، كشف التأخير والمشاكل، شرح الإجراءات، تجهيز تنبيه للمسؤول، وتلخيص التقارير — داخل نطاق صلاحياتك فقط.",
    en: "I can: track trips and shipments, detect delays and incidents, explain procedures, route a notification to the owner, and summarise reports — always inside your permissions.",
    ur: "میں ٹرپس اور کھیپ ٹریک، تاخیر اور مسائل کی نشاندہی، طریقہ کار کی وضاحت، ذمہ دار کو اطلاع اور رپورٹس کا خلاصہ کر سکتا ہوں — صرف آپ کی اجازتوں کے دائرے میں۔",
  },

  /* ── Trip status labels (shared by the console, mobile and the assistant) ── */
  "status.on_road": { ar: "على الطريق", en: "On route", ur: "راستے میں" },
  "status.waiting": { ar: "في الانتظار", en: "Waiting", ur: "انتظار میں" },
  "status.loading": { ar: "قيد التحميل", en: "Loading", ur: "لوڈنگ جاری" },
  "status.ready": { ar: "جاهزة للانطلاق", en: "Ready for departure", ur: "روانگی کے لیے تیار" },
  "status.planning": { ar: "قيد التجهيز", en: "Planning", ur: "منصوبہ بندی" },
  "status.arrived": { ar: "وصلت للموقع", en: "Arrived on site", ur: "منزل پر پہنچ گیا" },
  "status.delivered": { ar: "تم التسليم", en: "Delivered", ur: "ڈیلیور ہو گیا" },
  "status.cancelled": { ar: "ملغاة", en: "Cancelled", ur: "منسوخ" },
  "status.completed": { ar: "مكتملة", en: "Completed", ur: "مکمل" },
  "status.inactive": { ar: "متوقفة", en: "Inactive", ur: "غیر فعال" },

  /* ── Assistant · contextual suggestions per page/role (§23) ───────────── */
  "assistant.suggest.delayReason": { ar: "ما سبب تأخر الرحلة الحالية؟", en: "Why is the open trip delayed?", ur: "کھلے ٹرپ میں تاخیر کی وجہ؟" },
  "assistant.suggest.lastDriverUpdate": { ar: "اعرض آخر تحديث من السائق", en: "Show the driver's last update", ur: "ڈرائیور کی آخری اپ ڈیٹ دکھائیں" },
  "assistant.suggest.alertAdmin": { ar: "أرسل تنبيها للمسؤول", en: "Send a notification to the owner", ur: "ذمہ دار کو اطلاع بھیجیں" },
  "assistant.suggest.openAlerts": { ar: "ما التنبيهات النشطة عليّ؟", en: "Which notifications are open for me?", ur: "میرے لیے کون سی اطلاعات فعال ہیں؟" },
  "assistant.suggest.eta": { ar: "ما وقت الوصول المتوقع؟", en: "What is the expected arrival?", ur: "متوقع آمد کا وقت کیا ہے؟" },
  "assistant.suggest.nextStop": { ar: "ما المحطة التالية؟", en: "What is the next waypoint?", ur: "اگلا اسٹاپ کہاں ہے؟" },
  "assistant.suggest.myTrip": { ar: "اعرض تفاصيل رحلتي", en: "Show my current trip", ur: "میرا موجودہ ٹرپ دکھائیں" },
  "assistant.suggest.reportProblem": { ar: "أريد الإبلاغ عن مشكلة", en: "I want to report a problem", ur: "میں مسئلہ رپورٹ کرنا چاہتا ہوں" },
  "assistant.suggest.contactOps": { ar: "كيف أتواصل مع غرفة العمليات؟", en: "How do I reach the operations room?", ur: "آپریشنز روم سے رابطہ کیسے کروں؟" },
  "assistant.suggest.shipmentStatus": { ar: "ما حالة شحنتي؟", en: "What is my shipment status?", ur: "میری کھیپ کی حالت؟" },
  "assistant.suggest.deliveryDate": { ar: "متى يصل الطلب؟", en: "When will it arrive?", ur: "یہ کب پہنچے گا؟" },
  "assistant.suggest.delays": { ar: "ما الرحلات المتأخرة اليوم؟", en: "Which trips are late today?", ur: "آج کون سے ٹرپس تاخیر میں ہیں؟" },
  "assistant.suggest.drivers": { ar: "حالة السائقين على الطريق", en: "Driver status on the road", ur: "سڑک پر ڈرائیورز کی حالت" },
  "assistant.suggest.utilization": { ar: "أي شاحنات جاهزة دون تكليف؟", en: "Which trucks are idle without a load?", ur: "کون سے ٹرک فارغ ہیں؟" },
  "assistant.suggest.operations": { ar: "لخّص لي العمليات الآن", en: "Summarise operations for me", ur: "آپریشنز کا خلاصہ دیں" },
  "assistant.suggest.system": { ar: "هل هناك خلل تقني في النظام؟", en: "Any technical faults in the system?", ur: "کوئی تکنیکی خرابی ہے؟" },
  "assistant.answer.summary": {
    ar: "ملخص التشغيل: {trips} رحلة نشطة، منها {late} متأخرة، و{idle} شاحنة متاحة، و{alerts} تنبيه مفتوح.",
    en: "Operations summary: {trips} active trips, {late} late, {idle} trucks available, {alerts} open notifications.",
    ur: "آپریشنز خلاصہ: {trips} فعال ٹرپس، {late} تاخیر، {idle} دستیاب ٹرک، {alerts} کھلی اطلاعات۔",
  },
  "assistant.answer.reportAck": {
    ar: "تم تسجيل بلاغك وربطه بالرحلة {trip}. سيتولى {owner} المتابعة، ورقم البلاغ {id}.",
    en: "Your report is logged against trip {trip}. {owner} will follow up; reference {id}.",
    ur: "آپ کی شکایت ٹرپ {trip} سے منسلک کر دی گئی۔ {owner} کارروائی کرے گا، حوالہ {id}۔",
  },
  "assistant.reportPlaceholder": { ar: "اكتب وصف المشكلة…", en: "Describe the problem…", ur: "مسئلے کی تفصیل لکھیں…" },
  "assistant.reportSend": { ar: "إرسال البلاغ", en: "Send report", ur: "شکایت بھیجیں" },
} as const satisfies Record<string, MessageEntry>;

export type I18nKey = keyof typeof MESSAGES;

/** Replace `{name}` placeholders in a translated string. */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/** Translate a central key into the active language. */
export function translateKey(
  lang: Lang,
  key: I18nKey,
  vars?: Record<string, string | number>,
): string {
  const entry = MESSAGES[key] as MessageEntry | undefined;
  if (!entry) return key;
  const value = entry[lang] ?? entry.en ?? entry.ar ?? key;
  return interpolate(value, vars);
}

export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "en" ? "ltr" : "rtl";
}

/** Native label + flag for the three supported languages (one source of truth). */
export const LANGUAGE_OPTIONS: { code: Lang; flag: string; labelKey: I18nKey; hintKey: I18nKey }[] = [
  { code: "ar", flag: "🇾🇪", labelKey: "language.ar", hintKey: "language.arHint" },
  { code: "en", flag: "🇬🇧", labelKey: "language.en", hintKey: "language.enHint" },
  { code: "ur", flag: "🇵🇰", labelKey: "language.ur", hintKey: "language.urHint" },
];
