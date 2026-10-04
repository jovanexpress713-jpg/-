import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDictionary, type Translations } from "./localization/translations";
import {
  dirOf,
  translateKey,
  type I18nKey,
  type Lang,
} from "./localization/i18n";
import { resolveUrdu } from "./localization/ur.glossary";
import { localizeDataPair, localizeDataText } from "./localization/dataText";

export type { Lang };
export type Theme = "dark" | "light";

export interface Settings {
  lang: Lang;
  theme: Theme;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  /**
   * Legacy inline translation. Existing call sites pass `(en, ar, ur?)`;
   * Urdu now falls back to the central glossary so an Urdu session never shows
   * Arabic text.
   */
  t: (en: string, ar: string, ur?: string) => string;
  /** Central key translation — every new surface uses this. */
  tk: (key: I18nKey, vars?: Record<string, string | number>) => string;
  /**
   * Translate a value that comes from the data layer (Arabic is canonical):
   * «منذ ٢٥ دقيقة» → "25 minutes ago", «الرياض» → "Riyadh"/"ریاض".
   */
  td: (value: string | undefined | null) => string;
  /** Same, for values that ship with an English twin in the record. */
  tdp: (arabic: string | undefined | null, english: string | undefined | null) => string;
  tr: Translations;
}

const Ctx = createContext<Settings>(null!);

const LANG_KEY = "ejaz-lang";
const THEME_KEY = "ejaz-theme";
const USER_KEY = "ejaz_current_user";

const META: Record<Lang, { dir: "rtl" | "ltr"; name: string }> = {
  ar: { dir: "rtl", name: "العربية" },
  en: { dir: "ltr", name: "English" },
  ur: { dir: "rtl", name: "اردو" },
};

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en" || value === "ur";
}

/**
 * Language resolution order on boot:
 *   1. the language saved for the signed-in user (per-user preference),
 *   2. the device/session language,
 *   3. Arabic — the operational default for the control room.
 */
function initialLang(): Lang {
  const user = readJson<{ preferredLanguage?: string }>(USER_KEY);
  if (user && isLang(user.preferredLanguage)) return user.preferredLanguage;
  const saved = read(LANG_KEY, "");
  if (isLang(saved)) return saved;
  return "ar";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  /**
   * Appearance defaults to the light identity (white surfaces, navy ink,
   * orange accents). The explicit device choice always wins, and dark mode is
   * one tap away inside Account → Appearance (§26).
   */
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = read(THEME_KEY, "");
    return saved === "light" || saved === "dark" ? saved : "light";
  });

  const dir = dirOf(lang);
  const tr = useMemo(() => getDictionary(lang), [lang]);

  /** Persist the language on the device *and* on the signed-in user record. */
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    write(LANG_KEY, next);
    const user = readJson<Record<string, unknown>>(USER_KEY);
    if (user && typeof user === "object") {
      try {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify({ ...user, preferredLanguage: next }),
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  /**
   * A sign-in (or an account switch) adopts the language saved on that user's
   * record, so a user who chose اردو once comes back to اردو.
   */
  useEffect(() => {
    const onSignedIn = (event: Event) => {
      const detail = (event as CustomEvent<{ preferredLanguage?: string }>).detail;
      if (isLang(detail?.preferredLanguage)) setLangState(detail.preferredLanguage);
    };
    window.addEventListener("ejaz:user-signed-in", onSignedIn);
    return () => window.removeEventListener("ejaz:user-signed-in", onSignedIn);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
    html.setAttribute("data-lang", lang);
    write(LANG_KEY, lang);
  }, [lang, dir]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    write(THEME_KEY, theme);
  }, [theme]);

  const t = useCallback(
    (en: string, ar: string, ur?: string) => {
      if (lang === "ar") return ar;
      if (lang === "en") return en;
      return resolveUrdu(en, ar, ur);
    },
    [lang],
  );

  const tk = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) =>
      translateKey(lang, key, vars),
    [lang],
  );

  const td = useCallback((value: string | undefined | null) => localizeDataText(value, lang), [lang]);
  const tdp = useCallback(
    (arabic: string | undefined | null, english: string | undefined | null) =>
      localizeDataPair(arabic, english, lang),
    [lang],
  );

  const value = useMemo<Settings>(
    () => ({ lang, theme, dir, setLang, setTheme, t, tk, td, tdp, tr }),
    [lang, theme, dir, setLang, t, tk, td, tdp, tr],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}

/** Language metadata (name + direction) for menus that list all three. */
export function languageMeta(lang: Lang) {
  return META[lang];
}
