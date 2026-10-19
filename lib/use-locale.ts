'use client';

import { useSyncExternalStore } from 'react';

export type Locale = 'zh' | 'en';
export const localeChangeEvent = 'ckb-dao-locale-change';

function subscribeLocale(sync: () => void) {
  window.addEventListener(localeChangeEvent, sync);
  return () => window.removeEventListener(localeChangeEvent, sync);
}

function currentLocale(): Locale {
  return document.documentElement.dataset.locale === 'en' ? 'en' : 'zh';
}

export function useLocale() {
  // Matches static HTML during hydration, then synchronously adopts the
  // pre-paint preference. Unlike a delayed effect this avoids a second frame.
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, (): Locale => 'zh');

  return {
    locale,
    t: (zh: string, en: string) => locale === 'en' ? en : zh,
  };
}
