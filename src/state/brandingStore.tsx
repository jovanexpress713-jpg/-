import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "../services/apiClient";

/**
 * EJAZ Transport — Central branding store.
 *
 * The Branding settings screen (`Settings & Identity`) persists the official logo
 * and identity to `/api/branding`. This store is the single consumer that pushes
 * those values to every surface (admin header, sidebar, mobile welcome, login),
 * so saving a logo there genuinely re-skins the product instead of only writing
 * to the server.
 *
 * A missing provider (e.g. an SSR harness) yields the vector defaults, so nothing
 * that renders `BrandLogo` can crash.
 */

export interface BrandingState {
  officialNameAr: string;
  officialNameEn: string;
  officialNameUr: string;
  taglineAr: string;
  taglineEn: string;
  logoUrl: string | null;
  headerLogoUrl: string | null;
  loginLogoUrl: string | null;
  reportLogoUrl: string | null;
  primaryColor: string;
  navyColor: string;
}

const DEFAULT_BRANDING: BrandingState = {
  officialNameAr: "مؤسسة إيجاز للنقليات",
  officialNameEn: "EJAZ Transport",
  officialNameUr: "اعجاز ٹرانسپورٹ",
  taglineAr: "إدارة أسطول النقل الثقيل والرحلات",
  taglineEn: "Heavy Fleet & Logistics Control",
  logoUrl: null,
  headerLogoUrl: null,
  loginLogoUrl: null,
  reportLogoUrl: null,
  primaryColor: "#FF6B1A",
  navyColor: "#050B18",
};

interface BrandingContextType {
  branding: BrandingState;
  /** Re-fetch after a save so the new logo applies without a reload. */
  refresh: () => Promise<void>;
  /** The emblem to use in the admin header / sidebar (custom or vector). */
  headerLogo: string | null;
  /** The emblem to use on the welcome / login surfaces. */
  loginLogo: string | null;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.branding.get();
      if (res?.branding) {
        setBranding((prev) => ({ ...prev, ...res.branding }));
      }
    } catch {
      /* Offline / unauthenticated: keep the vector defaults. */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const headerLogo = branding.headerLogoUrl || branding.logoUrl || null;
  const loginLogo = branding.loginLogoUrl || branding.logoUrl || null;

  return (
    <BrandingContext.Provider value={{ branding, refresh, headerLogo, loginLogo }}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Safe read: a missing provider (SSR harnesses) returns vector defaults. */
export function useBranding(): BrandingContextType {
  const ctx = useContext(BrandingContext);
  if (ctx) return ctx;
  return {
    branding: DEFAULT_BRANDING,
    refresh: async () => {},
    headerLogo: null,
    loginLogo: null,
  };
}
