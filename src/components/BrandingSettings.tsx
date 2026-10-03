import { useState, useEffect } from "react";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { BrandLogo, EjazEmblem } from "./Logo";
import { useBranding } from "../state/brandingStore";
import { IconClose, IconCheck } from "./Icons";

interface BrandingSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrandingSettings({ isOpen, onClose }: BrandingSettingsProps) {
  const { t } = useSettings();
  const { refresh: refreshBranding } = useBranding();
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [logoVariant, setLogoVariant] = useState<"master" | "header" | "login" | "report">("master");

  const [branding, setBranding] = useState({
    officialNameAr: "مؤسسة إيجاز للنقليات",
    officialNameEn: "EJAZ Transport",
    officialNameUr: "اعجاز ٹرانسپورٹ",
    taglineAr: "إدارة أسطول النقل الثقيل والرحلات",
    taglineEn: "Heavy Fleet & Logistics Control",
    taglineUr: "ہیوی فلیٹ اور لاجسٹکس کنٹرول",
    logoUrl: "",
    headerLogoUrl: "",
    loginLogoUrl: "",
    reportLogoUrl: "",
    primaryColor: "#FF7A00",
    navyColor: "#0A1931",
  });

  useEffect(() => {
    if (!isOpen) return;
    async function loadBranding() {
      try {
        const res = await apiClient.branding.get();
        if (res?.branding) {
          setBranding((prev) => ({
            ...prev,
            ...res.branding,
            logoUrl: res.branding.logoUrl || "",
            headerLogoUrl: res.branding.headerLogoUrl || "",
            loginLogoUrl: res.branding.loginLogoUrl || "",
            reportLogoUrl: res.branding.reportLogoUrl || "",
          }));
        }
      } catch (err: any) {
        console.warn("[BrandingSettings] Failed to fetch branding config:", err);
      }
    }
    loadBranding();
  }, [isOpen]);

