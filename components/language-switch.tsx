'use client';

import { useEffect } from 'react';
import { Languages } from 'lucide-react';
import { localeChangeEvent, useLocale } from '@/lib/use-locale';

export function LanguageSwitch() {
  const { locale } = useLocale();

  useEffect(() => {
    const stored = window.localStorage.getItem('ckb-dao-locale');
    const nextLocale = stored === 'en' ? 'en' : 'zh';
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.lang = nextLocale === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new Event(localeChangeEvent));
  }, []);

  function toggle() {
    const nextLocale = document.documentElement.dataset.locale === 'en' ? 'zh' : 'en';
    window.localStorage.setItem('ckb-dao-locale', nextLocale);
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.lang = nextLocale === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new Event(localeChangeEvent));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-bold transition hover:border-[#00a873]/50 hover:text-[#087958]"
      aria-label="切换中文或英文 / Switch language"
    >
      <Languages className="size-3.5" aria-hidden="true" />
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
