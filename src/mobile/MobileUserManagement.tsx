import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { can, type SessionUser } from "../utils/permissions";
import { MobileSection } from "./MobileShared";
import {
  IconArrowRight,
  IconCheck,
  IconClose,
  IconProfile,
  IconPlus,
  IconTruck,
  IconUpload,
} from "../components/Icons";

/**
 * «إدارة المستخدمين» inside the mobile apps (§15-§19).
 *
 * Both the driver app and the client app expose «إضافة سائق جديد» and «إضافة
 * عميل جديد» — but ONLY to identities carrying the CREATE_DRIVER /
 * CREATE_CUSTOMER capabilities (real RBAC: the API refuses the same call
 * without the permission, and duplicate phone / e-mail / national ID /
 * commercial registration are rejected by the backend, §19, §31).
 *
 * The forms render the official registration fields fetched from the live
 * schema (`/api/registrations/schema`) — never invented fields — and every
 * submission becomes a real request («جاري معالجة الطلب») reviewed in the
 * control room with the approval/rejection notifications of §20-§21.
 */

interface FieldSpec {
  key: string;
  labelAr: string;
  labelEn: string;
  required: boolean;
  kind?: string;
  options?: string[];
}
interface DocumentSpec {
  kind: string;
  labelAr: string;
  labelEn: string;
}

export function MobileUserManagement({ user }: { user: SessionUser | null }) {
  const { t } = useSettings();
  const [view, setView] = useState<"menu" | "driver" | "client">("menu");

  const mayCreateDriver = can(user, "drivers.create");
  const mayCreateCustomer = can(user, "customers.create");

  if (!mayCreateDriver && !mayCreateCustomer) return null;

  return (
    <MobileSection
      title={t("User management", "إدارة المستخدمين")}
      hint={t("Available because your account holds the required permissions", "متاحة لأن حسابك يحمل الصلاحيات المطلوبة")}
    >
      {view === "menu" && (
        <div className="p-3 space-y-2">
          {mayCreateDriver && (
            <button
              onClick={() => setView("driver")}
              className="flex w-full items-center gap-3 rounded-inner border border-border-subtle bg-surface-2 px-3.5 py-3 text-start transition-colors hover:border-brand/60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-brand/15 text-brand">
                <IconPlus size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label-lg font-bold text-white">
                  {t("Add new driver", "إضافة سائق جديد")}
                </span>
                <span className="block text-micro text-text-muted">
                  {t("Sends the request to the control room for review", "يُرسل الطلب إلى غرفة التحكم للمراجعة")}
                </span>
              </span>
              <IconTruck size={16} className="shrink-0 text-brand" />
            </button>
          )}
          {mayCreateCustomer && (
            <button
              onClick={() => setView("client")}
              className="flex w-full items-center gap-3 rounded-inner border border-border-subtle bg-surface-2 px-3.5 py-3 text-start transition-colors hover:border-accent-2/60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent-2/15 text-accent-2">
                <IconPlus size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label-lg font-bold text-white">
                  {t("Add new customer", "إضافة عميل جديد")}
                </span>
                <span className="block text-micro text-text-muted">
                  {t("Sends the request to the control room for review", "يُرسل الطلب إلى غرفة التحكم للمراجعة")}
                </span>
              </span>
              <IconProfile size={16} className="shrink-0 text-accent-2" />
            </button>
          )}
        </div>
      )}

      {view !== "menu" && (
        <AddUserForm
          type={view === "driver" ? "DRIVER" : "CUSTOMER"}
          onBack={() => setView("menu")}
        />
      )}
    </MobileSection>
  );
}

