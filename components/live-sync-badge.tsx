'use client';

import { CircleAlert, Radio, RefreshCw } from 'lucide-react';
import type { LiveDataState } from '@/lib/live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveSyncBadge({ state, fetchedAt, dark = false }: { state: LiveDataState; fetchedAt?: string; dark?: boolean }) {
  const { locale, t } = useLocale();
  const base = dark ? 'border-white/12 bg-white/8 text-white/58' : 'border-black/8 bg-white text-black/50';
  if (state === 'loading') {
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${base}`}><RefreshCw className="size-3 animate-spin" />{t('正在读取公开来源', 'Reading public sources')}</span>;
  }
  if (state === 'fallback') {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800"><CircleAlert className="size-3" />{t('来源暂不可用 · 显示最近快照', 'Source unavailable · Showing latest snapshot')}</span>;
  }
  const time = fetchedAt ? new Date(fetchedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${dark ? 'border-[#7fe0bc]/25 bg-[#00cc8e]/10 text-[#7fe0bc]' : 'border-[#00a873]/20 bg-[#e3f8ef] text-[#087958]'}`}><Radio className="size-3" />{t('实时读取', 'Live')}{time ? ` · ${time}` : ''}</span>;
}
