import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { VehicleImageLightbox } from "./VehicleImageLightbox";
import {
  IconSearch,
  IconCheck,
  IconClose,
  IconAlertCircle,
  IconTruck,
  IconProfile,
  IconUpload,
} from "./Icons";

type RegStatus = "DRAFT" | "PENDING_REVIEW" | "NEEDS_COMPLETION" | "APPROVED" | "REJECTED";

const STATUS_AR: Record<RegStatus, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "جاري المراجعة",
  NEEDS_COMPLETION: "يحتاج استكمال",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
};

const STATUS_TONE: Record<RegStatus, string> = {
  DRAFT: "bg-surface-3 text-text-muted border-border-subtle",
  PENDING_REVIEW: "bg-status-waiting/15 text-status-waiting border-status-waiting/30",
  NEEDS_COMPLETION: "bg-accent-2/15 text-accent-2 border-accent-2/30",
  APPROVED: "bg-status-active/15 text-status-active border-status-active/30",
  REJECTED: "bg-status-danger/15 text-status-danger border-status-danger/30",
};

const ACTION_LABEL: Record<string, string> = {
  CREATED: "إنشاء الطلب",
  SUBMITTED: "إرسال الطلب",
  RESUBMITTED: "إعادة إرسال بعد الاستكمال",
  APPROVED: "موافقة واعتماد",
  NEEDS_COMPLETION: "طلب استكمال بيانات",
  REJECTED: "رفض الطلب",
};