function AddUserForm({
  type,
  onBack,
}: {
  type: "DRIVER" | "CUSTOMER";
  onBack: () => void;
}) {
  const { t } = useSettings();
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [documents, setDocuments] = useState<DocumentSpec[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [files, setFiles] = useState<Record<string, { fileName: string; data: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ missingFields?: string[]; missingDocuments?: string[] } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.registrations
      .schema()
      .then((schema) => {
        if (cancelled) return;
        setFields(schema?.fields?.[type] || []);
        setDocuments(schema?.documents?.[type] || []);
      })
      .catch(() => {
        if (!cancelled) setError(t("Unable to load the form. Check the connection.", "تعذّر تحميل النموذج. تحقق من الاتصال."));
      });
    return () => {
      cancelled = true;
    };
  }, [type, t]);

  const requiredMissing = useMemo(() => {
    const miss: string[] = [];
    for (const f of fields) {
      if (f.required && !String(values[f.key] || "").trim()) miss.push(f.key);
    }
    return miss;
  }, [fields, values]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    setMissing(null);

    if (requiredMissing.length > 0) {
      setMissing({ missingFields: requiredMissing });
      setError(t("Please complete the required fields.", "يرجى استكمال الحقول المطلوبة."));
      return;
    }
    if (password.length < 8) {
      setError(t("Account password must be at least 8 characters.", "كلمة مرور الحساب يجب ألا تقل عن ٨ أحرف."));
      return;
    }
    if (password !== passwordConfirm) {
      setError(t("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
      return;
    }

    setSubmitting(true);
    try {
      const documentsPayload = Object.entries(files).map(([kind, doc]) => ({
        kind,
        fileName: doc.fileName,
        data: doc.data,
      }));

      const res =
        type === "DRIVER"
          ? await apiClient.drivers.create({
              fullName: values.fullName,
              phone: values.phone,
              email: values.email,
              nationalId: values.nationalId,
              licenseNumber: values.licenseNumber,
              licenseExpiry: values.licenseExpiry,
              fields: values,
              password,
              documents: documentsPayload,
            })
          : await apiClient.customers.create({
              companyName: values.companyName,
              fullName: values.fullName,
              phone: values.phone,
              email: values.email,
              commercialReg: values.commercialReg,
              vatNumber: values.vatNumber,
              city: values.city,
              address: values.address,
              fields: values,
              password,
              documents: documentsPayload,
            });

      setSuccess(
        res?.messageAr ||
          t(
            "The request was submitted — status: processing. It is now in the control room for review.",
            "تم إرسال الطلب — الحالة: جاري معالجة الطلب. سيظهر في لوحة التحكم للمراجعة.",
          ),
      );
      setValues({});
      setPassword("");
      setPasswordConfirm("");
      setFiles({});
    } catch (err: any) {
      const message = String(err?.message || "");
      // Backend duplicate guards (§19) surface their clear Arabic message.
      setError(message || t("Unable to submit the request.", "تعذّر إرسال الطلب."));
    } finally {
      setSubmitting(false);
    }
  };

  const label = (f: FieldSpec) => (f.labelAr ? `${f.labelAr} · ${f.labelEn}` : f.labelEn);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label={t("Back", "رجوع")}
        >
          <IconArrowRight size={13} className="rtl:rotate-180" />
        </button>
        <h3 className="text-body font-bold text-white">
          {type === "DRIVER" ? t("Add new driver", "إضافة سائق جديد") : t("Add new customer", "إضافة عميل جديد")}
        </h3>
      </div>

      {success && (
        <div className="flex items-start gap-2 rounded-control border border-status-active/40 bg-status-active/10 p-2.5 text-label font-semibold text-status-active">
          <IconCheck size={14} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-control border border-status-danger/40 bg-status-danger/10 p-2.5 text-label font-semibold text-status-danger">
          <IconClose size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fields.map((f) => {
        const value = values[f.key] || "";
        const isMissing = !!missing?.missingFields?.includes(f.key);
        const common = cn(
          "w-full rounded-control border bg-surface-2 px-3 py-2 text-label text-white placeholder:text-text-muted focus:border-brand focus:outline-none",
          isMissing ? "border-status-danger" : "border-border-subtle",
        );
        return (
          <div key={f.key}>
            <label className="mb-1 block text-micro font-semibold text-text-muted">
              {label(f)}
              {f.required && <span className="text-status-danger"> *</span>}
            </label>
            {f.kind === "select" ? (
              <select
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={common}
              >
                <option value="">{t("Select…", "اختر…")}</option>
                {(f.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : f.kind === "textarea" ? (
              <textarea
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={2}
                className={common}
              />
            ) : (
              <input
                type={f.kind === "tel" ? "tel" : f.kind === "email" ? "email" : f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={common}
                inputMode={f.kind === "tel" ? "tel" : undefined}
              />
            )}
          </div>
        );
      })}

      {/* Account data (§17-§18) */}
      <div className="rounded-inner border border-border-subtle bg-surface-2 p-2.5 space-y-2">
        <div className="text-micro font-bold text-text-muted">
          {t("Account data", "بيانات الحساب")}
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("Account password (8+ characters)", "كلمة مرور الحساب (٨ أحرف فأكثر)")}
          className="w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-label text-white placeholder:text-text-muted focus:border-brand focus:outline-none"
        />
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder={t("Confirm password", "تأكيد كلمة المرور")}
          className="w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-label text-white placeholder:text-text-muted focus:border-brand focus:outline-none"
        />
      </div>

      {/* Documents (real schema kinds) */}
      {documents.length > 0 && (
        <div className="rounded-inner border border-border-subtle bg-surface-2 p-2.5 space-y-2">
          <div className="text-micro font-bold text-text-muted">
            {t("Documents", "المستندات")}
          </div>
          {documents.map((doc) => (
            <label
              key={doc.kind}
              className="flex cursor-pointer items-center gap-2.5 rounded-control border border-border-subtle bg-surface-1 px-3 py-2"
            >
              <IconUpload size={14} className={cn("shrink-0", files[doc.kind] ? "text-status-active" : "text-text-muted")} />
              <span className="min-w-0 flex-1 truncate text-label text-white">
                {doc.labelAr} · {doc.labelEn}
              </span>
              <span className={cn("shrink-0 text-micro font-bold", files[doc.kind] ? "text-status-active" : "text-text-muted")}>
                {files[doc.kind] ? t("Attached", "مرفق") : t("Attach", "إرفاق")}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const data = String(reader.result || "");
                    setFiles((prev) => ({
                      ...prev,
                      [doc.kind]: { fileName: file.name, data },
                    }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          ))}
        </div>
      )}

      {missing && ((missing.missingDocuments || []).length > 0) && (
        <div className="rounded-control border border-brand/40 bg-brand/10 p-2.5 text-micro text-brand">
          {t("Missing documents", "مستندات ناقصة")}: {(missing.missingDocuments || []).join("، ")}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full h-11 rounded-inner bg-brand text-on-brand text-label-lg font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
      >
        {submitting
          ? t("Submitting…", "جاري الإرسال…")
          : type === "DRIVER"
            ? t("Submit driver request", "إرسال طلب إضافة السائق")
            : t("Submit customer request", "إرسال طلب إضافة العميل")}
      </button>
    </div>
  );
}
