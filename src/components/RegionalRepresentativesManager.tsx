import React, { useState, useEffect, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import {
  IconDoc,
  IconClose,
  IconCheck,
  IconAlertCircle,
  IconTruck,
  IconCargo,
  IconHistory,
  IconPlus,
  IconTag,
  IconProfile,
} from "./Icons";

interface RepMetrics {
  totalTrips: number;
  activeTrips: number;
  deliveredTrips: number;
  pendingPriceTrips: number;
}

interface RepresentativePermissions {
  canCreateTrips?: boolean;
  canEditTrips?: boolean;
  canTrackTrips?: boolean;
  canManageCustomers?: boolean;
  canManageDrivers?: boolean;
  canEnterCustomPrice?: boolean;
  canRequestPriceApproval?: boolean;
  canCancelTrips?: boolean;
  canReopenTrips?: boolean;
  canAssignTrips?: boolean;
}

interface Representative {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  region: string;
  isActive: boolean;
  createdAt: string;
  permissions: RepresentativePermissions;
  metrics: RepMetrics;
}

const SAUDI_REGIONS = [
  "المنطقة الشمالية",
  "المنطقة الشرقية",
  "المنطقة الغربية",
  "المنطقة الجنوبية",
  "المنطقة الوسطى",
];

const REGION_BADGE_COLORS: Record<string, string> = {
  "المنطقة الشمالية": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "المنطقة الشرقية": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "المنطقة الغربية": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "المنطقة الجنوبية": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "المنطقة الوسطى": "bg-brand/15 text-brand border-brand/30",
};

const PERMISSION_CONFIG: Array<{
  key: keyof RepresentativePermissions;
  labelAr: string;
  descAr: string;
}> = [
  { key: "canCreateTrips", labelAr: "إنشاء الرحلات والشحنات", descAr: "إمكانية فتح طلبات نقل جديدة باسم الممثل ومنطقته" },
  { key: "canEditTrips", labelAr: "تعديل تفاصيل الرحلات", descAr: "تعديل بيانات البضاعة، الأوزان، ومواعيد التحميل" },
  { key: "canTrackTrips", labelAr: "متابعة وتتبع الرحلات", descAr: "مراقبة مسار الشاحنات الحي والحالات التشغيلية" },
  { key: "canManageCustomers", labelAr: "إدارة العملاء والتجار", descAr: "تسجيل عملاء جدد وتعديل ملفاتهم في المنطقة" },
  { key: "canManageDrivers", labelAr: "إدارة السائقين الميدانيين", descAr: "متابعة السائقين والرخص والاتصال المباشر" },
  { key: "canEnterCustomPrice", labelAr: "إدخال أسعار مخصصة للرحلات", descAr: "إدخال سعر تفاوضي يدوي عند إنشاء الرحلة" },
  { key: "canRequestPriceApproval", labelAr: "طلب اعتماد الأسعار", descAr: "إرسال طلب موافقة على السعر لمدير العمليات" },
  { key: "canAssignTrips", labelAr: "إعادة تعيين السائق أو الشاحنة", descAr: "تبديل الكابتن أو المركبة لمعالجة الظروف الميدانية" },
  { key: "canCancelTrips", labelAr: "إلغاء الرحلات الميدانية", descAr: "إلغاء رحلة مع تسجيل السبب المبرر إلزاميًا" },
  { key: "canReopenTrips", labelAr: "إعادة فتح الرحلات الملغاة", descAr: "إعادة تنشيط رحلة ملغاة لمتابعة التشغيل" },
];

export function RegionalRepresentativesManager() {
  const { t } = useSettings();
  const toast = useToast();

  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTripsDrawer, setShowTripsDrawer] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  const [activeRep, setActiveRep] = useState<Representative | null>(null);
  const [repTrips, setRepTrips] = useState<any[]>([]);
  const [repAudit, setRepAudit] = useState<any[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  // Create Form State
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("+9665");
  const [formPassword, setFormPassword] = useState("Ejaz@2026Rep");
  const [formRegion, setFormRegion] = useState("المنطقة الوسطى");
  const [formPermissions, setFormPermissions] = useState<RepresentativePermissions>({
    canCreateTrips: true,
    canEditTrips: true,
    canTrackTrips: true,
    canManageCustomers: true,
    canManageDrivers: true,
    canEnterCustomPrice: true,
    canRequestPriceApproval: true,
    canAssignTrips: false,
    canCancelTrips: false,
    canReopenTrips: false,
  });

  // Edit / Status Form State
  const [statusReason, setStatusReason] = useState("");

  const loadRepresentatives = async () => {
    try {
      setLoading(true);
      const res = await apiClient.representatives.getAll();
      if (res && Array.isArray(res.representatives)) {
        setRepresentatives(res.representatives);
      }
    } catch (err: any) {
      toast(t("Failed to load representatives", "فشل تحميل بيانات ممثلي المناطق"), err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepresentatives();
  }, []);

  const filteredRepresentatives = useMemo(() => {
    return representatives.filter((r) => {
      const matchRegion = selectedRegion === "ALL" || r.region === selectedRegion;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.region.toLowerCase().includes(q);
      return matchRegion && matchQuery;
    });
  }, [representatives, selectedRegion, searchQuery]);

  const kpis = useMemo(() => {
    const total = representatives.length;
    const active = representatives.filter((r) => r.isActive).length;
    const totalTrips = representatives.reduce((acc, r) => acc + (r.metrics?.totalTrips || 0), 0);
    const activeTrips = representatives.reduce((acc, r) => acc + (r.metrics?.activeTrips || 0), 0);
    const pendingPrice = representatives.reduce((acc, r) => acc + (r.metrics?.pendingPriceTrips || 0), 0);
    return { total, active, totalTrips, activeTrips, pendingPrice };
  }, [representatives]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    try {
      await apiClient.representatives.create({
        fullName: formFullName,
        email: formEmail,
        phone: formPhone,
        password: formPassword,
        region: formRegion,
        permissions: formPermissions,
      });
      toast(t("Representative Created", "تم إنشاء حساب الممثل بنجاح"));
      setShowCreateModal(false);
      setFormFullName("");
      setFormEmail("");
      setFormPhone("+9665");
      loadRepresentatives();
    } catch (err: any) {
      toast(t("Failed to create representative", "فشل إنشاء حساب الممثل"), err.message || "Error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRep) return;
    setActionBusy(true);
    try {
      await apiClient.representatives.update(activeRep.id, {
        fullName: formFullName,
        phone: formPhone,
        region: formRegion,
        permissions: formPermissions,
      });
      toast(t("Representative Updated", "تم تحديث بيانات وصلاحيات الممثل بنجاح"));
      setShowEditModal(false);
      loadRepresentatives();
    } catch (err: any) {
      toast(t("Failed to update representative", "فشل تحديث بيانات الممثل"), err.message || "Error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!activeRep) return;
    setActionBusy(true);
    try {
      const nextState = !activeRep.isActive;
      await apiClient.representatives.setStatus(activeRep.id, nextState, statusReason);
      toast(
        nextState
          ? t("Representative Activated", "تم تفعيل حساب الممثل")
          : t("Representative Deactivated", "تم تعطيل حساب الممثل وحفظ سجله")
      );
      setShowStatusModal(false);
      setStatusReason("");
      loadRepresentatives();
    } catch (err: any) {
      toast(t("Failed to change status", "فشل تغيير حالة الحساب"), err.message || "Error");
    } finally {
      setActionBusy(false);
    }
  };

  const openEditModal = (rep: Representative) => {
    setActiveRep(rep);
    setFormFullName(rep.fullName);
    setFormEmail(rep.email);
    setFormPhone(rep.phone);
    setFormRegion(rep.region);
    setFormPermissions({ ...rep.permissions });
    setShowEditModal(true);
  };

  const openStatusModal = (rep: Representative) => {
    setActiveRep(rep);
    setStatusReason("");
    setShowStatusModal(true);
  };

  const openTripsDrawer = async (rep: Representative) => {
    setActiveRep(rep);
    setShowTripsDrawer(true);
    try {
      const res = await apiClient.representatives.getTrips(rep.id);
      setRepTrips(res.trips || []);
    } catch {
      setRepTrips([]);
    }
  };

  const openAuditDrawer = async (rep: Representative) => {
    setActiveRep(rep);
    setShowAuditDrawer(true);
    try {
      const res = await apiClient.representatives.getAudit(rep.id);
      setRepAudit(res.audit || []);
    } catch {
      setRepAudit([]);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-0 px-4 py-5 md:px-6">
      {/* Top Banner & Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-control bg-brand/15 text-brand border border-brand/30">
              <IconProfile size={22} />
            </span>
            <div>
              <h1 className="text-section-title font-extrabold text-text-primary">
                {t("Regional Representatives Management", "إدارة ممثلي المناطق")}
              </h1>
              <p className="text-label text-text-muted">
                {t(
                  "Operational management of regional representatives across the 5 Saudi regions",
                  "صلاحيات مدير العمليات لإدارة الحسابات، المناطق، والتحكم بالصلاحيات التشغيلية والأسعار"
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setFormFullName("");
            setFormEmail("");
            setFormPhone("+9665");
            setFormPassword("Ejaz@2026Rep");
            setFormRegion("المنطقة الوسطى");
            setFormPermissions({
              canCreateTrips: true,
              canEditTrips: true,
              canTrackTrips: true,
              canManageCustomers: true,
              canManageDrivers: true,
              canEnterCustomPrice: true,
              canRequestPriceApproval: true,
              canAssignTrips: false,
              canCancelTrips: false,
              canReopenTrips: false,
            });
            setShowCreateModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 rounded-control px-4 py-2 text-label font-bold shadow-md shadow-brand/20 active:scale-95"
        >
          <IconPlus size={16} />
          <span>{t("Add Representative", "إضافة ممثّل منطقة جديد")}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Total Reps", "إجمالي الممثلين")}</div>
          <div className="mt-1 text-metric font-extrabold text-text-primary">{kpis.total}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Covering 5 Regions", "يغطون ٥ مناطق مستقلة")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Active Reps", "الحسابات النشطة")}</div>
          <div className="mt-1 text-metric font-extrabold text-status-active">{kpis.active}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Operational now", "جاهزون للتشغيل")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Regional Trips", "رحلات المناطق")}</div>
          <div className="mt-1 text-metric font-extrabold text-sky-400">{kpis.totalTrips}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Created / Assigned", "مسندة للممثلين")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Active Trips", "رحلات جارية")}</div>
          <div className="mt-1 text-metric font-extrabold text-status-warning">{kpis.activeTrips}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("On the road", "على المسار الآن")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Price Approvals", "اعتمادات الأسعار")}</div>
          <div className="mt-1 text-metric font-extrabold text-brand">{kpis.pendingPrice}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Awaiting Manager", "بانتظار قرار المدير")}</div>
        </div>
      </div>

      {/* Filters & Region Selector Tabs */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Region Filter Buttons */}
        <div className="scroll-x flex items-center gap-1.5 rounded-inner bg-surface-1 p-1 border border-border-subtle">
          <button
            onClick={() => setSelectedRegion("ALL")}
            className={cn(
              "rounded-control px-3 py-1.5 text-label font-bold transition-all",
              selectedRegion === "ALL"
                ? "bg-brand text-on-brand shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2"
            )}
          >
            {t("All Regions", "كافة المناطق")}
          </button>
          {SAUDI_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={cn(
                "rounded-control px-3 py-1.5 text-label font-bold whitespace-nowrap transition-all",
                selectedRegion === r
                  ? "bg-brand text-on-brand shadow-sm"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search representative…", "بحث بالاسم، الجوال، البريد…")}
            className="w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-1.5 text-body text-text-primary placeholder:text-text-muted/60 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Representatives Cards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-body text-text-muted animate-pulse">{t("Loading representatives…", "جارٍ تحميل بيانات الممثلين…")}</div>
        </div>
      ) : filteredRepresentatives.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-subtle bg-surface-1/40 p-12 text-center">
          <div className="text-page-title font-bold text-text-primary">{t("No representatives found", "لم يتم العثور على ممثلين")}</div>
          <p className="mt-1 text-label text-text-muted">
            {t("Add a representative or adjust your filter selection", "قم بإضافة ممثّل للمنطقة أو تعديل خيارات التصفية")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRepresentatives.map((rep) => {
            const badgeClass = REGION_BADGE_COLORS[rep.region] || "bg-surface-3 text-text-secondary border-border-subtle";
            return (
              <div
                key={rep.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-card border bg-surface-1 p-4 shadow-sm transition-all hover:shadow-md",
                  rep.isActive ? "border-border-subtle" : "border-status-error/30 opacity-75 bg-surface-1/60"
                )}
              >
                {/* Header & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-card-title font-bold text-text-primary">{rep.fullName}</h3>
                        <span
                          className={cn(
                            "rounded-chip border px-2 py-0.5 text-micro font-extrabold uppercase",
                            badgeClass
                          )}
                        >
                          {rep.region}
                        </span>
                      </div>
                      <div className="mt-1 text-label text-text-muted truncate">{rep.email}</div>
                      <div className="text-label text-text-muted font-mono" dir="ltr">{rep.phone}</div>
                    </div>

                    <button
                      onClick={() => openStatusModal(rep)}
                      title={rep.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-micro font-bold border transition-colors",
                        rep.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                      )}
                    >
                      {rep.isActive ? t("Active", "نشط") : t("Disabled", "معطّل")}
                    </button>
                  </div>

                  {/* Operational Metrics Chips */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-inner bg-surface-2/60 p-2 border border-border-subtle/50 text-center">
                    <div>
                      <div className="text-micro text-text-muted">{t("Trips", "الرحلات")}</div>
                      <div className="text-body font-extrabold text-text-primary">{rep.metrics?.totalTrips || 0}</div>
                    </div>
                    <div>
                      <div className="text-micro text-text-muted">{t("Active", "جارية")}</div>
                      <div className="text-body font-extrabold text-status-warning">{rep.metrics?.activeTrips || 0}</div>
                    </div>
                    <div>
                      <div className="text-micro text-text-muted">{t("Pending Price", "سعر معلق")}</div>
                      <div className="text-body font-extrabold text-brand">{rep.metrics?.pendingPriceTrips || 0}</div>
                    </div>
                  </div>

                  {/* Operational Permissions Summary */}
                  <div className="mt-3 space-y-1.5">
                    <div className="text-micro font-bold uppercase text-text-muted">{t("Operational Matrix", "الصلاحيات التشغيلية المفوضة:")}</div>
                    <div className="flex flex-wrap gap-1">
                      {rep.permissions.canCreateTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          إنشاء الرحلات
                        </span>
                      )}
                      {rep.permissions.canEnterCustomPrice && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-amber-400 border border-amber-500/30">
                          إدخال أسعار
                        </span>
                      )}
                      {rep.permissions.canManageCustomers && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          إدارة العملاء
                        </span>
                      )}
                      {rep.permissions.canManageDrivers && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          إدارة السائقين
                        </span>
                      )}
                      {rep.permissions.canAssignTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-sky-400 border border-sky-500/30">
                          إعادة التعيين
                        </span>
                      )}
                      {rep.permissions.canCancelTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-rose-400 border border-rose-500/30">
                          إلغاء الرحلات
                        </span>
                      )}
                      {rep.permissions.canReopenTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-purple-400 border border-purple-500/30">
                          إعادة الفتح
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 flex items-center justify-between gap-1.5 border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openTripsDrawer(rep)}
                      className="rounded-control bg-surface-2 px-2.5 py-1 text-label font-bold text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
                    >
                      {t("Trips", "الرحلات")} ({rep.metrics?.totalTrips || 0})
                    </button>
                    <button
                      onClick={() => openAuditDrawer(rep)}
                      className="rounded-control bg-surface-2 px-2.5 py-1 text-label font-bold text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
                    >
                      {t("Audit Log", "سجل التعديلات")}
                    </button>
                  </div>

                  <button
                    onClick={() => openEditModal(rep)}
                    className="rounded-control bg-brand/10 border border-brand/20 px-3 py-1 text-label font-bold text-brand hover:bg-brand/20 transition-colors"
                  >
                    {t("Edit & Perms", "تعديل والصلاحيات")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE REPRESENTATIVE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-page-title font-bold text-text-primary">{t("Add Regional Representative", "إضافة ممثل منطقة جديد")}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-text-primary">
                <IconClose size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-label font-bold text-text-secondary">{t("Full Name", "الاسم الرباعي الكامل")}</label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="مثال: تركي بن صالح الحربي"
                  className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Email", "البريد الإلكتروني")}</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="rep@ejaz.sa"
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Phone Number", "رقم الجوال")}</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+966550000000"
                    dir="ltr"
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Assigned Region", "المنطقة المخصصة")}</label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  >
                    {SAUDI_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Password", "كلمة المرور الأولية")}</label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* Operational Permissions Matrix Checklist */}
              <div className="rounded-card border border-border-subtle bg-surface-1/70 p-3.5">
                <div className="text-label-lg font-bold text-text-primary mb-2">
                  {t("Operational Permissions Granted", "تحديد الصلاحيات التشغيلية المفوضة")}
                </div>
                <div className="space-y-2">
                  {PERMISSION_CONFIG.map((p) => {
                    const isChecked = !!formPermissions[p.key];
                    return (
                      <label
                        key={p.key}
                        className="flex items-start gap-2.5 rounded-control p-1.5 hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setFormPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 rounded accent-brand"
                        />
                        <div>
                          <div className="text-body font-bold text-text-primary">{p.labelAr}</div>
                          <div className="text-micro text-text-muted">{p.descAr}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-control border border-border-subtle px-4 py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="btn-primary rounded-control px-5 py-2 text-label font-bold text-on-brand disabled:opacity-50"
                >
                  {actionBusy ? t("Saving…", "جارٍ الحفظ…") : t("Create Account", "إنشاء الحساب وتفعيل الصلاحيات")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REPRESENTATIVE & PERMISSIONS MODAL */}
      {showEditModal && activeRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-bold text-text-primary">
                  {t("Edit Representative & Permissions", "تعديل بيانات وصلاحيات الممثل")}
                </h3>
                <div className="text-micro text-text-muted">{activeRep.email}</div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-text-muted hover:text-text-primary">
                <IconClose size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-label font-bold text-text-secondary">{t("Full Name", "الاسم الكامل")}</label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Phone Number", "رقم الجوال")}</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    dir="ltr"
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-label font-bold text-text-secondary">{t("Assigned Region", "المنطقة الرسمية")}</label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                  >
                    {SAUDI_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions matrix */}
              <div className="rounded-card border border-border-subtle bg-surface-1/70 p-3.5">
                <div className="text-label-lg font-bold text-text-primary mb-2">
                  {t("Operational Permissions", "التحكم بالصلاحيات التشغيلية للممثل")}
                </div>
                <div className="space-y-2">
                  {PERMISSION_CONFIG.map((p) => {
                    const isChecked = !!formPermissions[p.key];
                    return (
                      <label
                        key={p.key}
                        className="flex items-start gap-2.5 rounded-control p-1.5 hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setFormPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 rounded accent-brand"
                        />
                        <div>
                          <div className="text-body font-bold text-text-primary">{p.labelAr}</div>
                          <div className="text-micro text-text-muted">{p.descAr}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-control border border-border-subtle px-4 py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="btn-primary rounded-control px-5 py-2 text-label font-bold text-on-brand disabled:opacity-50"
                >
                  {actionBusy ? t("Saving…", "جارٍ الحفظ…") : t("Save Changes", "حفظ وتطبيق الصلاحيات فوراً")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS TOGGLE MODAL */}
      {showStatusModal && activeRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl">
            <h3 className="text-page-title font-bold text-text-primary">
              {activeRep.isActive
                ? t("Deactivate Representative Account?", "تعطيل حساب الممثل؟")
                : t("Reactivate Representative Account?", "إعادة تفعيل حساب الممثل؟")}
            </h3>
            <p className="mt-2 text-body text-text-secondary">
              {activeRep.isActive
                ? t(
                    `Are you sure you want to deactivate ${activeRep.fullName}'s account? Their operational history and trips will be completely preserved.`,
                    `هل أنت متأكد من تعطيل حساب ${activeRep.fullName}؟ سيتم تعليق دخوله فوراً مع الاحتفاظ بسجله التشغيلي وكافة رحلاته التاريخية بأمان.`
                  )
                : t(
                    `Reactivate ${activeRep.fullName}'s account and restore their assigned region?`,
                    `إعادة تفعيل حساب ${activeRep.fullName} واستعادة إمكانية تسجيل الدخول في ${activeRep.region}؟`
                  )}
            </p>

            <div className="mt-3">
              <label className="text-label font-bold text-text-secondary">{t("Operational Reason", "المبرر التشغيلي")}</label>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="مثال: إجازة موسمية / إعادة توزيع المناطق"
                className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="rounded-control border border-border-subtle px-4 py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
              >
                {t("Cancel", "إلغاء")}
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={actionBusy}
                className={cn(
                  "rounded-control px-4 py-2 text-label font-bold text-white transition-colors",
                  activeRep.isActive ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                )}
              >
                {activeRep.isActive ? t("Confirm Deactivation", "تأكيد التعطيل") : t("Confirm Activation", "تأكيد التفعيل")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: REPRESENTATIVE'S TRIPS */}
      {showTripsDrawer && activeRep && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl bg-surface-2 p-5 shadow-2xl overflow-y-auto border-s border-border-subtle flex flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-bold text-text-primary">{t("Regional Trips", "رحلات الممثل")}</h3>
                <div className="text-label text-brand font-bold">{activeRep.fullName} ({activeRep.region})</div>
              </div>
              <button onClick={() => setShowTripsDrawer(false)} className="text-text-muted hover:text-text-primary">
                <IconClose size={20} />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              {repTrips.length === 0 ? (
                <div className="py-12 text-center text-text-muted">{t("No trips created yet in this region", "لا توجد رحلات مسجلة لهذا الممثل حتى الآن")}</div>
              ) : (
                repTrips.map((tr) => (
                  <div key={tr.id} className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-body font-bold text-brand">{tr.tripNumber}</span>
                      <span className="rounded-chip bg-surface-2 border border-border-subtle px-2 py-0.5 text-micro text-text-secondary font-bold">
                        {tr.status}
                      </span>
                    </div>
                    <div className="mt-2 text-body font-bold text-text-primary">
                      {tr.originCity} ➔ {tr.destinationCity}
                    </div>
                    <div className="mt-1 text-label text-text-muted">
                      {tr.customerName} · {tr.cargoType} ({tr.cargoWeightTons} طن)
                    </div>
                    <div className="mt-2 flex items-center justify-between text-micro text-text-muted pt-2 border-t border-border-subtle/50">
                      <span>السعر: <strong className="text-text-primary">{tr.tripPrice || 0} {tr.currency || "SAR"}</strong> ({tr.priceStatus || "TARIFF"})</span>
                      <span>{new Date(tr.createdAt).toLocaleDateString("ar-SA")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: REPRESENTATIVE'S AUDIT LOG */}
      {showAuditDrawer && activeRep && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl bg-surface-2 p-5 shadow-2xl overflow-y-auto border-s border-border-subtle flex flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-bold text-text-primary">{t("Audit Trail", "سجل التعديلات والعمليات")}</h3>
                <div className="text-label text-brand font-bold">{activeRep.fullName}</div>
              </div>
              <button onClick={() => setShowAuditDrawer(false)} className="text-text-muted hover:text-text-primary">
                <IconClose size={20} />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-3">
              {repAudit.length === 0 ? (
                <div className="py-12 text-center text-text-muted">{t("No audit events recorded yet", "لا توجد تعديلات مسجلة بعد")}</div>
              ) : (
                repAudit.map((log) => (
                  <div key={log.id} className="rounded-card border border-border-subtle bg-surface-1 p-3 text-body">
                    <div className="flex items-center justify-between text-micro text-text-muted">
                      <span className="font-bold text-brand">{log.action}</span>
                      <span>{new Date(log.timestamp).toLocaleString("ar-SA")}</span>
                    </div>
                    <div className="mt-1 text-label text-text-secondary">
                      المنفّذ: <strong className="text-text-primary">{log.actorName || log.actorRole || "مدير العمليات"}</strong>
                    </div>
                    {log.reason && (
                      <div className="mt-1 text-micro text-amber-400">
                        السبب: {log.reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
