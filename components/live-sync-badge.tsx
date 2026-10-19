'use client';

import { CircleAlert, Radio, RefreshCw } from 'lucide-react';
import type { LiveDataState } from '@/lib/live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveSyncBadge({ state, fetchedAt, dark = false, onRetry }: { state: LiveDataState; fetchedAt?: string; dark?: boolean; onRetry?: () => void }) {
  const { locale, t } = useLocale();
  const base = dark ? 'border-white/20 bg-white/8 text-white/75' : 'border-border bg-card text-muted-foreground';
  const validDate = fetchedAt && Number.isFinite(Date.parse(fetchedAt));
  const date = validDate ? new Date(fetchedAt!) : null;
  const time = date ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) : '';
  const fullTime = date ? `${new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)} UTC+8` : '';
  if (state === 'loading') {
    const description = t('正在检查公开来源，先显示可用记录。', 'Checking public sources; available records are shown first.');
    return <span title={description} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${base}`}><RefreshCw className="size-3 shrink-0 animate-spin" aria-hidden="true" />{t('更新中', 'Updating')}<span className="sr-only"> · {description}</span></span>;
  }
  if (state === 'fallback') {
    const description = t(`公开来源暂不可用，当前显示缓存记录。${fullTime ? `记录时间：${fullTime}。` : ''}`, `Public sources are unavailable; cached records are shown.${fullTime ? ` Record time: ${fullTime}.` : ''}`);
    return <span title={description} className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900"><CircleAlert className="size-3 shrink-0" aria-hidden="true" />{t('缓存', 'Cached')}<span className="sr-only"> · {description}</span>{onRetry && <button type="button" onClick={onRetry} className="touch-target rounded-lg px-2 underline underline-offset-4">{t('重试', 'Retry')}</button>}</span>;
  }
  const description = t(`${fullTime ? `来源读取于 ${fullTime}。` : ''}读取时间不等于每个字段的更新时间，详见数据说明。`, `${fullTime ? `Sources checked at ${fullTime}. ` : ''}This is not the update time of every field; see Methodology.`);
  return <span title={description} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${dark ? 'border-[#7fe0bc]/30 bg-[#00cc8e]/10 text-[#7fe0bc]' : 'border-primary/25 bg-secondary text-primary'}`}><Radio className="size-3 shrink-0" aria-hidden="true" />{t('实时', 'Live')}{time ? ` · ${time}` : ''}<span className="sr-only"> · {description}</span></span>;
}
