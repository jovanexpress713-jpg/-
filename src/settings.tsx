import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getDictionary, type Translations } from "./localization/translations";

export type Lang = "ar" | "en";
export type Theme = "dark" | "light";

interface Settings {
  lang: Lang;
  theme: Theme;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (en: string, ar: string) => string;
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
  const [lang, setLang] = useState<Lang>(() =>
    read("ejaz-lang", "ar") === "en" ? "en" : "ar",
  );
  const [theme, setTheme] = useState<Theme>(() =>
    read("ejaz-theme", "dark") === "light" ? "light" : "dark",
  );

  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const tr = getDictionary(lang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
    html.setAttribute("data-theme", theme);
    write("ejaz-lang", lang);
    write("ejaz-theme", theme);
  }, [lang, theme, dir]);

  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  return (
    <Ctx.Provider value={{ lang, theme, dir, setLang, setTheme, t, tr }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  return useContext(Ctx);
}
