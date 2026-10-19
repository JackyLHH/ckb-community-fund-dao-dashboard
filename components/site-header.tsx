'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StaticLink as Link } from '@/components/static-link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { useLocale } from '@/lib/use-locale';

const pages = [
  { href: '/', zh: '总览', en: 'Overview' },
  { href: '/projects', zh: '提案', en: 'Proposals' },
  { href: '/#subscribe', zh: '订阅', en: 'Subscribe' },
  { href: '/methodology', zh: '数据说明', en: 'Methodology' },
];
const subscribePath = (sync: () => void) => {
  window.addEventListener('popstate', sync);
  return () => window.removeEventListener('popstate', sync);
};

export function SiteHeader() {
  const { t } = useLocale();
  const path = useSyncExternalStore(subscribePath, () => window.location.pathname, () => '');
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const active = (href: string) => href === '/projects' ? path === '/projects' || path === '/project' : path === href;
  return <>
    <a className="skip-link" href="#main-content"><I18nText zh="跳到主要内容" en="Skip to content" /></a>
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-2 lg:px-8">
        <Link href="/" className="touch-target flex shrink-0 items-center gap-3 rounded-xl" aria-label={t('CKB Community Fund DAO 首页', 'CKB Community Fund DAO home')}>
          <span className="grid size-10 place-items-center rounded-xl bg-[#0b0f0e] text-xs font-black text-[#c8ff67]">CKB</span>
          <span className="hidden text-sm font-bold tracking-tight sm:block">Community Fund DAO</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm lg:flex" aria-label={t('主导航', 'Main navigation')}>
          {pages.map(page => <Link key={page.href} href={page.href} aria-current={active(page.href) ? 'page' : undefined}
            className={`touch-target inline-flex items-center rounded-xl px-4 font-semibold transition ${active(page.href) ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <I18nText zh={page.zh} en={page.en} />
          </Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitch /><LanguageSwitch />
          <button ref={menuButton} type="button" className="touch-target grid place-items-center rounded-xl border border-border bg-card lg:hidden" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? t('关闭导航', 'Close navigation') : t('打开导航', 'Open navigation')} onClick={() => setOpen(!open)}>
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav hidden={!open} id="mobile-navigation" aria-label={t('手机导航', 'Mobile navigation')} className="border-t border-border px-4 py-3 lg:hidden">
        {pages.map(page => <Link key={page.href} href={page.href} onClick={() => setOpen(false)} aria-current={active(page.href) ? 'page' : undefined} className={`touch-target flex items-center rounded-xl px-4 font-semibold ${active(page.href) ? 'bg-secondary text-primary' : 'hover:bg-secondary'}`}><I18nText zh={page.zh} en={page.en} /></Link>)}
        <a href="https://talk.nervos.org/c/daos-funding/ckb-community-fund-dao/65" target="_blank" rel="noreferrer" className="touch-target flex items-center gap-2 rounded-xl px-4 hover:bg-secondary">Nervos Talk <ArrowUpRight className="size-4" aria-hidden="true" /><span className="sr-only">{t('在新标签页打开', 'opens in a new tab')}</span></a>
      </nav>
    </header>
  </>;
}
