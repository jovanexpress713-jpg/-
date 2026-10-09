# مؤسسة إيجاز للنقليات · EJAZ Transport Platform

منصة موحدة لإدارة وتتبع أسطول الشاحنات الثقيلة والرحلات اللوجستية (تطبيق السائق والعميل + غرفة التحكم الإدارية + خادم Express المركزي).

## هيكل المشروع · Project Structure

```
├── data/
│   └── vehicle-asset-registry.json   # سجل الأصول المركزي (الأنواع الأربعة المعتمدة)
├── docs/                             # تقارير التدقيق والتوثيق الفني والأمني
│   ├── EJAZ_AUDIT_REPORT.md
│   ├── EJAZ_CONSOLE_VISUAL_AUDIT.md   # التدقيق البصري — البنود الستة (كلها مغلقة)
│   ├── EJAZ_DESIGN_SCALE_MIGRATION.md # سجل توحيد مقياس الخطوط والزوايا
│   ├── EJAZ_FINAL_SYNC_VERIFICATION.md
│   ├── EJAZ_FINAL_VERIFICATION_REPORT.md
│   ├── EJAZ_FUNCTIONAL_MAP.md
│   ├── EJAZ_NOVA_DESIGN_SYSTEM.md
│   └── EJAZ_SECURITY_HARDENING_REPORT.md
├── public/
│   ├── images/trucks/official/       # الصور الرسمية المعتمدة للأنواع الأربعة (PNG + WebP)
│   └── models/trucks/                # مجلد المجسمات ثلاثية الأبعاد (GLB/glTF)
├── scripts/                          # أدوات النشر والتحقق الحي
│   ├── i18n-audit.mjs
│   ├── migrate-design-tokens.mjs      # مُحوِّل المقياس القانوني (+ وضع --check للـ CI)
│   ├── probe-rbac.mjs
│   ├── publish-vehicle-asset.mjs
│   ├── verify-fleet-imagery.tsx
│   ├── verify-registration-flow.mjs
│   └── verify-upload-propagation.mjs
├── src/
│   ├── components/                   # مكونات غرفة التحكم والواجهات المشتركة
│   │   ├── TruckTypeIcon.tsx         # محلّل أيقونة نوع الشاحنة (٤ فئات، قابل للتوسع)
│   │   ├── TruckSpecs.tsx            # صفوف وبطاقات مواصفات المركبة مع أيقوناتها
│   │   ├── orbit.ts                  # مُكامِل المدار ثلاثي الأبعاد (سحب، قصور، ٣٦٠°)
│   │   └── Vehicle3DViewer.tsx       # عارض النماذج الأربعة التفاعلي
│   ├── data/                         # الأنواع المعتمدة وبيانات الأسطول والمسارات
│   ├── hooks/                        # الخطافات المشتركة (المؤقتات والتتبع)
│   ├── localization/                 # القواميس متعددة اللغات (العربية · English · اردو)
│   ├── mobile/                       # تطبيق الجوال (تسجيل الدخول، طلب التسجيل، وضع السائق، وضع العميل)
│   ├── server/                       # خادم Express، المصادقة والصلاحيات، المسارات، والخدمات
│   ├── services/                     # عميل API الموحد ومحاكاة المسارات
│   ├── state/                        # مخازن الحالة المركزية (الأسطول وأصول المركبات)
│   └── utils/                        # أدوات مساعدة
├── tests/                            # مجموعات الاختبار الآلية (٢٤ مجموعة)
├── index.html                        # نقطة الدخول مع حارس شاشة الإقلاع (__EJAZ_BOOT__)
├── server.ts                         # مشغل الخادم الموحد (Express + Vite HMR / Static)
├── tsconfig.json
└── vite.config.ts
```

## الأوامر المتاحة · Scripts

| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل الخادم الموحد في وضع التطوير على المنفذ `3000` |
| `npm test` | تشغيل مجموعات الاختبار الأربع والعشرين كلها (`tests/runAllTests.ts`) |
| `npm run lint` | فحص الأنواع الصارم عبر TypeScript (`tsc --noEmit`) |
| `npm run build` | بناء حزمة الإنتاج المقسمة في `dist/` |
| `npm run verify:fleet-imagery` | التحقق من توحيد صور الأسطول الرسمية عبر جميع الشاشات |
| `npm run verify:registration` | التحقق الحي من دورة طلب التسجيل والمراجعة والاعتماد |
| `npm run verify:upload` | التحقق الحي من رفع صور المركبات وانتشارها الفوري |
| `npm run verify:design-scale` | فحص المقياس القانوني: يفشل (`exit 1`) إن بقي حجم أو زايا اعتباطية في `src/` |

## التفاعل ثلاثي الأبعاد وأيقونات الأنواع · 3D Interaction & Type Icons

- **العارض التفاعلي** — `Vehicle3DViewer` يعرض النماذج الأربعة الموجودة في المشروع
  (سطحة · براد · جاف · ستارة) تفاعليًا بشكل افتراضي: سحب بالماوس أو باللمس، دوران
  أفقي كامل ٣٦٠°، زاوية علوية لرؤية السقف وزاوية منخفضة لرؤية العجلات، مع تكبير
  وتصغير. الحركة مُخمَّدة عبر `src/components/orbit.ts` (تتبّع أُسّي مستقل عن معدل
  الإطارات + قصور ذاتي عند الإفلات) فلا قفزات ولا اهتزاز. لا يوجد LOD ولا خفض
  لدقة البكسل أثناء السحب؛ الظلال عبر `ShadowMaterial` فلا تلمس مواد الشاحنة.
  ميزانية سياقات WebGL (`MAX_LIVE_WEBGL_CONTEXTS`) تمنع فقدان السياق عند عرض
  الأسطول كاملًا في شبكة واحدة.
