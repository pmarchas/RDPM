import { createContext, useContext } from 'react';
import { tr } from './i18n';

export const LanguageContext = createContext('es');

/** Hook: const t = useT();  →  t('key') or t('key', { n: 5 }) */
export function useT() {
  const lang = useContext(LanguageContext);
  return (key, vars) => tr(lang, key, vars);
}
