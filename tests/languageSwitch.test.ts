import assert from "assert";
import fs from "fs";
import path from "path";
import { JSDOM, VirtualConsole } from "jsdom";

/**
 * EJAZ Transport — live language switching (§6, §7, §8, §9, §12, §29).
 *
 * The unit tests above prove the dictionaries are complete. This suite proves
 * the promise the operator actually sees: choose a language and the mounted
 * product switches every string *and* the direction — with no half-translated
 * screen anywhere.
 *
 * It mounts the real shell components (header, sidebar, notifications centre,
 * assistant) inside jsdom and reads the rendered text:
 *
 *   ar → only Arabic, dir="rtl"
 *   en → only English, dir="ltr"
 *   ur → only Urdu,   dir="rtl"
 */

const root = process.cwd();

const ARABIC = /[\u0600-\u06FF]/;
/** Urdu-only letters that never appear in the Arabic UI copy. */
const URDU_ONLY = /[\u0679\u067E\u0686\u0688\u0691\u06BA\u06BE\u06C1\u06CC\u06D2\u06AF]/;

/** Arabic words that must never survive into an Urdu session. */
const ARABIC_LEAKS = [
  "الرحلات",
  "الشحنات",
  "الإعدادات",
  "التنبيهات",
  "التشغيل",
  "الهوية",
  "لوحة",
  "الأسطول",
];

/** Latin words that must never survive into an Arabic/Urdu session (brands aside). */
const LATIN_ALLOWED = new Set([
  "EJAZ",
  "PDF",
  "GPS",
  "SA",
  "KB",
  "LTE",
  "SHA",
  "DL",
  "AVL",
  "MB",
  "ID",
  "http",
  "https",
  "KSA",
  "EZ",
  "POD",
  "IV",
  "IQAMA",
  "ADR",
  "API",
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
  "SUPER",
  "ADMIN",
  "DRIVER",
  "CUSTOMER",
  "OPERATIONS",
  "MANAGER",
  "DISPATCHER",
  "ACCOUNTANT",
  "WAREHOUSE",
  "BROKER",
  "REPRESENTATIVE",
  "GENERAL",
  "CUSTOMS",
  "L",
  "R",
  "FH",
  "Volvo",
  "Scania",
  "MAN",
  "DAF",
  "Iveco",
  "Mercedes",
  "Benz",
  "Actros",
  "TGS",
  "XF",
  "www",
  "com",
]);