- **أيقونات الأنواع** — `TruckTypeIcon` يستقبل قيمة النوع (`trip.cargoType` أو
  `vehicle.body` أو أي صيغة قديمة/عربية) ويعيد الأيقونة المطابقة. لإضافة فئة خامسة:
  أضِفها في `src/data/vehicleTypes.ts` ثم أضِف مدخلًا واحدًا في `TRUCK_TYPE_ICONS`،
  وكل الشاشات تلتقطها تلقائيًا.
- **شاشة الترحيب** — `SplashScreen` هي نقطة البداية الفعلية للتطبيق؛ زر «الترحيب»
  أُزيل من الشريط العلوي ومن كل منطق يعتمد عليه. جلسة محفوظة صحيحة تعيد المستخدم
  إلى التطبيق الرئيسي مباشرة دون إعادة تسجيل دخول.

## المقياس القانوني للخطوط والزوايا · The Canonical Scale

مُعلَن مرة واحدة في `@theme static` أعلى `src/index.css`. منه تُولَّد أدوات
Tailwind (`text-label`، `rounded-chip`) **و** المتغيرات (`--text-label`) التي تشير
إليها كل الرموز القديمة (`--ds-text-*`، `--type-*`، `--ds-radius-*`)، فلا يوجد رقم
مكرر يمكن أن ينحرف.

| الخطوط | px | | الزوايا | px |
|---|---:|---|---|---:|
| `text-micro` | 10 | | `rounded-micro` | 6 |
| `text-label` | 11 | | `rounded-chip` | 8 |
| `text-label-lg` | 12 | | `rounded-control` | 10 |
| `text-body` | 13 | | `rounded-inner` | 12 |
| `text-card-title` | 14 | | `rounded-panel` | 16 |
| `text-page-title` | 16 | | `rounded-card` | 20 |
| `text-section-title` | 18 | | `rounded-hero` | 24 |
| `text-headline` | 20 | | `rounded-full` | حبة/صورة رمزية |
| `text-hero-sm` | 22 | | | |
| `text-hero` | 26 | | | |
| `text-metric` | 28 | | | |
| `text-metric-lg` | 36 | | | |

**قواعد لا تُكسر:**

- لا حجم خط تحت **١٠ بكسل** — الوثيقة `lang="ar" dir="rtl"`، والحرف العربي المتصل
  يفقد عُيونه والتشكيلُ وضوحه تحت هذا الحد.
- لا **نصف بكسل** في أي مكان: `10.5` و`11.5` و`12.5` فروق لا تقرأها العين، فتُنتج
  ضوضاء بدل تراتبية.
- لا أحجام Tailwind الافتراضية (`text-xs`، `rounded-xl`…): كانت تكرر الدرجات نفسها
  بأسماء ثانية (`text-xs` = ١٢ = `text-label-lg`)، فطُويت كلها.
- **لإضافة درجة:** أضِفها في `@theme static` وفي `TEXT_STEPS`/`RADIUS_STEPS` داخل
  `tests/designScale.test.ts` معًا، وإلا فشل الفحص (A) — وهذا مقصود.
- **إن كتبت حجمًا اعتباطيًا بالخطأ:** `npm run migrate:design-scale` يكمّمه على أقرب
  درجة، و`npm run verify:design-scale` يفشل في CI إن بقي واحد.

الاستثناءات الثلاثة المكتوبة (وحدات SVG داخل `viewBox`، وذيل فقاعة المحادثة
`rounded-ee-sm`/`rounded-es-sm`، و`index.html` الذي يُرسم قبل ورقة الأنماط)
مُثبَّتة باختبارات في المجموعة (E) حتى لا تتحول إلى ثغرة.

السجل الكامل: [`docs/EJAZ_DESIGN_SCALE_MIGRATION.md`](./docs/EJAZ_DESIGN_SCALE_MIGRATION.md)
— ٢٬١٣٧ موضعًا، أكبر إزاحة ٢ بكسل، وصفر إزاحة في كل ما طُوي من أحجام Tailwind.

### مجموعات الاختبار المضافة · Added test suites

| المجموعة | ما تتحقق منه |
|---|---|
| `uiInteraction.test.ts` | تعيين أيقونة لكل فئة (عرض فعلي عبر `react-dom/server`)، عقد تفاعل الـ3D، غياب زر «الترحيب» |
| `runtimeUi.test.ts` | مُكامِل المدار (٣٦٠°، السقف، العجلات، التخميد، القصور، استقلالية معدل الإطارات) + تركيب React حقيقي داخل jsdom لتدفق الترحيب وأيقونات بطاقات الرحلات |
| `responsiveAudit.test.ts` | تدقيق بنيوي يمنع الفيض الأفقي على عرض ٣٢٠ بكسل |
| `designScale.test.ts` | المقياس القانوني: ١٢ درجة خط و٧ درجات زوايا مُثبَّتة، كلها أعداد صحيحة وأرضيتها ١٠ بكسل، صفر `text-[Npx]`/`rounded-[Npx]`/أحجام Tailwind المكررة، وكل أداة مستخدمة مُعلَنة فعلًا (يمنع `text-lable` التي لا تولّد CSS) |
