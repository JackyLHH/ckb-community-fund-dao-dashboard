'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';
import { applyTheme, safeStore, type ThemePreference } from '@/lib/ui-preferences';

function subscribeTheme(sync: () => void) {
  window.addEventListener('ckb-dao-theme-change', sync);
  return () => window.removeEventListener('ckb-dao-theme-change', sync);
}
function currentTheme(): ThemePreference {
  const saved = document.documentElement.dataset.theme;
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}
function currentDark() {
  return document.documentElement.classList.contains('dark');
}
export function ThemeSwitch() {
  const { t } = useLocale();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, (): ThemePreference => 'system');
  const dark = useSyncExternalStore(subscribeTheme, currentDark, () => false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => { if (document.documentElement.dataset.theme === 'system') applyTheme('system'); };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const Icon = dark ? Moon : Sun;
  return <label className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-ring">
    <Icon className="pointer-events-none size-4" aria-hidden="true" />
    <span className="sr-only">{t('外观', 'Appearance')}</span>
    <select aria-label={t('选择外观', 'Choose appearance')} value={theme} onChange={(event) => {
      const next = event.target.value as ThemePreference;
      safeStore('ckb-dao-theme', next); applyTheme(next);
    }} className="absolute inset-0 cursor-pointer rounded-xl opacity-0">
      <option value="system">{t('跟随系统', 'System')}</option>
      <option value="light">{t('浅色', 'Light')}</option>
      <option value="dark">{t('深色', 'Dark')}</option>
    </select>
  </label>;
}
