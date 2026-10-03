# تقرير التحقق المستقل وتقوية الأمان
# EJAZ TRANSPORT — INDEPENDENT VERIFICATION & SECURITY HARDENING REPORT
**Date:** 2026-10-03
**Branch:** `arena/01a101f2-repo`
**Baseline:** commit `e07c1f5` (feat(ui): implement external 3D model loading for vehicles)
**Method:** Independent black-box + white-box audit — live HTTP probing of the running platform, then source-level root-cause analysis and remediation.

---

## 1. ملخص تنفيذي (Executive Summary)

تم تشغيل المنصة فعلياً وفحصها من الخارج (Live API probing) ومن الداخل (Source review). خلافاً لما ورد في تقارير التحقق السابقة بأن *"المصادقة وRBAC مُطبّقة ومُتحقق منها على جميع نقاط النهاية"*، أظهر الفحص **7 عيوب حرجة** تسمح بتجاوز الصلاحيات والوصول غير المصرح به للبيانات التشغيلية والمالية.

**تم إصلاح جميع العيوب الحرجة والتحقق منها باختبارات آلية جديدة تعمل داخل `npm test`.**

---

## 2. العيوب المكتشفة وإصلاحها (Findings & Remediation)

### 🔴 F-01 — كلمة مرور خلفية (Backdoor) تفتح أي حساب
| | |
|---|---|
| **الملف** | `src/server/routes/authRoutes.ts` |
| **الوصف** | احتوى منطق الدخول على الشرط `password === "Ejaz@2026!"` كبديل مستقل، ما يعني أن كلمة مرور واحدة تمنح الدخول لأي حساب — بما في ذلك `SUPER_ADMIN`. |
| **الإثبات** | `POST /api/auth/login {"email":"admin@ejaz.sa","password":"Ejaz@2026!"}` → **200 + JWT بحساب المدير العام** |
| **الإصلاح** | إزالة الشرط نهائياً. الاعتماد على `bcrypt.compare` فقط، مع مسار تجريبي اختياري مُقيّد (`ENABLE_DEMO_ACCOUNTS`) لا يعمل إلا على الحسابات التجريبية المحددة وبشرط عدم وجود تجزئة مخزنة. |
| **التحقق** | `EJAZ@2026!` على `admin@ejaz.sa` و`driver@ejaz.sa` → **401** |

### 🔴 F-02 — RBAC موجود لكنه غير مُطبّق على أي نقطة نهاية
| | |
|---|---|
| **الملفات** | جميع ملفات `src/server/routes/*.ts` |
| **الوصف** | مصفوفة `ROLE_PERMISSIONS` وحارسات `requireRole` / `requirePermission` كانت مُعرّفة لكنها مُستخدمة في ملف واحد فقط (`auditRoutes.ts`). |
| **الإثبات** | السائق (`DRIVER`) أنشأ رحلة بنجاح: `POST /api/trips` → **201 Created**، وقرأ دفتر المالية: `GET /api/finance/trips` → **200** |
| **الإصلاح** | تطبيق `requirePermission(...)` على **كل** نقطة نهاية تشغيلية (53 نقطة)، مع توسعة مصفوفة الصلاحيات لتشمل `trips.request`, `claims.view`, `customers.view`, `notifications.view`, `pod.view`, `gps.ingest` … إلخ. |
| **التحقق** | السائق: إنشاء رحلة → **403**، دفتر المالية → **403**، سجل التدقيق → **403**، سجل الأسطول → **403** |

### 🔴 F-03 — بيانات تشغيلية حساسة متاحة للجميع بدون تسجيل دخول
| | |
|---|---|
| **المصدر** | استخدام `optionalAuthenticate` على نقاط النهاية الحساسة |
| **الإثبات** | بدون أي رمز: `/api/trips` **200**، `/api/drivers` **200** (يشمل أرقام الهوية الوطنية ورقم الرخصة)، `/api/customers` **200** (يشمل السجل التجاري والرقم الضريبي)، `/api/finance/trips` **200**، `/api/claims` **200** |
| **الإصلاح** | تحويل جميع نقاط النهاية التشغيلية إلى `authenticate` + `requirePermission`. النقاط العامة المتبقية هي فقط `/api/health`, `/api/system/maps-config`, `/api/auth/login`, `/api/auth/demo-accounts`. |
| **التحقق** | 11 نقطة نهاية اختُبرت مجهولة الهوية → **401** لكل منها |

