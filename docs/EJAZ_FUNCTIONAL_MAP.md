# الخريطة الوظيفية الشاملة لمنظومة إيجاز للنقليات
# EJAZ TRANSPORT — FUNCTIONAL ARCHITECTURE MAP
**Version:** 1.0.0-PROD  
**Pattern:** `SCREEN` → `ACTION` → `API` → `BACKEND SERVICE` → `DATABASE` → `EVENT` → `AUDIT` → `NOTIFICATION` → `UI UPDATE`

---

## 1. مخطط تدفق العمليات الرئيسي (Core Workflow Pipeline)

```
[UI Component / Mobile / Role Portal]
                 │
                 ▼ (Bearer Token / Credentials)
     [API Gateway / Auth Middleware]
                 │
                 ▼ (RBAC Permission & Business Rules Check)
       [Core Business Service]
                 │
        ┌────────┴────────┐
        ▼                 ▼
[Database Transaction] [Event Engine]
        │                 │
        ▼                 ▼
   [PostgreSQL]    [Audit Log] ──► [Notifications] ──► [WebSocket / Real-time UI Update]
```

---

## 2. جدول المسارات والخرائط الوظيفية (Detailed Functional Matrix)

| الشاشة (Screen) | الإجراء (Action) | واجهة البرمجة (API) | خدمة الخلفية (Service) | جدول البيانات (DB Table) | الحدث والتدقيق (Event & Audit) | التحديث في الواجهة (UI Update) |
|---|---|---|---|---|---|---|
| **تسجيل الدخول (Login)** | إدخال بيانات المستخدم | `POST /api/auth/login` | `AuthService.authenticate` | `users` | `AUTH_LOGIN_SUCCESS` (Audit Log) | حفظ الجلسة، توجيه المستخدم بحسب الدور والصلاحيات |
| **لوحة التحكم (Console)** | استعراض الأسطول | `GET /api/vehicles` | `VehicleService.getVehicles` | `vehicles`, `drivers` | قراءة حالة الأسطول (Read) | تحديث قائمة الشاحنات ومؤشرات الوقود والحرارة وحالة الصيانة |
| **إنشاء طلب شحن (Create Request)** | تقديم شحنة جديدة | `POST /api/trips` | `TripLifecycleService.createTrip` | `trips`, `trip_events` | `TRIP_CREATED` (توليد رقم `EJ-2026-XXXXXX`) وتوثيق التدقيق | إشعار مديري العمليات وإضافة الرحلة بحالة `DRAFT_CREATED` |
| **إدارة الرحلات (Trips Manager)** | اعتماد وتعيين شاحنة وسائق | `POST /api/trips/:id/transition` | `TripLifecycleService.transitionState` | `trips`, `trip_events` | الانتقال من `CONFIRMED` إلى `ASSIGNED`، فحص صلاحية الرخص | تحديث حالة الرحلة، تنبيه السائق، وإظهار المسار في الخريطة |
| **بوابة السائق (Driver Portal)** | بدء التوجه للتحميل | `POST /api/trips/:id/transition` | `TripLifecycleService.transitionState` | `trips`, `trip_events` | `HEADING_TO_LOADING` مع ختم الموقع والوقت | تحويل الواجهة إلى تتبع مباشر وإظهار شارة الاتجاه |
| **موقع التحميل (Loading Bay)** | تسجيل وصول وإتمام التحميل | `POST /api/trips/:id/loading` | `TripLifecycleService.recordLoading` | `trips`, `trip_events`, `trip_documents` | `LOADED` وتوثيق بوليصة الشحن (BOL) والأوزان | تفعيل مسار السفر المباشر وحساب موعد الوصول التقديري (ETA) |
| **التتبع الحي (Live Tracking)** | تلقي تحديثات الموقع من المزود | `POST /api/gps/telemetry` | `GPSProviderAdapter.ingestPosition` | `gps_telemetry`, `trips` | تحديث إحداثيات الشاحنة وسرعتها، ورصد الانحراف أو التوقف | تحريك الشاحنة على الخريطة والرسم البصري بناءً على بيانات حقيقية |
| **تسليم الشحنة (Delivery & POD)** | توقيع المستلم ورفع صور التسليم | `POST /api/pod` | `PODService.createPOD` | `pod_records`, `trips` | `DELIVERED`، أرشفة التوقيع وصور الاستلام | تحويل الرحلة تلقائياً إلى حالة التسوية المالية `SETTLEMENT_PENDING` |
| **تسجيل المطالبات (Claims)** | إبلاغ عن ضرر أو عجز بالحمولة | `POST /api/claims` | `ClaimService.submitClaim` | `claims`, `trips`, `audit_logs` | `CLAIM_SUBMITTED`، حجز جزئي للدفعة المالية للمراجعة | إشعار المحاسب والمدير العام بالضرر وقيمة المطالبة التقديرية |
| **الإدارة المالية (Finance)** | مراجعة الفواتير واعتماد التسوية | `POST /api/finance/settle` | `FinanceService.settleTrip` | `trips`, `invoices`, `payments` | الانتقال إلى `FINANCIAL_REVIEW` ثم `PAID` وإصدار إشعار المقاصة | تحديث رصيد السائق ورصيد العميل وإتمام إغلاق الرحلة `COMPLETED` |
| **إلغاء رحلة (Trip Cancellation)** | إلغاء مع سبب مسبب | `POST /api/trips/:id/cancel` | `TripLifecycleService.cancelTrip` | `trips`, `trip_events`, `audit_logs` | `TRIP_CANCELLED`، توثيق السبب والمسؤول وإلغاء حجز الشاحنة | تجميد مسار الرحلة وإرجاع الشاحنة لحالة "متاحة" مع الاحتفاظ بالأرشيف |
| **إعادة فتح رحلة (Trip Reopening)** | إعادة الفتح بتفويض إداري | `POST /api/trips/:id/reopen` | `TripLifecycleService.reopenTrip` | `trips`, `trip_events`, `audit_logs` | `TRIP_REOPENED` بواسطة المدير العام مع سبب مبرر | استئناف دورة الحياة وتحديث حالة الرحلة في جميع الشاشات |

---

## 3. محرك انتقالات دورة حياة الرحلات (18 Canonical States)

```
[DRAFT_CREATED]
      │
      ▼
[PENDING_APPROVAL]
      │
      ▼
 [CONFIRMED]
      │
      ▼
  [ASSIGNED]
      │
      ▼
[HEADING_TO_LOADING] ──► [ARRIVED_LOADING] ──► [LOADED]
                                                  │
                                                  ▼
                                             [IN_TRANSIT]
                                                  │
                                                  ▼
[DELIVERED] ◄── [ARRIVED_DESTINATION] ◄───────────┘
      │
      ▼
[SETTLEMENT_PENDING]
      │
      ▼
[FINANCIAL_REVIEW]
      │
      ▼
[PARTIALLY_PAID] ──► [PAID] ──► [COMPLETED] ──► [ARCHIVED]

* مسارات استثنائية:
- أي حالة قبل DELIVERED ──► [CANCELLED] (بإذن وسبب موثق)
- [CANCELLED] ──► [REOPENED] (بصلاحية SUPER_ADMIN / GENERAL_MANAGER فقط مع توثيق)
```
