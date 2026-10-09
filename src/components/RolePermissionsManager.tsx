/**
 * EJAZ Transport — Central Dynamic Permission & Role Administration
 * ─────────────────────────────────────────────────────────────────────────
 * Full-featured RBAC + User Override + Data Scope + Temporary Grant + Audit
 * control center for SUPER_ADMIN:
 *   1. Roles & Multi-Level Permission Matrix (Module → Page → Action → Scope)
 *   2. Individual User Permissions (Inherited / +Allow / -Deny + Data Scope)
 *   3. Temporary Time-Bound Permissions & Global Permission Enable/Disable
 *   4. Immutable Permission Audit Log (Before / After / Actor / Reason)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/apiClient";
import { useSettings } from "../settings";
import { usePermissions } from "../state/permissionStore";
import { useToast } from "./Toast";
import { cn } from "../utils/cn";
import {
  IconCheck,
  IconClose,
  IconHistory,
  IconLock,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconSparkles,
  IconUsers,
} from "./Icons";

interface CatalogFunction {
  key: string;
  action: string;
  labelAr: string;
  labelEn: string;
  code?: string;
  sensitive?: boolean;
}

interface CatalogPage {
  id: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
  viewKey?: string;
  functions: CatalogFunction[];
}

interface CatalogSection {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}

interface DataScopeMeta {
  id: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}

interface AccessLevelMeta {
  id: string;
  ar: string;
  en: string;
}

interface RoleRow {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  core: boolean;
  locked: boolean;
  custom?: boolean;
  enabled: boolean;
  dataScope: string;
  customized: boolean;
  permissions: string[];
  defaultPermissions: string[];
  userCount: number;
  users?: Array<{ id: string; fullName: string; email: string; isActive: boolean }>;
  pageIds: string[];
}

interface UserPermRow {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  override: {
    userId: string;
    allow: string[];
    deny: string[];
    dataScope?: string;
    allowedBranches?: string[];
    allowedRegions?: string[];
  };
  effectivePermissions: string[];
  effectivePages: string[];
  dataScope: string;
  temporaryPermissions: string[];
}

interface TempGrantRow {
  id: string;
  targetType: "USER" | "ROLE";
  targetId: string;
  permission: string;
  validFrom: string;
  validTo: string;
  reason?: string;
  createdByName?: string;
  createdAt: string;
  revokedAt?: string;
}

interface AuditEntry {
  id: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityId?: string;
  oldValues?: { permissions?: string[]; dataScope?: string; allow?: string[]; deny?: string[] };
  newValues?: {
    permissions?: string[];
    added?: string[];
    removed?: string[];
    dataScope?: string;
    allow?: string[];
    deny?: string[];
    permission?: string;
    enabled?: boolean;
  };
  reason?: string;
  timestamp: string;
}

type AdminSubTab = "matrix" | "users" | "temporary" | "audit";

export function RolePermissionsManager() {
  const { lang, t } = useSettings();
  const { can, refresh: refreshLivePermissions } = usePermissions();
  const toast = useToast();
  const push = useCallback(
    (msg: { kind?: string; title: string; desc?: string }) => {
      toast(msg.title, msg.desc);
    },
    [toast]
  );
  const isAr = lang !== "en";

  const [subTab, setSubTab] = useState<AdminSubTab>("matrix");
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [pages, setPages] = useState<CatalogPage[]>([]);
  const [dataScopes, setDataScopes] = useState<DataScopeMeta[]>([]);
  const [accessLevels, setAccessLevels] = useState<AccessLevelMeta[]>([]);
  const [disabledPermissions, setDisabledPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [usersList, setUsersList] = useState<UserPermRow[]>([]);
  const [tempGrants, setTempGrants] = useState<TempGrantRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("OPERATIONS_MANAGER");
  const [selectedUserId, setSelectedUserId] = useState<string>("u-ops");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [draftScope, setDraftScope] = useState<string>("ALL");
  const [reason, setReason] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "granted" | "sensitive">("all");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showRoleUsersModal, setShowRoleUsersModal] = useState<boolean>(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState<boolean>(false);
  const [showCloneRoleModal, setShowCloneRoleModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // New / Clone Role state
  const [newRoleForm, setNewRoleForm] = useState({
    id: "",
    labelAr: "",
    labelEn: "",
    descriptionAr: "",
    descriptionEn: "",
    dataScope: "OWN",
  });

  // User override draft state
  const [userRoleDraft, setUserRoleDraft] = useState<string>("OPERATIONS_MANAGER");
  const [userScopeDraft, setUserScopeDraft] = useState<string>("");
  const [userAllowDraft, setUserAllowDraft] = useState<Set<string>>(new Set());
  const [userDenyDraft, setUserDenyDraft] = useState<Set<string>>(new Set());
  const [userReason, setUserReason] = useState<string>("");

  // Temporary grant form state
  const [tempForm, setTempForm] = useState({
    targetType: "USER" as "USER" | "ROLE",
    targetId: "u-ops",
    permission: "finance.view",
    validTo: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    reason: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, roleRes, auditRes, usersRes, tempRes] = await Promise.all([
        apiClient.permissions.catalog(),
        apiClient.permissions.roles(),
        apiClient.permissions.audit(80),
        apiClient.permissions.users().catch(() => ({ users: [] })),
        apiClient.permissions.temporary().catch(() => ({ grants: [] })),
      ]);
      setSections(cat?.sections || []);
      setPages(cat?.pages || []);
      setDataScopes(cat?.dataScopes || []);
      setAccessLevels(cat?.accessLevels || []);
      setDisabledPermissions(cat?.disabledPermissions || []);
      const list: RoleRow[] = roleRes?.roles || [];
      setRoles(list);
      setAudit(auditRes?.entries || []);
      setUsersList(usersRes?.users || []);
      setTempGrants(tempRes?.grants || []);

      const currentRole = list.find((r) => r.id === selectedRoleId) || list[0];
      if (currentRole) {
        setSelectedRoleId(currentRole.id);
        setDraft(new Set(currentRole.permissions.filter((p) => p !== "*")));
        setDraftScope(currentRole.dataScope || "OWN");
      }

      const uList: UserPermRow[] = usersRes?.users || [];
      const currentUser = uList.find((u) => u.id === selectedUserId) || uList.find((u) => u.id !== "u-admin") || uList[0];
      if (currentUser) {
        setSelectedUserId(currentUser.id);
        setUserRoleDraft(currentUser.role);
        setUserScopeDraft(currentUser.override?.dataScope || "");
        setUserAllowDraft(new Set(currentUser.override?.allow || []));
        setUserDenyDraft(new Set(currentUser.override?.deny || []));
      }
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Failed to load permissions", "تعذّر تحميل سجل الصلاحيات", "اجازتوں کا ریکارڈ لوڈ نہ ہو سکا"),
        desc: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }, [push, selectedRoleId, selectedUserId, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const selectedUser = useMemo(
    () => usersList.find((u) => u.id === selectedUserId) || null,
    [usersList, selectedUserId]
  );

  const selectRole = (role: RoleRow) => {
    setSelectedRoleId(role.id);
    setDraft(new Set(role.permissions.filter((p) => p !== "*")));
    setDraftScope(role.dataScope || "OWN");
    setReason("");
  };

  const selectUser = (u: UserPermRow) => {
    setSelectedUserId(u.id);
    setUserRoleDraft(u.role);
    setUserScopeDraft(u.override?.dataScope || "");
    setUserAllowDraft(new Set(u.override?.allow || []));
    setUserDenyDraft(new Set(u.override?.deny || []));
    setUserReason("");
  };

  const allCatalogFunctions = useMemo(
    () => pages.flatMap((p) => p.functions.map((f) => ({ ...f, pageLabelAr: p.labelAr, pageLabelEn: p.labelEn }))),
    [pages]
  );

  const allCatalogKeys = useMemo(
    () => Array.from(new Set(pages.flatMap((p) => p.functions.map((f) => f.key)))),
    [pages]
  );

  const isGranted = useCallback(
    (key: string) => {
      if (selectedRole?.locked) return true;
      return draft.has(key);
    },
    [draft, selectedRole]
  );

  const dirty = useMemo(() => {
    if (!selectedRole || selectedRole.locked) return false;
    const live = new Set(selectedRole.permissions.filter((p) => p !== "*"));
    if (draftScope !== (selectedRole.dataScope || "OWN")) return true;
    if (live.size !== draft.size) return true;
    for (const k of draft) if (!live.has(k)) return true;
    return false;
  }, [draft, draftScope, selectedRole]);

  const toggleFunction = (page: CatalogPage, fnKey: string) => {
    if (!selectedRole || selectedRole.locked) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(fnKey)) {
        next.delete(fnKey);
        if (page.viewKey === fnKey) {
          page.functions.forEach((f) => next.delete(f.key));
        }
      } else {
        next.add(fnKey);
        if (page.viewKey) next.add(page.viewKey);
      }
      return next;
    });
  };

  const togglePage = (page: CatalogPage, on: boolean) => {
    if (!selectedRole || selectedRole.locked) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) {
        if (page.viewKey) next.add(page.viewKey);
        page.functions.forEach((f) => next.add(f.key));
      } else {
        if (page.viewKey) next.delete(page.viewKey);
        page.functions.forEach((f) => next.delete(f.key));
      }
      return next;
    });
  };

  const togglePageViewOnly = (page: CatalogPage) => {
    if (!selectedRole || selectedRole.locked) return;
    setDraft((prev) => {
      const next = new Set(prev);
      page.functions.forEach((f) => next.delete(f.key));
      if (page.viewKey) next.add(page.viewKey);
      return next;
    });
  };

  const handleModuleLevelChange = async (sectionId: string, level: string) => {
    if (!selectedRole || selectedRole.locked) return;
    setSaving(true);
    try {
      await apiClient.permissions.setModuleAccessLevel(
        selectedRole.id,
        sectionId,
        level,
        t("Module access level change", "تغيير مستوى الوصول للوحدة", "ماڈیول رسائی کی سطح میں تبدیلی")
      );
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "success",
        title: t("Module access level updated", "تم تحديث مستوى وصول الوحدة", "ماڈیول رسائی کی سطح اپڈیٹ ہو گئی"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Could not update module level", "تعذّر تحديث مستوى الوحدة", "ماڈیول کی سطح اپڈیٹ نہ ہو سکی"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedRole || selectedRole.locked) return;
    setSaving(true);
    try {
      const list = Array.from(draft);
      const res = await apiClient.permissions.save(
        selectedRole.id,
        list,
        reason.trim() || undefined,
        draftScope
      );
      await loadAll();
      await refreshLivePermissions();
      const added = res?.added?.length || 0;
      const removed = res?.removed?.length || 0;
      push({
        kind: "success",
        title: t("Permissions saved", "تم حفظ الصلاحيات وتطبيقها فورًا", "اجازتیں محفوظ اور فوری لاگو ہو گئیں"),
        desc: isAr
          ? `${selectedRole.labelAr}: +${added} مضافة · −${removed} مسحوبة · النطاق: ${draftScope}`
          : `${selectedRole.labelEn}: +${added} granted · −${removed} revoked · Scope: ${draftScope}`,
      });
      setReason("");
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Could not save permissions", "تعذّر حفظ الصلاحيات", "اجازتیں محفوظ نہ ہو سکیں"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedRole || selectedRole.locked) return;
    setSaving(true);
    try {
      await apiClient.permissions.reset(
        selectedRole.id,
        reason.trim() || t("Reset to factory defaults", "إعادة الضبط إلى الإعدادات الافتراضية", "ڈیفالٹ ترتیبات پر بحالی")
      );
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "info",
        title: t("Role restored to default", "تمت استعادة الصلاحيات الافتراضية للدور", "کردار کی ڈیفالٹ اجازتیں بحال ہو گئیں"),
        desc: isAr ? selectedRole.labelAr : selectedRole.labelEn,
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Reset failed", "تعذّرت استعادة الافتراضي", "ڈیفالٹ بحال نہ ہو سکا"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRoleEnabled = async () => {
    if (!selectedRole || selectedRole.locked) return;
    setSaving(true);
    try {
      const nextEnabled = !selectedRole.enabled;
      await apiClient.permissions.setRoleStatus(
        selectedRole.id,
        nextEnabled,
        reason.trim() || (nextEnabled ? "Re-enable role" : "Disable role")
      );
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "success",
        title: nextEnabled
          ? t("Role enabled", "تم تفعيل الدور بنجاح", "کردار فعال کر دیا گیا")
          : t("Role disabled", "تم تعطيل الدور وإيقاف وصوله", "کردار غیر فعال کر دیا گیا"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Action failed", "تعذّر تغيير حالة الدور", "کردار کی حالت تبدیل نہ ہو سکی"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.locked || selectedRole.core) return;
    setSaving(true);
    try {
      await apiClient.permissions.deleteRole(selectedRole.id);
      setSelectedRoleId("OPERATIONS_MANAGER");
      await loadAll();
      push({
        kind: "success",
        title: t("Custom role deleted", "تم حذف الدور المخصص", "مخصوص کردار حذف کر دیا گیا"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Cannot delete role", "تعذّر حذف الدور", "کردار حذف نہ ہو سکا"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleForm.id.trim() || !newRoleForm.labelAr.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.permissions.createRole({
        id: newRoleForm.id,
        labelAr: newRoleForm.labelAr,
        labelEn: newRoleForm.labelEn || newRoleForm.labelAr,
        descriptionAr: newRoleForm.descriptionAr,
        descriptionEn: newRoleForm.descriptionEn,
        dataScope: newRoleForm.dataScope,
        permissions: ["trips.view", "notifications.view"],
      });
      setShowCreateRoleModal(false);
      setNewRoleForm({ id: "", labelAr: "", labelEn: "", descriptionAr: "", descriptionEn: "", dataScope: "OWN" });
      if (res?.role?.id) setSelectedRoleId(res.role.id);
      await loadAll();
      push({
        kind: "success",
        title: t("Role created", "تم إنشاء الدور الجديد بنجاح", "نیا کردار کامیابی سے بن گیا"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Could not create role", "تعذّر إنشاء الدور", "کردار نہ بن سکا"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloneRole = async () => {
    if (!selectedRole || !newRoleForm.id.trim() || !newRoleForm.labelAr.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.permissions.cloneRole(selectedRole.id, {
        id: newRoleForm.id,
        labelAr: newRoleForm.labelAr,
        labelEn: newRoleForm.labelEn || `${selectedRole.labelEn} (Copy)`,
        descriptionAr: newRoleForm.descriptionAr,
        descriptionEn: newRoleForm.descriptionEn,
      });
      setShowCloneRoleModal(false);
      setNewRoleForm({ id: "", labelAr: "", labelEn: "", descriptionAr: "", descriptionEn: "", dataScope: "OWN" });
      if (res?.role?.id) setSelectedRoleId(res.role.id);
      await loadAll();
      push({
        kind: "success",
        title: t("Role cloned", "تم نسخ الدور وصلاحياته بنجاح", "کردار اور اس کی اجازتیں کاپی ہو گئیں"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Could not clone role", "تعذّر نسخ الدور", "کردار کاپی نہ ہو سکا"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // User override handlers
  const handleSaveUserOverrides = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await apiClient.permissions.saveUser(selectedUser.id, {
        role: userRoleDraft,
        allow: Array.from(userAllowDraft),
        deny: Array.from(userDenyDraft),
        dataScope: userScopeDraft || undefined,
        reason: userReason.trim() || undefined,
      });
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "success",
        title: t("User permissions saved", "تم حفظ صلاحيات واستثناءات المستخدم", "صارف کی اجازتیں محفوظ ہو گئیں"),
        desc: selectedUser.fullName,
      });
      setUserReason("");
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Failed to save user overrides", "تعذّر حفظ صلاحيات المستخدم", "صارف کی اجازتیں محفوظ نہ ہو سکیں"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetUserOverrides = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await apiClient.permissions.resetUser(selectedUser.id, "Reset to role inheritance");
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "info",
        title: t("User reset to role defaults", "تمت إعادة المستخدم لوراثة صلاحيات الدور", "صارف کو کردار کی ڈیفالٹ اجازتوں پر بحال کر دیا گیا"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Reset failed", "تعذّرت إعادة الضبط", "ری سیٹ ناکام رہا"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const setUserPermState = (key: string, mode: "inherited" | "allow" | "deny") => {
    setUserAllowDraft((prev) => {
      const next = new Set(prev);
      if (mode === "allow") next.add(key);
      else next.delete(key);
      return next;
    });
    setUserDenyDraft((prev) => {
      const next = new Set(prev);
      if (mode === "deny") next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // Temporary permission & Global toggle handlers
  const handleGrantTemporary = async () => {
    if (!tempForm.targetId || !tempForm.permission || !tempForm.validTo) return;
    setSaving(true);
    try {
      await apiClient.permissions.grantTemporary({
        targetType: tempForm.targetType,
        targetId: tempForm.targetId,
        permission: tempForm.permission,
        validFrom: new Date().toISOString(),
        validTo: new Date(tempForm.validTo).toISOString(),
        reason: tempForm.reason.trim() || undefined,
      });
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "success",
        title: t("Temporary permission granted", "تم منح الصلاحية المؤقتة بنجاح", "عارضی اجازت کامیابی سے دے دی گئی"),
      });
      setTempForm((prev) => ({ ...prev, reason: "" }));
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Could not grant temporary permission", "تعذّر منح الصلاحية المؤقتة", "عارضی اجازت نہ دی جا سکی"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeTemporary = async (grantId: string) => {
    setSaving(true);
    try {
      await apiClient.permissions.revokeTemporary(grantId, "Manual revocation by Super Admin");
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "info",
        title: t("Temporary permission revoked", "تم إلغاء الصلاحية المؤقتة", "عارضی اجازت منسوخ کر دی گئی"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Revocation failed", "تعذّر الإلغاء", "منسوخی ناکام رہی"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGlobalPermission = async (permKey: string, currentlyDisabled: boolean) => {
    setSaving(true);
    try {
      await apiClient.permissions.togglePermission(
        permKey,
        currentlyDisabled,
        currentlyDisabled ? "Re-enabled globally" : "Disabled globally by Super Admin"
      );
      await loadAll();
      await refreshLivePermissions();
      push({
        kind: "info",
        title: currentlyDisabled
          ? t("Permission enabled globally", "تم تفعيل الصلاحية على مستوى النظام", "اجازت پورے نظام میں فعال کر دی گئی")
          : t("Permission disabled globally", "تم تعطيل الصلاحية على مستوى النظام", "اجازت پورے نظام میں غیر فعال کر دی گئی"),
      });
    } catch (err: any) {
      push({
        kind: "error",
        title: t("Toggle failed", "تعذّر تغيير حالة الصلاحية", "اجازت کی حالت تبدیل نہ ہو سکی"),
        desc: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  /* Never render the administration surface to a role that lacks permission. */
  if (!can("permissions.manage")) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (page: CatalogPage) => {
    if (!normalizedQuery) return true;
    const hay = [
      page.id,
      page.labelAr,
      page.labelEn,
      page.hintAr || "",
      page.hintEn || "",
      ...page.functions.flatMap((f) => [f.key, f.labelAr, f.labelEn, f.code || ""]),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(normalizedQuery);
  };

  const grantedCount = selectedRole?.locked
    ? allCatalogKeys.length
    : allCatalogKeys.filter((k) => draft.has(k)).length;

  const visiblePageCount = selectedRole?.locked
    ? pages.length
    : pages.filter((p) => !p.viewKey || draft.has(p.viewKey)).length;

  return (
    <div className="space-y-4" data-testid="role-permissions-manager">
      {/* ── Top Executive Banner & Sub-navigation ────────────────────────── */}
      <div className="rounded-panel border border-border-subtle bg-surface-2/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand/15 text-brand">
              <IconShield size={20} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-card-title leading-5 font-black text-text-primary">
                  {t(
                    "Central Dynamic Permission & Role System (EJAZ RBAC)",
                    "نظام الصلاحيات المركزي الديناميكي — إدارة الأدوار والمستخدمين",
                    "مرکزی متحرک اجازت اور کردار کا نظام"
                  )}
                </h3>
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-label font-bold text-brand">
                  {t("NO PERMISSION = NO VISIBILITY + NO API", "لا صلاحية = لا ظهور + لا وصول برمجي", "بلا اجازت = نہ ظہور + نہ رسائی")}
                </span>
              </div>
              <p className="mt-1 text-label-lg leading-relaxed text-text-secondary">
                {t(
                  "Control roles, multi-level permission matrix, data scope (OWN / ASSIGNED / BRANCH / REGION / ALL), individual user Allow/Deny overrides, temporary grants, and full audit logs.",
                  "تحكم مركزي فوري في الأدوار، مصفوفة الصلاحيات متعددة المستويات، نطاق البيانات (OWN / ASSIGNED / BRANCH / REGION / ALL)، استثناءات المستخدمين (سماح / منع)، الصلاحيات المؤقتة، وسجل التدقيق.",
                  "کرداروں، کثیر سطحی اجازتوں، ڈیٹا کے دائرہ کار، صارفین کی انفرادی اجازتوں اور آڈٹ لاگ پر مکمل کنٹرول۔"
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-inner border border-border-subtle bg-surface-1 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-secondary hover:border-brand/40 hover:text-text-primary"
          >
            <IconRefresh size={14} />
            {t("Refresh", "تحديث", "تازہ کریں")}
          </button>
        </div>

        {/* 4 Sub-tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
          {[
            {
              id: "matrix" as const,
              label: t("Roles & Permission Matrix", "إدارة الأدوار ومصفوفة الصلاحيات", "کردار اور اجازتوں کا جدول"),
              badge: roles.length,
            },
            {
              id: "users" as const,
              label: t("Individual User Overrides (Allow / Deny)", "صلاحيات المستخدمين الفردية (Allow / Deny)", "صارفین کی انفرادی اجازتیں"),
              badge: usersList.length,
            },
            {
              id: "temporary" as const,
              label: t("Temporary Grants & Global Switch", "الصلاحيات المؤقتة والتحكم العام", "عارضی اجازتیں اور عمومی کنٹرول"),
              badge: tempGrants.filter((g) => !g.revokedAt).length,
            },
            {
              id: "audit" as const,
              label: t("Permission Audit Log", "سجل تدقيق الصلاحيات", "اجازتوں کا آڈٹ لاگ"),
              badge: audit.length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-inner px-3.5 py-2 text-label-lg leading-4 font-bold transition-all",
                subTab === tab.id
                  ? "bg-brand text-on-brand shadow-sm"
                  : "border border-border-subtle bg-surface-1 text-text-secondary hover:text-text-primary"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-label font-bold",
                  subTab === tab.id ? "bg-white/20 text-on-brand" : "bg-surface-2 text-text-muted"
                )}
              >
                {tab.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: ROLES & MULTI-LEVEL PERMISSION MATRIX (§3, §4, §5, §8, §11, §14)
         ════════════════════════════════════════════════════════════════════ */}
      {subTab === "matrix" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Role selector column */}
          <div className="space-y-2 lg:col-span-4">
            <div className="flex items-center justify-between px-1">
              <div className="text-label font-bold uppercase tracking-wider text-text-muted">
                {t("System & Custom Roles", "الأدوار الأساسية والتشغيلية والمخصصة", "بنیادی اور مخصوص کردار")}
              </div>
              <button
                type="button"
                onClick={() => setShowCreateRoleModal(true)}
                className="inline-flex items-center gap-1 rounded-chip bg-brand/15 px-2.5 py-1 text-label font-bold text-brand hover:bg-brand/25"
              >
                <IconPlus size={12} />
                {t("New Role", "دور جديد", "نیا کردار")}
              </button>
            </div>

            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              const permCount = role.locked
                ? allCatalogKeys.length
                : role.permissions.filter((p) => p !== "*").length;
              return (
                <button
                  key={role.id}
                  type="button"
                  data-testid={`role-card-${role.id}`}
                  onClick={() => selectRole(role)}
                  className={cn(
                    "w-full rounded-panel border p-3.5 text-start transition-all",
                    active
                      ? "border-brand bg-brand/10 shadow-sm"
                      : "border-border-subtle bg-surface-1 hover:border-brand/40",
                    !role.enabled && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-label-lg leading-4 font-extrabold text-text-primary">
                          {isAr ? role.labelAr : role.labelEn}
                        </span>
                        {role.core && (
                          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-label font-bold text-brand">
                            {t("Core", "أساسي", "بنیادی")}
                          </span>
                        )}
                        {role.custom && (
                          <span className="rounded-full bg-info/15 px-2 py-0.5 text-label font-bold text-info">
                            {t("Custom", "مخصص", "مخصوص")}
                          </span>
                        )}
                        {!role.enabled && (
                          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-label font-bold text-danger">
                            {t("Disabled", "معطّل", "غیر فعال")}
                          </span>
                        )}
                        {role.customized && !role.locked && (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-label font-bold text-warning">
                            {t("Modified", "معدّل", "تبدیل شدہ")}
                          </span>
                        )}
                        {role.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-label font-bold text-emerald-500">
                            <IconLock size={10} />
                            {t("Full", "كامل", "مکمل")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 line-clamp-2 text-label text-text-muted">
                        {isAr ? role.descriptionAr : role.descriptionEn}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/70 pt-2 text-label text-text-secondary">
                    <span>
                      <strong className="font-extrabold text-text-primary">{permCount}</strong>{" "}
                      {t("permissions", "صلاحية", "اجازتیں")} ·{" "}
                      <strong className="font-extrabold text-text-primary">{role.pageIds.length}</strong>{" "}
                      {t("pages", "صفحة", "صفحات")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-label font-bold text-brand">
                        {role.dataScope || "OWN"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-text-muted">
                        <IconUsers size={12} />
                        {role.userCount}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Permission Matrix & Role Controls column */}
          <div className="space-y-4 lg:col-span-8">
            {selectedRole && (
              <>
                {/* Selected role header + Data Scope + Role lifecycle actions */}
                <div className="rounded-panel border border-border-subtle bg-surface-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-card-title leading-5 font-black text-text-primary">
                          {isAr ? selectedRole.labelAr : selectedRole.labelEn}
                        </h4>
                        <span className="rounded-chip bg-surface-2 px-2 py-0.5 font-mono text-label text-text-muted">
                          {selectedRole.id}
                        </span>
                        {!selectedRole.enabled && (
                          <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-label font-bold text-danger">
                            {t("Role Disabled", "هذا الدور معطّل حاليًا", "یہ کردار اس وقت غیر فعال ہے")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-label-lg leading-4 text-text-secondary">
                        {isAr ? selectedRole.descriptionAr : selectedRole.descriptionEn}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-label-lg leading-4">
                      <div className="rounded-inner border border-border-subtle bg-surface-2/60 px-3 py-1.5">
                        <span className="text-text-muted">{t("Visible pages:", "الصفحات الظاهرة:", "نظر آنے والے صفحات:")} </span>
                        <strong className="font-black text-text-primary">
                          {visiblePageCount} / {pages.length}
                        </strong>
                      </div>
                      <div className="rounded-inner border border-border-subtle bg-surface-2/60 px-3 py-1.5">
                        <span className="text-text-muted">{t("Granted actions:", "العمليات المسموحة:", "اجازت یافتہ افعال:")} </span>
                        <strong className="font-black text-brand">
                          {grantedCount} / {allCatalogKeys.length}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRoleUsersModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-inner border border-border-subtle bg-surface-2/60 px-3 py-1.5 font-bold text-text-primary hover:border-brand/40"
                      >
                        <IconUsers size={13} />
                        {t("Assigned Users", "المستخدمون المرتبطون", "منسلک صارفین")} ({selectedRole.userCount})
                      </button>
                    </div>
                  </div>

                  {/* Role lifecycle toolbar: Clone, Disable/Enable, Delete (custom), Data Scope */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-label font-bold text-text-secondary">
                        {t("Data Scope (§8):", "نطاق البيانات (Data Scope):", "ڈیٹا کا دائرہ کار:")}
                      </label>
                      <select
                        disabled={selectedRole.locked}
                        value={draftScope}
                        onChange={(e) => setDraftScope(e.target.value)}
                        className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary focus:border-brand focus:outline-none disabled:opacity-60"
                      >
                        {dataScopes.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {isAr ? sc.ar : sc.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNewRoleForm({
                            id: `${selectedRole.id}_COPY`,
                            labelAr: `${selectedRole.labelAr} (نسخة)`,
                            labelEn: `${selectedRole.labelEn} (Copy)`,
                            descriptionAr: selectedRole.descriptionAr,
                            descriptionEn: selectedRole.descriptionEn,
                            dataScope: selectedRole.dataScope || "OWN",
                          });
                          setShowCloneRoleModal(true);
                        }}
                        className="rounded-inner border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-label font-bold text-text-secondary hover:text-text-primary"
                      >
                        {t("Clone Role", "نسخ الدور", "کردار کاپی کریں")}
                      </button>

                      {!selectedRole.locked && (
                        <button
                          type="button"
                          onClick={handleToggleRoleEnabled}
                          disabled={saving}
                          className={cn(
                            "rounded-inner border px-2.5 py-1.5 text-label font-bold",
                            selectedRole.enabled
                              ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          )}
                        >
                          {selectedRole.enabled
                            ? t("Disable Role", "تعطيل الدور", "کردار غیر فعال کریں")
                            : t("Enable Role", "إعادة تفعيل الدور", "کردار فعال کریں")}
                        </button>
                      )}

                      {selectedRole.custom && !selectedRole.core && (
                        <button
                          type="button"
                          onClick={handleDeleteRole}
                          disabled={saving || selectedRole.userCount > 0}
                          title={
                            selectedRole.userCount > 0
                              ? t("Cannot delete role with assigned users", "لا يمكن حذف دور مرتبط بمستخدمين", "صارفین سے منسلک کردار حذف نہیں ہو سکتا")
                              : undefined
                          }
                          className="rounded-inner border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-label font-bold text-danger hover:bg-danger/20 disabled:opacity-40"
                        >
                          {t("Delete Role", "حذف الدور", "کردار حذف کریں")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Module-Level Quick Access Presets (§14: NONE / VIEW / OPERATE / MANAGE / ADMIN) */}
                  {!selectedRole.locked && (
                    <div className="mt-3 rounded-inner border border-border-subtle bg-surface-2/40 p-3">
                      <div className="mb-2 text-label font-bold text-text-secondary">
                        {t(
                          "Module Access Levels (NONE / VIEW / OPERATE / MANAGE / ADMIN):",
                          "مستوى الوصول السريع للوحدات (NONE / VIEW / OPERATE / MANAGE / ADMIN):",
                          "ماڈیول رسائی کی سطحیں:"
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="flex items-center justify-between gap-2 rounded-chip border border-border-subtle bg-surface-1 px-2.5 py-1.5"
                          >
                            <span className="truncate text-label font-bold text-text-primary">
                              {isAr ? sec.labelAr : sec.labelEn}
                            </span>
                            <select
                              aria-label={isAr ? sec.labelAr : sec.labelEn}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) void handleModuleLevelChange(sec.id, e.target.value);
                                e.target.value = "";
                              }}
                              className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-label font-bold text-text-secondary"
                            >
                              <option value="">{t("Set level…", "تحديد المستوى…", "سطح منتخب کریں…")}</option>
                              {accessLevels.map((lvl) => (
                                <option key={lvl.id} value={lvl.id}>
                                  {isAr ? lvl.ar : lvl.en}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRole.locked ? (
                    <div className="mt-3 flex items-center gap-2 rounded-inner border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-label-lg leading-4 text-emerald-500">
                      <IconLock size={14} />
                      <span>
                        {t(
                          "Super Admin holds full access permanently so the platform can never be locked out.",
                          "صلاحيات مدير النظام (Super Admin) كاملة ومقفلة لضمان عدم قفل النظام على الإدارة في أي حالة.",
                          "سپر ایڈمن کی اجازتیں مکمل اور محفوظ ہیں تاکہ نظام کبھی مقفل نہ ہو۔"
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t(
                          "Audit note (why this change was made)…",
                          "سبب التعديل (يُسجَّل في سجل تدقيق الصلاحيات)…",
                          "تبدیلی کی وجہ (آڈٹ لاگ کے لیے)…"
                        )}
                        className="min-w-[220px] flex-1 rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReset}
                          disabled={saving || !selectedRole.customized}
                          className="inline-flex items-center gap-1.5 rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-secondary hover:text-text-primary disabled:opacity-40"
                        >
                          <IconRefresh size={13} />
                          {t("Restore Default", "إعادة الضبط الافتراضي", "ڈیفالٹ بحال کریں")}
                        </button>
                        <button
                          type="button"
                          data-testid="save-role-permissions"
                          onClick={handleSave}
                          disabled={saving || !dirty}
                          className="inline-flex items-center gap-1.5 rounded-inner bg-brand px-4 py-1.5 text-label-lg leading-4 font-black text-on-brand shadow-sm transition hover:opacity-95 disabled:opacity-40"
                        >
                          <IconCheck size={14} />
                          {saving
                            ? t("Saving…", "جارٍ الحفظ…", "محفوظ ہو رہا ہے…")
                            : t("Save Changes", "حفظ وتطبيق الصلاحيات", "تبدیلیاں محفوظ کریں")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search & Matrix Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1">
                    <IconSearch
                      size={15}
                      className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t(
                        "Search pages or permissions (e.g. settlements, reopen, invoices, fleet)…",
                        "ابحث في الصفحات أو الصلاحيات (مثل: التسويات، الفواتير، إعادة فتح، الأسطول)…",
                        "صفحات یا اجازتوں میں تلاش کریں…"
                      )}
                      className="w-full rounded-inner border border-border-subtle bg-surface-1 py-2 ps-9 pe-3 text-label-lg leading-4 text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-inner border border-border-subtle bg-surface-1 p-1">
                    {[
                      { id: "all" as const, label: t("All", "الكل", "تمام") },
                      { id: "granted" as const, label: t("Granted", "الممنوحة", "عطا کردہ") },
                      { id: "sensitive" as const, label: t("Sensitive (§19)", "الحساسة (§19)", "حساس") },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterMode(f.id)}
                        className={cn(
                          "rounded-chip px-2.5 py-1 text-label font-bold transition",
                          filterMode === f.id ? "bg-brand text-on-brand" : "text-text-secondary hover:text-text-primary"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sections → Pages → Functions Matrix */}
                {sections.map((section) => {
                  const sectionPages = pages
                    .filter((p) => p.sectionId === section.id && matchesQuery(p))
                    .filter((p) => {
                      if (filterMode === "granted") {
                        return p.functions.some((f) => isGranted(f.key));
                      }
                      if (filterMode === "sensitive") {
                        return p.functions.some((f) => f.sensitive);
                      }
                      return true;
                    });
                  if (!sectionPages.length) return null;

                  return (
                    <div
                      key={section.id}
                      className="overflow-hidden rounded-panel border border-border-subtle bg-surface-1"
                    >
                      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-2/50 px-4 py-2.5">
                        <span className="text-label-lg leading-4 font-extrabold text-text-primary">
                          {isAr ? section.labelAr : section.labelEn}
                        </span>
                        <span className="text-label text-text-muted">
                          {sectionPages.length} {t("pages", "صفحات", "صفحات")}
                        </span>
                      </div>

                      <div className="divide-y divide-border-subtle">
                        {sectionPages.map((page) => {
                          const pageShown = page.viewKey ? isGranted(page.viewKey) : true;
                          const displayedFunctions = page.functions.filter((fn) => {
                            if (filterMode === "granted") return isGranted(fn.key);
                            if (filterMode === "sensitive") return !!fn.sensitive;
                            return true;
                          });
                          const allOn = page.functions.every((f) => isGranted(f.key));

                          return (
                            <div key={page.id} className="p-4" data-testid={`catalog-page-${page.id}`}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-label-lg leading-4 font-bold text-text-primary">
                                      {isAr ? page.labelAr : page.labelEn}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-label font-bold",
                                        pageShown
                                          ? "bg-emerald-500/15 text-emerald-500"
                                          : "bg-surface-2 text-text-muted"
                                      )}
                                    >
                                      {pageShown
                                        ? t("Visible in navigation", "تظهر في القوائم", "مینیو میں نظر آتا ہے")
                                        : t("Hidden from user", "مخفية بالكامل", "مکمل طور پر پوشیدہ")}
                                    </span>
                                  </div>
                                  {(page.hintAr || page.hintEn) && (
                                    <div className="mt-0.5 text-label text-text-muted">
                                      {isAr ? page.hintAr : page.hintEn}
                                    </div>
                                  )}
                                </div>

                                {!selectedRole.locked && (
                                  <div className="flex items-center gap-1.5 text-label">
                                    <button
                                      type="button"
                                      onClick={() => togglePageViewOnly(page)}
                                      className="rounded-chip border border-border-subtle bg-surface-2 px-2.5 py-1 font-bold text-text-secondary hover:text-text-primary"
                                    >
                                      {t("View only", "عرض فقط", "صرف دیکھیں")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => togglePage(page, !allOn)}
                                      className="rounded-chip border border-border-subtle bg-surface-2 px-2.5 py-1 font-bold text-text-secondary hover:text-text-primary"
                                    >
                                      {allOn
                                        ? t("Hide page", "إخفاء الصفحة", "صفحہ چھپائیں")
                                        : t("Grant all", "تفعيل الكل", "سب فعال کریں")}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {displayedFunctions.map((fn) => {
                                  const checked = isGranted(fn.key);
                                  const globallyDisabled = disabledPermissions.includes(fn.key);
                                  return (
                                    <label
                                      key={fn.key}
                                      data-testid={`perm-toggle-${fn.key}`}
                                      className={cn(
                                        "flex cursor-pointer items-center justify-between gap-2 rounded-inner border px-3 py-2 text-label-lg leading-4 transition",
                                        checked
                                          ? "border-brand/40 bg-brand/5 text-text-primary"
                                          : "border-border-subtle bg-surface-2/40 text-text-secondary",
                                        selectedRole.locked && "cursor-default",
                                        globallyDisabled && "opacity-50"
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="truncate font-bold">
                                            {isAr ? fn.labelAr : fn.labelEn}
                                          </span>
                                          {fn.sensitive && (
                                            <span className="rounded bg-danger/15 px-1.5 py-0.5 text-label font-bold text-danger">
                                              {t("Sensitive", "حساسة", "حساس")}
                                            </span>
                                          )}
                                          {globallyDisabled && (
                                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-label font-bold text-warning">
                                              {t("Disabled Globally", "معطلة عامًا", "عالمی سطح پر غیر فعال")}
                                            </span>
                                          )}
                                        </div>
                                        <div className="font-mono text-label text-text-muted">
                                          {fn.code ? `${fn.code} · ${fn.key}` : fn.key}
                                        </div>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={selectedRole.locked}
                                        onChange={() => toggleFunction(page, fn.key)}
                                        className="h-4 w-4 shrink-0 accent-brand"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: INDIVIDUAL USER OVERRIDES (§9, §10: Inherited / +Allow / -Deny)
         ════════════════════════════════════════════════════════════════════ */}
      {subTab === "users" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            <div className="px-1 text-label font-bold uppercase tracking-wider text-text-muted">
              {t("System Users", "المستخدمون والحسابات", "نظام کے صارفین")}
            </div>
            {usersList.map((u) => {
              const active = u.id === selectedUserId;
              const allowCount = u.override?.allow?.length || 0;
              const denyCount = u.override?.deny?.length || 0;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectUser(u)}
                  className={cn(
                    "w-full rounded-panel border p-3.5 text-start transition-all",
                    active
                      ? "border-brand bg-brand/10 shadow-sm"
                      : "border-border-subtle bg-surface-1 hover:border-brand/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-label-lg leading-4 font-extrabold text-text-primary">{u.fullName}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-label font-bold text-brand">
                      {u.role}
                    </span>
                  </div>
                  <div className="mt-1 text-label text-text-muted">{u.email}</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/70 pt-2 text-label">
                    <span className="text-text-secondary">
                      {t("Scope:", "النطاق:", "دائرہ کار:")} <strong>{u.dataScope}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {allowCount > 0 && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-500">
                          +{allowCount} Allow
                        </span>
                      )}
                      {denyCount > 0 && (
                        <span className="rounded bg-danger/15 px-1.5 py-0.5 font-bold text-danger">
                          −{denyCount} Deny
                        </span>
                      )}
                      {allowCount === 0 && denyCount === 0 && (
                        <span className="text-text-muted">
                          {t("Inherited", "موروث من الدور", "کردار سے موروثی")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4 lg:col-span-8">
            {selectedUser && (
              <div className="rounded-panel border border-border-subtle bg-surface-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-card-title leading-5 font-black text-text-primary">{selectedUser.fullName}</h4>
                    <p className="text-label-lg leading-4 text-text-muted">{selectedUser.email}</p>
                  </div>
                  <div className="rounded-inner border border-brand/30 bg-brand/5 px-3 py-1.5 text-label font-bold text-brand">
                    {t(
                      "Rule: DENY overrides ALLOW and Role Permissions",
                      "قاعدة الحسم: المنع الصريح (DENY) يغلب السماح (ALLOW) وصلاحيات الدور",
                      "اصول: صریح ممانعت (DENY) اجازت اور کردار پر غالب ہے"
                    )}
                  </div>
                </div>

                {selectedUser.id === "u-admin" ? (
                  <div className="mt-4 rounded-inner border border-emerald-500/30 bg-emerald-500/10 p-3 text-label-lg leading-4 text-emerald-500">
                    {t(
                      "The primary Super Admin account has full permanent permissions and cannot be restricted.",
                      "حساب مدير النظام الأساسي (Super Admin) يمتلك صلاحيات كاملة دائمة ولا يمكن تقييده.",
                      "بنیادی سپر ایڈمن اکاؤنٹ مکمل اجازت رکھتا ہے اور محدود نہیں کیا جا سکتا۔"
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-label font-bold text-text-secondary">
                          {t("Assigned Primary Role", "الدور الأساسي للمستخدم", "صارف کا بنیادی کردار")}
                        </label>
                        <select
                          value={userRoleDraft}
                          onChange={(e) => setUserRoleDraft(e.target.value)}
                          className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-label-lg leading-4 font-bold text-text-primary"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {isAr ? r.labelAr : r.labelEn} ({r.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-label font-bold text-text-secondary">
                          {t("User Data Scope Override (§8)", "تخصيص نطاق البيانات للمستخدم (§8)", "صارف کے ڈیٹا کا دائرہ کار")}
                        </label>
                        <select
                          value={userScopeDraft}
                          onChange={(e) => setUserScopeDraft(e.target.value)}
                          className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-label-lg leading-4 font-bold text-text-primary"
                        >
                          <option value="">
                            {t("Inherit from Role", "موروث من الدور تلقائيًا", "کردار سے خودکار وراثت")}
                          </option>
                          {dataScopes.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {isAr ? sc.ar : sc.en}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <input
                        type="text"
                        value={userReason}
                        onChange={(e) => setUserReason(e.target.value)}
                        placeholder={t(
                          "Reason for user permission override…",
                          "سبب تخصيص صلاحيات هذا المستخدم…",
                          "صارف کی اجازت میں تبدیلی کی وجہ…"
                        )}
                        className="min-w-[200px] flex-1 rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 text-text-primary"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetUserOverrides}
                          disabled={saving}
                          className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-secondary hover:text-text-primary"
                        >
                          {t("Reset to Inherited", "إعادة للوراثة من الدور", "موروثی حالت پر بحال کریں")}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveUserOverrides}
                          disabled={saving}
                          className="rounded-inner bg-brand px-4 py-1.5 text-label-lg leading-4 font-black text-on-brand"
                        >
                          {t("Save User Overrides", "حفظ استثناءات المستخدم", "صارف کی اجازتیں محفوظ کریں")}
                        </button>
                      </div>
                    </div>

                    {/* Per-permission 3-state matrix (Inherited / +Allow / -Deny) */}
                    <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                      {allCatalogFunctions.map((fn) => {
                        const isAllow = userAllowDraft.has(fn.key);
                        const isDeny = userDenyDraft.has(fn.key);
                        const roleHas =
                          roles.find((r) => r.id === userRoleDraft)?.permissions.includes(fn.key) ||
                          roles.find((r) => r.id === userRoleDraft)?.permissions.includes("*");

                        return (
                          <div
                            key={fn.key}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-inner border border-border-subtle bg-surface-2/40 px-3 py-2 text-label-lg leading-4"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-text-primary">
                                  {isAr ? fn.labelAr : fn.labelEn}
                                </span>
                                <span className="text-label text-text-muted">
                                  ({isAr ? fn.pageLabelAr : fn.pageLabelEn})
                                </span>
                                {roleHas && (
                                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-label text-text-secondary">
                                    {t("In Role", "ضمن الدور", "کردار میں شامل")}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-label text-text-muted">{fn.key}</div>
                            </div>

                            <div className="flex items-center gap-1 rounded-chip border border-border-subtle bg-surface-1 p-0.5 text-label">
                              <button
                                type="button"
                                onClick={() => setUserPermState(fn.key, "inherited")}
                                className={cn(
                                  "rounded-micro px-2 py-1 font-bold transition",
                                  !isAllow && !isDeny
                                    ? "bg-surface-2 text-text-primary"
                                    : "text-text-muted hover:text-text-primary"
                                )}
                              >
                                {t("Inherited", "موروث", "موروثی")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setUserPermState(fn.key, "allow")}
                                className={cn(
                                  "rounded-micro px-2 py-1 font-bold transition",
                                  isAllow
                                    ? "bg-emerald-500 text-white"
                                    : "text-text-muted hover:text-emerald-500"
                                )}
                              >
                                + {t("Allow", "سماح", "اجازت")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setUserPermState(fn.key, "deny")}
                                className={cn(
                                  "rounded-micro px-2 py-1 font-bold transition",
                                  isDeny ? "bg-danger text-white" : "text-text-muted hover:text-danger"
                                )}
                              >
                                − {t("Deny", "منع", "ممانعت")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3: TEMPORARY GRANTS (§13) & GLOBAL PERMISSION SWITCH (§12)
         ════════════════════════════════════════════════════════════════════ */}
      {subTab === "temporary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Temporary Permission Grant Card */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-panel border border-border-subtle bg-surface-1 p-4">
              <div className="flex items-center gap-2">
                <IconSparkles size={16} className="text-brand" />
                <h4 className="text-label-lg leading-4 font-extrabold text-text-primary">
                  {t(
                    "Grant Temporary Time-Bound Permission (§13)",
                    "منح صلاحية مؤقتة مرتبطة بفترة زمنية (§13)",
                    "وقتی طور پر محدود عارضی اجازت دیں"
                  )}
                </h4>
              </div>
              <p className="mt-1 text-label text-text-muted">
                {t(
                  "Automatically expires once the end timestamp is reached.",
                  "تنتهي الصلاحية المؤقتة تلقائيًا فور انتهاء الوقت المحدد دون تدخل يدوي.",
                  "مقررہ وقت ختم ہونے پر یہ اجازت خودکار طور پر ختم ہو جائے گی۔"
                )}
              </p>

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-label font-bold text-text-secondary">
                      {t("Target Type", "نوع المستهدف", "ہدف کی قسم")}
                    </label>
                    <select
                      value={tempForm.targetType}
                      onChange={(e) =>
                        setTempForm((prev) => ({
                          ...prev,
                          targetType: e.target.value as "USER" | "ROLE",
                          targetId: e.target.value === "USER" ? "u-ops" : "OPERATIONS_MANAGER",
                        }))
                      }
                      className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary"
                    >
                      <option value="USER">{t("User", "مستخدم محدد", "مخصوص صارف")}</option>
                      <option value="ROLE">{t("Role", "دور كامل", "مکمل کردار")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-label font-bold text-text-secondary">
                      {t("Target", "المستهدف", "ہدف")}
                    </label>
                    {tempForm.targetType === "USER" ? (
                      <select
                        value={tempForm.targetId}
                        onChange={(e) => setTempForm((prev) => ({ ...prev, targetId: e.target.value }))}
                        className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary"
                      >
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={tempForm.targetId}
                        onChange={(e) => setTempForm((prev) => ({ ...prev, targetId: e.target.value }))}
                        className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary"
                      >
                        {roles
                          .filter((r) => !r.locked)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {isAr ? r.labelAr : r.labelEn}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-label font-bold text-text-secondary">
                      {t("Permission", "الصلاحية الممنوحة", "عطا کردہ اجازت")}
                    </label>
                    <select
                      value={tempForm.permission}
                      onChange={(e) => setTempForm((prev) => ({ ...prev, permission: e.target.value }))}
                      className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary"
                    >
                      {allCatalogFunctions.map((fn) => (
                        <option key={fn.key} value={fn.key}>
                          {isAr ? fn.labelAr : fn.labelEn} ({fn.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-label font-bold text-text-secondary">
                      {t("Expires At", "تنتهي في تاريخ/وقت", "میعاد ختم ہونے کا وقت")}
                    </label>
                    <input
                      type="datetime-local"
                      value={tempForm.validTo}
                      onChange={(e) => setTempForm((prev) => ({ ...prev, validTo: e.target.value }))}
                      className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempForm.reason}
                    onChange={(e) => setTempForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder={t("Reason for temporary grant…", "سبب منح الصلاحية المؤقتة…", "عارضی اجازت کی وجہ…")}
                    className="flex-1 rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={handleGrantTemporary}
                    disabled={saving}
                    className="rounded-inner bg-brand px-4 py-1.5 text-label-lg leading-4 font-black text-on-brand"
                  >
                    {t("Grant", "منح مؤقت", "اجازت دیں")}
                  </button>
                </div>
              </div>

              <div className="mt-4 divide-y divide-border-subtle border-t border-border-subtle pt-3">
                {tempGrants.length === 0 ? (
                  <div className="py-4 text-center text-label-lg leading-4 text-text-muted">
                    {t("No temporary permissions granted yet.", "لا توجد صلاحيات مؤقتة مسجلة حاليًا.", "ابھی تک کوئی عارضی اجازت درج نہیں۔")}
                  </div>
                ) : (
                  tempGrants.map((g) => {
                    const expired = Date.parse(g.validTo) < Date.now();
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-2 py-2.5 text-label-lg leading-4">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-primary">{g.permission}</span>
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-label text-brand">
                              {g.targetType}: {g.targetId}
                            </span>
                            {g.revokedAt ? (
                              <span className="rounded bg-danger/15 px-1.5 py-0.5 text-label font-bold text-danger">
                                {t("Revoked", "ملغاة", "منسوخ")}
                              </span>
                            ) : expired ? (
                              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-label font-bold text-warning">
                                {t("Expired", "منتهية", "ختم شدہ")}
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-label font-bold text-emerald-500">
                                {t("Active", "نشطة", "فعال")}
                              </span>
                            )}
                          </div>
                          <div className="text-label text-text-muted">
                            {t("Until:", "حتى:", "تک:")} {new Date(g.validTo).toLocaleString(isAr ? "ar-SA" : "en-US")}
                            {g.reason ? ` — ${g.reason}` : ""}
                          </div>
                        </div>
                        {!g.revokedAt && !expired && (
                          <button
                            type="button"
                            onClick={() => void handleRevokeTemporary(g.id)}
                            className="rounded-chip border border-danger/40 bg-danger/10 px-2.5 py-1 text-label font-bold text-danger"
                          >
                            {t("Revoke", "إلغاء", "منسوخ کریں")}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Global Permission Enable / Disable Switch (§12) */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-panel border border-border-subtle bg-surface-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-label-lg leading-4 font-extrabold text-text-primary">
                  {t(
                    "Global Permission Switchboard (§12)",
                    "تفعيل / تعطيل الصلاحيات على مستوى النظام (§12)",
                    "عالمی سطح پر اجازتوں کی فعالیت"
                  )}
                </h4>
                <span className="text-label text-text-muted">
                  {disabledPermissions.length} {t("disabled", "معطّلة", "غیر فعال")}
                </span>
              </div>
              <p className="mt-1 text-label text-text-muted">
                {t(
                  "Disabling a permission here suspends it across all non-Super-Admin roles and users without deleting it.",
                  "تعطيل أي صلاحية هنا يوقف العمل بها فورًا لدى جميع الأدوار والمستخدمين دون حذفها من النظام.",
                  "یہاں کسی اجازت کو غیر فعال کرنے سے وہ تمام کرداروں کے لیے عارضی طور پر رک جاتی ہے۔"
                )}
              </p>

              <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {allCatalogFunctions
                  .filter((fn) => fn.key !== "permissions.manage")
                  .map((fn) => {
                    const isDisabled = disabledPermissions.includes(fn.key);
                    return (
                      <div
                        key={fn.key}
                        className="flex items-center justify-between gap-2 rounded-inner border border-border-subtle bg-surface-2/40 px-3 py-2 text-label-lg leading-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold text-text-primary">
                            {isAr ? fn.labelAr : fn.labelEn}
                          </div>
                          <div className="font-mono text-label text-text-muted">{fn.key}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleToggleGlobalPermission(fn.key, isDisabled)}
                          disabled={saving}
                          className={cn(
                            "rounded-chip px-2.5 py-1 text-label font-bold transition",
                            isDisabled
                              ? "bg-danger/15 text-danger hover:bg-danger/25"
                              : "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                          )}
                        >
                          {isDisabled
                            ? t("Disabled (Click to Enable)", "معطّلة (اضغط للتفعيل)", "غیر فعال")
                            : t("Enabled", "مفعّلة", "فعال")}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 4: PERMISSION AUDIT LOG (§26)
         ════════════════════════════════════════════════════════════════════ */}
      {subTab === "audit" && (
        <div className="rounded-panel border border-border-subtle bg-surface-1">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <IconHistory size={16} className="text-brand" />
              <span className="text-label-lg leading-4 font-extrabold text-text-primary">
                {t("Permission Change Log", "سجل تغييرات الصلاحيات والأدوار", "اجازتوں کی تبدیلی کا ریکارڈ")}
              </span>
            </div>
            <span className="text-label text-text-muted">
              {audit.length} {t("recorded changes", "تعديل مسجل", "درج تبدیلیاں")}
            </span>
          </div>

          {audit.length === 0 ? (
            <div className="p-6 text-center text-label-lg leading-4 text-text-muted">
              {t(
                "No permission changes have been recorded yet.",
                "لم تُسجَّل أي تعديلات على الصلاحيات بعد.",
                "ابھی تک اجازتوں میں کوئی تبدیلی درج نہیں ہوئی۔"
              )}
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {audit.slice(0, 40).map((entry) => {
                const added = entry.newValues?.added || [];
                const removed = entry.newValues?.removed || [];
                return (
                  <div key={entry.id} className="px-4 py-3 text-label-lg leading-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-text-primary">
                          {entry.actorName || t("System Admin", "مدير النظام", "سسٹم ایڈمن")}
                        </span>
                        <span className="rounded-micro bg-brand/10 px-2 py-0.5 font-mono text-label font-bold text-brand">
                          {entry.action}
                        </span>
                        {entry.entityId && (
                          <span className="rounded-micro bg-surface-2 px-2 py-0.5 font-mono text-label font-bold text-text-primary">
                            {entry.entityId}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-label text-text-muted">
                        {new Date(entry.timestamp).toLocaleString(isAr ? "ar-SA" : "en-US")}
                      </span>
                    </div>
                    {entry.reason && (
                      <div className="mt-1 text-label text-text-secondary">
                        {t("Reason:", "السبب:", "وجہ:")} {entry.reason}
                      </div>
                    )}
                    {(added.length > 0 || removed.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-label">
                        {added.map((k) => (
                          <span
                            key={`+${k}`}
                            className="rounded-micro bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-500"
                          >
                            +{k}
                          </span>
                        ))}
                        {removed.map((k) => (
                          <span
                            key={`-${k}`}
                            className="rounded-micro bg-danger/15 px-1.5 py-0.5 font-mono text-danger"
                          >
                            −{k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Users Linked to Role (§3) ──────────────────────────────── */}
      {showRoleUsersModal && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h4 className="text-card-title leading-5 font-black text-text-primary">
                {t("Users Assigned to Role:", "المستخدمون المرتبطون بالدور:", "کردار سے منسلک صارفین:")}{" "}
                {isAr ? selectedRole.labelAr : selectedRole.labelEn}
              </h4>
              <button
                type="button"
                onClick={() => setShowRoleUsersModal(false)}
                className="rounded-chip p-1 text-text-muted hover:text-text-primary"
              >
                <IconClose size={16} />
              </button>
            </div>
            <div className="mt-3 max-h-72 divide-y divide-border-subtle overflow-y-auto">
              {(selectedRole.users || []).length === 0 ? (
                <div className="py-6 text-center text-label-lg leading-4 text-text-muted">
                  {t("No users currently assigned to this role.", "لا يوجد مستخدمون مرتبطون بهذا الدور حاليًا.", "اس کردار سے کوئی صارف منسلک نہیں۔")}
                </div>
              ) : (
                (selectedRole.users || []).map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5 text-label-lg leading-4">
                    <div>
                      <div className="font-bold text-text-primary">{u.fullName}</div>
                      <div className="text-label text-text-muted">{u.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleUsersModal(false);
                        setSelectedUserId(u.id);
                        setSubTab("users");
                      }}
                      className="rounded-chip bg-brand/15 px-2.5 py-1 text-label font-bold text-brand"
                    >
                      {t("Customize User", "تخصيص المستخدم", "صارف کی تخصیص")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create / Clone Role (§3) ───────────────────────────────── */}
      {(showCreateRoleModal || showCloneRoleModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h4 className="text-card-title leading-5 font-black text-text-primary">
                {showCloneRoleModal
                  ? t("Clone Role", "نسخ الدور الحالي إلى دور جديد", "موجودہ کردار کاپی کریں")
                  : t("Create New Role", "إنشاء دور وظيفي جديد", "نیا کردار بنائیں")}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowCreateRoleModal(false);
                  setShowCloneRoleModal(false);
                }}
                className="rounded-chip p-1 text-text-muted hover:text-text-primary"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-label-lg leading-4">
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Role Code (English uppercase)", "معرّف الدور (بالحروف الإنجليزية)", "کردار کا کوڈ")}
                </label>
                <input
                  type="text"
                  value={newRoleForm.id}
                  onChange={(e) => setNewRoleForm((p) => ({ ...p, id: e.target.value.toUpperCase() }))}
                  placeholder="REGIONAL_SUPERVISOR"
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 font-mono text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Arabic Name", "اسم الدور بالعربية", "عربی نام")}
                </label>
                <input
                  type="text"
                  value={newRoleForm.labelAr}
                  onChange={(e) => setNewRoleForm((p) => ({ ...p, labelAr: e.target.value }))}
                  placeholder="مشرف المنطقة"
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("English Name", "اسم الدور بالإنجليزية", "انگریزی نام")}
                </label>
                <input
                  type="text"
                  value={newRoleForm.labelEn}
                  onChange={(e) => setNewRoleForm((p) => ({ ...p, labelEn: e.target.value }))}
                  placeholder="Regional Supervisor"
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Description", "الوصف الوظيفي للدور", "کردار کی تفصیل")}
                </label>
                <input
                  type="text"
                  value={newRoleForm.descriptionAr}
                  onChange={(e) =>
                    setNewRoleForm((p) => ({
                      ...p,
                      descriptionAr: e.target.value,
                      descriptionEn: e.target.value,
                    }))
                  }
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              {!showCloneRoleModal && (
                <div>
                  <label className="mb-1 block font-bold text-text-secondary">
                    {t("Default Data Scope", "نطاق البيانات الافتراضي", "ڈیٹا کا دائرہ کار")}
                  </label>
                  <select
                    value={newRoleForm.dataScope}
                    onChange={(e) => setNewRoleForm((p) => ({ ...p, dataScope: e.target.value }))}
                    className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 font-bold text-text-primary"
                  >
                    {dataScopes.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {isAr ? sc.ar : sc.en}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRoleModal(false);
                    setShowCloneRoleModal(false);
                  }}
                  className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 font-bold text-text-secondary"
                >
                  {t("Cancel", "إلغاء", "منسوخ کریں")}
                </button>
                <button
                  type="button"
                  onClick={showCloneRoleModal ? handleCloneRole : handleCreateRole}
                  disabled={saving || !newRoleForm.id.trim() || !newRoleForm.labelAr.trim()}
                  className="rounded-inner bg-brand px-4 py-1.5 font-black text-on-brand disabled:opacity-40"
                >
                  {showCloneRoleModal
                    ? t("Clone Role", "نسخ الدور", "کاپی کریں")
                    : t("Create Role", "إنشاء الدور", "کردار بنائیں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