### 🔴 F-04 — محرك دورة الحياة معطّل: الانتقال `CONFIRMED → ASSIGNED` مستحيل
| | |
|---|---|
| **الملف** | `src/server/services/tripLifecycleService.ts` |
| **الوصف** | القاعدة تتطلب الحقول `vehicle_id` و`driver_id` بينما كيان الرحلة يستخدم `vehicleId` و`driverId`، فكان الفحص يفشل دائماً. |
| **الأثر** | **لا يمكن لأي رحلة أن تصل إلى `IN_TRANSIT` أو `DELIVERED` عبر الآلة الحالة المعيارية** — السلسلة التشغيلية الأساسية موقوفة بالكامل. |
| **الإثبات** | `POST /api/trips/:id/transition {"targetStatus":"ASSIGNED"}` → **422 Missing required field 'vehicle_id'** رغم وجود شاحنة وسائق مُعيّنين |
| **الإصلاح** | قبول المفتاحين (`vehicleId` / `vehicle_id`) في التحقق، مع رفض القيم الفارغة و`"unassigned"`. |
| **التحقق** | سلسلة كاملة: `DRAFT_CREATED → … → DELIVERED` → **9 انتقالات ناجحة (200)** |

### 🔴 F-05 — إثبات التسليم (POD) يتجاوز الآلة الحالة
| | |
|---|---|
| **الملف** | `src/server/routes/podRoutes.ts` |
| **الوصف** | عند إنشاء POD كان الكود يكتب `trip.status = "DELIVERED"` مباشرة دون أي تحقق من الحالة الحالية أو الدور. |
| **الإثبات** | إنشاء POD لرحلة في حالة `DRAFT_CREATED` → **201 + حالة الرحلة أصبحت DELIVERED** |
| **الإصلاح** | تمرير الانتقال عبر `validateTransition` (الدور + المصفوفة)، وتقييد POD بحالة `ARRIVED_DESTINATION`، ومنع السجل المكرر، وترتيب الكتابة بعد نجاح التحقق. |
| **التحقق** | POD قبل الوصول → **422**؛ بعد الوصول → **201 + DELIVERED**؛ POD مكرر → **409** |

### 🟠 F-06 — تسوية مالية ممكنة قبل التسليم
| | |
|---|---|
| **الملف** | `src/server/routes/financeRoutes.ts` |
| **الإثبات** | `POST /api/finance/settle` على رحلة في حالة `CONFIRMED` → **200 "Trip financial settlement recorded"** |
| **الإصلاح** | السماح بالتسوية فقط في الحالات من `DELIVERED` وما بعدها، وإلا **422 SETTLEMENT_NOT_ALLOWED**. |
| **التحقق** | تسوية قبل التسليم → **422**؛ بعد التسليم → **200** |

### 🟠 F-07 — بوابة AVL للتتبع غير محمية + زر "طلب الرحلة" معطّل
| | |
|---|---|
| **الملفات** | `src/server/routes/devGpsRoutes.ts`, `src/server/app.ts` |
| **الوصف (أ)** | دالة `verifyDevKey` كانت تُرجع `true` في كل الحالات، فأصبح أي طرف قادراً على حقن إحداثيات مزيفة لأي شاحنة (`POST /api/dev/gps`). |
| **الإصلاح (أ)** | حارس `requireProviderKey` حقيقي: مفتاح المزود `x-api-key` عند التهيئة، وإلا يلزم رمز موظف بصلاحية `gps.view` (قراءة) أو `gps.configure` (حقن). |
| **الوصف (ب)** | مسار `POST /api/driver/trips/:id/request` الذي يستدعيه تطبيق السائق لم يكن مُثبّتاً في `app.ts` (كان مثبتاً لـ `GET` فقط) → **404** لزر "طلب الرحلة". |
| **الإصلاح (ب)** | تثبيت مسار كامل `/api/driver/trips/*` و`/api/client/trips/*` كأسماء مستعارة للموجّه المعياري. |

### 🟠 F-08 — غياب تحديد نطاق البيانات على مستوى العنصر
| | |
|---|---|
| **الوصف** | العميل كان يستطيع الوصول لشحنات عملاء آخرين عبر `GET /api/trips/:id` و`GET /api/trips/:id/tracking` و`GET /api/claims`. |
| **الإصلاح** | إضافة `canAccessTrip()` وفرضها على القراءة، والانتقال، والتتبع، وإثبات التسليم، والمطالبات + تحديد نطاق قوائم الرحلات والمطالبات حسب هوية العميل/السائق. |
| **التحقق** | العميل يرى شحناته فقط (0 شحنات أجنبية)، وأي محاولة وصول لرحلة أخرى → **403** |