const DEMO_REGISTRATION_REQUESTS: any[] = [
  {
    id: "EJ-REG-2026-000101",
    type: "DRIVER",
    status: "PENDING_REVIEW",
    fullName: "نواف بن عبد الرحمن القحطاني",
    email: "nawaf.driver@ejaz-partner.sa",
    phone: "+966558129340",
    submittedAt: "2026-10-03T07:30:00Z",
    accountCreated: true,
    fields: {
      "الاسم الكامل": "نواف بن عبد الرحمن القحطاني",
      "رقم الهوية الوطنية": "1092837465",
      "رقم الجوال": "+966558129340",
      "البريد الإلكتروني": "nawaf.driver@ejaz-partner.sa",
      "المدينة": "الرياض",
      "رقم رخصة القيادة": "DL-SA-994821",
      "تاريخ انتهاء الرخصة": "2029-04-15",
      "نوع الشاحنة": "ستارة",
      "رقم لوحة الشاحنة": "ر ج د ٩٤٢٠",
      "موديل الشاحنة": "Mercedes-Benz Actros L 1863 (2024)",
    },
    documents: [
      {
        id: "doc-demo-1",
        kind: "nationalId",
        labelAr: "صورة الهوية الوطنية",
        fileName: "national-id-1092837465.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-curtain.png",
      },
      {
        id: "doc-demo-2",
        kind: "drivingLicense",
        labelAr: "صورة رخصة القيادة للنقل الثقيل",
        fileName: "heavy-license-DL994821.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-curtain.png",
      },
      {
        id: "doc-demo-3",
        kind: "vehiclePhoto",
        labelAr: "صورة الشاحنة الرسمية",
        fileName: "actros-curtain-9420.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-curtain.png",
      },
    ],
    history: [
      {
        id: "h-101-1",
        action: "CREATED",
        toStatus: "DRAFT",
        actorName: "نواف بن عبد الرحمن القحطاني",
        at: "2026-10-03T07:20:00Z",
      },
      {
        id: "h-101-2",
        action: "SUBMITTED",
        fromStatus: "DRAFT",
        toStatus: "PENDING_REVIEW",
        actorName: "نواف بن عبد الرحمن القحطاني",
        at: "2026-10-03T07:30:00Z",
      },
    ],
  },
  {
    id: "EJ-REG-2026-000102",
    type: "CUSTOMER",
    status: "PENDING_REVIEW",
    fullName: "شركة المدار اللوجستية للتجارة (م. عبدالإله الشهري)",
    email: "supply@almadar-logistics.sa",
    phone: "+966126543210",
    submittedAt: "2026-10-03T06:15:00Z",
    accountCreated: true,
    fields: {
      "اسم المنشأة": "شركة المدار اللوجستية للتجارة",
      "اسم مسؤول التواصل": "م. عبدالإله الشهري",
      "رقم السجل التجاري": "4030291847",
      "الرقم الضريبي": "300492817200003",
      "رقم الجوال": "+966126543210",
      "البريد الإلكتروني": "supply@almadar-logistics.sa",
      "المدينة": "جدة",
      "العنوان الوطني": "جدة - المنطقة الصناعية الثالثة - شارع المستودعات",
    },
    documents: [
      {
        id: "doc-demo-4",
        kind: "commercialRegistration",
        labelAr: "السجل التجاري للمنشأة",
        fileName: "cr-4030291847.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-reefer.png",
      },
      {
        id: "doc-demo-5",
        kind: "vatCertificate",
        labelAr: "شهادة التسجيل في ضريبة القيمة المضافة",
        fileName: "vat-300492817200003.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-reefer.png",
      },
    ],
    history: [
      {
        id: "h-102-1",
        action: "SUBMITTED",
        fromStatus: "DRAFT",
        toStatus: "PENDING_REVIEW",
        actorName: "م. عبدالإله الشهري",
        at: "2026-10-03T06:15:00Z",
      },
    ],
  },
  {
    id: "EJ-REG-2026-000103",
    type: "DRIVER",
    status: "APPROVED",
    fullName: "راشد بن فهد الدوسري",
    email: "rashed.driver@ejaz.sa",
    phone: "+966509988776",
    submittedAt: "2026-10-02T14:10:00Z",
    decidedAt: "2026-10-02T16:45:00Z",
    reviewerName: "فهد بن عبد العزيز السبيعي",
    accountCreated: true,
    fields: {
      "الاسم الكامل": "راشد بن فهد الدوسري",
      "رقم الهوية الوطنية": "1076543219",
      "رقم الجوال": "+966509988776",
      "المدينة": "الدمام",
      "رقم رخصة القيادة": "DL-SA-772190",
      "نوع الشاحنة": "براد",
      "رقم لوحة الشاحنة": "ب ر د ٦١٢٠",
      "موديل الشاحنة": "Volvo FH 500 ColdChain (2024)",
    },
    documents: [
      {
        id: "doc-demo-6",
        kind: "vehiclePhoto",
        labelAr: "صورة الشاحنة المبردة",
        fileName: "volvo-reefer-6120.png",
        mimeType: "image/png",
        previewUrl: "/images/trucks/official/official-reefer.png",
      },
    ],
    history: [
      {
        id: "h-103-1",
        action: "SUBMITTED",
        fromStatus: "DRAFT",
        toStatus: "PENDING_REVIEW",
        actorName: "راشد بن فهد الدوسري",
        at: "2026-10-02T14:10:00Z",
      },
      {
        id: "h-103-2",
        action: "APPROVED",
        fromStatus: "PENDING_REVIEW",
        toStatus: "APPROVED",
        actorName: "فهد بن عبد العزيز السبيعي",
        at: "2026-10-02T16:45:00Z",
        reason: "تم التحقق من الهوية ورخصة النقل الثقيل وفحص المركبة بنجاح.",
      },
    ],
  },
];

function computeSummary(list: any[]) {
  return {
    pending: list.filter((r) => r.status === "PENDING_REVIEW").length,
    needsCompletion: list.filter((r) => r.status === "NEEDS_COMPLETION").length,
    approved: list.filter((r) => r.status === "APPROVED").length,
    rejected: list.filter((r) => r.status === "REJECTED").length,
  };
}

