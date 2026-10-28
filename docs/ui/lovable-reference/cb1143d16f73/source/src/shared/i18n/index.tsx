import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { tr, type Dict } from "./tr";
import { en } from "./en";
import { de } from "./de";

export type Lang = "tr" | "en" | "de";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "tr", label: "Türkçe" },
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
];
const dicts: Record<Lang, Dict> = { tr, en, de };

const Ctx = createContext<{ t: Dict; lang: Lang; setLang: (l: Lang) => void }>({
  t: tr,
  lang: "tr",
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");
  useEffect(() => {
    const saved = window.localStorage.getItem("kloda-lang") as Lang | null;
    if (saved && saved in dicts) setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("kloda-lang", l);
  };
  return <Ctx.Provider value={{ t: dicts[lang], lang, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Replace {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