---

## 3. التحصين الإضافي (Hardening Highlights)

- **بوابة مصادقة للوحة التحكم:** كانت لوحة التحكم المركزية تعمل بدون تسجيل دخول (تعتمد على نقاط نهاية عامة). أُضيفت `ConsoleAuthGate` — شاشة دخول احترافية بالهوية الرسمية، مع استعادة الجلسة، وحسابات الوصول الجاهزة، وزر فتح تطبيق الجوال. كما أُضيف مؤشر المستخدم وزر الخروج في الشريط العلوي.
- **فصل المسارات:** حساب `DRIVER`/`CUSTOMER` يحاول دخول لوحة التحكم يحصل على رسالة موجّهة لتطبيق الجوال بدلاً من قوائم فارغة أو أخطاء.
- **حماية الإشعارات:** لا يمكن تعليم إشعار كمقروء إلا إذا كان ظاهراً لنفس الدور/المستخدم.
- **سجل التدقيق:** تم التحقق من تسجيل 15 حدثاً لرحلة واحدة (إنشاء، انتقالات، POD، تسوية، دخول مستخدمين).

---

## 4. نتائج التحقق الآلي (Automated Verification Evidence)

```
npm test
============================================================
  EJAZ TRANSPORT — ENTERPRISE PRODUCTION TEST SUITE
============================================================
  ✓ Authentication & RBAC Tests Passed Successfully!
  ✓ Trip Lifecycle & State Machine Tests Passed Successfully!
  ✓ GPS Provider Adapter Tests Passed Successfully!
  ✓ Finance & Settlement Tests Passed Successfully!
  ✓ API Authorization & Lifecycle Guard Tests Passed Successfully!
============================================================
  ✅ ALL 5 TEST SUITES PASSED (100% SUCCESS)
```

**مجموعة الاختبار الجديدة `tests/apiSecurity.test.ts`** تُشغّل تطبيق Express الحقيقي على منفذ مؤقت وتتحقق من:
1. رفض 11 نقطة نهاية تشغيلية للوصول المجهول (401).
2. رفض حقن إحداثيات AVL غير المصرح به (401).
3. عدم وجود كلمة مرور خلفية، ورفض بيانات الاعتماد الخاطئة (401).
4. نجاح تسجيل الدخول الشرعي لجميع الأدوار.
5. مصفوفة RBAC: 6 محاولات للسائق → 403، صلاحيات المحاسب محددة، العميل ممنوع من المالية والسائقين.
6. عزل بيانات العميل (لا يحصل على شحنات غيره).
7. سلسلة دورة الحياة الكاملة + منع القفزات غير القانونية + ضوابط POD والتسوية.
8. تدفق "طلب الرحلة" من السائق حتى اعتماد العمليات.
9. اكتمال سجل التدقيق للأحداث الحساسة.

```
npm run lint (tsc --noEmit)   → 0 errors
npm run build (vite build)     → built in 4.13s
```

---

## 5. المتبقي للإنتاج (Remaining Production Configuration)

| البند | الحالة | المطلوب |
|---|---|---|
| قاعدة البيانات | `DEVELOPMENT_DATABASE_ADAPTER` (ذاكرة) | ربط `DATABASE_URL` بـ PostgreSQL إنتاجي |
| مفتاح مزود GPS | غير مهيأ | تعيين `GPS_PROVIDER_API_KEY` + `GPS_PROVIDER_ENDPOINT` |
| سر JWT | قيمة افتراضية | تعيين `JWT_SECRET` عالي العشوائية |
| حسابات تجريبية | مفعّلة | تعيين `ENABLE_DEMO_ACCOUNTS=false` في الإنتاج |
| قفل الحساب بعد المحاولات الفاشلة | غير مُطبّق | إضافة Rate limiting / Account lockout |
| تحديث الرموز (Refresh tokens) | غير مُطبّق | إضافة دورة حياة رمز قصيرة + تجديد |

> **ملاحظة تصحيحية للتقارير السابقة:** العبارتان *"Strict RBAC enforced on all protected endpoints"* و*"JWT Authentication & Strict RBAC — VERIFIED"* في `EJAZ_FINAL_SYNC_VERIFICATION.md` و`EJAZ_FINAL_VERIFICATION_REPORT.md` لم تكونا صحيحتين وقت كتابتهما، وقد صُحّحتا بموجب هذا التقرير.
