'use client';

import { CircleAlert, Radio, RefreshCw } from 'lucide-react';
import type { LiveDataState } from '@/lib/live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveSyncBadge({ state, fetchedAt, dark = false, onRetry }: { state: LiveDataState; fetchedAt?: string; dark?: boolean; onRetry?: () => void }) {
  const { locale, t } = useLocale();
  const base = dark ? 'border-white/20 bg-white/8 text-white/75' : 'border-border bg-card text-muted-foreground';
  const validDate = fetchedAt && Number.isFinite(Date.parse(fetchedAt));
  const time = validDate ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(fetchedAt!)) : '';
  if (state === 'loading') {
    return <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${base}`}><RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />{t('正在读取公开来源 · 先显示可用记录', 'Checking sources · Available records shown first')}</span>;
  }
  if (state === 'fallback') {
    return <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />{t('来源暂不可用 · 显示缓存记录', 'Source unavailable · Cached records shown')}{time && <span>{time} UTC+8</span>}{onRetry && <button type="button" onClick={onRetry} className="touch-target rounded-lg px-2 underline underline-offset-4">{t('重试', 'Retry')}</button>}</span>;
  }
  return <span title={t('这是本次来源读取时间，并非每个字段的更新时间。字段来源与日期见数据说明。', 'This is the source-check time, not the update time of every field. See Methodology for field sources and dates.')} className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${dark ? 'border-[#7fe0bc]/30 bg-[#00cc8e]/10 text-[#7fe0bc]' : 'border-primary/25 bg-secondary text-primary'}`}><Radio className="size-3.5 shrink-0" aria-hidden="true" />{t('已读取可用来源', 'Available sources checked')}{time ? ` · ${time} UTC+8` : ''}</span>;
}
