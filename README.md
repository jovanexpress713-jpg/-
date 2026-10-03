# مؤسسة إيجاز للنقليات · EJAZ Transport Platform

منصة موحدة لإدارة وتتبع أسطول الشاحنات الثقيلة والرحلات اللوجستية (تطبيق السائق والعميل + غرفة التحكم الإدارية + خادم Express المركزي).

## هيكل المشروع · Project Structure

```
├── data/
│   └── vehicle-asset-registry.json   # سجل الأصول المركزي (الأنواع الأربعة المعتمدة)
├── docs/                             # تقارير التدقيق والتوثيق الفني والأمني
│   ├── EJAZ_AUDIT_REPORT.md
│   ├── EJAZ_FINAL_SYNC_VERIFICATION.md
│   ├── EJAZ_FINAL_VERIFICATION_REPORT.md
│   ├── EJAZ_FUNCTIONAL_MAP.md
│   └── EJAZ_SECURITY_HARDENING_REPORT.md
├── public/
│   ├── images/trucks/official/       # الصور الرسمية المعتمدة للأنواع الأربعة (PNG + WebP)
│   └── models/trucks/                # مجلد المجسمات ثلاثية الأبعاد (GLB/glTF)
├── scripts/                          # أدوات النشر والتحقق الحي
│   ├── publish-vehicle-asset.mjs
│   ├── verify-fleet-imagery.tsx
│   ├── verify-registration-flow.mjs
│   └── verify-upload-propagation.mjs
├── src/
│   ├── components/                   # مكونات غرفة التحكم والواجهات المشتركة
│   ├── data/                         # الأنواع المعتمدة وبيانات الأسطول والمسارات
│   ├── hooks/                        # الخطافات المشتركة (المؤقتات والتتبع)
│   ├── localization/                 # القواميس متعددة اللغات (العربية · English · اردو)
│   ├── mobile/                       # تطبيق الجوال (تسجيل الدخول، طلب التسجيل، وضع السائق، وضع العميل)
│   ├── server/                       # خادم Express، المصادقة والصلاحيات، المسارات، والخدمات
│   ├── services/                     # عميل API الموحد ومحاكاة المسارات
│   ├── state/                        # مخازن الحالة المركزية (الأسطول وأصول المركبات)
│   └── utils/                        # أدوات مساعدة
├── tests/                            # مجموعات الاختبار الآلية (9 مجموعات)
├── index.html                        # نقطة الدخول مع حارس شاشة الإقلاع (__EJAZ_BOOT__)
├── server.ts                         # مشغل الخادم الموحد (Express + Vite HMR / Static)
├── tsconfig.json
└── vite.config.ts
```

## الأوامر المتاحة · Scripts

| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل الخادم الموحد في وضع التطوير على المنفذ `3000` |
| `npm test` | تشغيل جميع مجموعات الاختبار التسع (`tests/runAllTests.ts`) |
| `npm run lint` | فحص الأنواع الصارم عبر TypeScript (`tsc --noEmit`) |
| `npm run build` | بناء حزمة الإنتاج المقسمة في `dist/` |
| `npm run verify:fleet-imagery` | التحقق من توحيد صور الأسطول الرسمية عبر جميع الشاشات |
| `npm run verify:registration` | التحقق الحي من دورة طلب التسجيل والمراجعة والاعتماد |
| `npm run verify:upload` | التحقق الحي من رفع صور المركبات وانتشارها الفوري |
