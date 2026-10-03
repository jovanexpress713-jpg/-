import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getDictionary, type Translations } from "./localization/translations";

export type Lang = "ar" | "en" | "ur";
export type Theme = "dark" | "light";

interface Settings {
  lang: Lang;
  theme: Theme;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (en: string, ar: string, ur?: string) => string;
  tr: Translations;
}

const Ctx = createContext<Settings>(null!);

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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = read("ejaz-lang", "ar");
    if (saved === "en" || saved === "ur") return saved;
    return "ar";
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = read("ejaz-theme", "");
    if (saved === "light" || saved === "dark") return saved;
    const prefersLight =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  });

  const dir: "rtl" | "ltr" = lang === "en" ? "ltr" : "rtl";
  const tr = getDictionary(lang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
    html.setAttribute("data-theme", theme);
    write("ejaz-lang", lang);
    write("ejaz-theme", theme);
  }, [lang, theme, dir]);

  const t = (en: string, ar: string, ur?: string) => {
    if (lang === "ur") return ur || ar;
    if (lang === "ar") return ar;
    return en;
  };

  return (
    <Ctx.Provider value={{ lang, theme, dir, setLang, setTheme, t, tr }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  return useContext(Ctx);
}