export function RegistrationRequestsManager() {
  const { t } = useSettings();
  const pushToast = useToast();

  const [requests, setRequests] = useState<any[]>(DEMO_REGISTRATION_REQUESTS);
  const [summary, setSummary] = useState<{ pending: number; needsCompletion: number; approved: number; rejected: number } | null>(() =>
    computeSummary(DEMO_REGISTRATION_REQUESTS)
  );
  const [filter, setFilter] = useState<"ALL" | RegStatus>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_REGISTRATION_REQUESTS[0].id);
  const [detail, setDetail] = useState<any | null>({
    request: DEMO_REGISTRATION_REQUESTS[0],
    history: DEMO_REGISTRATION_REQUESTS[0].history,
  });
  const [reason, setReason] = useState("");
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; isPdf: boolean } | null>(null);
  const [documentBusy, setDocumentBusy] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.registrations.list();
      const serverRequests = res?.requests || [];
      const merged =
        serverRequests.length > 0
          ? [
              ...serverRequests,
              ...DEMO_REGISTRATION_REQUESTS.filter(
                (d) => !serverRequests.some((s: any) => s.id === d.id)
              ),
            ]
          : DEMO_REGISTRATION_REQUESTS;
      setRequests(merged);
      setSummary(computeSummary(merged));
      if (!selectedId && merged.length > 0) {
        setSelectedId(merged[0].id);
        setDetail({ request: merged[0], history: merged[0].history || [] });
      }
    } catch {
      setRequests(DEMO_REGISTRATION_REQUESTS);
      setSummary(computeSummary(DEMO_REGISTRATION_REQUESTS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const closeLightbox = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setLightbox(null);
  };

  const openDocument = async (document: any) => {
    if (!selectedId || !document?.id) return;
    if (document.previewUrl) {
      setLightbox({ src: document.previewUrl, isPdf: false });
      return;
    }
    setDocumentBusy(document.id);
    setError(null);
    try {
      const blob = await apiClient.registrations.document(selectedId, document.id);
      const objectUrl = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setLightbox({ src: objectUrl, isPdf: document.mimeType === "application/pdf" });
    } catch (err: any) {
      setError(err?.message || t("Could not open the document", "تعذّر فتح المستند"));
    } finally {
      setDocumentBusy(null);
    }
  };

  const open = async (id: string) => {
    setSelectedId(id);
    setReason("");
    setMissingItems([]);
    setError(null);

    const localMatch = requests.find((r) => r.id === id);
    if (localMatch && id.startsWith("EJ-REG-2026-00010")) {
      setDetail({ request: localMatch, history: localMatch.history || [] });
      return;
    }

    try {
      const res = await apiClient.registrations.get(id);
      setDetail(res);
    } catch (err: any) {
      if (localMatch) {
        setDetail({ request: localMatch, history: localMatch.history || [] });
      } else {
        setError(err?.message || t("Could not open the request", "تعذّر فتح الطلب"));
      }
    }
  };

  const decide = async (action: "APPROVE" | "NEEDS_COMPLETION" | "REJECT") => {
    if (!selectedId) return;
    if (action === "REJECT" && !reason.trim()) {
      setError(t("Rejection requires a reason", "سبب الرفض إلزامي"));
      return;
    }
    if (action === "NEEDS_COMPLETION" && !reason.trim() && missingItems.length === 0) {
      setError(t("Specify the missing data or documents", "يجب تحديد البيانات أو المستندات الناقصة"));
      return;
    }

    setBusy(action);
    setError(null);

    const isDemoRequest = selectedId.startsWith("EJ-REG-2026-00010");
    if (isDemoRequest) {
      const nextStatus: RegStatus =
        action === "APPROVE"
          ? "APPROVED"
          : action === "NEEDS_COMPLETION"
            ? "NEEDS_COMPLETION"
            : "REJECTED";
      const updatedList = requests.map((r) => {
        if (r.id !== selectedId) return r;
        const newEntry = {
          id: `h-${Date.now()}`,
          action: action === "APPROVE" ? "APPROVED" : action === "NEEDS_COMPLETION" ? "NEEDS_COMPLETION" : "REJECTED",
          fromStatus: r.status,
          toStatus: nextStatus,
          actorName: "فهد بن عبد العزيز السبيعي (مدير النظام)",
          at: new Date().toISOString(),
          reason: reason.trim() || undefined,
          missingItems: missingItems.length > 0 ? missingItems : undefined,
        };
        const updatedReq = {
          ...r,
          status: nextStatus,
          decidedAt: new Date().toISOString(),
          reviewerName: "فهد بن عبد العزيز السبيعي",
          history: [...(r.history || []), newEntry],
        };
        setDetail({ request: updatedReq, history: updatedReq.history });
        return updatedReq;
      });
      setRequests(updatedList);
      setSummary(computeSummary(updatedList));
      pushToast(
        action === "APPROVE"
          ? t("Account approved and activated", "تمت الموافقة على الحساب وتفعيله")
          : action === "NEEDS_COMPLETION"
            ? t("Completion requested from the applicant", "تم طلب استكمال البيانات من مقدم الطلب")
            : t("Request rejected", "تم رفض الطلب"),
        selectedId,
      );
      setBusy(null);
      return;
    }

    try {
      const res = await apiClient.registrations.decide(selectedId, action, {
        reason: reason.trim() || undefined,
        missingItems,
      });
      pushToast(
        action === "APPROVE"
          ? t("Account approved and activated", "تمت الموافقة على الحساب وتفعيله")
          : action === "NEEDS_COMPLETION"
            ? t("Completion requested from the applicant", "تم طلب استكمال البيانات من مقدم الطلب")
            : t("Request rejected", "تم رفض الطلب"),
        res?.request?.id,
      );
      setDetail({ request: res.request, history: res.history });
      await load();
    } catch (err: any) {
      setError(err?.message || t("Decision failed", "تعذّر تنفيذ القرار"));
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => (filter === "ALL" ? true : r.status === filter))
      .filter((r) =>
        q
          ? `${r.id} ${r.fullName} ${r.email} ${r.phone} ${JSON.stringify(r.fields || {})}`
              .toLowerCase()
              .includes(q)
          : true,
      );
  }, [requests, filter, query]);

  const request = detail?.request;

  const completionOptions = useMemo(() => {
    if (!request) return [] as { key: string; labelAr: string }[];
    const docs = (request.documents || []).map((d: any) => ({ key: d.kind, labelAr: `${d.labelAr} (مستند)` }));
    const fields = Object.keys(request.fields || {}).map((key) => ({ key, labelAr: key }));
    return [...docs, ...fields];
  }, [request]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      {/* Header */}
      <div className="border-b border-border-subtle bg-surface-1 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-page-title font-bold text-text-primary">
              {t("Registration Requests", "طلبات التسجيل")}
            </h1>
            <p className="text-label-lg text-text-muted">
              {t(
                "Driver and customer registration requests awaiting an administrative decision.",
                "طلبات تسجيل السائقين والعملاء بانتظار قرار الإدارة.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-label">
            {[
              [t("Pending review", "جاري المراجعة"), summary?.pending ?? 0, "bg-status-waiting/15 text-status-waiting"],
              [t("Needs completion", "يحتاج استكمال"), summary?.needsCompletion ?? 0, "bg-accent-2/15 text-accent-2"],
              [t("Approved", "تمت الموافقة"), summary?.approved ?? 0, "bg-status-active/15 text-status-active"],
              [t("Rejected", "مرفوض"), summary?.rejected ?? 0, "bg-status-danger/15 text-status-danger"],
            ].map(([label, value, tone]) => (
              <span key={String(label)} className={cn("rounded-full px-2.5 py-1 font-bold", String(tone))}>
                {label}: {value}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-control border border-border-subtle bg-surface-2 px-3 py-1.5">
            <IconSearch size={14} className="text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search by number, name, plate or company…", "ابحث بالرقم أو الاسم أو اللوحة أو المنشأة…")}
              className="w-[260px] bg-transparent text-label-lg text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          {(["ALL", "PENDING_REVIEW", "NEEDS_COMPLETION", "APPROVED", "REJECTED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                "rounded-full px-3 py-1.5 text-label font-semibold transition-colors",
                filter === status ? "bg-brand text-on-brand" : "bg-surface-2 text-text-muted hover:text-text-primary",
              )}
            >
              {status === "ALL" ? t("All", "الكل") : STATUS_AR[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]">
        {/* Queue */}
        <div className="scroll-thin overflow-y-auto border-e border-border-subtle p-3">
          {loading && <div className="p-3 text-label-lg text-text-muted">{t("Loading…", "جارٍ التحميل…")}</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-3 text-label-lg text-text-muted">{t("No registration requests", "لا توجد طلبات تسجيل")}</div>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => open(r.id)}
              className={cn(
                "mb-2 w-full rounded-inner border p-3 text-start transition-colors",
                selectedId === r.id ? "border-brand bg-brand/10" : "border-border-subtle bg-surface-1 hover:bg-surface-2",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-label-lg font-bold text-text-primary">
                  {r.type === "DRIVER" ? <IconTruck size={14} className="text-brand" /> : <IconProfile size={14} className="text-accent-2" />}
                  {r.type === "DRIVER" ? t("Driver request", "طلب تسجيل سائق") : t("Customer request", "طلب تسجيل عميل")}
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-micro font-bold", STATUS_TONE[r.status as RegStatus])}>
                  {STATUS_AR[r.status as RegStatus]}
                </span>
              </div>
              <div className="mt-1.5 truncate text-label-lg text-text-secondary">{r.fullName || r.email}</div>
              <div className="mt-1 flex items-center justify-between text-micro text-text-muted">
                <span className="font-mono">{r.id}</span>
                <span>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("ar-SA") : "—"}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail + decision */}
        <div className="scroll-thin overflow-y-auto p-4">
          {!request && (
            <div className="grid h-full place-items-center text-body text-text-muted">
              {t("Select a request to review its data and documents", "اختر طلبًا لمراجعة بياناته ومستنداته")}
            </div>
          )}

          {request && (
            <div className="space-y-4">
              <div className="rounded-inner border border-border-subtle bg-surface-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-card-title font-bold text-text-primary">
                      {request.type === "DRIVER" ? t("Driver registration request", "طلب تسجيل سائق") : t("Customer registration request", "طلب تسجيل عميل")}
                    </h2>
                    <div className="mt-0.5 font-mono text-label text-text-muted">{request.id}</div>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-label font-bold", STATUS_TONE[request.status as RegStatus])}>
                    {STATUS_AR[request.status as RegStatus]}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-label lg:grid-cols-3">
                  {Object.entries(request.fields || {}).map(([key, value]) => (
                    <div key={key} className="rounded-control bg-surface-2 p-2">
                      <dt className="text-text-muted">{key}</dt>
                      <dd className="break-words text-text-primary">{String(value)}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 grid grid-cols-2 gap-2 text-label lg:grid-cols-4">
                  {[
                    [t("Submitted", "تاريخ الإرسال"), request.submittedAt ? new Date(request.submittedAt).toLocaleString("ar-SA") : "—"],
                    [t("Reviewed by", "الجهة المراجعة"), request.reviewerName || "—"],
                    [t("Decision", "القرار"), request.decidedAt ? new Date(request.decidedAt).toLocaleString("ar-SA") : "—"],
                    [t("Account", "الحساب"), request.accountCreated ? t("Created", "أُنشئ") : t("Linked", "مرتبط")],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-control bg-surface-2 p-2">
                      <div className="text-text-muted">{label}</div>
                      <div className="text-text-primary">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              <div className="rounded-inner border border-border-subtle bg-surface-1 p-4">
                <h3 className="mb-2 text-body font-bold text-text-primary">{t("Documents and files", "المستندات والملفات")}</h3>
                {(request.documents || []).length === 0 ? (
                  <p className="text-label-lg text-text-muted">{t("No documents attached", "لا توجد مستندات مرفقة")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(request.documents || []).map((doc: any) => (
                      <button
                        key={doc.id}
                        onClick={() => void openDocument(doc)}
                        disabled={documentBusy !== null}
                        className="flex items-center gap-2 rounded-control border border-border-subtle bg-surface-2 p-2 text-start transition-colors hover:border-brand/40"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-surface-3 text-micro font-bold text-text-secondary">
                          {String(doc.fileName || "").split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label font-bold text-text-primary">{doc.labelAr}</span>
                          <span className="block truncate text-micro text-text-muted">{doc.fileName}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Decision */}
              {request.status !== "APPROVED" && (
                <div className="rounded-inner border border-border-subtle bg-surface-1 p-4">
                  <h3 className="mb-2 text-body font-bold text-text-primary">{t("Administrative decision", "قرار الإدارة")}</h3>

                  <label className="block">
                    <span className="mb-1 block text-label font-semibold text-text-secondary">
                      {t("Notes / reason (mandatory for rejection)", "ملاحظات / السبب (إلزامي عند الرفض)")}
                    </span>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      className="w-full rounded-control border border-border-subtle bg-surface-2 px-3 py-2 text-label-lg text-text-primary outline-none focus:border-brand"
                      placeholder={t("e.g. The attached documents are incomplete", "مثال: الوثائق المرفقة غير مكتملة")}
                    />
                  </label>

                  <div className="mt-2">
                    <div className="mb-1 text-label font-semibold text-text-secondary">
                      {t("Items the applicant must complete", "العناصر المطلوب استكمالها من مقدم الطلب")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {completionOptions.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() =>
                            setMissingItems((prev) =>
                              prev.includes(opt.key) ? prev.filter((x) => x !== opt.key) : [...prev, opt.key],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-label font-semibold transition-colors",
                            missingItems.includes(opt.key)
                              ? "border-accent-2 bg-accent-2/15 text-accent-2"
                              : "border-border-subtle bg-surface-2 text-text-muted hover:text-text-primary",
                          )}
                        >
                          {opt.labelAr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="mt-3 flex items-start gap-2 rounded-control border border-status-danger/40 bg-status-danger/10 p-2.5 text-label-lg text-status-danger">
                      <IconAlertCircle size={15} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => decide("APPROVE")}
                      disabled={busy !== null}
                      className="flex items-center justify-center gap-1.5 rounded-control bg-status-active/90 py-2.5 text-body font-bold text-[#05240f] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <IconCheck size={15} />
                      {busy === "APPROVE" ? t("Approving…", "جارٍ الاعتماد…") : t("Approve", "موافقة")}
                    </button>
                    <button
                      onClick={() => decide("NEEDS_COMPLETION")}
                      disabled={busy !== null}
                      className="flex items-center justify-center gap-1.5 rounded-control bg-accent-2/90 py-2.5 text-body font-bold text-[#04223f] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <IconUpload size={15} />
                      {busy === "NEEDS_COMPLETION" ? t("Sending…", "جارٍ الإرسال…") : t("Request completion", "طلب استكمال البيانات")}
                    </button>
                    <button
                      onClick={() => decide("REJECT")}
                      disabled={busy !== null}
                      className="flex items-center justify-center gap-1.5 rounded-control bg-status-danger/90 py-2.5 text-body font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <IconClose size={15} />
                      {busy === "REJECT" ? t("Rejecting…", "جارٍ الرفض…") : t("Reject", "رفض الطلب")}
                    </button>
                  </div>
                </div>
              )}

              {/* Audit trail */}
              <div className="rounded-inner border border-border-subtle bg-surface-1 p-4">
                <h3 className="mb-2 text-body font-bold text-text-primary">{t("Review audit trail", "سجل المراجعة")}</h3>
                <ol className="space-y-2">
                  {(detail?.history || request.history || []).map((entry: any) => (
                    <li key={entry.id} className="rounded-control border border-border-subtle bg-surface-2 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-label">
                        <span className="font-bold text-text-primary">{ACTION_LABEL[entry.action] || entry.action}</span>
                        <span className="text-text-muted">{new Date(entry.at).toLocaleString("ar-SA")}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-label text-text-muted">
                        <span>
                          {t("From", "من")}: {entry.fromStatus ? STATUS_AR[entry.fromStatus as RegStatus] : "—"}
                        </span>
                        <span>
                          {t("To", "إلى")}: {STATUS_AR[entry.toStatus as RegStatus]}
                        </span>
                        <span>
                          {t("By", "بواسطة")}: {entry.actorName || "—"}
                        </span>
                      </div>
                      {entry.reason && <div className="mt-1 text-label text-text-secondary">{entry.reason}</div>}
                      {(entry.missingItems || []).length > 0 && (
                        <div className="mt-1 text-label text-accent-2">
                          {t("Requested items", "العناصر المطلوبة")}: {entry.missingItems.join("، ")}
                        </div>
                      )}
                    </li>
                  ))}
                  {(!detail?.history || detail.history.length === 0) && (
                    <li className="text-label-lg text-text-muted">{t("No decisions yet", "لا توجد قرارات بعد")}</li>
                  )}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <VehicleImageLightbox src={lightbox.src} isPdf={lightbox.isPdf} onClose={closeLightbox} />
      )}
    </div>
  );
}