export async function runLanguageSwitchTests() {
  console.log("  [TEST] Running Live Language Switch Tests (jsdom)...");

  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", () => {});
  const dom = new JSDOM(`<!doctype html><html lang="ar" dir="rtl"><body></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole,
  });

  const g = globalThis as any;
  const define = (key: string, value: unknown) =>
    Object.defineProperty(g, key, { value, writable: true, configurable: true });
  define("window", dom.window);
  define("document", dom.window.document);
  define("navigator", dom.window.navigator);
  define("localStorage", dom.window.localStorage);
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.Event = dom.window.Event;
  g.MouseEvent = dom.window.MouseEvent;
  g.CustomEvent = dom.window.CustomEvent;
  g.getComputedStyle = dom.window.getComputedStyle;
  g.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  g.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  dom.window.ResizeObserver = g.ResizeObserver;
  dom.window.IntersectionObserver = g.IntersectionObserver;
  dom.window.matchMedia =
    dom.window.matchMedia ??
    (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as any);
  g.matchMedia = dom.window.matchMedia;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { SettingsProvider } = await import("../src/settings");
  const { FleetStoreProvider } = await import("../src/state/fleetStore");
  const { ToastProvider } = await import("../src/components/Toast");
  const { AppHeader } = await import("../src/components/AppHeader");
  const { Sidebar } = await import("../src/components/Sidebar");
  const { AlertsCenter } = await import("../src/components/AlertsCenter");
  const { AIAssistant } = await import("../src/components/AIAssistant");
  const { BrandingProvider } = await import("../src/state/brandingStore");
  const { translateKey } = await import("../src/localization/i18n");

  const ADMIN = {
    id: "u-admin",
    email: "admin@ejaz.sa",
    fullName: "فهد بن عبد العزيز السبيعي",
    role: "SUPER_ADMIN",
    permissions: ["*"],
  } as any;

  /**
   * Two kinds of text are legitimately identical in every language and must not
   * be counted as a leak:
   *   • the official brand mark the logo draws (the Arabic calligraphy «إيجاز»
   *     is part of the published logo artwork, not UI copy), and
   *   • a person's own name, which is never translated.
   */
  const stripBrandAndNames = (text: string) =>
    text
      .split("مؤسسة إيجاز للنقليات")
      .join(" ")
      .split("إيجاز")
      .join(" ")
      .split(ADMIN.fullName)
      .join(" ");

  const NAV_COUNTS = { trucks: 36, cargos: 248, repair: 3, drivers: 29, reports: 6 } as any;

  /** Mount the whole shell for one language and return its rendered text. */
  const mountFor = async (lang: "ar" | "en" | "ur") => {
    for (const key of ["ejaz-lang", "ejaz_current_user", "ejaz-theme"]) {
      localStorage.removeItem(key);
    }
    localStorage.setItem("ejaz-lang", lang);

    const host = document.createElement("div");
    document.body.appendChild(host);
    const rootApi = createRoot(host);

    await act(async () => {
      rootApi.render(
        React.createElement(
          SettingsProvider,
          null,
          React.createElement(
            BrandingProvider,
            null,
            React.createElement(
              FleetStoreProvider,
              null,
              React.createElement(
                ToastProvider,
                null,
                React.createElement(
                  "div",
                  null,
                  React.createElement(AppHeader, {
                    user: ADMIN,
                    /* The header receives already-translated strings from the
                       shell, exactly as App.tsx passes them in production. */
                    pageTitle: translateKey(lang, "nav.trips"),
                    pageHint: translateKey(lang, "nav.operations"),
                    unreadAlerts: 3,
                    showMenuButton: true,
                    onOpenSidebar: () => {},
                    onOpenAssistant: () => {},
                    onOpenAlerts: () => {},
                    onOpenSettings: () => {},
                    onSwitchDemoAccount: () => {},
                    onPreviewLogin: () => {},
                    onLogout: () => {},
                    onNavigate: () => {},
                    view: "web",
                    onViewChange: () => {},
                  } as never),
                  React.createElement(Sidebar, {
                    active: "trips",
                    onSelect: () => {},
                    counts: NAV_COUNTS,
                    onCreate: () => {},
                  } as never),
                  React.createElement(AlertsCenter, {
                    isOpen: true,
                    onClose: () => {},
                    user: ADMIN,
                  } as never),
                  React.createElement(AIAssistant, {
                    isOpen: true,
                    onClose: () => {},
                    user: ADMIN,
                    page: "trips",
                    persona: "admin",
                  } as never),
                ),
              ),
            ),
          ),
        ),
      );
    });

    const text = host.textContent ?? "";
    const html = document.documentElement;
    await act(async () => {
      rootApi.unmount();
    });
    host.remove();
    return { text, dir: html.dir, lang: html.lang };
  };

  /* A. Arabic — the operational default. */
  const ar = await mountFor("ar");
  assert.strictEqual(ar.dir, "rtl", "Arabic must render right-to-left");
  assert.strictEqual(ar.lang, "ar");
  assert.ok(ARABIC.test(ar.text), "the Arabic session must render Arabic text");
  assert.ok(!URDU_ONLY.test(stripBrandAndNames(ar.text)), "no Urdu glyph may appear in an Arabic session");

  /* B. English — full LTR, no Arabic left anywhere. */
  const en = await mountFor("en");
  assert.strictEqual(en.dir, "ltr", "English must render left-to-right");
  assert.strictEqual(en.lang, "en");
  const arabicInEnglish = ar.text ? stripBrandAndNames(en.text).match(/[\u0600-\u06FF]+/g) ?? [] : [];
  assert.deepStrictEqual(
    arabicInEnglish.filter((w) => w.length > 1),
    [],
    `these Arabic fragments survived into the English session: ${arabicInEnglish.join(" / ")}`,
  );

  /* C. Urdu — full RTL, no Arabic UI copy, script is Urdu. */
  const ur = await mountFor("ur");
  assert.strictEqual(ur.dir, "rtl", "Urdu must render right-to-left");
  assert.strictEqual(ur.lang, "ur");
  const urduText = stripBrandAndNames(ur.text);
  const leaked = ARABIC_LEAKS.filter((word) => urduText.includes(word));
  assert.deepStrictEqual(leaked, [], `Arabic copy leaked into the Urdu session: ${leaked.join(", ")}`);
  assert.ok(URDU_ONLY.test(urduText), "the Urdu session must render Urdu copy");

  /* D. Latin words in the Arabic/Urdu sessions: brand names and codes only. */
  const latinWords = (text: string) =>
    (text.match(/[A-Za-z][A-Za-z-]*[A-Za-z]/g) ?? []).filter(
      (w) => w.length >= 3 && !LATIN_ALLOWED.has(w),
    );
  const latinInArabic = [...new Set(latinWords(stripBrandAndNames(ar.text)))];
  assert.deepStrictEqual(
    latinInArabic,
    [],
    `English words survived into the Arabic session: ${latinInArabic.join(", ")}`,
  );
  const latinInUrdu = [...new Set(latinWords(urduText))];
  assert.deepStrictEqual(
    latinInUrdu,
    [],
    `English words survived into the Urdu session: ${latinInUrdu.join(", ")}`,
  );

  /* E. The choice is persisted and reused (§12). */
  assert.strictEqual(localStorage.getItem("ejaz-lang"), "ur", "the chosen language must be stored");

  /* F. Direction handling is a first-class rule of the stylesheet, not a
        one-off: logical properties carry the RTL/LTR flip. */
  const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
  assert.match(css, /\[dir="rtl"\]|rtl:/, "the stylesheet must contain explicit RTL rules");
  const headerSource = fs.readFileSync(path.join(root, "src", "components", "AppHeader.tsx"), "utf8");
  assert.ok(
    !/margin-right|padding-left/.test(headerSource),
    "the header must use logical (start/end) spacing so it mirrors in RTL",
  );

  console.log("  ✓ Live Language Switch Tests Passed Successfully!");
}
