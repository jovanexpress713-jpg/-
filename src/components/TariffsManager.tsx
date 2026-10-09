import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { TruckTypeIcon } from "./TruckTypeIcon";
import { IconPlus, IconSearch, IconClose, IconHistory, IconPencil, IconCheck, IconTag } from "./Icons";
import { APPROVED_VEHICLE_TYPES_LIST } from "../data/vehicleTypes";

/**
 * قائمة الأسعار والتعرفة (Phase 1)
 *
 * An independent control-room screen where the EJAZ company manages the tariff
 * book. Prices here are the ONLY source a trip price can come from — a trip
 * never carries a hardcoded number. Every create/edit/deactivate/reactivate is
 * persisted to the central database and logged with who/when/old price/new
 * price/reason. Overlapping tariffs for the same (type + route + distance +
 * weight + period) are rejected with a clear explanation.
 */

interface Tariff {
  id: string;
  truckType: string;
  originCity: string;
  destinationCity: string;
  minDistanceKm: number;
  maxDistanceKm: number | null;
  minWeight: number;
  maxWeight: number | null;
  weightUnit: "TON" | "KG";
  price: number;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  validFrom: string;
  validTo: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryRecord {
  id: string;
  tariffId: string;
  userName: string;
  userRole?: string;
  action: "CREATED" | "UPDATED" | "DEACTIVATED" | "ACTIVATED";
  oldPrice?: number;
  newPrice?: number;
  reason?: string;
  timestamp: string;
}

interface QuoteRequest {
  id: string;
  truckType: string;
  originCity: string;
  destinationCity: string;
  weightTons: number;
  distanceKm: number | null;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  requestedByName?: string;
  note?: string;
  createdAt: string;
}

interface CityOption { id: string; ar: string; en: string }

const EMPTY_FORM = {
  truckType: "براد",
  originCity: "",
  destinationCity: "",
  minDistanceKm: "0",
  maxDistanceKm: "",
  minWeight: "0",
  maxWeight: "",
  weightUnit: "TON",
  price: "",
  currency: "SAR",
  status: "ACTIVE",
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: "",
  notes: "",
  reason: "",
};

export function TariffsManager() {
  const { t, td } = useSettings();
  const toast = useToast();

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterOrigin, setFilterOrigin] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState<Tariff | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  const reload = useCallback(async () => {
    try {
      const [tRes, qRes] = await Promise.all([
        apiClient.tariffs.getAll(),
        apiClient.tariffs.getQuoteRequests(),
      ]);
      setTariffs(tRes?.tariffs || []);
      setQuoteRequests(qRes?.quoteRequests || []);
    } catch (e: any) {
      toast(t("Failed to load tariffs", "تعذّر تحميل قائمة الأسعار"), e?.message || "");
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    reload();
    apiClient.tariffs.getCities().then((r) => setCities(r?.cities || [])).catch(() => {});
  }, [reload]);

  const filtered = useMemo(() => {
    return tariffs.filter((tar) => {
      if (filterType !== "ALL" && tar.truckType !== filterType) return false;
      if (filterStatus !== "ALL" && tar.status !== filterStatus) return false;
      if (filterOrigin && tar.originCity !== filterOrigin) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${tar.originCity} ${tar.destinationCity} ${tar.truckType} ${tar.price} ${tar.currency}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [tariffs, filterType, filterStatus, filterOrigin, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (tar: Tariff) => {
    setEditingId(tar.id);
    setForm({
      truckType: tar.truckType,
      originCity: tar.originCity,
      destinationCity: tar.destinationCity,
      minDistanceKm: String(tar.minDistanceKm),
      maxDistanceKm: tar.maxDistanceKm === null ? "" : String(tar.maxDistanceKm),
      minWeight: String(tar.minWeight),
      maxWeight: tar.maxWeight === null ? "" : String(tar.maxWeight),
      weightUnit: tar.weightUnit,
      price: String(tar.price),
      currency: tar.currency,
      status: tar.status,
      validFrom: tar.validFrom.slice(0, 10),
      validTo: tar.validTo ? tar.validTo.slice(0, 10) : "",
      notes: tar.notes || "",
      reason: "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openHistory = async (tar: Tariff) => {
    setHistoryFor(tar);
    try {
      const res = await apiClient.tariffs.getById(tar.id);
      setHistory(res?.history || []);
    } catch {
      setHistory([]);
    }
  };

  const submitForm = async () => {
    setSaving(true);
    setFormError(null);
    const payload = {
      truckType: form.truckType,
      originCity: form.originCity,
      destinationCity: form.destinationCity,
      minDistanceKm: form.minDistanceKm === "" ? 0 : Number(form.minDistanceKm),
      maxDistanceKm: form.maxDistanceKm === "" ? null : Number(form.maxDistanceKm),
      minWeight: form.minWeight === "" ? 0 : Number(form.minWeight),
      maxWeight: form.maxWeight === "" ? null : Number(form.maxWeight),
      weightUnit: form.weightUnit,
      price: Number(form.price),
      currency: form.currency,
      status: form.status,
      validFrom: form.validFrom,
      validTo: form.validTo === "" ? null : form.validTo,
      notes: form.notes,
      reason: form.reason,
    };
    try {
      if (editingId) {
        await apiClient.tariffs.update(editingId, payload);
        toast(t("Tariff updated", "تم تعديل التعرفة"), "");
      } else {
        await apiClient.tariffs.create(payload);
        toast(t("Tariff created", "تم إنشاء التعرفة"), "");
      }
      setModalOpen(false);
      reload();
    } catch (e: any) {
      setFormError(e?.message || t("Failed to save the tariff", "تعذّر حفظ التعرفة"));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (tar: Tariff) => {
    try {
      if (tar.status === "ACTIVE") {
        await apiClient.tariffs.deactivate(tar.id);
        toast(t("Tariff deactivated", "تم إيقاف التعرفة"), "");
      } else {
        await apiClient.tariffs.activate(tar.id);
        toast(t("Tariff reactivated", "تمت إعادة تفعيل التعرفة"), "");
      }
      reload();
    } catch (e: any) {
      toast(t("Operation failed", "فشلت العملية"), e?.message || "");
    }
  };

  const resolveQuote = async (q: QuoteRequest) => {
    try {
      await apiClient.tariffs.resolveQuoteRequest(q.id);
      toast(t("Quote request resolved", "تمت معالجة طلب عرض السعر"), "");
      reload();
    } catch (e: any) {
      toast(t("Operation failed", "فشلت العملية"), e?.message || "");
    }
  };

  /* Bands follow «أكثر من X إلى Y»: lower bound exclusive, upper inclusive. */
  const fmtRange = (min: number, max: number | null, unit: string) => {
    const top = max === null ? "∞" : String(max);
    return min === 0 ? `${min}–${top} ${unit}` : `>${min}–${top} ${unit}`;
  };

  const cityLabel = (name: string) => {
    const c = cities.find((x) => x.ar === name);
    return c ? c.ar : name;
  };

  const openQuotes = quoteRequests.filter((q) => q.status === "OPEN");

  return (
    <div className="flex h-full flex-col bg-surface-0 min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-hero-sm font-bold text-text-primary">{t("Pricing & Tariff List", "قائمة الأسعار والتعرفة")}</h2>
            <span className="badge bg-brand/15 text-brand tabular-nums">{tariffs.length} {t("Tariffs", "تعرفة")}</span>
          </div>
          <p className="mt-0.5 text-label-lg text-text-muted">
            {t(
              "Company-managed freight pricing. Prices resolve dynamically by truck type + route + distance + weight — never hardcoded.",
              "تعرفة نقل تديرها الشركة. تُحتسب الأسعار ديناميكيًا حسب نوع الشاحنة والمسار والمسافة والوزن — دون أي أسعار ثابتة."
            )}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-label-lg py-2 px-4 flex items-center gap-2">
          <IconPlus size={15} />
          {t("Add price", "إضافة سعر")}
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {/* Pending quote requests */}
        {openQuotes.length > 0 && (
          <div className="card p-4 border border-status-waiting/40 bg-status-waiting/5">
            <div className="flex items-center gap-2">
              <IconTag size={16} className="text-status-waiting" />
              <span className="text-body font-bold text-text-primary">
                {t("Client quote requests (no matching tariff)", "طلبات عرض سعر من العملاء (لا توجد تعرفة مطابقة)")}
              </span>
              <span className="badge bg-status-waiting/20 text-status-waiting tabular-nums">{openQuotes.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {openQuotes.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-inner bg-surface-2 border border-border-subtle p-3">
                  <div className="text-label-lg">
                    <span className="font-bold text-text-primary">{td(q.originCity)} ← {td(q.destinationCity)}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    <span className="text-brand font-semibold">{q.truckType}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    <span className="tabular-nums">{q.weightTons} {t("tons", "طن")}</span>
                    {q.distanceKm != null && (<><span className="mx-2 text-text-muted">·</span><span className="tabular-nums">{q.distanceKm} {t("km", "كم")}</span></>)}
                    {q.requestedByName && (<div className="text-label text-text-muted mt-0.5">{t("Requested by", "مقدم الطلب")}: {q.requestedByName}</div>)}
                  </div>
                  <button onClick={() => resolveQuote(q)} className="btn-ghost text-label py-1.5 px-3 border border-status-active/40 text-status-active">
                    <IconCheck size={13} />
                    {t("Mark resolved", "تمت المعالجة")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-control bg-surface-2 border border-border-subtle px-3 py-2 focus-within:border-brand">
            <IconSearch size={14} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search route, type, price…", "ابحث بالمسار أو النوع أو السعر…")}
              className="w-[190px] bg-transparent text-label-lg text-white outline-none"
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="field !py-2 text-label-lg">
            <option value="ALL">{t("All truck types", "كل أنواع الشاحنات")}</option>
            {APPROVED_VEHICLE_TYPES_LIST.map((v) => (
              <option key={v.id} value={v.arabicName}>{v.arabicName} · {v.englishName}</option>
            ))}
          </select>
          <select value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} className="field !py-2 text-label-lg">
            <option value="">{t("All origins", "كل مدن الانطلاق")}</option>
            {cities.map((c) => (<option key={c.id} value={c.ar}>{c.ar}</option>))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="field !py-2 text-label-lg">
            <option value="ALL">{t("All statuses", "كل الحالات")}</option>
            <option value="ACTIVE">{t("Active", "نشطة")}</option>
            <option value="INACTIVE">{t("Stopped", "موقوفة")}</option>
          </select>
        </div>

        {/* Tariff table */}
        {loading ? (
          <div className="card p-8 text-center text-text-muted text-body">{t("Loading tariffs…", "جارٍ تحميل قائمة الأسعار…")}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-card-title font-bold text-text-primary">{t("No tariffs yet", "لا توجد تعرفات بعد")}</div>
            <p className="mt-1 text-label-lg text-text-muted">
              {t("Add the first tariff to start pricing trips dynamically.", "أضف أول تعرفة لبدء تسعير الرحلات ديناميكيًا.")}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-start text-body">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="px-4 py-3 text-start font-semibold">{t("Truck type", "نوع الشاحنة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Route", "المسار")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Distance", "المسافة")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Weight", "الوزن")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Price", "السعر")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Validity", "الصلاحية")}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t("Status", "الحالة")}</th>
                  <th className="px-3 py-3 text-end font-semibold">{t("Actions", "الإجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tar) => (
                  <tr key={tar.id} className="border-b border-border-subtle/60 last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold text-text-primary">
                        <TruckTypeIcon truckType={tar.truckType} size={18} />
                        {tar.truckType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-text-primary font-medium">{cityLabel(tar.originCity)} ← {cityLabel(tar.destinationCity)}</td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">{fmtRange(tar.minDistanceKm, tar.maxDistanceKm, t("km", "كم"))}</td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">{fmtRange(tar.minWeight, tar.maxWeight, tar.weightUnit === "KG" ? t("kg", "كجم") : t("t", "طن"))}</td>
                    <td className="px-3 py-3 tabular-nums font-bold text-brand">{tar.price.toLocaleString()} {tar.currency}</td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">
                      {tar.validFrom.slice(0, 10)}{tar.validTo ? ` → ${tar.validTo.slice(0, 10)}` : t(" · open", " · مفتوحة")}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("badge text-label", tar.status === "ACTIVE" ? "bg-status-active/20 text-status-active" : "bg-surface-5 text-text-muted")}>
                        {tar.status === "ACTIVE" ? t("Active", "نشطة") : t("Stopped", "موقوفة")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(tar)} title={t("Edit", "تعديل")} className="btn-icon"><IconPencil size={14} /></button>
                        <button onClick={() => openHistory(tar)} title={t("Change history", "سجل التعديلات")} className="btn-icon"><IconHistory size={14} /></button>
                        <button
                          onClick={() => toggleStatus(tar)}
                          title={tar.status === "ACTIVE" ? t("Stop tariff", "إيقاف التعرفة") : t("Reactivate tariff", "إعادة تفعيل التعرفة")}
                          className={cn("btn-icon", tar.status === "ACTIVE" ? "text-status-danger" : "text-status-active")}
                        >
                          {tar.status === "ACTIVE" ? <IconClose size={14} /> : <IconCheck size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="animate-fade-up scroll-thin max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-panel bg-surface-1 p-6 border border-border-subtle shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-section-title font-bold text-text-primary">
                  {editingId ? t("Edit tariff", "تعديل التعرفة") : t("Add a new price", "إضافة سعر جديد")}
                </h3>
                <p className="mt-0.5 text-label-lg text-text-muted">
                  {t("The price is set by the company and matched by type + route + distance + weight.", "يُحدد السعر من الشركة ويُطابق حسب النوع والمسار والمسافة والوزن.")}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn-icon" aria-label={t("Close", "إغلاق")}><IconClose size={16} /></button>
            </div>

            {formError && (
              <div className="mt-3 rounded-inner border border-status-danger/40 bg-status-danger/10 p-3 text-label-lg text-status-danger font-semibold">
                {formError}
              </div>
            )}

            <div className="mt-3 rounded-control bg-surface-2/70 border border-border-subtle px-3 py-2 text-label text-text-muted">
              {t(
                "Range convention: the lower bound is exclusive and the upper bound is inclusive — e.g. distance 900–1000 km with weight 5–10 t means “more than 5 up to 10 tons”. Adjacent ranges never overlap.",
                "اصطلاح النطاقات: الحد الأدنى غير شامل والحد الأعلى شامل — مثال: المسافة ٩٠٠–١٠٠٠ كم مع الوزن ٥–١٠ طن تعني «أكثر من ٥ حتى ١٠ طن». النطاقات المتجاورة لا تتداخل أبدًا."
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Truck type — strictly the 4 approved categories */}
              <div>
                <Label>{t("Truck type", "نوع الشاحنة")} *</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {APPROVED_VEHICLE_TYPES_LIST.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, truckType: v.arabicName }))}
                      className={cn("chip flex items-center gap-1.5 text-label-lg", form.truckType === v.arabicName && "chip-on")}
                    >
                      <TruckTypeIcon truckType={v.arabicName} size={15} />
                      {v.arabicName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Origin / Destination */}
              <div>
                <Label>{t("Origin city / region", "مدينة / منطقة الانطلاق")} *</Label>
                <select value={form.originCity} onChange={(e) => setForm((f) => ({ ...f, originCity: e.target.value }))} className="field mt-1.5">
                  <option value="">{t("Select…", "اختر…")}</option>
                  {cities.map((c) => (<option key={c.id} value={c.ar}>{c.ar} · {c.en}</option>))}
                </select>
              </div>
              <div>
                <Label>{t("Destination city / region", "مدينة / منطقة الوصول")} *</Label>
                <select value={form.destinationCity} onChange={(e) => setForm((f) => ({ ...f, destinationCity: e.target.value }))} className="field mt-1.5">
                  <option value="">{t("Select…", "اختر…")}</option>
                  {cities.map((c) => (<option key={c.id} value={c.ar}>{c.ar} · {c.en}</option>))}
                </select>
              </div>

              {/* Distance band */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("Min distance (km)", "أدنى مسافة (كم)")} *</Label>
                  <input type="number" min={0} value={form.minDistanceKm} onChange={(e) => setForm((f) => ({ ...f, minDistanceKm: e.target.value }))} className="field mt-1.5" />
                </div>
                <div>
                  <Label>{t("Max distance (km)", "أقصى مسافة (كم)")}</Label>
                  <input type="number" min={0} value={form.maxDistanceKm} onChange={(e) => setForm((f) => ({ ...f, maxDistanceKm: e.target.value }))} placeholder={t("No upper limit", "بدون حد أعلى")} className="field mt-1.5" />
                </div>
              </div>

              {/* Weight band + unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>{t("Min weight", "أدنى وزن")} *</Label>
                  <input type="number" min={0} value={form.minWeight} onChange={(e) => setForm((f) => ({ ...f, minWeight: e.target.value }))} className="field mt-1.5" />
                </div>
                <div>
                  <Label>{t("Max weight", "أقصى وزن")}</Label>
                  <input type="number" min={0} value={form.maxWeight} onChange={(e) => setForm((f) => ({ ...f, maxWeight: e.target.value }))} placeholder={t("Open", "مفتوح")} className="field mt-1.5" />
                </div>
                <div>
                  <Label>{t("Unit", "الوحدة")}</Label>
                  <select value={form.weightUnit} onChange={(e) => setForm((f) => ({ ...f, weightUnit: e.target.value }))} className="field mt-1.5">
                    <option value="TON">{t("Ton", "طن")}</option>
                    <option value="KG">{t("Kilogram", "كيلوجرام")}</option>
                  </select>
                </div>
              </div>

              {/* Price + currency */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("Price", "السعر")} *</Label>
                  <input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="field mt-1.5" />
                </div>
                <div>
                  <Label>{t("Currency", "العملة")}</Label>
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="field mt-1.5">
                    <option value="SAR">SAR · {t("Saudi Riyal", "ريال سعودي")}</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Validity window */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("Valid from", "تاريخ البداية")} *</Label>
                  <input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} className="field mt-1.5" />
                </div>
                <div>
                  <Label>{t("Valid to (optional)", "تاريخ النهاية (اختياري)")}</Label>
                  <input type="date" value={form.validTo} onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))} className="field mt-1.5" />
                </div>
              </div>

              {/* Status */}
              <div>
                <Label>{t("Price status", "حالة السعر")}</Label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="field mt-1.5">
                  <option value="ACTIVE">{t("Active", "نشطة")}</option>
                  <option value="INACTIVE">{t("Stopped", "موقوفة")}</option>
                </select>
              </div>

              {/* Notes */}
              <div className="sm:col-span-2">
                <Label>{t("Notes (optional)", "ملاحظات (اختياري)")}</Label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="field mt-1.5 resize-none" />
              </div>

              {/* Reason (recorded in the change history when editing) */}
              {editingId && (
                <div className="sm:col-span-2">
                  <Label>{t("Reason for the change (recorded in history)", "سبب التعديل (يُسجَّل في السجل)")}</Label>
                  <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="field mt-1.5" />
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
              <button onClick={() => setModalOpen(false)} className="btn-ghost">{t("Cancel", "إلغاء")}</button>
              <button onClick={submitForm} disabled={saving} className="btn-primary px-5 flex items-center gap-2 disabled:opacity-50">
                <IconCheck size={15} />
                {saving ? t("Saving…", "جارٍ الحفظ…") : editingId ? t("Save changes", "حفظ التعديلات") : t("Create tariff", "إنشاء التعرفة")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyFor && (
        <div className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setHistoryFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="animate-fade-up scroll-thin max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-panel bg-surface-1 p-6 border border-border-subtle shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-bold text-text-primary">{t("Tariff change history", "سجل تعديلات التعرفة")}</h3>
                <p className="mt-0.5 text-label-lg text-text-muted">
                  {historyFor.originCity} ← {historyFor.destinationCity} · {historyFor.truckType}
                </p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="btn-icon" aria-label={t("Close", "إغلاق")}><IconClose size={16} /></button>
            </div>
            <div className="mt-4 space-y-3">
              {history.length === 0 && (<div className="text-label-lg text-text-muted">{t("No history recorded yet.", "لا يوجد سجل تعديلات بعد.")}</div>)}
              {history.map((h) => (
                <div key={h.id} className="rounded-inner bg-surface-2 border border-border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-label-lg font-bold text-text-primary">
                      {h.action === "CREATED" ? t("Created", "إنشاء") : h.action === "UPDATED" ? t("Updated", "تعديل") : h.action === "DEACTIVATED" ? t("Deactivated", "إيقاف") : t("Reactivated", "إعادة تفعيل")}
                    </span>
                    <span className="text-label text-text-muted tabular-nums">{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-label-lg text-text-secondary tabular-nums">
                    {h.oldPrice !== undefined && h.newPrice !== undefined && h.oldPrice !== h.newPrice && (
                      <span>{t("Price", "السعر")}: <span className="line-through text-text-muted">{h.oldPrice}</span> → <span className="text-brand font-bold">{h.newPrice}</span></span>
                    )}
                  </div>
                  <div className="mt-0.5 text-label text-text-muted">{t("By", "بواسطة")}: {h.userName}{h.userRole ? ` (${h.userRole})` : ""}</div>
                  {h.reason && (<div className="mt-0.5 text-label text-text-secondary">{t("Reason", "السبب")}: {h.reason}</div>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-label tracking-wide text-text-muted uppercase">{children}</span>;
}
