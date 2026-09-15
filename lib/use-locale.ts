'use client';

import { useEffect, useState } from 'react';

export type Locale = 'zh' | 'en';
export const localeChangeEvent = 'ckb-dao-locale-change';

export function useLocale() {
  const [locale, setLocale] = useState<Locale>('zh');

  useEffect(() => {
    const sync = () => setLocale(document.documentElement.dataset.locale === 'en' ? 'en' : 'zh');
    sync();
    window.addEventListener(localeChangeEvent, sync);
    return () => window.removeEventListener(localeChangeEvent, sync);
  }, []);

  return {
    locale,
    t: (zh: string, en: string) => locale === 'en' ? en : zh,
  };
}
