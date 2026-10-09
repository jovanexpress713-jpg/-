/**
 * EJAZ Transport — Enterprise Financial Operations Center (§15–§19)
 * ─────────────────────────────────────────────────────────────────────────
 * Houses the five financial sub-modules with strict capability-driven
 * visibility (NO PERMISSION = NO TAB + NO BUTTON + NO FIELD):
 *   1. Financial Overview & Trip Ledger (`finance.view`)
 *   2. Invoices Management (`invoices.view`)
 *   3. Financial Settlements (`settlements.view`) — locked after approval unless reopened (`settlements.reopen`)
 *   4. Payments & Receivables (`payments.view`)
 *   5. Financial Review & Sign-off (`review.view`)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/apiClient";
import { useSettings } from "../settings";
import { usePermissions } from "../state/permissionStore";
import { useToast } from "./Toast";
import { cn } from "../utils/cn";
import {
  IconPlus,
  IconRefresh,
} from "./Icons";

type FinanceTabId = "ledger" | "invoices" | "settlements" | "payments" | "review";

export function FinanceCenter() {
  const { t } = useSettings();
  const { can, canAny } = usePermissions();
  const toast = useToast();
  const push = useCallback(
    (msg: { kind?: string; title: string; desc?: string }) => {
      toast(msg.title, msg.desc);
    },
    [toast]
  );

  const canViewLedger = can("finance.view");
  const canViewInvoices = canAny("invoices.view", "finance.view");
  const canViewSettlements = canAny("settlements.view", "finance.view");
  const canViewPayments = canAny("payments.view", "finance.view");
  const canViewReview = canAny("review.view", "finance.view");

  const availableTabs = useMemo(() => {
    const list: Array<{ id: FinanceTabId; label: string }> = [];
    if (canViewLedger) {
      list.push({
        id: "ledger",
        label: t("Financial Ledger", "الملخص المالي وسجل الرحلات", "مالیاتی خلاصہ اور ٹرپ لیجر"),
      });
    }
    if (canViewInvoices) {
      list.push({
        id: "invoices",
        label: t("Invoices", "الفواتير الضريبية", "ٹیکس انوائسز"),
      });
    }
    if (canViewSettlements) {
      list.push({
        id: "settlements",
        label: t("Financial Settlements", "التسويات المالية", "مالیاتی تصفیے"),
      });
    }
    if (canViewPayments) {
      list.push({
        id: "payments",
        label: t("Payments & Collections", "المدفوعات والمقبوضات", "ادائیگیاں اور وصولیاں"),
      });
    }
    if (canViewReview) {
      list.push({
        id: "review",
        label: t("Financial Review", "المراجعة والاعتماد المالي", "مالیاتی جائزہ اور منظوری"),
      });
    }
    return list;
  }, [canViewInvoices, canViewLedger, canViewPayments, canViewReview, canViewSettlements, t]);

  const [activeTab, setActiveTab] = useState<FinanceTabId>(
    () => availableTabs[0]?.id || "ledger"
  );

  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Action modal states
  const [reopenModal, setReopenModal] = useState<{ tripId: string; reason: string } | null>(null);
  const [settleModal, setSettleModal] = useState<{ tripId: string; paidAmount: string; notes: string } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    tripId: string;
    amount: string;
    direction: string;
    method: string;
    reference: string;
  } | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<{
    tripId: string;
    amount: string;
    notes: string;
  } | null>(null);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<any>[] = [];
      if (canViewLedger) {
        tasks.push(
          apiClient.finance
            .getTrips()
            .then((res) => {
              setSummary(res?.summary || null);
              setRecords(res?.records || []);
            })
            .catch(() => {})
        );
      }
      if (canViewInvoices) {
        tasks.push(
          apiClient.finance
            .getInvoices()
            .then((res) => setInvoices(res?.invoices || []))
            .catch(() => {})
        );
      }
      if (canViewSettlements) {
        tasks.push(
          apiClient.finance
            .getSettlements()
            .then((res) => setSettlements(res?.settlements || []))
            .catch(() => {})
        );
      }
      if (canViewPayments) {
        tasks.push(
          apiClient.finance
            .getPayments()
            .then((res) => setPayments(res?.payments || []))
            .catch(() => {})
        );
      }
      if (canViewReview) {
        tasks.push(
          apiClient.finance
            .getReviews()
            .then((res) => setReviews(res?.reviews || []))
            .catch(() => {})
        );
      }
      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [canViewInvoices, canViewLedger, canViewPayments, canViewReview, canViewSettlements]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  // Strict philosophy (§1, §15): If the user holds NO financial permission, render nothing at all.
  if (availableTabs.length === 0) {
    return null;
  }

  // Invoice actions
  const handleCreateInvoice = async () => {
    if (!invoiceModal?.tripId) return;
    try {
      await apiClient.finance.createInvoice({
        tripId: invoiceModal.tripId,
        amount: invoiceModal.amount ? Number(invoiceModal.amount) : undefined,
        notes: invoiceModal.notes || undefined,
      });
      setInvoiceModal(null);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Invoice created", "تم إنشاء الفاتورة بنجاح", "انوائس کامیابی سے بن گئی"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر إنشاء الفاتورة", "خرابی"), desc: err?.message });
    }
  };

  const handleApproveInvoice = async (id: string) => {
    try {
      await apiClient.finance.approveInvoice(id);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Invoice approved", "تم اعتماد الفاتورة", "انوائس منظور ہو گئی"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر الاعتماد", "خرابی"), desc: err?.message });
    }
  };

  const handleIssueInvoice = async (id: string) => {
    try {
      await apiClient.finance.issueInvoice(id);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Tax invoice issued", "تم إصدار الفاتورة الضريبية", "ٹیکس انوائس جاری کر دی گئی"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر الإصدار", "خرابی"), desc: err?.message });
    }
  };

  // Settlement actions
  const handleSaveSettlement = async () => {
    if (!settleModal) return;
    try {
      await apiClient.finance.createOrUpdateSettlement({
        tripId: settleModal.tripId,
        paidAmount: Number(settleModal.paidAmount || 0),
        notes: settleModal.notes || undefined,
      });
      setSettleModal(null);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Settlement updated", "تم تحديث التسوية المالية", "مالیاتی تصفیہ اپڈیٹ ہو گیا"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Settlement locked or denied", "تعذّر تعديل التسوية", "تصفیہ مقفل ہے"), desc: err?.message });
    }
  };

  const handleApproveSettlement = async (tripId: string) => {
    try {
      await apiClient.finance.approveSettlement(tripId);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Settlement approved & locked", "تم اعتماد التسوية المالية وقفلها", "مالیاتی تصفیہ منظور اور مقفل ہو گیا"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Approval failed", "تعذّر اعتماد التسوية", "منظوری ناکام"), desc: err?.message });
    }
  };

  const handleReopenSettlement = async () => {
    if (!reopenModal || !reopenModal.reason.trim()) return;
    try {
      await apiClient.finance.reopenSettlement(reopenModal.tripId, reopenModal.reason.trim());
      setReopenModal(null);
      await loadFinanceData();
      push({
        kind: "info",
        title: t("Settlement reopened and logged in Audit Trail", "تمت إعادة فتح التسوية وتسجيل السبب في سجل التدقيق", "تصفیہ دوبارہ کھول دیا گیا اور آڈٹ لاگ میں درج ہو گیا"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Reopen denied", "تعذّرت إعادة فتح التسوية", "دوبارہ کھولنے کی اجازت نہیں"), desc: err?.message });
    }
  };

  // Payment actions
  const handleRecordPayment = async () => {
    if (!paymentModal || !paymentModal.tripId || !paymentModal.amount) return;
    try {
      await apiClient.finance.recordPayment({
        tripId: paymentModal.tripId,
        amount: Number(paymentModal.amount),
        direction: paymentModal.direction,
        method: paymentModal.method,
        reference: paymentModal.reference,
      });
      setPaymentModal(null);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Payment recorded", "تم تسجيل الدفعة المالية", "ادائیگی درج کر دی گئی"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Payment failed", "تعذّر تسجيل الدفعة", "ادائیگی ناکام"), desc: err?.message });
    }
  };

  const handleConfirmPayment = async (id: string) => {
    try {
      await apiClient.finance.confirmPayment(id);
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Payment receipt confirmed", "تم تأكيد استلام الدفعة", "ادائیگی کی وصولی کی تصدیق ہو گئی"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر التأكيد", "خرابی"), desc: err?.message });
    }
  };

  // Financial review actions
  const handlePerformReview = async (tripId: string) => {
    try {
      await apiClient.finance.performReview(tripId, "Reviewed financial figures and POD");
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Financial review performed", "تم إجراء المراجعة المالية", "مالیاتی جائزہ مکمل ہو گیا"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر إجراء المراجعة", "خرابی"), desc: err?.message });
    }
  };

  const handleApproveReview = async (tripId: string) => {
    try {
      await apiClient.finance.approveReview(tripId, "Approved after financial audit");
      await loadFinanceData();
      push({
        kind: "success",
        title: t("Financial review approved", "تم اعتماد المراجعة المالية", "مالیاتی جائزہ منظور ہو گیا"),
      });
    } catch (err: any) {
      push({ kind: "error", title: t("Error", "تعذّر اعتماد المراجعة", "خرابی"), desc: err?.message });
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-center">
      {/* Header & Sub-module Tabs */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="label-sm">{t("FINANCE & SETTLEMENTS", "الوحدة المالية والفواتير والتسويات", "مالیات، انوائسز اور تصفیے")}</span>
            <h2 className="mt-0.5 text-page-title leading-6 font-extrabold text-text-primary">
              {t(
                "Financial Operations, Invoices, Settlements & Review",
                "الإدارة المالية، الفواتير، التسويات، المدفوعات والمراجعة المالية",
                "مالیاتی آپریشنز، انوائسز، تصفیے اور مالیاتی جائزہ"
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(can("invoices.create") || can("finance.create")) && (
              <button
                type="button"
                onClick={() =>
                  setInvoiceModal({
                    tripId: records[0]?.tripId || "trip-101",
                    amount: "",
                    notes: "",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-inner bg-brand px-3 py-1.5 text-label-lg leading-4 font-bold text-on-brand"
              >
                <IconPlus size={14} />
                {t("New Invoice", "إنشاء فاتورة", "نئی انوائس")}
              </button>
            )}
            {(can("payments.record") || can("finance.pay")) && (
              <button
                type="button"
                onClick={() =>
                  setPaymentModal({
                    tripId: records[0]?.tripId || "trip-101",
                    amount: "2500",
                    direction: "INBOUND_RECEIVABLE",
                    method: "BANK_TRANSFER",
                    reference: `TRX-${Date.now().toString().slice(-5)}`,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-inner border border-brand/40 bg-brand/10 px-3 py-1.5 text-label-lg leading-4 font-bold text-brand"
              >
                <IconPlus size={14} />
                {t("Record Payment", "تسجيل دفعة", "ادائیگی درج کریں")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadFinanceData()}
              disabled={loading}
              className="btn-ghost h-8 px-3 text-label"
            >
              <IconRefresh size={13} />
              {t("Refresh", "تحديث", "تازہ کریں")}
            </button>
          </div>
        </div>

        {/* Dynamic Sub-tabs — only tabs with permission appear */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-inner px-3.5 py-2 text-label-lg leading-4 font-bold transition",
                activeTab === tab.id
                  ? "bg-brand text-on-brand shadow-sm"
                  : "border border-border-subtle bg-surface-2/60 text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Strip (only if `finance.view` is granted) ─────────────────── */}
      {canViewLedger && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiBox
            label={t("Total Revenue", "إجمالي الإيرادات", "کل آمدنی")}
            value={`${Number(summary.totalRevenue || 0).toLocaleString()} SAR`}
          />
          <KpiBox
            label={t("Total Expenses", "إجمالي المصروفات", "کل اخراجات")}
            value={`${Number(summary.totalExpenses || 0).toLocaleString()} SAR`}
          />
          <KpiBox
            label={t("Commissions", "عمولات السائقين", "ڈرائیور کمیشن")}
            value={`${Number(summary.totalDriverCommissions || 0).toLocaleString()} SAR`}
          />
          <KpiBox
            label={t("Net Profit", "صافي الربح", "خالص منافع")}
            value={`${Number(summary.totalNetProfit || 0).toLocaleString()} SAR`}
            highlight
          />
          <KpiBox
            label={t("Collected", "المقبوضات المحصلة", "وصول شدہ رقم")}
            value={`${Number(summary.totalPaid || 0).toLocaleString()} SAR`}
          />
          <KpiBox
            label={t("Balance Due", "الذمم المتبقية", "واجب الادا بقایا")}
            value={`${Number(summary.totalBalanceDue || 0).toLocaleString()} SAR`}
          />
        </div>
      )}

      {/* ── TAB 1: FINANCIAL LEDGER ──────────────────────────────────────── */}
      {activeTab === "ledger" && canViewLedger && (
        <div className="card overflow-x-auto p-4">
          <table className="w-full text-label-lg leading-4">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="p-2 text-start">{t("Trip", "الرحلة", "ٹرپ")}</th>
                <th className="p-2 text-start">{t("Customer", "العميل", "کلائنٹ")}</th>
                <th className="p-2 text-start">{t("Revenue", "الإيراد", "آمدنی")}</th>
                <th className="p-2 text-start">{t("Expenses", "المصروفات", "اخراجات")}</th>
                <th className="p-2 text-start">{t("Commission", "عمولة السائق", "کمیشن")}</th>
                <th className="p-2 text-start">{t("Net Profit", "صافي الربح", "خالص منافع")}</th>
                <th className="p-2 text-start">{t("Paid", "المدفوع", "ادا شدہ")}</th>
                <th className="p-2 text-start">{t("Status", "التسوية", "حالت")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {records.map((r) => (
                <tr key={r.tripId}>
                  <td className="p-2 font-mono font-bold text-brand">{r.tripNumber || r.tripId}</td>
                  <td className="p-2">{r.customerName || "—"}</td>
                  <td className="p-2 tabular-nums font-bold">{Number(r.revenue || 0).toLocaleString()} SAR</td>
                  <td className="p-2 tabular-nums">{Number(r.expenses || 0).toLocaleString()} SAR</td>
                  <td className="p-2 tabular-nums">{Number(r.driverCommission || 0).toLocaleString()} SAR</td>
                  <td className="p-2 tabular-nums font-bold text-emerald-500">
                    {Number(r.netProfit || 0).toLocaleString()} SAR
                  </td>
                  <td className="p-2 tabular-nums">{Number(r.paidAmount || 0).toLocaleString()} SAR</td>
                  <td className="p-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label font-bold">
                      {r.settlementStatus} · {r.settlementApprovalStatus || "DRAFT"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: INVOICES (§17) ────────────────────────────────────────── */}
      {activeTab === "invoices" && canViewInvoices && (
        <div className="card overflow-x-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-label-lg leading-4 font-extrabold text-text-primary">
              {t("Tax Invoices Registry (§17)", "سجل الفواتير الضريبية (§17)", "ٹیکس انوائسز کا ریکارڈ")}
            </h3>
            <span className="text-label text-text-muted">
              {invoices.length} {t("invoices", "فاتورة", "انوائسز")}
            </span>
          </div>
          <table className="w-full text-label-lg leading-4">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="p-2 text-start">{t("Invoice #", "رقم الفاتورة", "انوائس نمبر")}</th>
                <th className="p-2 text-start">{t("Trip", "الرحلة", "ٹرپ")}</th>
                <th className="p-2 text-start">{t("Customer", "العميل", "کلائنٹ")}</th>
                <th className="p-2 text-start">{t("Subtotal", "المبلغ الأساسي", "بنیادی رقم")}</th>
                <th className="p-2 text-start">{t("VAT (15%)", "الضريبة 15%", "ٹیکس")}</th>
                <th className="p-2 text-start">{t("Total", "الإجمالي", "کل رقم")}</th>
                <th className="p-2 text-start">{t("Status", "الحالة", "حالت")}</th>
                <th className="p-2 text-start">{t("Actions", "الإجراءات المسموحة", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-2 font-mono font-bold text-brand">{inv.invoiceNumber}</td>
                  <td className="p-2 font-mono">{inv.tripNumber}</td>
                  <td className="p-2">{inv.customerName}</td>
                  <td className="p-2 tabular-nums">{Number(inv.amount || 0).toLocaleString()} SAR</td>
                  <td className="p-2 tabular-nums">{Number(inv.taxAmount || 0).toLocaleString()} SAR</td>
                  <td className="p-2 tabular-nums font-bold">{Number(inv.totalAmount || 0).toLocaleString()} SAR</td>
                  <td className="p-2">
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-label font-bold text-brand">
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(can("invoices.approve") || can("finance.approve")) && inv.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => void handleApproveInvoice(inv.id)}
                          className="rounded-chip bg-emerald-500/15 px-2 py-1 text-label font-bold text-emerald-500"
                        >
                          {t("Approve", "اعتماد", "منظور کریں")}
                        </button>
                      )}
                      {can("invoices.issue") && (inv.status === "APPROVED" || inv.status === "DRAFT") && (
                        <button
                          type="button"
                          onClick={() => void handleIssueInvoice(inv.id)}
                          className="rounded-chip bg-brand/15 px-2 py-1 text-label font-bold text-brand"
                        >
                          {t("Issue", "إصدار", "جاری کریں")}
                        </button>
                      )}
                      {can("invoices.print") && (
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="rounded-chip border border-border-subtle px-2 py-1 text-label font-bold text-text-secondary"
                        >
                          {t("Print", "طباعة", "پرنٹ")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: FINANCIAL SETTLEMENTS (§16) ───────────────────────────── */}
      {activeTab === "settlements" && canViewSettlements && (
        <div className="card overflow-x-auto p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-label-lg leading-4 font-extrabold text-text-primary">
                {t("Financial Settlements (§16)", "التسويات المالية للرحلات (§16)", "ٹرپس کے مالیاتی تصفیے")}
              </h3>
              <p className="text-label text-text-muted">
                {t(
                  "Approved settlements are locked and cannot be edited unless reopened by a user with REOPEN_SETTLEMENT.",
                  "بعد اعتماد التسوية لا يمكن تعديلها إلا لمن يملك صلاحية إعادة فتح التسوية (REOPEN_SETTLEMENT) مع تسجيل السبب في التدقيق.",
                  "منظوری کے بعد تصفیہ مقفل ہو جاتا ہے اور صرف REOPEN_SETTLEMENT کی اجازت سے دوبارہ کھولا جا سکتا ہے۔"
                )}
              </p>
            </div>
          </div>

          <table className="w-full text-label-lg leading-4">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="p-2 text-start">{t("Trip", "الرحلة", "ٹرپ")}</th>
                <th className="p-2 text-start">{t("Customer / Driver", "العميل / السائق", "کلائنٹ / ڈرائیور")}</th>
                <th className="p-2 text-start">{t("Revenue", "الإيراد", "آمدنی")}</th>
                <th className="p-2 text-start">{t("Paid", "المدفوع", "ادا شدہ")}</th>
                <th className="p-2 text-start">{t("Balance", "المتبقي", "بقایا")}</th>
                <th className="p-2 text-start">{t("Settlement Status", "حالة التسوية", "تصفیہ کی حالت")}</th>
                <th className="p-2 text-start">{t("Approval", "الاعتماد", "منظوری")}</th>
                <th className="p-2 text-start">{t("Actions", "الإجراءات", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {settlements.map((st) => {
                const isLocked = st.settlementApprovalStatus === "APPROVED";
                const canEditThis =
                  (!isLocked && (can("settlements.edit") || can("settlements.create") || can("finance.settle"))) ||
                  (isLocked && can("finance.postapprove"));

                return (
                  <tr key={st.tripId}>
                    <td className="p-2 font-mono font-bold text-brand">{st.tripNumber || st.tripId}</td>
                    <td className="p-2">
                      <div className="font-bold">{st.customerName || "—"}</div>
                      <div className="text-label text-text-muted">{st.driverName || "—"}</div>
                    </td>
                    <td className="p-2 tabular-nums">{Number(st.revenue || 0).toLocaleString()} SAR</td>
                    <td className="p-2 tabular-nums font-bold">{Number(st.paidAmount || 0).toLocaleString()} SAR</td>
                    <td className="p-2 tabular-nums">{Number(st.balanceDue || 0).toLocaleString()} SAR</td>
                    <td className="p-2">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label font-bold">
                        {st.settlementStatus}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-label font-bold",
                          isLocked
                            ? "bg-emerald-500/15 text-emerald-500"
                            : st.settlementApprovalStatus === "REOPENED"
                            ? "bg-warning/15 text-warning"
                            : "bg-surface-2 text-text-secondary"
                        )}
                      >
                        {st.settlementApprovalStatus || "DRAFT"}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canEditThis && (
                          <button
                            type="button"
                            onClick={() =>
                              setSettleModal({
                                tripId: st.tripId,
                                paidAmount: String(st.paidAmount || st.revenue || 0),
                                notes: st.settlementNotes || "",
                              })
                            }
                            className="rounded-chip bg-brand/15 px-2.5 py-1 text-label font-bold text-brand"
                          >
                            {t("Settle / Edit", "تسوية / تعديل", "تصفیہ / ترمیم")}
                          </button>
                        )}
                        {!isLocked && (can("settlements.approve") || can("finance.approve")) && (
                          <button
                            type="button"
                            onClick={() => void handleApproveSettlement(st.tripId)}
                            className="rounded-chip bg-emerald-500/15 px-2.5 py-1 text-label font-bold text-emerald-500"
                          >
                            {t("Approve", "اعتماد", "منظور کریں")}
                          </button>
                        )}
                        {isLocked && can("settlements.reopen") && (
                          <button
                            type="button"
                            onClick={() => setReopenModal({ tripId: st.tripId, reason: "" })}
                            className="rounded-chip bg-warning/15 px-2.5 py-1 text-label font-bold text-warning"
                          >
                            {t("Reopen Settlement", "إعادة فتح التسوية", "تصفیہ دوبارہ کھولیں")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 4: PAYMENTS & RECEIVABLES (§18) ──────────────────────────── */}
      {activeTab === "payments" && canViewPayments && (
        <div className="card overflow-x-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-label-lg leading-4 font-extrabold text-text-primary">
              {t("Payments & Receivables (§18)", "سجل المدفوعات والمقبوضات (§18)", "ادائیگیوں اور وصولیوں کا ریکارڈ")}
            </h3>
            <span className="text-label text-text-muted">
              {payments.length} {t("records", "سند مالي", "ریکارڈز")}
            </span>
          </div>
          <table className="w-full text-label-lg leading-4">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="p-2 text-start">{t("Payment #", "رقم السند", "سند نمبر")}</th>
                <th className="p-2 text-start">{t("Trip", "الرحلة", "ٹرپ")}</th>
                <th className="p-2 text-start">{t("Party", "الطرف", "فریق")}</th>
                <th className="p-2 text-start">{t("Direction", "النوع", "نوعیت")}</th>
                <th className="p-2 text-start">{t("Amount", "المبلغ", "رقم")}</th>
                <th className="p-2 text-start">{t("Method", "طريقة الدفع", "طریقہ")}</th>
                <th className="p-2 text-start">{t("Status", "الحالة", "حالت")}</th>
                <th className="p-2 text-start">{t("Actions", "الإجراءات", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {payments.map((pmt) => (
                <tr key={pmt.id}>
                  <td className="p-2 font-mono font-bold text-brand">{pmt.paymentNumber}</td>
                  <td className="p-2 font-mono">{pmt.tripNumber}</td>
                  <td className="p-2">{pmt.partyName}</td>
                  <td className="p-2">
                    {pmt.direction === "INBOUND_RECEIVABLE"
                      ? t("Inbound Receipt", "قبض من عميل", "کلائنٹ سے وصولی")
                      : t("Driver Payout", "صرف لسائق", "ڈرائیور کو ادائیگی")}
                  </td>
                  <td className="p-2 tabular-nums font-bold">{Number(pmt.amount || 0).toLocaleString()} SAR</td>
                  <td className="p-2 font-mono text-label">{pmt.method}</td>
                  <td className="p-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label font-bold">
                      {pmt.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {can("payments.receive") && pmt.status === "RECORDED" && (
                      <button
                        type="button"
                        onClick={() => void handleConfirmPayment(pmt.id)}
                        className="rounded-chip bg-emerald-500/15 px-2.5 py-1 text-label font-bold text-emerald-500"
                      >
                        {t("Confirm Receipt", "تأكيد الاستلام", "وصولی کی تصدیق")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 5: FINANCIAL REVIEW (§18) ────────────────────────────────── */}
      {activeTab === "review" && canViewReview && (
        <div className="card overflow-x-auto p-4">
          <div className="mb-3">
            <h3 className="text-label-lg leading-4 font-extrabold text-text-primary">
              {t("Financial Review & Audit Approval (§18)", "المراجعة المالية واعتماد التدقيق (§18)", "مالیاتی جائزہ اور آڈٹ منظوری")}
            </h3>
          </div>
          <table className="w-full text-label-lg leading-4">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="p-2 text-start">{t("Trip", "الرحلة", "ٹرپ")}</th>
                <th className="p-2 text-start">{t("Customer", "العميل", "کلائنٹ")}</th>
                <th className="p-2 text-start">{t("Net Profit", "صافي الربح", "خالص منافع")}</th>
                <th className="p-2 text-start">{t("Review Status", "حالة المراجعة", "جائزہ کی حالت")}</th>
                <th className="p-2 text-start">{t("Reviewed By", "المراجع", "جائزہ کنندہ")}</th>
                <th className="p-2 text-start">{t("Actions", "الإجراءات", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {reviews.map((rv) => (
                <tr key={rv.tripId}>
                  <td className="p-2 font-mono font-bold text-brand">{rv.tripNumber || rv.tripId}</td>
                  <td className="p-2">{rv.customerName || "—"}</td>
                  <td className="p-2 tabular-nums font-bold">{Number(rv.netProfit || 0).toLocaleString()} SAR</td>
                  <td className="p-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label font-bold">
                      {rv.reviewStatus}
                    </span>
                  </td>
                  <td className="p-2 text-label text-text-muted">{rv.reviewedByName || "—"}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {can("review.perform") && rv.reviewStatus === "NOT_STARTED" && (
                        <button
                          type="button"
                          onClick={() => void handlePerformReview(rv.tripId)}
                          className="rounded-chip bg-brand/15 px-2.5 py-1 text-label font-bold text-brand"
                        >
                          {t("Perform Review", "إجراء المراجعة", "جائزہ لیں")}
                        </button>
                      )}
                      {can("review.approve") && rv.reviewStatus !== "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => void handleApproveReview(rv.tripId)}
                          className="rounded-chip bg-emerald-500/15 px-2.5 py-1 text-label font-bold text-emerald-500"
                        >
                          {t("Approve Review", "اعتماد المراجعة", "جائزہ منظور کریں")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Reopen Approved Settlement (§16) ───────────────────────── */}
      {reopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <h4 className="text-card-title leading-5 font-black text-text-primary">
              {t("Reopen Approved Settlement", "إعادة فتح تسوية مالية معتمدة", "منظور شدہ تصفیہ دوبارہ کھولیں")}
            </h4>
            <p className="mt-1 text-label-lg leading-4 text-text-muted">
              {t(
                "Please enter the mandatory audit reason for reopening this approved settlement.",
                "يرجى إدخال السبب الإلزامي لإعادة فتح هذه التسوية المعتمدة (سيُسجَّل في سجل التدقيق).",
                "براہ کرم منظور شدہ تصفیہ کو دوبارہ کھولنے کی لازمی وجہ درج کریں۔"
              )}
            </p>
            <textarea
              rows={3}
              value={reopenModal.reason}
              onChange={(e) => setReopenModal({ ...reopenModal, reason: e.target.value })}
              placeholder={t("Audit reason…", "سبب إعادة الفتح…", "دوبارہ کھولنے کی وجہ…")}
              className="mt-3 w-full rounded-inner border border-border-subtle bg-surface-2 p-2.5 text-label-lg leading-4 text-text-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReopenModal(null)}
                className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 text-label-lg leading-4 font-bold text-text-secondary"
              >
                {t("Cancel", "إلغاء", "منسوخ کریں")}
              </button>
              <button
                type="button"
                disabled={!reopenModal.reason.trim()}
                onClick={() => void handleReopenSettlement()}
                className="rounded-inner bg-warning px-4 py-1.5 text-label-lg leading-4 font-black text-black disabled:opacity-40"
              >
                {t("Confirm Reopen", "تأكيد إعادة الفتح", "تصدیق کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Settle / Edit Settlement ───────────────────────────────── */}
      {settleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <h4 className="text-card-title leading-5 font-black text-text-primary">
              {t("Update Trip Settlement", "تحديث التسوية المالية للرحلة", "ٹرپ کا مالیاتی تصفیہ اپڈیٹ کریں")}
            </h4>
            <div className="mt-3 space-y-3 text-label-lg leading-4">
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Paid Amount (SAR)", "المبلغ المسدد (ريال)", "ادا شدہ رقم")}
                </label>
                <input
                  type="number"
                  value={settleModal.paidAmount}
                  onChange={(e) => setSettleModal({ ...settleModal, paidAmount: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Settlement Notes", "ملاحظات التسوية", "تصفیہ کے نوٹس")}
                </label>
                <input
                  type="text"
                  value={settleModal.notes}
                  onChange={(e) => setSettleModal({ ...settleModal, notes: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleModal(null)}
                  className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 font-bold text-text-secondary"
                >
                  {t("Cancel", "إلغاء", "منسوخ کریں")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSettlement()}
                  className="rounded-inner bg-brand px-4 py-1.5 font-black text-on-brand"
                >
                  {t("Save Settlement", "حفظ التسوية", "محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Invoice ─────────────────────────────────────────── */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <h4 className="text-card-title leading-5 font-black text-text-primary">
              {t("Create Tax Invoice", "إنشاء فاتورة ضريبية جديدة", "نئی ٹیکس انوائس بنائیں")}
            </h4>
            <div className="mt-3 space-y-3 text-label-lg leading-4">
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Trip ID", "معرّف الرحلة", "ٹرپ آئی ڈی")}
                </label>
                <input
                  type="text"
                  value={invoiceModal.tripId}
                  onChange={(e) => setInvoiceModal({ ...invoiceModal, tripId: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Amount before VAT (optional)", "المبلغ قبل الضريبة (اختياري)", "ٹیکس سے پہلے کی رقم")}
                </label>
                <input
                  type="number"
                  value={invoiceModal.amount}
                  onChange={(e) => setInvoiceModal({ ...invoiceModal, amount: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInvoiceModal(null)}
                  className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 font-bold text-text-secondary"
                >
                  {t("Cancel", "إلغاء", "منسوخ کریں")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateInvoice()}
                  className="rounded-inner bg-brand px-4 py-1.5 font-black text-on-brand"
                >
                  {t("Create Invoice", "إنشاء الفاتورة", "انوائس بنائیں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Record Payment ─────────────────────────────────────────── */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-1 p-5 shadow-xl">
            <h4 className="text-card-title leading-5 font-black text-text-primary">
              {t("Record Financial Payment", "تسجيل دفعة مالية", "مالیاتی ادائیگی درج کریں")}
            </h4>
            <div className="mt-3 space-y-3 text-label-lg leading-4">
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Trip ID", "معرّف الرحلة", "ٹرپ آئی ڈی")}
                </label>
                <input
                  type="text"
                  value={paymentModal.tripId}
                  onChange={(e) => setPaymentModal({ ...paymentModal, tripId: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-secondary">
                  {t("Amount (SAR)", "المبلغ (ريال)", "رقم (ریال)")}
                </label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 px-3 py-2 text-text-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="rounded-inner border border-border-subtle bg-surface-2 px-3 py-1.5 font-bold text-text-secondary"
                >
                  {t("Cancel", "إلغاء", "منسوخ کریں")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRecordPayment()}
                  className="rounded-inner bg-brand px-4 py-1.5 font-black text-on-brand"
                >
                  {t("Save Payment", "تسجيل الدفعة", "محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-3">
      <div className="truncate text-label text-text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-label-lg leading-4 font-extrabold tabular-nums",
          highlight ? "text-emerald-500" : "text-text-primary"
        )}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}
