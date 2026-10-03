import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "../components/Logo";
import { apiClient } from "../services/apiClient";
import { IconUpload, IconCheck, IconAlertCircle, IconTruck, IconProfile } from "../components/Icons";

/**
 * EJAZ Transport — Registration request flow (driver / customer).
 *
 * Creating an account in the application is NOT an automatic approval: it is a
 * formal registration request that the administration reviews before the account
 * is activated. This screen implements the applicant side of that flow inside
 * the existing account types — same design language, no parallel system.
 *
 * States: DRAFT · PENDING_REVIEW · NEEDS_COMPLETION · APPROVED · REJECTED
 */

type RegType = "DRIVER" | "CUSTOMER";
type RegStatus = "DRAFT" | "PENDING_REVIEW" | "NEEDS_COMPLETION" | "APPROVED" | "REJECTED";

interface FieldSpec {
  key: string;
  labelAr: string;
  labelEn: string;
  required: boolean;
  kind?: string;
  options?: string[];
}
interface DocSpec {
  kind: string;
  labelAr: string;
  labelEn: string;
}

interface RegistrySchema {
  fields: Record<RegType, FieldSpec[]>;
  documents: Record<RegType, DocSpec[]>;
}

const FALLBACK_SCHEMA: RegistrySchema = {
  fields: {
    DRIVER: [
      { key: "fullName", labelAr: "الاسم الكامل", labelEn: "Full name", required: true },
      { key: "phone", labelAr: "رقم الجوال", labelEn: "Mobile", required: true, kind: "tel" },
      { key: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", required: true, kind: "email" },
      { key: "nationalId", labelAr: "رقم الهوية الوطنية", labelEn: "National ID", required: true },
      { key: "city", labelAr: "المدينة", labelEn: "City", required: true },
      { key: "licenseNumber", labelAr: "رقم رخصة القيادة", labelEn: "Licence number", required: true },
      { key: "licenseExpiry", labelAr: "تاريخ انتهاء الرخصة", labelEn: "Licence expiry", required: true, kind: "date" },
      { key: "vehicleType", labelAr: "نوع الشاحنة", labelEn: "Truck type", required: true, kind: "select", options: ["سطحة", "براد", "جاف", "ستارة"] },
      { key: "vehiclePlate", labelAr: "رقم لوحة الشاحنة", labelEn: "Truck plate", required: true },
      { key: "notes", labelAr: "ملاحظات إضافية", labelEn: "Notes", required: false, kind: "textarea" },
    ],
    CUSTOMER: [
      { key: "fullName", labelAr: "اسم مسؤول التواصل", labelEn: "Contact person", required: true },
      { key: "companyName", labelAr: "اسم المنشأة", labelEn: "Company", required: true },
      { key: "phone", labelAr: "رقم الجوال", labelEn: "Mobile", required: true, kind: "tel" },
      { key: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", required: true, kind: "email" },
      { key: "commercialReg", labelAr: "رقم السجل التجاري", labelEn: "CR number", required: true },
      { key: "vatNumber", labelAr: "الرقم الضريبي", labelEn: "VAT number", required: true },
      { key: "city", labelAr: "المدينة", labelEn: "City", required: true },
      { key: "address", labelAr: "العنوان الوطني", labelEn: "National address", required: true, kind: "textarea" },
      { key: "notes", labelAr: "ملاحظات إضافية", labelEn: "Notes", required: false, kind: "textarea" },
    ],
  },
  documents: {
    DRIVER: [
      { kind: "nationalId", labelAr: "صورة الهوية الوطنية", labelEn: "National ID" },
      { kind: "drivingLicense", labelAr: "صورة رخصة القيادة", labelEn: "Driving licence" },
      { kind: "vehicleRegistration", labelAr: "رخصة سير الشاحنة", labelEn: "Truck registration" },
      { kind: "vehiclePhoto", labelAr: "صورة الشاحنة", labelEn: "Truck photograph" },
    ],
    CUSTOMER: [
      { kind: "commercialRegistration", labelAr: "السجل التجاري", labelEn: "Commercial registration" },
      { kind: "vatCertificate", labelAr: "شهادة الضريبة", labelEn: "VAT certificate" },
      { kind: "nationalAddress", labelAr: "العنوان الوطني", labelEn: "National address" },
    ],
  },
};

const STATUS_AR: Record<RegStatus, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "جاري المراجعة",
  NEEDS_COMPLETION: "يحتاج استكمال",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
};

const STATUS_TONE: Record<RegStatus, string> = {
  DRAFT: "bg-white/10 text-slate-200 border-white/15",
  PENDING_REVIEW: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  NEEDS_COMPLETION: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  APPROVED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  REJECTED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function Field({
  spec,
  value,
  onChange,
  missing,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
  missing?: boolean;
}) {
  const { t } = useSettings();
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-slate-300">
        {t(spec.labelEn, spec.labelAr)}
        {spec.required && <span className="text-brand"> *</span>}
      </span>
      {spec.kind === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          dir="rtl"
          className={cn(
            "w-full rounded-xl border bg-[#0e1626]/90 px-3 py-2.5 text-[13px] text-white outline-none transition-all placeholder-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/20",
            missing ? "border-rose-500/60" : "border-slate-700/60",
          )}
        />
      ) : spec.kind === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="rtl"
          className={cn(
            "h-11 w-full rounded-xl border bg-[#0e1626]/90 px-3 text-[13px] text-white outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20",
            missing ? "border-rose-500/60" : "border-slate-700/60",
          )}
        >
          <option value="">— اختر —</option>
          {(spec.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={spec.kind === "email" ? "email" : spec.kind === "date" ? "date" : spec.kind === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="rtl"
          className={cn(
            "h-11 w-full rounded-xl border bg-[#0e1626]/90 px-3 text-[13px] text-white outline-none transition-all placeholder-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/20",
            missing ? "border-rose-500/60" : "border-slate-700/60",
          )}
        />
      )}
    </label>
  );
}

function StatusPill({ status }: { status: RegStatus }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[10.5px] font-bold", STATUS_TONE[status] || STATUS_TONE.DRAFT)}>
      {STATUS_AR[status] || status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Applicant: submit / complete a registration request                 */
/* ------------------------------------------------------------------ */

export function RegistrationScreen({
  initialType = "DRIVER",
  onBackToLogin,
  onSubmitted,
  existingRequest,
  onApproved,
}: {
  initialType?: RegType;
  onBackToLogin: () => void;
  onSubmitted?: (state: ApplicantState) => void;
  existingRequest?: any | null;
  onApproved?: () => void;
}) {
  const { t } = useSettings();
  const [type, setType] = useState<RegType>((existingRequest?.type as RegType) || initialType);
  const [schema, setSchema] = useState<RegistrySchema>(FALLBACK_SCHEMA);
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(existingRequest?.fields || {}) }));
  const [documents, setDocuments] = useState<Record<string, { fileName: string; data: string; url?: string }>>(() => {
    const attached: Record<string, { fileName: string; data: string; url?: string }> = {};
    for (const doc of existingRequest?.documents || []) {
      attached[doc.kind] = { fileName: doc.fileName, data: "", url: doc.url };
    }
    return attached;
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ fields: string[]; documents: string[] }>({ fields: [], documents: [] });
  const [submitted, setSubmitted] = useState<any | null>(
    existingRequest && existingRequest.status !== "DRAFT" && existingRequest.status !== "NEEDS_COMPLETION"
      ? existingRequest
      : null,
  );

  useEffect(() => {
    apiClient.registrations.schema()
      .then((res: any) => {
        if (res?.fields && res?.documents) setSchema({ fields: res.fields, documents: res.documents });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (existingRequest?.type) setType(existingRequest.type);
  }, [existingRequest?.type]);

  const specs = schema.fields[type] || [];
  const docSpecs = schema.documents[type] || [];

  const missingSet = useMemo(() => {
    return {
      fields: new Set(missing.fields),
      documents: new Set(missing.documents),
    };
  }, [missing]);

  const pickDocument = async (kind: string, file: File) => {
    if (file.size > 12 * 1024 * 1024) {
      setError(t("The document exceeds the 12 MB limit", "حجم المستند يتجاوز الحد المسموح (١٢ ميجابايت)"));
      return;
    }
    const data = await readAsDataUrl(file);
    setDocuments((prev) => ({ ...prev, [kind]: { fileName: file.name, data } }));
    setMissing((prev) => ({ ...prev, documents: prev.documents.filter((d) => d !== kind) }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Client-side completeness check first: the applicant sees exactly what is missing.
      const missingFields = specs.filter((s) => s.required && !String(values[s.key] || "").trim()).map((s) => s.key);
      const missingDocs = docSpecs
        .filter((d) => !documents[d.kind] || (!documents[d.kind].data && !documents[d.kind].url))
        .map((d) => d.kind);

      if (type === "CUSTOMER" && !values.email?.trim()) missingFields.push("email");
      if (!password.trim() && !existingRequest) {
        setMissing({ fields: missingFields, documents: missingDocs });
        setError(t("Please set a password (at least 8 characters)", "يرجى تعيين كلمة المرور (٨ أحرف على الأقل)"));
        setBusy(false);
        return;
      }

      if (missingFields.length || missingDocs.length) {
        setMissing({ fields: missingFields, documents: missingDocs });
        setError(
          t(
            "The request is incomplete — the highlighted items are required before it can be sent.",
            "الطلب غير مكتمل — العناصر المظللة مطلوبة قبل إرسال الطلب.",
          ),
        );
        setBusy(false);
        return;
      }

      const payloadDocs = Object.entries(documents)
        .filter(([, v]) => v.data)
        .map(([kind, v]) => ({ kind, fileName: v.fileName, data: v.data }));

      const res = existingRequest
        ? await apiClient.registrations.resubmitMine({ fields: values, documents: payloadDocs })
        : await apiClient.registrations.submit({ type, fields: values, password, documents: payloadDocs, submit: true });

      setMissing({ fields: [], documents: [] });
      setSubmitted(res.request || { status: "PENDING_REVIEW" });
      onSubmitted?.({
        request: res.request,
        status: res.request?.status || "PENDING_REVIEW",
        messageAr: res.messageAr,
      });
    } catch (err: any) {
      const validation = err?.body?.validation;
      if (validation) {
        setMissing({
          fields: (validation.missingFields || []).map((f: any) => f.key),
          documents: (validation.missingDocuments || []).map((d: any) => d.kind),
        });
      }
      setError(err?.message || t("Could not send the request", "تعذّر إرسال الطلب"));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <PendingView
        status={(submitted.status as RegStatus) || "PENDING_REVIEW"}
        request={submitted}
        onBackToLogin={onBackToLogin}
        onUpdateRequest={onApproved ? () => onApproved() : undefined}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#070b14] text-white select-none">
      <div className="mx-auto w-full max-w-[720px] px-5 py-6">
        <div className="flex items-center justify-between">
          <BrandLogo size={34} showSub={false} />
          <button onClick={onBackToLogin} className="text-[11.5px] text-slate-300 underline underline-offset-2 hover:text-white">
            {t("Back to sign in", "العودة لتسجيل الدخول")}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-[#0b1220]/90 p-4">
          <h1 className="text-[17px] font-extrabold">
            {existingRequest
              ? t("Complete your registration request", "استكمال طلب التسجيل")
              : t("New registration request", "طلب تسجيل جديد")}
          </h1>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
            {t(
              "Creating an account is a request. The administration reviews it, then the account is activated and you are notified.",
              "إنشاء الحساب يُعد طلبًا رسميًا. تقوم الإدارة بمراجعته ثم يُعتمد الحساب ويُفعَّل، ويصلك إشعار بذلك.",
            )}
          </p>

          {/* Account type — the existing types of the application */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["DRIVER", "CUSTOMER"] as RegType[]).map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={!!existingRequest}
                onClick={() => {
                  setType(kind);
                  setMissing({ fields: [], documents: [] });
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold transition-all disabled:opacity-60",
                  type === kind ? "border-brand bg-brand/15 text-brand" : "border-slate-700/60 bg-[#0e1626]/80 text-slate-300",
                )}
              >
                {kind === "DRIVER" ? <IconTruck size={15} /> : <IconProfile size={15} />}
                {kind === "DRIVER" ? t("Driver request", "طلب تسجيل سائق") : t("Customer request", "طلب تسجيل عميل")}
              </button>
            ))}
          </div>
        </div>

        {/* Personal / official / facility / truck data */}
        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-[#0b1220]/90 p-4">
          <h2 className="mb-3 text-[13.5px] font-bold">
            {type === "DRIVER" ? t("Personal, licence and truck data", "البيانات الشخصية والرخصة والشاحنة") : t("Contact and facility data", "بيانات التواصل والمنشأة")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {specs.map((spec) => (
              <Field
                key={spec.key}
                spec={spec}
                value={values[spec.key] || ""}
                missing={missingSet.fields.has(spec.key)}
                onChange={(v) => {
                  setValues((prev) => ({ ...prev, [spec.key]: v }));
                  setMissing((prev) => ({ ...prev, fields: prev.fields.filter((f) => f !== spec.key) }));
                }}
              />
            ))}

            {!existingRequest && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-slate-300">
                  {t("Account password", "كلمة مرور الحساب")}
                  <span className="text-brand"> *</span>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="rtl"
                  placeholder={t("At least 8 characters", "٨ أحرف على الأقل")}
                  className="h-11 w-full rounded-xl border border-slate-700/60 bg-[#0e1626]/90 px-3 text-[13px] text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
            )}
          </div>
        </div>

        {/* Required documents */}
        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-[#0b1220]/90 p-4">
          <h2 className="mb-1 text-[13.5px] font-bold">{t("Required documents", "المستندات المطلوبة")}</h2>
          <p className="mb-3 text-[11px] text-slate-400">
            {t("PDF or image. The file is stored with your request for the administration to review.", "PDF أو صورة. يُحفظ الملف مع طلبك لمراجعة الإدارة.")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {docSpecs.map((doc) => {
              const attached = documents[doc.kind];
              const isMissing = missingSet.documents.has(doc.kind);
              return (
                <label
                  key={doc.kind}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border bg-[#0e1626]/80 p-2.5 transition-colors",
                    isMissing ? "border-rose-500/60" : attached ? "border-emerald-500/40" : "border-slate-700/60",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", attached ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-300")}>
                    {attached ? <IconCheck size={15} /> : <IconUpload size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-bold text-slate-100">{t(doc.labelEn, doc.labelAr)}</span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {attached ? attached.fileName || attached.url : t("Tap to attach", "اضغط للإرفاق")}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) pickDocument(doc.kind, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-[11.5px] text-rose-200">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(missing.fields.length > 0 || missing.documents.length > 0) && (
          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-[11.5px] text-amber-100">
            <div className="mb-1 font-bold">{t("Missing items", "العناصر الناقصة")}</div>
            <ul className="list-inside list-disc space-y-0.5">
              {missing.fields.map((key) => (
                <li key={key}>{specs.find((s) => s.key === key)?.labelAr || key}</li>
              ))}
              {missing.documents.map((kind) => (
                <li key={kind}>{docSpecs.find((d) => d.kind === kind)?.labelAr || kind}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-brand py-3 text-[13.5px] font-extrabold text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy
            ? t("Sending…", "جارٍ الإرسال…")
            : existingRequest
              ? t("Re-send the request for review", "إعادة إرسال الطلب للمراجعة")
              : t("Send the request", "إرسال الطلب")}
        </button>
        <p className="mt-2 pb-8 text-center text-[10.5px] text-slate-500">
          {t(
            "The account is not approved automatically — the administration reviews every request.",
            "لا يُعتمد الحساب تلقائيًا — الإدارة تراجع كل طلب قبل التفعيل.",
          )}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Applicant: follow-up state («جاري معالجة طلبك»)                     */
/* ------------------------------------------------------------------ */

export interface ApplicantState {
  request: any;
  status: RegStatus;
  messageAr?: string;
}

/** Shared status card — used after submission and inside the signed-in app. */
export function RegistrationStatusCard({
  state,
  onOpenCompletion,
  compact = false,
}: {
  state: ApplicantState;
  onOpenCompletion?: () => void;
  compact?: boolean;
}) {
  const { t } = useSettings();
  const request = state.request || {};
  const status = (request.status as RegStatus) || state.status;

  const headline =
    status === "PENDING_REVIEW"
      ? t("Your request is being processed", "جاري معالجة طلبك")
      : status === "NEEDS_COMPLETION"
        ? t("Your request needs more information", "طلبك يحتاج إلى استكمال بعض البيانات")
        : status === "APPROVED"
          ? t("Your request has been approved", "تمت الموافقة على طلبك")
          : status === "REJECTED"
            ? t("Your request was rejected", "تم رفض طلبك")
            : t("Registration request", "طلب التسجيل");

  const body =
    status === "PENDING_REVIEW"
      ? t(
          "We received your request successfully. It will be reviewed by the administration and you will be notified once the review is complete.",
          "تم استلام طلبك بنجاح، وسيتم مراجعته من الإدارة. سنقوم بإشعارك عند الانتهاء من المراجعة.",
        )
      : status === "NEEDS_COMPLETION"
        ? request.decisionReason || t("Please complete the requested items, then re-send.", "يرجى استكمال العناصر المطلوبة ثم إعادة الإرسال.")
        : status === "APPROVED"
          ? t(
              "Your registration request has been approved. You can now use your account and the available services.",
              "تمت الموافقة على طلب تسجيلك بنجاح. يمكنك الآن استخدام حسابك والاستفادة من الخدمات المتاحة لك.",
            )
          : request.decisionReason || t("Contact the administration for details.", "يرجى التواصل مع الإدارة للمزيد.");

  return (
    <div className={cn("rounded-2xl border border-slate-700/60 bg-[#0b1220]/95 p-4", compact && "p-3")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold text-white">{headline}</h2>
        <StatusPill status={status} />
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-slate-300">{body}</p>

      {(request.completionRequests || []).length > 0 && (
        <div className="mt-2.5 rounded-xl border border-sky-400/30 bg-sky-400/10 p-2.5">
          <div className="mb-1 text-[11px] font-bold text-sky-200">{t("Items requested by the administration", "العناصر المطلوبة من الإدارة")}</div>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-sky-100">
            {(request.completionRequests || []).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] sm:grid-cols-4">
        {[
          [t("Request number", "رقم الطلب"), request.id || "—"],
          [t("Type", "نوع الطلب"), request.type === "CUSTOMER" ? t("Customer", "عميل") : t("Driver", "سائق")],
          [t("Submitted", "تاريخ الإرسال"), request.submittedAt ? new Date(request.submittedAt).toLocaleDateString("ar-SA") : "—"],
          [t("Reviewed by", "الجهة المراجعة"), request.reviewerName || "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-white/[0.04] p-2">
            <dt className="text-slate-400">{label}</dt>
            <dd className="truncate font-mono text-slate-100" title={String(value)}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {status === "NEEDS_COMPLETION" && onOpenCompletion && (
        <button
          onClick={onOpenCompletion}
          className="mt-3 w-full rounded-xl bg-brand py-2.5 text-[12.5px] font-extrabold text-on-brand transition-opacity hover:opacity-90"
        >
          {t("Complete the data and re-send", "استكمال البيانات وإعادة الإرسال")}
        </button>
      )}
    </div>
  );
}

/**
 * Signed-in applicant whose account is not approved yet.
 * They can sign in and follow the request, but the account functions of a
 * driver / customer are not granted until the administration approves it.
 */
export function RegistrationStatusScreen({
  user,
  onLogout,
  onApproved,
}: {
  user?: any;
  onLogout?: () => void;
  onApproved?: () => void;
}) {
  const { t } = useSettings();
  const [state, setState] = useState<ApplicantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    try {
      const res = await apiClient.registrations.mine();
      setState({ request: res.request, status: res.status, messageAr: res.statusAr });
      if (res.status === "APPROVED") onApproved?.();
    } catch (err: any) {
      setError(err?.message || t("No registration request for this account", "لا يوجد طلب تسجيل لهذا الحساب"));
    }
  };

  useEffect(() => {
    load();
    // The screens reflect an administrative decision without a manual refresh.
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (editing) {
    return (
      <RegistrationScreen
        existingRequest={state?.request}
        onBackToLogin={() => setEditing(false)}
        onSubmitted={() => {
          setEditing(false);
          load();
        }}
      />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-start overflow-y-auto bg-[#070b14] px-5 py-8 text-white">
      <BrandLogo size={36} showSub={false} />
      <div className="mt-5 w-full max-w-[560px] space-y-3">
        {state ? (
          <RegistrationStatusCard state={state} onOpenCompletion={() => setEditing(true)} />
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0b1220]/95 p-4 text-[12px] text-slate-300">
            {error || t("Loading your request…", "جارٍ تحميل طلبك…")}
          </div>
        )}

        <button
          onClick={load}
          className="w-full rounded-xl border border-slate-700/60 bg-[#0e1626]/80 py-2.5 text-[12px] font-bold text-slate-200 transition-colors hover:text-white"
        >
          {t("Refresh status", "تحديث الحالة")}
        </button>
        {onLogout && (
          <button onClick={onLogout} className="w-full rounded-xl border border-slate-700/60 bg-transparent py-2.5 text-[12px] font-bold text-slate-400 transition-colors hover:text-white">
            {t("Sign out", "تسجيل الخروج")}
          </button>
        )}
        <p className="text-center text-[10.5px] text-slate-500">
          {t("Signed in as", "مسجّل الدخول باسم")}: {user?.email}
        </p>
      </div>
    </div>
  );
}

/** Full-screen wrap-up shown right after the request is sent. */
export function PendingView({
  status,
  request,
  onBackToLogin,
  onUpdateRequest,
}: {
  status: RegStatus;
  request: any;
  onBackToLogin: () => void;
  onUpdateRequest?: () => void;
}) {
  const { t } = useSettings();
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-start overflow-y-auto bg-[#070b14] px-5 py-8 text-white">
      <BrandLogo size={36} showSub={false} />
      <div className="mt-5 w-full max-w-[560px]">
        <RegistrationStatusCard state={{ request, status }} onOpenCompletion={onUpdateRequest} />
        <button
          onClick={onBackToLogin}
          className="mt-4 w-full rounded-xl border border-slate-700/60 bg-[#0e1626]/80 py-2.5 text-[12.5px] font-bold text-slate-200 transition-colors hover:text-white"
        >
          {t("Back to sign in", "العودة لتسجيل الدخول")}
        </button>
      </div>
    </div>
  );
}
