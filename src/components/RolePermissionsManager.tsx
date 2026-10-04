/**
 * EJAZ Transport — Roles & Permissions Administration
 * ─────────────────────────────────────────────────────────────────────────
 * «الإعدادات → إدارة الأدوار والصلاحيات»
 *
 * The system administrator picks a role, then walks
 *   القسم  ←  الصفحة  ←  الوظيفة  ←  الصلاحية
 * and toggles each level. Saving writes the grant to the server registry, which
 * re-answers every permission check from then on — no code change, no redeploy.
 *
 * Rules enforced here and on the server:
 *  • the administrator's own role is locked (nobody can be locked out);
 *  • granting a page's function without the page re-grants the page;
 *  • every save is written to the audit trail with its before/after diff;
 *  • a role can never edit itself or another role's grants.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { useToast } from "./Toast";
import { usePermissions } from "../state/permissionStore";
import {
  IconCheck,
  IconClose,
  IconDoc,
  IconLock,
  IconProfile,
  IconReport,
  IconRotate360,
  IconSearch,
  IconTruck,
  IconDashboard,
  IconAnalysis,
} from "./Icons";

interface CatalogFunction {
  key: string;
  action: string;
  labelAr: string;
  labelEn: string;
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
interface RoleRow {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  core: boolean;
  locked: boolean;
  permissions: string[];
  defaultPermissions: string[];
  customized: boolean;
}
interface AuditRow {
  id: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityId: string;
  oldValues?: { permissions?: string[] };
  newValues?: { permissions?: string[]; added?: string[]; removed?: string[] };
  reason?: string;
  timestamp: string;
}

const SECTION_ICONS: Record<string, typeof IconTruck> = {
  dashboard: IconDashboard,
  truck: IconTruck,
  report: IconReport,
  analysis: IconAnalysis,
  lock: IconLock,
};

export function RolePermissionsManager({ onClose }: { onClose?: () => void }) {
  const { t, lang } = useSettings();
  const toast = useToast();
  const { refresh: refreshPermissions } = usePermissions();
  const ar = lang === "ar" || lang === "ur";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [pages, setPages] = useState<CatalogPage[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selected, setSelected] = useState<string>("OPERATIONS_MANAGER");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog, roleRes, auditRes] = await Promise.all([
        apiClient.permissions.catalog(),
        apiClient.permissions.roles(),
        apiClient.permissions.audit(25).catch(() => ({ entries: [] })),
      ]);
      setSections(catalog?.sections || []);
      setPages(catalog?.pages || []);
      setRoles(roleRes?.roles || []);
      setAudit(auditRes?.entries || []);
    } catch (err: any) {
      setLoadError(String(err?.message || t("Unable to load the permission registry.", "تعذّر تحميل سجل الصلاحيات.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = useMemo(() => roles.find((r) => r.id === selected), [roles, selected]);

  /* Selecting a role loads its live grant into the editable draft. */
  useEffect(() => {
    if (role) setDraft(new Set(role.permissions));
  }, [role]);

  const dirty = useMemo(() => {
    if (!role) return false;
    const before = new Set(role.permissions);
    if (before.size !== draft.size) return true;
    for (const k of draft) if (!before.has(k)) return true;
    return false;
  }, [role, draft]);

  const toggle = (key: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Toggles a whole page: its view key plus every function under it. */
  const togglePage = (page: CatalogPage) => {
    const keys = [page.viewKey, ...page.functions.map((f) => f.key)].filter(Boolean) as string[];
    const allOn = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  /** Toggles a whole section: every page and function inside it. */
  const toggleSection = (sectionId: string) => {
    const keys = pages
      .filter((p) => p.sectionId === sectionId)
      .flatMap((p) => [p.viewKey, ...p.functions.map((f) => f.key)])
      .filter(Boolean) as string[];
    const allOn = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const save = async () => {
    if (!role || role.locked) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await apiClient.permissions.save(role.id, Array.from(draft));
      setNotice({
        ok: true,
        text:
          t("Permissions saved for", "تم حفظ صلاحيات") +
          ` «${ar ? role.labelAr : role.labelEn}» — ` +
          t("added", "مضاف") +
          ` ${res?.added?.length ?? 0} · ` +
          t("removed", "مزال") +
          ` ${res?.removed?.length ?? 0}`,
      });
      toast(t("Permissions saved", "تم حفظ الصلاحيات"), ar ? role.labelAr : role.labelEn);
      await load();
      /* Open sessions pick the change up on their next registry poll. */
      await refreshPermissions();
      const fresh = await apiClient.permissions.audit(25).catch(() => ({ entries: [] }));
      setAudit(fresh?.entries || []);
    } catch (err: any) {
      setNotice({ ok: false, text: String(err?.message || t("Saving failed.", "فشل الحفظ.")) });
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async () => {
    if (!role || role.locked) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiClient.permissions.reset(role.id);
      setNotice({ ok: true, text: t("Default permissions restored.", "تمت استعادة الصلاحيات الافتراضية.") });
      await load();
      await refreshPermissions();
    } catch (err: any) {
      setNotice({ ok: false, text: String(err?.message || t("Reset failed.", "فشلت الاستعادة.")) });
    } finally {
      setSaving(false);
    }
  };

  const label = (arText: string, enText: string) => (ar ? arText : enText);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.labelAr.toLowerCase().includes(q) ||
        p.labelEn.toLowerCase().includes(q) ||
        p.functions.some((f) => f.labelAr.toLowerCase().includes(q) || f.labelEn.toLowerCase().includes(q) || f.key.includes(q))
    );
  }, [pages, query]);

  const grantedCount = draft.size;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4 lg:px-6">
        <div className="min-w-0">
          <h2 className="text-[var(--type-page-title)] font-extrabold text-text-primary">
            {t("Roles & permissions", "إدارة الأدوار والصلاحيات")}
          </h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {t(
              "Control exactly which sections, pages and functions each role sees. Changes apply on save — no code edit.",
              "تحكم كامل في الأقسام والصفحات والوظائف التي يراها كل دور. يسري التعديل فور الحفظ دون تعديل الكود.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="btn-icon" aria-label={t("Close", "إغلاق")}>
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center p-10 text-[12px] text-text-muted">
          {t("Loading the permission registry…", "جارٍ تحميل سجل الصلاحيات…")}
        </div>
      ) : loadError ? (
        <div className="grid flex-1 place-items-center p-10 text-center">
          <div className="max-w-md space-y-3">
            <p className="text-[12px] text-status-danger">{loadError}</p>
            <button onClick={() => void load()} className="btn-ghost border border-border-subtle px-3 py-2 text-[11.5px]">
              {t("Retry", "إعادة المحاولة")}
            </button>
          </div>
        </div>
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
            {/* ── Role list ─────────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="label-sm px-1">{t("Roles", "الأدوار")}</div>
              {roles.map((r) => {
                const active = r.id === selected;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "card w-full p-3 text-start transition hover:border-brand/40",
                      active && "border-brand/60 ring-1 ring-brand/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-[10px]",
                          active ? "bg-brand text-on-brand" : "bg-surface-3 text-text-secondary"
                        )}
                      >
                        {r.locked ? <IconLock size={14} /> : <IconProfile size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold text-text-primary">
                          {label(r.labelAr, r.labelEn)}
                        </span>
                        <span className="block truncate font-mono text-[9.5px] text-text-muted">{r.id}</span>
                      </span>
                      {r.customized && !r.locked && (
                        <span className="badge badge-brand shrink-0 text-[9px]">{t("edited", "معدّل")}</span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-text-muted">
                      {label(r.descriptionAr, r.descriptionEn)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* ── Permission tree ───────────────────────────────────────── */}
            <div className="min-w-0 space-y-3">
              {role?.locked && (
                <div className="card flex items-start gap-3 border-status-waiting/30 bg-status-waiting/8 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-status-waiting/15 text-status-waiting">
                    <IconLock size={15} />
                  </span>
                  <p className="text-[11.5px] leading-relaxed text-text-secondary">
                    {t(
                      "The system administrator holds full access and cannot be restricted — otherwise nobody could restore access. Edit any other role to control what it sees.",
                      "مدير النظام يملك صلاحية كاملة ولا يمكن تقييدها، وإلا تعذّر استعادة الوصول. عدّل أي دور آخر للتحكم فيما يراه.",
                    )}
                  </p>
                </div>
              )}

              {/* Toolbar */}
              <div className="card flex flex-wrap items-center gap-2 p-3">
                <div className="relative min-w-[180px] flex-1">
                  <span className="pointer-events-none absolute inset-y-0 start-2.5 grid place-items-center text-text-muted">
                    <IconSearch size={14} />
                  </span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Search a page or function…", "ابحث عن صفحة أو وظيفة…")}
                    className="h-9 w-full rounded-[8px] border border-border-subtle bg-surface-2 ps-8 pe-2.5 text-[11.5px] text-text-primary focus:border-brand focus:outline-none"
                  />
                </div>
                <span className="badge bg-surface-3 text-text-secondary">
                  {grantedCount} {t("granted", "صلاحية مفعّلة")}
                </span>
                <button
                  onClick={resetRole}
                  disabled={!dirty && !role?.customized}
                  className="btn-ghost gap-1.5 border border-border-subtle px-3 py-2 text-[11.5px] disabled:opacity-40"
                >
                  <IconRotate360 size={13} />
                  {t("Restore defaults", "استعادة الافتراضي")}
                </button>
                <button
                  onClick={save}
                  disabled={!dirty || role?.locked || saving}
                  className="btn-primary gap-1.5 px-4 py-2 text-[11.5px] disabled:opacity-40"
                >
                  <IconCheck size={14} />
                  {saving ? t("Saving…", "جارٍ الحفظ…") : t("Save permissions", "حفظ الصلاحيات")}
                </button>
              </div>

              {notice && (
                <div
                  className={cn(
                    "card flex items-start gap-2 p-3 text-[11.5px]",
                    notice.ok
                      ? "border-status-active/30 bg-status-active/8 text-status-active"
                      : "border-status-danger/30 bg-status-danger/8 text-status-danger"
                  )}
                >
                  <span className="mt-0.5 shrink-0">{notice.ok ? <IconCheck size={14} /> : <IconClose size={14} />}</span>
                  <span className="leading-relaxed">{notice.text}</span>
                </div>
              )}

              {/* Sections → pages → functions */}
              {sections.map((section) => {
                const sectionPages = filteredPages.filter((p) => p.sectionId === section.id);
                if (!sectionPages.length) return null;
                const SectionIcon = SECTION_ICONS[section.icon] || IconDoc;
                const sectionKeys = sectionPages.flatMap((p) =>
                  [p.viewKey, ...p.functions.map((f) => f.key)].filter(Boolean) as string[]
                );
                const allOn = sectionKeys.every((k) => draft.has(k));
                const someOn = sectionKeys.some((k) => draft.has(k));

                return (
                  <section key={section.id} className="card overflow-hidden">
                    <div className="flex items-center gap-2.5 border-b border-border-subtle bg-surface-2 px-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand/12 text-brand">
                        <SectionIcon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[12.5px] font-bold text-text-primary">
                          {label(section.labelAr, section.labelEn)}
                        </h3>
                        <p className="text-[10px] text-text-muted">
                          {sectionPages.length} {t("pages", "صفحات")}
                        </p>
                      </div>
                      <TriState
                        on={allOn}
                        partial={someOn && !allOn}
                        disabled={role?.locked}
                        label={t("Whole section", "القسم كاملًا")}
                        onClick={() => toggleSection(section.id)}
                      />
                    </div>

                    <div className="divide-y divide-border-subtle">
                      {sectionPages.map((page) => {
                        const pageKeys = [page.viewKey, ...page.functions.map((f) => f.key)].filter(Boolean) as string[];
                        const pageOn = pageKeys.every((k) => draft.has(k));
                        const pageSome = pageKeys.some((k) => draft.has(k));
                        const pageGranted = !page.viewKey || draft.has(page.viewKey);

                        return (
                          <div key={page.id} className={cn("p-3", !pageGranted && "opacity-55")}>
                            <div className="flex items-center gap-2.5">
                              <TriState
                                on={pageOn}
                                partial={pageSome && !pageOn}
                                disabled={role?.locked}
                                label={label(page.labelAr, page.labelEn)}
                                onClick={() => togglePage(page)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-bold text-text-primary">
                                  {label(page.labelAr, page.labelEn)}
                                </div>
                                {(page.hintAr || page.hintEn) && (
                                  <div className="truncate text-[10px] text-text-muted">
                                    {label(page.hintAr || "", page.hintEn || "")}
                                  </div>
                                )}
                              </div>
                              <span className="badge bg-surface-3 font-mono text-[9px] text-text-muted">{page.id}</span>
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-1.5 ps-7">
                              {page.functions.map((f) => {
                                const on = draft.has(f.key);
                                return (
                                  <button
                                    key={f.key}
                                    type="button"
                                    disabled={role?.locked}
                                    onClick={() => toggle(f.key)}
                                    aria-pressed={on}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition",
                                      on
                                        ? "border-brand/50 bg-brand/12 text-brand"
                                        : "border-border-subtle bg-surface-2 text-text-muted hover:border-brand/30 hover:text-text-secondary",
                                      role?.locked && "cursor-not-allowed"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "grid h-3.5 w-3.5 place-items-center rounded-[4px] border",
                                        on ? "border-brand bg-brand text-on-brand" : "border-border-strong"
                                      )}
                                    >
                                      {on && <IconCheck size={9} />}
                                    </span>
                                    {label(f.labelAr, f.labelEn)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {/* ── Audit trail ─────────────────────────────────────────── */}
              <section className="card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-border-subtle bg-surface-2 px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-4 text-text-secondary">
                    <IconDoc size={15} />
                  </span>
                  <div>
                    <h3 className="text-[12.5px] font-bold text-text-primary">
                      {t("Permission change log", "سجل تغييرات الصلاحيات")}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      {t("Who changed which role, from what to what, and when.", "من عدّل أي دور، ومن ماذا إلى ماذا، ومتى.")}
                    </p>
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {audit.length === 0 && (
                    <p className="p-4 text-center text-[11px] text-text-muted">
                      {t("No permission changes recorded yet.", "لم تُسجَّل تغييرات على الصلاحيات بعد.")}
                    </p>
                  )}
                  {audit.map((entry) => {
                    const added = entry.newValues?.added || [];
                    const removed = entry.newValues?.removed || [];
                    return (
                      <div key={entry.id} className="border-b border-border-subtle p-3 last:border-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-bold text-text-primary">{entry.actorName || "—"}</span>
                          <span className="badge bg-surface-3 font-mono text-[9px] text-text-muted">{entry.entityId}</span>
                          <span className="badge badge-brand text-[9px]">
                            {entry.action === "ROLE_PERMISSIONS_RESET"
                              ? t("restored defaults", "استعادة الافتراضي")
                              : t("updated", "تعديل")}
                          </span>
                          <span className="ms-auto font-mono text-[9.5px] text-text-muted" dir="ltr">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {(added.length > 0 || removed.length > 0) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {added.map((k) => (
                              <span key={`a-${k}`} className="badge bg-status-active/15 font-mono text-[9px] text-status-active">
                                + {k}
                              </span>
                            ))}
                            {removed.map((k) => (
                              <span key={`r-${k}`} className="badge bg-status-danger/15 font-mono text-[9px] text-status-danger">
                                − {k}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.reason && <p className="mt-1 text-[10px] text-text-muted">{entry.reason}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Checkbox with an explicit indeterminate state for partial groups. */
function TriState({
  on,
  partial,
  disabled,
  label,
  onClick,
}: {
  on: boolean;
  partial?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? "mixed" : on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition",
        on && "border-brand bg-brand text-on-brand",
        !on && partial && "border-brand bg-brand/25",
        !on && !partial && "border-border-strong bg-surface-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {on ? (
        <IconCheck size={11} />
      ) : partial ? (
        <span className="h-[2px] w-[9px] rounded-full bg-brand" />
      ) : null}
    </button>
  );
}
