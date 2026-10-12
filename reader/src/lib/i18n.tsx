import { createContext, useContext, useMemo, type ReactNode } from 'react';
import english from '../locales/en.json';
import contentEnglish from '../locales/content.en.json';

export type Language = 'es' | 'en';
export const LANGUAGE_KEY = 'yomustory.interface.language.v1';
export function loadLanguage(): Language {
  try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'es'; }
  catch { return 'es'; }
}
const translations: Record<string, string> = { ...contentEnglish, ...english };
// Templates keep interpolated values (Japanese headwords, counts) out of catalogs.
const templates = Object.entries(translations).filter(([key]) => key.includes('{0}')).map(([key, value]) => ({
  pattern: new RegExp('^' + key.split(/(\{\d+\})/).map((part) => /^\{\d+\}$/.test(part)
    ? '(.*?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$'), value,
}));
export function translate(source: string, language: Language): string {
  if (language === 'es') return source;
  const key = source.trim();
  const direct = translations[key];
  if (direct) return source.replace(key, direct);
  for (const { pattern, value } of templates) {
    const match = key.match(pattern);
    if (match) return source.replace(key, value.replace(/\{(\d+)\}/g, (_, i: string) => {
      const captured = match[Number(i) + 1];
      // Only these UI action words need translation inside a template. Preserve
      // Japanese headwords even when they also happen to be topic catalog keys.
      return captured === 'Mostrar' ? 'Show' : captured === 'Ocultar' ? 'Hide' : captured;
    }));
  }
  return source;
}
const LanguageContext = createContext<Language>('es');
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}
export function useI18n() {
  const language = useContext(LanguageContext);
  return useMemo(() => ({ language, t: (source: string) => translate(source, language) }), [language]);
}
