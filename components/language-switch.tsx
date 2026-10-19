'use client';

import { Languages } from 'lucide-react';
import { localeChangeEvent, useLocale } from '@/lib/use-locale';
import { safeStore } from '@/lib/ui-preferences';

export function LanguageSwitch() {
  const { locale } = useLocale();

  function toggle() {
    const nextLocale = document.documentElement.dataset.locale === 'en' ? 'zh' : 'en';
    safeStore('ckb-dao-locale', nextLocale);
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.lang = nextLocale === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new Event(localeChangeEvent));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="touch-target inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-bold transition hover:bg-secondary"
      aria-label="切换中文或英文 / Switch language"
    >
      <Languages className="size-4" aria-hidden="true" />
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
