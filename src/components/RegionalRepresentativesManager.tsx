import React, { useState, useEffect, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import {
  IconClose,
  IconPlus,
  IconProfile,
  IconTruck,
  IconCheck,
  IconEye,
  IconEyeOff,
} from "./Icons";

export interface RepMetrics {
  totalTrips: number;
  activeTrips: number;
  deliveredTrips: number;
  pendingPriceTrips: number;
}

export interface RepresentativePermissions {
  // 1. إدارة الرحلات
  canViewTrips?: boolean;
  canCreateTrips?: boolean;
  canEditTrips?: boolean;
  canAssignTrips?: boolean;
  canTransitionTrips?: boolean;
  canTrackTrips?: boolean;
  canCancelTrips?: boolean;
  canReopenTrips?: boolean;
  canReassignTrips?: boolean;
  canDeleteTrips?: boolean;

  // 2. إدارة العملاء
  canViewCustomers?: boolean;
  canCreateCustomers?: boolean;
  canEditCustomers?: boolean;
  canDeleteCustomers?: boolean;

  // 3. إدارة السائقين والشاحنات
  canViewDrivers?: boolean;
  canCreateDrivers?: boolean;
  canEditDrivers?: boolean;
  canToggleDriverStatus?: boolean;
  canViewVehicles?: boolean;
  canManageVehicles?: boolean;

  // 4. التسعير والتعرفة
  canViewTariffs?: boolean;
  canEnterCustomPrice?: boolean;
  canEditPrice?: boolean;
  canRequestPriceApproval?: boolean;
  canApprovePrice?: boolean;
  canManageTariffs?: boolean;

  // 5. الصلاحيات التشغيلية الإضافية
  canViewReports?: boolean;
  canViewTripHistory?: boolean;
  canAddNotes?: boolean;
  canUploadDocuments?: boolean;
  canExportData?: boolean;
}

export interface Representative {
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

export const SAUDI_REGIONS = [
  "المنطقة الشمالية",
  "المنطقة الغربية",
  "المنطقة الجنوبية",
  "المنطقة الشرقية",
  "المنطقة الوسطى",
];

export const SAUDI_REGIONAL_PROFILES = [
  {
    id: "المنطقة الوسطى",
    nameAr: "المنطقة الوسطى",
    subAr: "الرياض، القصيم، الخرج، بريدة، عنيزة",
    iconColor: "from-brand/20 via-surface-2 to-brand/5 text-brand border-brand/40",
    badge: "bg-brand/15 text-brand border-brand/30",
    accent: "#ff8c00",
  },
  {
    id: "المنطقة الغربية",
    nameAr: "المنطقة الغربية",
    subAr: "مكة المكرمة، جدة، المدينة المنورة، ينبع، الطائف",
    iconColor: "from-amber-500/20 via-surface-2 to-amber-500/5 text-amber-400 border-amber-500/40",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    accent: "#f59e0b",
  },
  {
    id: "المنطقة الشرقية",
    nameAr: "المنطقة الشرقية",
    subAr: "الدمام، الخبر، الجبيل، الأحساء، حفر الباطن",
    iconColor: "from-emerald-500/20 via-surface-2 to-emerald-500/5 text-emerald-400 border-emerald-500/40",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    accent: "#10b981",
  },
  {
    id: "المنطقة الجنوبية",
    nameAr: "المنطقة الجنوبية",
    subAr: "عسير، أبها، جازان، نجران، خميس مشيط، الباحة",
    iconColor: "from-purple-500/20 via-surface-2 to-purple-500/5 text-purple-400 border-purple-500/40",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    accent: "#a855f7",
  },
  {
    id: "المنطقة الشمالية",
    nameAr: "المنطقة الشمالية",
    subAr: "تبوك، الجوف، الحدود الشمالية، عرعر، حائل",
    iconColor: "from-sky-500/20 via-surface-2 to-sky-500/5 text-sky-400 border-sky-500/40",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    accent: "#0ea5e9",
  },
];

export const PERMISSION_GROUPS: Array<{
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  permissions: Array<{
    key: keyof RepresentativePermissions;
    labelAr: string;
    descAr: string;
    sensitive?: boolean;
    adminOnly?: boolean;
  }>;
}> = [
  {
    id: "trips",
    titleAr: "١. إدارة الرحلات والتشغيل الميداني",
    titleEn: "Trip Lifecycle & Dispatch",
    descAr: "التحكم في إنشاء وتعديل ونقل ومتابعة رحلات المنطقة",
    permissions: [
      { key: "canViewTrips", labelAr: "عرض الرحلات", descAr: "عرض وبحث الرحلات المسموح بها ضمن المنطقة المحددة" },
      { key: "canCreateTrips", labelAr: "إنشاء رحلة جديدة", descAr: "حجز رقم موحد وإنشاء رحلة وحفظها مباشرة في قاعدة البيانات" },
      { key: "canEditTrips", labelAr: "تعديل تفاصيل الرحلة", descAr: "تعديل بيانات البضاعة والعناوين والأوزان قبل الإكمال" },
      { key: "canAssignTrips", labelAr: "تعيين سائق وشاحنة", descAr: "إسناد سائق ومركبة متاحين وفق القواعد التشغيلية" },
      { key: "canTransitionTrips", labelAr: "تغيير حالة الرحلة", descAr: "تنفيذ الانتقالات المرحلية المعتمدة (انطلاق، وصول، تحميل، تفريغ)" },
      { key: "canTrackTrips", labelAr: "متابعة وتتبع الرحلة", descAr: "متابعة الحالة الحية والإحداثيات والمواعيد التقديرية" },
      { key: "canCancelTrips", labelAr: "إلغاء الرحلة الميدانية", descAr: "إلغاء رحلة مع تسجيل السبب المبرر إلزاميًا", sensitive: true },
      { key: "canReopenTrips", labelAr: "إعادة فتح رحلة ملغاة", descAr: "ممنوع افتراضيًا للمندوب؛ يتطلب تفويضاً صريحاً من الإدارة", sensitive: true },
      { key: "canReassignTrips", labelAr: "إعادة تعيين السائق أو الشاحنة", descAr: "استبدال السائق أو الشاحنة مع توثيق السبب والبديل", sensitive: true },
      { key: "canDeleteTrips", labelAr: "حذف الرحلة نهائياً", descAr: "ممنوع على المندوبين؛ مخصص للمدير وفق ضوابط الأرشفة", adminOnly: true, sensitive: true },
    ],
  },
  {
    id: "customers",
    titleAr: "٢. إدارة العملاء والتجار",
    titleEn: "Customers & Accounts",
    descAr: "إدارة الحسابات المشتركة والتحقق من السجلات والبيانات",
    permissions: [
      { key: "canViewCustomers", labelAr: "عرض العملاء", descAr: "البحث واستعراض سجلات العملاء المشتركة في النظام" },
      { key: "canCreateCustomers", labelAr: "إضافة عميل جديد", descAr: "تسجيل عميل جديد وتوثيقه في قاعدة البيانات فوراً" },
      { key: "canEditCustomers", labelAr: "تعديل بيانات العميل", descAr: "تعديل بيانات التواصل والعناوين التجارية والسجل" },
      { key: "canDeleteCustomers", labelAr: "حذف العميل وتعديل الائتمان", descAr: "ممنوع على المندوبين افتراضيًا؛ مخصص للإدارة العليا", adminOnly: true, sensitive: true },
    ],
  },
  {
    id: "drivers",
    titleAr: "٣. إدارة السائقين والأسطول",
    titleEn: "Drivers & Fleet",
    descAr: "إدارة الكباتن الميدانيين والرخص والمركبات المعتمدة",
    permissions: [
      { key: "canViewDrivers", labelAr: "عرض السائقين", descAr: "استعراض سجل السائقين المعتمد وبيانات الرخص والاتصال" },
      { key: "canCreateDrivers", labelAr: "إضافة سائق جديد", descAr: "تسجيل سائق جديد وتوثيقه في النظام للإسناد المباشر" },
      { key: "canEditDrivers", labelAr: "تعديل بيانات السائق", descAr: "تعديل بيانات الاتصال ورقم ورخصة القيادة" },
      { key: "canToggleDriverStatus", labelAr: "تغيير حالة السائق", descAr: "تفعيل السائق أو إيقافه أو حظره (مخصص لمدير العمليات)", adminOnly: true, sensitive: true },
      { key: "canViewVehicles", labelAr: "عرض الشاحنات والمواصفات", descAr: "استعراض الشاحنات والمواصفات وحالات التوفر والأصول" },
      { key: "canManageVehicles", labelAr: "تسجيل وإدارة الشاحنات", descAr: "إضافة شاحنة وتعديلها وإخراجها من الخدمة", sensitive: true },
    ],
  },
  {
    id: "tariffs",
    titleAr: "٤. الأسعار والتعرفة المعتمدة",
    titleEn: "Pricing & Tariffs",
    descAr: "ضوابط تسعير الرحلات وطلب الاعتماد ومنع الموافقة الذاتية",
    permissions: [
      { key: "canViewTariffs", labelAr: "عرض دفتر التعرفة", descAr: "الاطلاع على جدول التعرفة والأسعار الرسمية المعتمدة" },
      { key: "canEnterCustomPrice", labelAr: "إدخال سعر الرحلة", descAr: "إدخال السعر المقترح عند إنشاء رحلة جديدة" },
      { key: "canEditPrice", labelAr: "تعديل سعر رحلة قائمة", descAr: "تعديل السعر مع تسجيل السعر السابق والجديد والمبرر", sensitive: true },
      { key: "canRequestPriceApproval", labelAr: "طلب اعتماد سعر", descAr: "إرسال طلب موافقة على السعر لمدير العمليات عند عدم وجود تعرفة" },
      { key: "canApprovePrice", labelAr: "اعتماد السعر أو رفضه", descAr: "مخصص لمدير العمليات؛ يُمنع المندوب منعاً باتاً من اعتماد سعره بنفسه", adminOnly: true, sensitive: true },
      { key: "canManageTariffs", labelAr: "إدارة التعرفة العامة", descAr: "إنشاء وتعديل التعرفة المرجعية لكافة المناطق (مخصصة للإدارة)", adminOnly: true, sensitive: true },
    ],
  },
  {
    id: "governance",
    titleAr: "٥. التقارير والتدقيق والمستندات والتصدير",
    titleEn: "Governance & Audit",
    descAr: "التقارير والملاحظات والمستندات وحظر التصدير الافتراضي",
    permissions: [
      { key: "canViewReports", labelAr: "عرض التقارير التشغيلية", descAr: "استعراض تقارير ومؤشرات أداء منطقة الممثل" },
      { key: "canViewTripHistory", labelAr: "سجل التدقيق وتاريخ الرحلات", descAr: "الاطلاع على السجل التاريخي الكامل لرحلات المنطقة" },
      { key: "canAddNotes", labelAr: "إضافة ملاحظات تشغيلية", descAr: "تدوين ملاحظات ميدانية على الرحلة دون تعديل السجلات التاريخية" },
      { key: "canUploadDocuments", labelAr: "رفع المستندات والإيصالات", descAr: "إرفاق بوالص الشحن وصور التسليم والمستندات التشغيلية" },
      { key: "canExportData", labelAr: "تصدير السجلات والبيانات", descAr: "تصدير البيانات إلى ملفات خارجية (ممنوع للمندوبين افتراضيًا)", sensitive: true },
    ],
  },
];

export const DEFAULT_LEAST_PRIVILEGE_PERMISSIONS: RepresentativePermissions = {
  canViewTrips: true,
  canCreateTrips: true,
  canEditTrips: true,
  canAssignTrips: false,
  canTransitionTrips: true,
  canTrackTrips: true,
  canCancelTrips: false,
  canReopenTrips: false,
  canReassignTrips: false,
  canDeleteTrips: false,

  canViewCustomers: true,
  canCreateCustomers: true,
  canEditCustomers: true,
  canDeleteCustomers: false,

  canViewDrivers: true,
  canCreateDrivers: true,
  canEditDrivers: false,
  canToggleDriverStatus: false,
  canViewVehicles: true,
  canManageVehicles: false,

  canViewTariffs: true,
  canEnterCustomPrice: true,
  canEditPrice: false,
  canRequestPriceApproval: true,
  canApprovePrice: false,
  canManageTariffs: false,

  canViewReports: false,
  canViewTripHistory: true,
  canAddNotes: true,
  canUploadDocuments: true,
  canExportData: false,
};

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

  // Password visibility
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Create Form State
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("+9665");
  const [formPassword, setFormPassword] = useState("Ejaz@2026Rep");
  const [formRegion, setFormRegion] = useState("المنطقة الوسطى");
  const [formPermissions, setFormPermissions] = useState<RepresentativePermissions>({ ...DEFAULT_LEAST_PRIVILEGE_PERMISSIONS });

  // Status reason
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

  // Regional trip & rep counts for interactive cards
  const regionalStats = useMemo(() => {
    const stats: Record<string, { repsCount: number; activeTrips: number; totalTrips: number; pendingPrices: number }> = {};
    for (const reg of SAUDI_REGIONS) {
      const regReps = representatives.filter((r) => r.region === reg);
      const totalTrips = regReps.reduce((acc, r) => acc + (r.metrics?.totalTrips || 0), 0);
      const activeTrips = regReps.reduce((acc, r) => acc + (r.metrics?.activeTrips || 0), 0);
      const pendingPrices = regReps.reduce((acc, r) => acc + (r.metrics?.pendingPriceTrips || 0), 0);
      stats[reg] = {
        repsCount: regReps.length,
        activeTrips,
        totalTrips,
        pendingPrices,
      };
    }
    return stats;
  }, [representatives]);

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
      toast(t("Representative Created", "تم إنشاء حساب الممثل وربطه بمنطقته وصلاحياته بنجاح"));
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
        reason: "تحديث الصلاحيات وبيانات الممثل من قبل مدير العمليات",
      });
      toast(t("Representative Updated", "تم حفظ وتحديث صلاحيات وبيانات الممثل بنجاح"));
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
          ? t("Representative Activated", "تم تفعيل حساب الممثل بنجاح")
          : t("Representative Deactivated", "تم تعطيل حساب الممثل فوراً وحظر وصوله للنظام مع حفظ كافة سجلاته")
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

  const openCreateModalForRegion = (regionName?: string) => {
    const targetReg = regionName && regionName !== "ALL" ? regionName : "المنطقة الوسطى";
    setFormFullName("");
    setFormEmail("");
    setFormPhone("+9665");
    setFormPassword("Ejaz@2026Rep");
    setFormRegion(targetReg);
    setFormPermissions({ ...DEFAULT_LEAST_PRIVILEGE_PERMISSIONS });
    setShowCreateModal(true);
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
      {/* Header Banner */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-control bg-brand/15 text-brand border border-brand/30 shadow-sm shadow-brand/10">
              <IconProfile size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-section-title font-extrabold text-text-primary">
                  {t("Regional Representatives Management", "ممثلو المناطق — منظومة إيجاز الميدانية")}
                </h1>
                <span className="rounded-chip border border-brand/30 bg-brand/10 px-2 py-0.5 text-micro font-bold text-brand">
                  ٥ مناطق معتمدة
                </span>
              </div>
              <p className="text-label text-text-muted mt-0.5">
                {t(
                  "Operational management of regional representatives across the 5 Saudi regions",
                  "إشراف مدير العمليات على حسابات الممثلين وتعيين مناطقهم وتحديد صلاحياتهم الدقيقة ومتابعة تشغيلهم"
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => openCreateModalForRegion(selectedRegion)}
          className="btn-primary flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-label font-bold shadow-md shadow-brand/20 active:scale-95"
        >
          <IconPlus size={16} />
          <span>{t("Add Representative", "إضافة ممثّل منطقة جديد")}</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Total Reps", "إجمالي الممثلين")}</div>
          <div className="mt-1 text-metric font-extrabold text-text-primary">{kpis.total}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("5 Independent Regions", "موزعون على ٥ مناطق مستقلة")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Active Reps", "الحسابات النشطة")}</div>
          <div className="mt-1 text-metric font-extrabold text-status-active">{kpis.active}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Operational now", "حسابات مفعلة تشغيلياً")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Regional Trips", "رحلات المناطق")}</div>
          <div className="mt-1 text-metric font-extrabold text-sky-400">{kpis.totalTrips}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Within regional bounds", "ضمن النطاق الميداني")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Active Trips", "رحلات جارية")}</div>
          <div className="mt-1 text-metric font-extrabold text-warning">{kpis.activeTrips}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("In transit & loading", "على المسار الميداني")}</div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-micro font-bold uppercase text-text-muted">{t("Price Approvals", "اعتمادات الأسعار")}</div>
          <div className="mt-1 text-metric font-extrabold text-brand">{kpis.pendingPrice}</div>
          <div className="mt-0.5 text-micro text-text-muted">{t("Awaiting Ops Manager", "بانتظار موافقة المدير")}</div>
        </div>
      </div>

      {/* ── FIVE CLICKABLE REGION CARDS ────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-card-title font-extrabold text-text-primary">
              {t("The Five Saudi Regions", "المناطق الجغرافية الخمس المعتمدة (اضغط لاختيار المنطقة وعرض مندوبيها)")}
            </h2>
            <p className="text-label text-text-muted">
              {t("Select any region to focus on its representatives, trips, and operational permissions", "اضغط على أي منطقة لعرض قائمتها ومندوبيها وصلاحياتهم مع إمكانية إضافة وإدارة المندوبين")}
            </p>
          </div>
          <button
            onClick={() => setSelectedRegion("ALL")}
            className={cn(
              "rounded-control border px-3 py-1.5 text-label font-bold transition-all shadow-sm",
              selectedRegion === "ALL"
                ? "bg-brand text-on-brand border-brand shadow-brand/20"
                : "border-border-subtle bg-surface-1 text-text-secondary hover:text-text-primary hover:bg-surface-2"
            )}
          >
            {t("View All Regions", "كافة المناطق (عرض شامل)")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SAUDI_REGIONAL_PROFILES.map((reg) => {
            const isSelected = selectedRegion === reg.id;
            const stat = regionalStats[reg.id] || { repsCount: 0, activeTrips: 0, totalTrips: 0, pendingPrices: 0 };
            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => setSelectedRegion(reg.id)}
                className={cn(
                  "relative flex flex-col justify-between rounded-card border p-3.5 text-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand/50",
                  isSelected
                    ? "bg-gradient-to-b from-surface-2 to-surface-1 border-brand ring-2 ring-brand/40 shadow-md shadow-brand/15"
                    : "bg-surface-1 border-border-subtle hover:border-border hover:bg-surface-2/70"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={cn("grid h-8 w-8 place-items-center rounded-inner border bg-gradient-to-br text-label font-black", reg.iconColor)}>
                      <IconTruck size={16} />
                    </span>
                    <span className={cn("rounded-chip border px-2 py-0.5 text-micro font-bold", reg.badge)}>
                      {stat.repsCount} {t("Reps", "مندوب")}
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-card-title font-extrabold text-text-primary">
                    {reg.nameAr}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-micro leading-snug text-text-muted">
                    {reg.subAr}
                  </p>
                </div>

                <div className="mt-3.5 border-t border-border-subtle/60 pt-2.5 flex items-center justify-between text-micro font-bold">
                  <span className="text-text-muted">{t("Active Trips:", "رحلات جارية:")}</span>
                  <span className={cn(stat.activeTrips > 0 ? "text-warning" : "text-text-secondary")}>
                    {stat.activeTrips} رحلة
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm">
                    <IconCheck size={12} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Region Action Bar & Filter */}
      <div className="mb-4 flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-1 p-3 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-label font-bold text-text-muted">
            {t("Current View:", "العرض الحالي:")}
          </span>
          <span className="rounded-control bg-surface-2 px-3 py-1 text-label font-extrabold text-brand border border-brand/30">
            {selectedRegion === "ALL" ? t("All 5 Regions", "كافة المناطق الخمس") : selectedRegion}
          </span>
          <span className="text-label text-text-muted">
            ({filteredRepresentatives.length} {t("representatives listed", "ممثّل مسجل")})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search by name, phone, email…", "بحث باسم المندوب، الجوال، البريد…")}
              className="w-full rounded-control border border-border-subtle bg-surface-2 px-3 py-1.5 text-body text-text-primary placeholder:text-text-muted/60 focus:border-brand focus:outline-none"
            />
          </div>

          <button
            onClick={() => openCreateModalForRegion(selectedRegion)}
            className="shrink-0 flex items-center gap-1.5 rounded-control border border-brand/40 bg-brand/10 hover:bg-brand/20 px-3 py-1.5 text-label font-bold text-brand transition-colors"
          >
            <IconPlus size={14} />
            <span>{selectedRegion === "ALL" ? t("Add Rep", "إضافة ممثّل") : `إضافة ممثل في ${selectedRegion}`}</span>
          </button>
        </div>
      </div>

      {/* Representatives Cards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-body text-text-muted animate-pulse">{t("Loading representatives…", "جارٍ تحميل بيانات الممثلين والصلاحيات…")}</div>
        </div>
      ) : filteredRepresentatives.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-subtle bg-surface-1/40 p-12 text-center">
          <div className="text-page-title font-bold text-text-primary">{t("No representatives found", "لم يتم العثور على ممثلين في هذه المنطقة")}</div>
          <p className="mt-1 text-label text-text-muted">
            {t("Click the button below to add an operational representative", "اضغط على الزر أدناه لإضافة ممثل ميداني وتعيين صلاحياته التشغيلية")}
          </p>
          <button
            onClick={() => openCreateModalForRegion(selectedRegion)}
            className="mt-4 btn-primary inline-flex items-center gap-2 rounded-control px-4 py-2 text-label font-bold"
          >
            <IconPlus size={16} />
            <span>{t("Add Representative", "إضافة ممثل منطقة الآن")}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRepresentatives.map((rep) => {
            const profile = SAUDI_REGIONAL_PROFILES.find((p) => p.id === rep.region);
            const badgeClass = profile?.badge || "bg-surface-3 text-text-secondary border-border-subtle";
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate text-card-title font-extrabold text-text-primary">{rep.fullName}</h3>
                        <span
                          className={cn(
                            "rounded-chip border px-2 py-0.5 text-micro font-extrabold uppercase",
                            badgeClass
                          )}
                        >
                          {rep.region}
                        </span>
                      </div>
                      <div className="mt-1 text-label text-text-muted truncate font-mono text-label-lg leading-4">{rep.email}</div>
                      <div className="text-label text-text-muted font-mono text-label-lg leading-4 mt-0.5" dir="ltr">{rep.phone}</div>
                    </div>

                    <button
                      onClick={() => openStatusModal(rep)}
                      title={rep.isActive ? "تعطيل الحساب وحظر الدخول فوراً" : "تفعيل الحساب والسماح بالدخول"}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-micro font-bold border transition-colors shrink-0",
                        rep.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                      )}
                    >
                      {rep.isActive ? t("Active", "نشط ومفعل") : t("Disabled", "معطّل")}
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
                      <div className="text-body font-extrabold text-warning">{rep.metrics?.activeTrips || 0}</div>
                    </div>
                    <div>
                      <div className="text-micro text-text-muted">{t("Pending Price", "سعر معلق")}</div>
                      <div className="text-body font-extrabold text-brand">{rep.metrics?.pendingPriceTrips || 0}</div>
                    </div>
                  </div>

                  {/* Granular Permissions Tags */}
                  <div className="mt-3 space-y-1.5">
                    <div className="text-micro font-bold uppercase text-text-muted flex items-center justify-between">
                      <span>{t("Operational Capabilities:", "الصلاحيات التشغيلية الممنوحة:")}</span>
                      <span className="text-micro font-semibold text-brand">
                        {Object.values(rep.permissions || {}).filter(Boolean).length} مفعلة
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                      {rep.permissions.canCreateTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-primary border border-border-subtle">
                          إنشاء الرحلات
                        </span>
                      )}
                      {rep.permissions.canEditTrips && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          تعديل الرحلات
                        </span>
                      )}
                      {rep.permissions.canAssignTrips && (
                        <span className="rounded-chip bg-sky-500/10 px-2 py-0.5 text-micro text-sky-400 border border-sky-500/30">
                          تعيين سائق وشاحنة
                        </span>
                      )}
                      {rep.permissions.canReassignTrips && (
                        <span className="rounded-chip bg-sky-500/10 px-2 py-0.5 text-micro text-sky-400 border border-sky-500/30">
                          إعادة التعيين
                        </span>
                      )}
                      {rep.permissions.canCancelTrips && (
                        <span className="rounded-chip bg-rose-500/10 px-2 py-0.5 text-micro text-rose-400 border border-rose-500/30">
                          إلغاء الرحلات
                        </span>
                      )}
                      {rep.permissions.canReopenTrips && (
                        <span className="rounded-chip bg-purple-500/10 px-2 py-0.5 text-micro text-purple-400 border border-purple-500/30">
                          إعادة فتح رحلة
                        </span>
                      )}
                      {rep.permissions.canCreateCustomers && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          إضافة عملاء
                        </span>
                      )}
                      {rep.permissions.canCreateDrivers && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-secondary border border-border-subtle">
                          إضافة سائقين
                        </span>
                      )}
                      {rep.permissions.canEnterCustomPrice && (
                        <span className="rounded-chip bg-amber-500/10 px-2 py-0.5 text-micro text-amber-400 border border-amber-500/30">
                          إدخال أسعار
                        </span>
                      )}
                      {rep.permissions.canEditPrice && (
                        <span className="rounded-chip bg-amber-500/10 px-2 py-0.5 text-micro text-amber-400 border border-amber-500/30">
                          تعديل السعر
                        </span>
                      )}
                      {rep.permissions.canRequestPriceApproval && (
                        <span className="rounded-chip bg-amber-500/10 px-2 py-0.5 text-micro text-amber-400 border border-amber-500/30">
                          طلب اعتماد سعر
                        </span>
                      )}
                      {rep.permissions.canViewReports && (
                        <span className="rounded-chip bg-brand/10 px-2 py-0.5 text-micro text-brand border border-brand/30">
                          تقارير المنطقة
                        </span>
                      )}
                      {rep.permissions.canAddNotes && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-muted border border-border-subtle">
                          إضافة ملاحظات
                        </span>
                      )}
                      {rep.permissions.canUploadDocuments && (
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro text-text-muted border border-border-subtle">
                          رفع مستندات
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
                      {t("Audit Log", "سجل التدقيق")}
                    </button>
                  </div>

                  <button
                    onClick={() => openEditModal(rep)}
                    className="rounded-control bg-brand/10 border border-brand/20 px-3 py-1 text-label font-bold text-brand hover:bg-brand/20 transition-colors"
                  >
                    {t("Edit & Perms", "تعديل الصلاحيات")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE REPRESENTATIVE MODAL ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-extrabold text-text-primary">
                  {t("Add Regional Representative", "إضافة ممثّل منطقة جديد")}
                </h3>
                <p className="text-micro text-text-muted">
                  {t("Create representative account and configure operational RBAC permissions", "إنشاء حساب موثق وتعيين منطقته وتحديد صلاحياته التشغيلية بدقة")}
                </p>
              </div>
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
                  <label className="text-label font-bold text-text-secondary">{t("Email", "البريد الإلكتروني الرسمي")}</label>
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
                  <label className="text-label font-bold text-text-secondary">{t("Assigned Region", "المنطقة المعتمدة")}</label>
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
                  <div className="relative mt-1">
                    <input
                      type={showFormPassword ? "text" : "password"}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-body text-text-primary focus:border-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((v) => !v)}
                      className="absolute end-2 top-2.5 text-text-muted hover:text-text-primary"
                    >
                      {showFormPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Granular Permissions Section Header & Quick Toggles */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-label-lg font-extrabold text-text-primary">
                    {t("Operational Permissions Matrix", "مصفوفة الصلاحيات التشغيلية الدقيقة (٢٦ صلاحية)")}
                  </div>
                  <div className="text-micro text-text-muted">
                    {t("Governed by Operations Manager — Least privilege by default", "محددة وفق مبدأ الحد الأدنى من الصلاحيات؛ يمكن تعديلها وتخصيصها")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPermissions({ ...DEFAULT_LEAST_PRIVILEGE_PERMISSIONS })}
                    className="text-micro font-bold text-brand hover:underline"
                  >
                    {t("Reset to Defaults", "استعادة الافتراضي")}
                  </button>
                </div>
              </div>

              {/* Granular Permissions Categories */}
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.id} className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
                    <div className="mb-2.5 border-b border-border-subtle/60 pb-1.5 flex items-center justify-between">
                      <h4 className="text-label-lg font-extrabold text-text-primary">{group.titleAr}</h4>
                      <span className="text-micro text-text-muted">{group.descAr}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.permissions.map((p) => {
                        const isChecked = !!formPermissions[p.key];
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex items-start gap-2.5 rounded-control p-2 border transition-colors cursor-pointer select-none",
                              isChecked
                                ? "bg-surface-2 border-brand/40 shadow-xs"
                                : "bg-surface-1 border-border-subtle/60 hover:bg-surface-2/60"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setFormPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                              }
                              className="mt-1 h-4 w-4 rounded accent-brand"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-label font-bold text-text-primary">{p.labelAr}</span>
                                {p.sensitive && (
                                  <span className="rounded-chip bg-rose-500/10 px-1.5 py-0.2 text-micro text-rose-400 border border-rose-500/30">
                                    حساسة
                                  </span>
                                )}
                                {p.adminOnly && (
                                  <span className="rounded-chip bg-surface-3 px-1.5 py-0.2 text-micro text-text-muted border border-border-subtle">
                                    للإدارة
                                  </span>
                                )}
                              </div>
                              <div className="text-micro text-text-muted leading-tight mt-0.5">{p.descAr}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
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

      {/* ── EDIT REPRESENTATIVE & PERMISSIONS MODAL ────────────────────────── */}
      {showEditModal && activeRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-page-title font-extrabold text-text-primary">
                  {t("Edit Representative & Operational Permissions", "تعديل بيانات وصلاحيات الممثل التشغيلية")}
                </h3>
                <div className="text-micro text-text-muted">{activeRep.fullName} · {activeRep.email} ({activeRep.region})</div>
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
                  <label className="text-label font-bold text-text-secondary">{t("Assigned Region", "المنطقة المعتمدة")}</label>
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

              {/* Granular Permissions Section Header & Quick Toggles */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-label-lg font-extrabold text-text-primary">
                    {t("Operational Permissions Matrix", "التحكم بالصلاحيات التشغيلية (٢٦ صلاحية)")}
                  </div>
                  <div className="text-micro text-text-muted">
                    {t("All updates take effect immediately on next server request", "تُطبق التعديلات فوراً على جلسة المندوب وقاعدة البيانات")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPermissions({ ...DEFAULT_LEAST_PRIVILEGE_PERMISSIONS })}
                    className="text-micro font-bold text-brand hover:underline"
                  >
                    {t("Reset to Defaults", "استعادة الافتراضي")}
                  </button>
                </div>
              </div>

              {/* Granular Permissions Categories */}
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.id} className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-sm">
                    <div className="mb-2.5 border-b border-border-subtle/60 pb-1.5 flex items-center justify-between">
                      <h4 className="text-label-lg font-extrabold text-text-primary">{group.titleAr}</h4>
                      <span className="text-micro text-text-muted">{group.descAr}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.permissions.map((p) => {
                        const isChecked = !!formPermissions[p.key];
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex items-start gap-2.5 rounded-control p-2 border transition-colors cursor-pointer select-none",
                              isChecked
                                ? "bg-surface-2 border-brand/40 shadow-xs"
                                : "bg-surface-1 border-border-subtle/60 hover:bg-surface-2/60"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setFormPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                              }
                              className="mt-1 h-4 w-4 rounded accent-brand"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-label font-bold text-text-primary">{p.labelAr}</span>
                                {p.sensitive && (
                                  <span className="rounded-chip bg-rose-500/10 px-1.5 py-0.2 text-micro text-rose-400 border border-rose-500/30">
                                    حساسة
                                  </span>
                                )}
                                {p.adminOnly && (
                                  <span className="rounded-chip bg-surface-3 px-1.5 py-0.2 text-micro text-text-muted border border-border-subtle">
                                    للإدارة
                                  </span>
                                )}
                              </div>
                              <div className="text-micro text-text-muted leading-tight mt-0.5">{p.descAr}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
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

      {/* ── STATUS TOGGLE MODAL ────────────────────────────────────────────── */}
      {showStatusModal && activeRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-2 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-card-title font-bold text-text-primary">
                {activeRep.isActive ? t("Deactivate Account", "تعطيل حساب الممثل") : t("Activate Account", "تفعيل حساب الممثل")}
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-text-muted hover:text-text-primary">
                <IconClose size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-card bg-surface-1 p-3 border border-border-subtle">
                <div className="text-body font-bold text-text-primary">{activeRep.fullName}</div>
                <div className="text-label text-text-muted">{activeRep.email} · {activeRep.region}</div>
              </div>

              <p className="text-label text-text-secondary leading-relaxed">
                {activeRep.isActive
                  ? t(
                      "Deactivating this representative will immediately block login and prevent any operational action. Historical records and trips will be preserved.",
                      "تعطيل حساب الممثل يؤدي إلى حظره فوراً ومنعه من تسجيل الدخول أو تنفيذ أي عمليات برمجية، مع الحفاظ الكامل على كافة رحلاته وسجلاته التاريخية."
                    )
                  : t(
                      "Activating will restore operational access according to granted permissions.",
                      "تفعيل الحساب سيمكن الممثل من تسجيل الدخول فوراً واستخدام الوظائف المصرح بها حسب صلاحياته المعتمدة."
                    )}
              </p>

              <div>
                <label className="text-label font-bold text-text-secondary">{t("Operational Reason", "سبب الإجراء التشغيلي")}</label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={activeRep.isActive ? "اكتب سبب التعطيل المؤقت أو إنهاء التكليف…" : "اكتب سبب إعادة التفعيل…"}
                  className="mt-1 w-full rounded-control border border-border-subtle bg-surface-1 p-2 text-body text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="rounded-control border border-border-subtle px-4 py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleToggleStatus}
                  className={cn(
                    "rounded-control px-4 py-2 text-label font-bold transition-colors disabled:opacity-50",
                    activeRep.isActive
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "btn-primary text-on-brand"
                  )}
                >
                  {actionBusy
                    ? t("Processing…", "جارٍ التنفيذ…")
                    : activeRep.isActive
                      ? t("Confirm Deactivation", "تأكيد تعطيل الحساب فوراً")
                      : t("Confirm Activation", "تأكيد تفعيل الحساب")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REGIONAL TRIPS DRAWER ────────────────────────────────────────── */}
      {showTripsDrawer && activeRep && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-surface-2 border-s border-border-subtle p-5 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-card-title font-extrabold text-text-primary">
                    {t("Regional Trips", "رحلات الممثل الميدانية")}
                  </h3>
                  <div className="text-micro text-text-muted">{activeRep.fullName} · {activeRep.region}</div>
                </div>
                <button onClick={() => setShowTripsDrawer(false)} className="text-text-muted hover:text-text-primary">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {repTrips.length === 0 ? (
                  <div className="rounded-card border border-dashed border-border-subtle bg-surface-1/50 p-8 text-center text-label text-text-muted">
                    {t("No trips associated with this representative yet", "لا توجد رحلات مسجلة لهذا الممثل حتى الآن")}
                  </div>
                ) : (
                  repTrips.map((tr) => (
                    <div key={tr.id} className="rounded-card border border-border-subtle bg-surface-1 p-3.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-label-lg leading-4 font-bold text-brand">{tr.tripNumber}</span>
                        <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-micro font-bold text-text-secondary border border-border-subtle">
                          {tr.status}
                        </span>
                      </div>
                      <div className="mt-2 text-body font-bold text-text-primary">
                        {tr.originCity} ← {tr.destinationCity}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-micro text-text-muted">
                        <span>{tr.cargoType} · {tr.cargoWeightTons} طن</span>
                        <span className="font-bold text-text-primary">{tr.tripPrice} {tr.currency || "SAR"}</span>
                      </div>
                      <div className="mt-1 text-micro text-text-muted/70">
                        {new Date(tr.createdAt).toLocaleDateString("ar-SA")} · العميل: {tr.customerName}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-border-subtle pt-3 mt-4">
              <button
                type="button"
                onClick={() => setShowTripsDrawer(false)}
                className="w-full rounded-control border border-border-subtle py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
              >
                {t("Close", "إغلاق")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG DRAWER ──────────────────────────────────────────────── */}
      {showAuditDrawer && activeRep && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-surface-2 border-s border-border-subtle p-5 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-card-title font-extrabold text-text-primary">
                    {t("Audit Trail", "سجل تدقيق عمليات الممثل")}
                  </h3>
                  <div className="text-micro text-text-muted">{activeRep.fullName} ({activeRep.email})</div>
                </div>
                <button onClick={() => setShowAuditDrawer(false)} className="text-text-muted hover:text-text-primary">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {repAudit.length === 0 ? (
                  <div className="rounded-card border border-dashed border-border-subtle bg-surface-1/50 p-8 text-center text-label text-text-muted">
                    {t("No audit events recorded for this representative", "لا توجد سجلات تدقيق مسجلة حتى الآن")}
                  </div>
                ) : (
                  repAudit.map((log: any) => (
                    <div key={log.id} className="rounded-card border border-border-subtle bg-surface-1 p-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-micro font-mono font-bold text-brand">{log.action}</span>
                        <span className="text-micro text-text-muted">{new Date(log.timestamp).toLocaleTimeString("ar-SA")}</span>
                      </div>
                      <div className="mt-1 text-label text-text-secondary">
                        بواسطة: {log.actorName || log.actorRole}
                      </div>
                      {log.reason && (
                        <div className="mt-1 rounded bg-surface-2 p-1.5 text-micro text-text-muted">
                          المبرر: {log.reason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-border-subtle pt-3 mt-4">
              <button
                type="button"
                onClick={() => setShowAuditDrawer(false)}
                className="w-full rounded-control border border-border-subtle py-2 text-label font-bold text-text-secondary hover:bg-surface-3"
              >
                {t("Close", "إغلاق")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
