import { useState, useEffect, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { useFleetStore } from "../state/fleetStore";
import {
  IconSearch,
  IconPlus,
  IconClose,
  IconCargo,
  IconCheck,
  IconDoc,
} from "./Icons";

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  commercialReg: string;
  vatNumber: string;
  city: string;
  address: string;
  totalTrips?: number;
  activeTrips?: number;
}

interface CustomersManagerProps {
  onOpenShipments?: () => void;
  onOpenCreateShipment?: (customerName: string) => void;
}

export function CustomersManager({ onOpenShipments, onOpenCreateShipment }: CustomersManagerProps = {}) {
  const { t } = useSettings();
  const toast = useToast();
  const { trips } = useFleetStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCR, setFormCR] = useState("");
  const [formVAT, setFormVAT] = useState("");
  const [formCity, setFormCity] = useState("الرياض");
  const [formAddress, setFormAddress] = useState("");
  const [formPassword, setFormPassword] = useState("Ejaz@2026Client");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.customers.getAll();
      setCustomers(res.customers || []);
    } catch (err: any) {
      console.warn("Failed to load customers from API, using fallback data:", err);
      // Fallback baseline customers
      setCustomers([
        {
          id: "cust-1",
          name: "شركة سدافكو للأغذية والمشروبات",
          contactPerson: "طارق منصور",
          phone: "+966112223344",
          email: "logistics@sadafco.com",
          commercialReg: "1010198421",
          vatNumber: "300184920100003",
          city: "جدة",
          address: "المنطقة الصناعية الأولى",
        },
        {
          id: "cust-2",
          name: "شركة المراعي المحدودة",
          contactPerson: "عبدالله الراجحي",
          phone: "+966114445566",
          email: "fleet@almarai.com",
          commercialReg: "1010023419",
          vatNumber: "300028491000003",
          city: "الخرج",
          address: "مجمع المعالجة المركزي",
        },
        {
          id: "cust-3",
          name: "شركة سابك للمغذيات الزراعية",
          contactPerson: "م. حسام العلي",
          phone: "+966133334455",
          email: "supply@sabic.com",
          commercialReg: "2050123984",
          vatNumber: "300059281000003",
          city: "الجبيل",
          address: "مدينة الجبيل الصناعية",
        },
        {
          id: "cust-4",
          name: "شركة أسواق عبدالله العثيم",
          contactPerson: "سليمان النشمي",
          phone: "+966114778899",
          email: "dc@othaimmarkets.com",
          commercialReg: "1010082736",
          vatNumber: "300129482000003",
          city: "الرياض",
          address: "مستودعات السلي الكبرى",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const citiesList = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (selectedCity !== "ALL" && c.city !== selectedCity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = c.name?.toLowerCase().includes(q);
        const mContact = c.contactPerson?.toLowerCase().includes(q);
        const mPhone = c.phone?.toLowerCase().includes(q);
        const mEmail = c.email?.toLowerCase().includes(q);
        const mCR = c.commercialReg?.toLowerCase().includes(q);
        const mVAT = c.vatNumber?.toLowerCase().includes(q);
        const mCity = c.city?.toLowerCase().includes(q);
        if (!mName && !mContact && !mPhone && !mEmail && !mCR && !mVAT && !mCity) return false;
      }
      return true;
    });
  }, [customers, selectedCity, search]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      toast(t("Missing required fields", "بيانات ناقصة"), t("Please enter company name and phone", "يرجى إدخال اسم المنشأة ورقم الهاتف"));
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.customers.create({
        companyName: formName,
        name: formName,
        fullName: formContact || formName,
        contactPerson: formContact || formName,
        phone: formPhone,
        email: formEmail,
        commercialReg: formCR,
        vatNumber: formVAT,
        city: formCity,
        address: formAddress,
        password: formPassword || "Ejaz@2026Client",
        direct: true,
      });

      const createdCust: Customer = res.customer || {
        id: `cust-${Date.now()}`,
        name: formName,
        contactPerson: formContact,
        phone: formPhone,
        email: formEmail,
        commercialReg: formCR,
        vatNumber: formVAT,
        city: formCity,
        address: formAddress,
      };

      setCustomers((prev) => [createdCust, ...prev]);
      toast(t("Customer added successfully", "تم تسجيل العميل بنجاح"), formName);
      setShowAddModal(false);
      // Reset form
      setFormName("");
      setFormContact("");
      setFormPhone("");
      setFormEmail("");
      setFormCR("");
      setFormVAT("");
      setFormAddress("");
    } catch (err: any) {
      toast(t("Failed to add customer", "تعذر إضافة العميل"), err.message || "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      setIsSubmitting(true);
      await apiClient.customers.update(editingCustomer.id, {
        name: editingCustomer.name,
        companyName: editingCustomer.name,
        contactPerson: editingCustomer.contactPerson,
        phone: editingCustomer.phone,
        email: editingCustomer.email,
        commercialReg: editingCustomer.commercialReg,
        vatNumber: editingCustomer.vatNumber,
        city: editingCustomer.city,
        address: editingCustomer.address,
      });

      setCustomers((prev) =>
        prev.map((c) => (c.id === editingCustomer.id ? editingCustomer : c))
      );
      toast(t("Customer updated successfully", "تم تحديث بيانات العميل بنجاح"), editingCustomer.name);
      setEditingCustomer(null);
    } catch (err: any) {
      toast(t("Failed to update customer", "تعذر تحديث بيانات العميل"), err.message || "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingCustomer) return;

    try {
      setIsSubmitting(true);
      await apiClient.customers.delete(deletingCustomer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
      toast(t("Customer removed successfully", "تم حذف العميل بنجاح"), deletingCustomer.name);
      setDeletingCustomer(null);
    } catch (err: any) {
      toast(t("Cannot delete customer", "تعذر حذف العميل"), err.message || "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast(t("Copied to clipboard", "تم النسخ إلى الحافظة"), label);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-0">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-chip bg-brand/12 text-brand">
                <IconDoc size={18} />
              </span>
              <h1 className="text-headline font-bold text-text-primary lg:text-hero-sm">
                {t("Customer Directory & Client Accounts", "سجل وإدارة العملاء والشركات المتعاقدة")}
              </h1>
            </div>
            <p className="mt-1 text-label-lg text-text-secondary">
              {t(
                "Authoritative registry of corporate shippers, commercial registrations, VAT certificates & contracts",
                "السجل الرسمي لشركات الشحن، السجلات التجارية، الأرقام الضريبية، وعقود النقل اللوجستي",
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-[220px] lg:w-[280px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search by customer, CR, VAT, city...", "ابحث بالاسم، السجل، الضريبة، المدينة...")}
                className="w-full rounded-chip border border-border-subtle bg-surface-2 px-3 py-1.5 ps-9 text-label-lg text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
              />
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted">
                <IconSearch size={14} />
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            {/* Add Customer Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-label-lg px-3.5 py-1.5 gap-1.5"
            >
              <IconPlus size={15} />
              <span>{t("Add Customer", "إضافة عميل جديد")}</span>
            </button>
          </div>
        </div>

        {/* Quick KPIs & Filter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-control bg-surface-2 p-1 border border-border-subtle">
            <button
              onClick={() => setSelectedCity("ALL")}
              className={cn(
                "rounded-chip px-3 py-1 text-label-lg font-semibold transition-all",
                selectedCity === "ALL"
                  ? "bg-surface-4 text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t("All Cities", "كل المدن")} ({customers.length})
            </button>
            {citiesList.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={cn(
                  "rounded-chip px-3 py-1 text-label-lg font-semibold transition-all",
                  selectedCity === city
                    ? "bg-surface-4 text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {city}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-label-lg font-mono tabular-nums">
            <span className="rounded-micro border border-border-subtle bg-surface-2 px-2.5 py-1 text-text-muted">
              {t("Active Accounts", "الحسابات النشطة")}: <strong className="text-text-primary font-bold">{customers.length}</strong>
            </span>
            <span className="rounded-micro border border-border-subtle bg-surface-2 px-2.5 py-1 text-text-muted">
              {t("Active Corridors", "المسارات المتعاقد عليها")}: <strong className="text-brand font-bold">16</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-thin">
        {loading ? (
          <div className="grid h-64 place-items-center text-text-muted text-body">
            {t("Loading customer registry…", "جارٍ تحميل سجل العملاء المعتمدين…")}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="grid h-64 place-items-center rounded-inner border border-dashed border-border-subtle p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-muted">
                <IconDoc size={22} />
              </span>
              <p className="mt-3 text-card-title font-semibold text-text-primary">
                {t("No customers found", "لم يتم العثور على عملاء مطابقين للبحث")}
              </p>
              <p className="mt-1 text-label-lg text-text-muted">
                {t("Adjust search query or add a new corporate customer manually", "عدّل خيارات البحث أو قم بإضافة عميل جديد يدوياً")}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary mt-4 text-label-lg mx-auto gap-1.5"
              >
                <IconPlus size={14} />
                <span>{t("Add Customer Now", "إضافة عميل الآن")}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((cust) => {
              const activeTripsCount = trips.filter(
                (tr) => (tr.shipper === cust.name || (tr as any).customerId === cust.id) && tr.status === "on_road"
              ).length;

              return (
                <div
                  key={cust.id}
                  className="group relative flex flex-col justify-between rounded-inner border border-border-subtle bg-surface-1 p-4 transition-all duration-200 hover:border-brand/40 hover:shadow-lg"
                >
                  <div>
                    {/* Header: Company Name & City */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-micro bg-brand/12 px-2 py-0.5 text-label font-bold text-brand">
                          {cust.city || "المملكة العربية السعودية"}
                        </span>
                        <h3 className="mt-1.5 text-card-title font-bold text-text-primary leading-tight">
                          {cust.name}
                        </h3>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-active/15 text-status-active" title="معتمد">
                        <IconCheck size={14} />
                      </span>
                    </div>

                    {/* Contact Person & Info */}
                    <div className="mt-3 space-y-1.5 text-label-lg text-text-secondary border-t border-border-subtle pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">{t("Contact Person", "المسؤول / المفوض")}:</span>
                        <span className="font-semibold text-text-primary">{cust.contactPerson || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">{t("Phone", "الهاتف")}:</span>
                        <span className="font-mono text-text-primary font-medium" dir="ltr">{cust.phone || "—"}</span>
                      </div>
                      {cust.email && (
                        <div className="flex items-center justify-between truncate">
                          <span className="text-text-muted">{t("Email", "البريد")}:</span>
                          <span className="font-mono text-text-muted text-label truncate max-w-[170px]">{cust.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Compliance Badges: CR & VAT */}
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-chip bg-surface-2 p-2 text-label font-mono">
                      <div
                        onClick={() => copyToClipboard(cust.commercialReg, "السجل التجاري")}
                        className="cursor-pointer hover:text-brand"
                        title={t("Click to copy CR", "انقر لنسخ رقم السجل")}
                      >
                        <span className="block text-micro text-text-muted font-sans">{t("CR Number", "س.ت")}:</span>
                        <span className="font-bold text-text-primary truncate block">{cust.commercialReg || "1010000000"}</span>
                      </div>
                      <div
                        onClick={() => copyToClipboard(cust.vatNumber, "الرقم الضريبي")}
                        className="cursor-pointer hover:text-brand"
                        title={t("Click to copy VAT", "انقر لنسخ الرقم الضريبي")}
                      >
                        <span className="block text-micro text-text-muted font-sans">{t("VAT Number", "الضريبة")}:</span>
                        <span className="font-bold text-text-primary truncate block">{cust.vatNumber || "3000000000"}</span>
                      </div>
                    </div>

                    {/* Physical Address */}
                    {cust.address && (
                      <p className="mt-2.5 text-label text-text-muted truncate">
                        📍 {cust.address}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-label-lg">
                    <div className="flex items-center gap-1.5 font-mono text-label">
                      {activeTripsCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenShipments?.()}
                          className="flex items-center gap-1 text-status-active font-semibold hover:underline cursor-pointer"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse" />
                          {activeTripsCount} {t("active trips", "شحنة نشطة")}
                        </button>
                      ) : (
                        <span className="text-text-muted">
                          {t("Ready for orders", "جاهز للتعميد")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onOpenCreateShipment && (
                        <button
                          onClick={() => onOpenCreateShipment(cust.name)}
                          className="btn-ghost text-label py-1 px-2 text-brand hover:bg-brand/10"
                          title={t("Create shipment for this customer", "إنشاء شحنة لهذا العميل")}
                        >
                          <IconCargo size={13} />
                          <span>{t("New Order", "طلب شحن")}</span>
                        </button>
                      )}

                      <button
                        onClick={() => setEditingCustomer(cust)}
                        className="btn-ghost text-label py-1 px-2 hover:text-text-primary"
                      >
                        {t("Edit", "تعديل")}
                      </button>

                      <button
                        onClick={() => setDeletingCustomer(cust)}
                        className="btn-ghost text-label py-1 px-2 text-status-danger hover:bg-status-danger/10"
                      >
                        {t("Delete", "حذف")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ADD CUSTOMER MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-inner border border-border-subtle bg-surface-1 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-page-title font-bold text-text-primary">
                  {t("Add New Corporate Customer", "إضافة منشأة / عميل جديد")}
                </h2>
                <p className="text-label-lg text-text-muted mt-0.5">
                  {t("Creates approved client account and commercial profile", "إنشاء وتفعيل حساب العميل الرسمي في سجلات إيجاز")}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-icon-sm text-text-muted hover:text-text-primary"
              >
                <IconClose size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-label-lg font-semibold text-text-muted mb-1">
                  {t("Company / Organization Name", "اسم الشركة أو المؤسسة")} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: شركة سدافكو للأغذية والمشروبات"
                  className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Authorized Contact Person", "اسم المسؤول / المفوض")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="مثال: م. طارق منصور"
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Contact Phone", "رقم الجوال الرسمي")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+966 5x xxx xxxx"
                    dir="ltr"
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Commercial Registration (CR)", "رقم السجل التجاري (١٠ أرقام)")}
                  </label>
                  <input
                    type="text"
                    value={formCR}
                    onChange={(e) => setFormCR(e.target.value)}
                    placeholder="1010xxxxxx"
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("VAT Number", "الرقم الضريبي (١٥ رقم)")}
                  </label>
                  <input
                    type="text"
                    value={formVAT}
                    onChange={(e) => setFormVAT(e.target.value)}
                    placeholder="3000xxxxxxxx003"
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("City", "المدينة الرئيسية")}
                  </label>
                  <select
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  >
                    <option value="الرياض">الرياض (Riyadh)</option>
                    <option value="جدة">جدة (Jeddah)</option>
                    <option value="الدمام">الدمام (Dammam)</option>
                    <option value="الجبيل">الجبيل (Jubail)</option>
                    <option value="الخرج">الخرج (Al-Kharj)</option>
                    <option value="القصيم">القصيم / بريدة (Qassim)</option>
                    <option value="المدينة المنورة">المدينة المنورة (Madinah)</option>
                    <option value="مكة المكرمة">مكة المكرمة (Makkah)</option>
                    <option value="حائل">حائل (Hail)</option>
                    <option value="أبها">أبها (Abha)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Email Address", "البريد الإلكتروني")}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="logistics@company.com"
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-lg font-semibold text-text-muted mb-1">
                  {t("Physical Address / Warehouse", "العنوان وموقع المستودعات")}
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="مثال: المنطقة الصناعية الأولى، بوابة المستودعات رقم ٤"
                  className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-label-lg font-semibold text-text-muted mb-1">
                  {t("Portal Password (for client mobile app)", "كلمة مرور بوابة العميل وتطبيق الجوال")}
                </label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Ejaz@2026Client"
                  className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ghost text-label-lg"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-label-lg px-4 py-2"
                >
                  {isSubmitting ? t("Saving…", "جارٍ الحفظ…") : t("Confirm & Create Customer", "تأكيد وإضافة العميل")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CUSTOMER MODAL ── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-inner border border-border-subtle bg-surface-1 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-page-title font-bold text-text-primary">
                  {t("Edit Customer Details", "تعديل بيانات العميل")}
                </h2>
                <p className="text-label-lg text-text-muted mt-0.5">
                  {editingCustomer.name}
                </p>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="btn-icon-sm text-text-muted hover:text-text-primary"
              >
                <IconClose size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-label-lg font-semibold text-text-muted mb-1">
                  {t("Company Name", "اسم المنشأة")}
                </label>
                <input
                  type="text"
                  required
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Contact Person", "المسؤول / المفوض")}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.contactPerson}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, contactPerson: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Phone", "رقم الجوال")}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("CR Number", "رقم السجل التجاري")}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.commercialReg}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, commercialReg: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("VAT Number", "الرقم الضريبي")}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.vatNumber}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, vatNumber: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("City", "المدينة")}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.city}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-label-lg font-semibold text-text-muted mb-1">
                    {t("Email", "البريد الإلكتروني")}
                  </label>
                  <input
                    type="email"
                    value={editingCustomer.email}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-lg font-semibold text-text-muted mb-1">
                  {t("Address", "العنوان")}
                </label>
                <input
                  type="text"
                  value={editingCustomer.address}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  className="w-full rounded-chip border border-border-subtle bg-surface-2 p-2 text-label-lg text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="btn-ghost text-label-lg"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-label-lg px-4 py-2"
                >
                  {isSubmitting ? t("Saving…", "جارٍ التحديث…") : t("Save Changes", "حفظ التعديلات")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-inner border border-status-danger/40 bg-surface-1 p-5 shadow-2xl">
            <h3 className="text-page-title font-bold text-status-danger">
              {t("Delete Customer Account", "تأكيد حذف حساب العميل")}
            </h3>
            <p className="mt-2 text-body text-text-secondary leading-relaxed">
              {t(
                "Are you sure you want to delete this customer account? This will remove the record from active directories.",
                "هل أنت متأكد من رغبتك في حذف حساب العميل هذا؟ سيتم إزالته من السجلات التشغيلية.",
              )}
            </p>
            <div className="mt-3 rounded-chip bg-surface-2 p-2.5 text-label-lg font-bold text-text-primary">
              {deletingCustomer.name} · {deletingCustomer.city}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="btn-ghost text-label-lg"
              >
                {t("Cancel", "تراجع")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteSubmit}
                className="rounded-chip bg-status-danger px-4 py-2 text-label-lg font-bold text-white transition-opacity hover:opacity-90"
              >
                {isSubmitting ? t("Deleting…", "جارٍ الحذف…") : t("Confirm Delete", "تأكيد الحذف النهائي")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