  if (!isOpen) return null;

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
      reader.readAsDataURL(file);
    });

  const FIELD_BY_VARIANT = {
    master: "logoUrl",
    header: "headerLogoUrl",
    login: "loginLogoUrl",
    report: "reportLogoUrl",
  } as const;

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const data = await readFileAsBase64(file);
      const res = await apiClient.branding.uploadLogo({ data, fileName: file.name, variant: logoVariant });
      const url = res?.url;
      if (url) {
        setBranding((prev) => ({ ...prev, [FIELD_BY_VARIANT[logoVariant]]: url }));
        await refreshBranding();
        setUploadMsg("تم رفع الشعار وتعميمه مباشرة عبر النظام.");
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      setUploadMsg(
        /auth|session|unauthor|مصادق|جلسة/i.test(msg)
          ? "انتهت جلستك أو لم يتم التحقق منها — أعد تسجيل الدخول بحساب مدير ثم جرّب الرفع مجددًا."
          : msg || "فشل رفع الشعار",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await apiClient.branding.update({
        ...branding,
        logoUrl: branding.logoUrl.trim() || null,
        headerLogoUrl: branding.headerLogoUrl.trim() || null,
        loginLogoUrl: branding.loginLogoUrl.trim() || null,
        reportLogoUrl: branding.reportLogoUrl.trim() || null,
      });

      // Push the new identity to the live header / sidebar / welcome surfaces.
      await refreshBranding();
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "فشل حفظ إعدادات الهوية الرسمية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-[620px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-surface-1 border border-border-subtle shadow-2xl p-6 text-text-primary">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} showSub={false} />
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">
                {t("Central Branding & Identity Settings", "إعدادات الهوية والعلامة التجارية المركزية")}
              </h2>
              <p className="text-[11.5px] text-text-muted">
                {t(
                  "Propagates official logo and company branding across Admin, Mobile, Reports and Login",
                  "تحديث وتعميم الشعار الرسمي وهوية إيجاز عبر لوحة التحكم والتطبيق والتقارير وشاشات الدخول"
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-sm rounded-full hover:bg-surface-3"
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Feedback Messages */}
        {savedSuccess && (
          <div className="mt-4 rounded-[12px] bg-status-active/15 border border-status-active/30 p-3 text-[12px] text-status-active font-semibold flex items-center gap-2">
            <IconCheck size={16} />
            <span>
              {t(
                "Central branding updated successfully and propagated system-wide!",
                "تم تحديث الهوية المركزية وتعميمها بنجاح عبر النظام كاملاً!"
              )}
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-[12px] bg-status-danger/15 border border-status-danger/30 p-3 text-[12px] text-status-danger">
            {errorMsg}
          </div>
        )}

        {/* Main Branding Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4 text-[12px]">
          {/* Logo Preview & Vector Emblem Indicator */}
          <div className="rounded-[14px] bg-surface-2 p-4 border border-border-subtle flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold text-text-muted uppercase">
                {t("Official Vector Emblem & Asset", "الشعار المعتمد الحالي")}
              </div>
              <div className="text-[13px] font-bold text-white mt-1">
                {branding.officialNameAr}
              </div>
              <div className="text-[11px] text-brand">
                {branding.officialNameEn} · {branding.officialNameUr}
              </div>
            </div>
            <div className="h-16 w-24 rounded-[10px] bg-navy flex items-center justify-center p-2 border border-white/10 shrink-0">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Official Logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <EjazEmblem size={44} color={branding.primaryColor} />
              )}
            </div>
          </div>

          {/* Official Names */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Name (Arabic)", "الاسم الرسمي (بالعربية)")}
              </label>
              <input
                type="text"
                value={branding.officialNameAr}
                onChange={(e) => setBranding({ ...branding, officialNameAr: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Name (English)", "الاسم الرسمي (بالإنجليزية)")}
              </label>
              <input
                type="text"
                value={branding.officialNameEn}
                onChange={(e) => setBranding({ ...branding, officialNameEn: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Name (Urdu)", "الاسم الرسمي (بالأوردو)")}
              </label>
              <input
                type="text"
                value={branding.officialNameUr}
                onChange={(e) => setBranding({ ...branding, officialNameUr: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
                required
              />
            </div>
          </div>

          {/* Taglines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Tagline (Arabic)", "الشعار اللفظي (بالعربية)")}
              </label>
              <input
                type="text"
                value={branding.taglineAr}
                onChange={(e) => setBranding({ ...branding, taglineAr: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Tagline (English)", "الشعار اللفظي (بالإنجليزية)")}
              </label>
              <input
                type="text"
                value={branding.taglineEn}
                onChange={(e) => setBranding({ ...branding, taglineEn: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Tagline (Urdu)", "الشعار اللفظي (بالأوردو)")}
              </label>
              <input
                type="text"
                value={branding.taglineUr}
                onChange={(e) => setBranding({ ...branding, taglineUr: e.target.value })}
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Upload a logo file from the device */}
          <div className="rounded-[14px] bg-surface-2 border border-border-subtle p-4 space-y-3">
            <div className="text-[11px] font-bold text-text-muted uppercase">
              {t("Upload Logo File", "رفع ملف الشعار من الجهاز")}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  {t("Logo Target", "وجهة الشعار")}
                </label>
                <select
                  value={logoVariant}
                  onChange={(e) => setLogoVariant(e.target.value as any)}
                  className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand"
                >
                  <option value="master">{t("Master (all surfaces)", "الرئيسي (كل الشاشات)")}</option>
                  <option value="header">{t("Admin header / sidebar", "هيدر ولوحة التحكم")}</option>
                  <option value="login">{t("Login & welcome", "شاشات الدخول والترحيب")}</option>
                  <option value="report">{t("Reports / PDF", "التقارير والطباعة")}</option>
                </select>
              </div>
              <label className="btn-primary h-10 inline-flex items-center justify-center gap-2 rounded-[10px] px-4 text-[12px] font-bold text-navy bg-brand hover:bg-brand-600 cursor-pointer shrink-0">
                {uploading ? t("Uploading...", "جارٍ الرفع...") : t("Choose & Upload", "اختيار ورفع")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    handleLogoUpload(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-[11px] text-text-muted">
              {t("PNG / JPG / WEBP / SVG · up to 4MB", "PNG / JPG / WEBP / SVG · حتى 4 ميجابايت")}
            </p>
            {uploadMsg && (
              <div className="rounded-[10px] bg-surface-3 border border-border-subtle p-2 text-[11.5px] text-text-secondary">
                {uploadMsg}
              </div>
            )}
          </div>

          {/* Custom Logo URL */}
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
              {t("Custom Logo Asset URL (optional)", "رابط ملف الشعار المخصص (اختياري - يترك فارغاً للشعار المتجهي الرسمي)")}
            </label>
            <input
              type="text"
              value={branding.logoUrl}
              onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
              placeholder="https://.../logo.png"
              className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-text-primary border border-border-subtle outline-none focus:border-brand font-mono text-[11.5px]"
            />
          </div>

          {/* Color Palettes */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Primary Orange Accent Color", "لون الهوية البرتقالي المعتمد")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="h-10 w-12 rounded-[8px] bg-surface-2 border border-border-subtle cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="w-full h-10 rounded-[10px] bg-surface-2 px-3 font-mono text-[12px] text-text-primary border border-border-subtle"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                {t("Navy Anchor Brand Color", "لون الهوية الكحلي المعتمد (Navy)")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.navyColor}
                  onChange={(e) => setBranding({ ...branding, navyColor: e.target.value })}
                  className="h-10 w-12 rounded-[8px] bg-surface-2 border border-border-subtle cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={branding.navyColor}
                  onChange={(e) => setBranding({ ...branding, navyColor: e.target.value })}
                  className="w-full h-10 rounded-[10px] bg-surface-2 px-3 font-mono text-[12px] text-text-primary border border-border-subtle"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-5 py-2.5 rounded-[10px] text-[12px]"
            >
              {t("Cancel", "إلغاء")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-6 py-2.5 rounded-[10px] text-[12.5px] font-bold shadow-lg"
            >
              {loading ? t("Saving...", "جاري الحفظ...") : t("Save & Propagate Branding", "حفظ وتعميم الهوية")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
