'use client';

import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';
import { collectionHealthState, collectionObservationTime, emptyCollectionHealth, COLLECTION_WORKFLOW_URL, type CollectionHealth } from '@/lib/collection-health';

export function CollectionFreshnessNotice() {
  const { locale, t } = useLocale();
  const [report, setReport] = useState<CollectionHealth | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort(); const requestController = new AbortController(); controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 15_000);
      try {
        const response = await fetch('/api/collection-health', { signal: requestController.signal });
        const next = await response.json() as CollectionHealth;
        if (!response.ok || next.version !== 1 || !next.sources || !next.schedule) throw new Error('Unavailable');
        if (active) { setReport(next); setNow(Date.now()); }
      } catch {
        if (active) { setReport(previous => previous ? { ...previous, available: false } : emptyCollectionHealth()); setNow(Date.now()); }
      } finally { window.clearTimeout(timeout); }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); };
  }, []);
  if (!report || now === null) return null;
  const freshness = collectionHealthState(report, now);
  if (freshness.state === 'fresh') return null;
  const format = (value: string | null) => value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) + ' UTC+8'
    : t('未核验', 'Unverified');
  return <aside data-collection-health={freshness.state} role="status" className="border-b border-amber-300 bg-amber-50 text-amber-950">
    <div className="mx-auto flex max-w-7xl items-start gap-3 px-5 py-3 lg:px-8">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-6">
        <p className="font-semibold">{freshness.state === 'stale' ? t('自动采集存在延迟，请核对以下时间。', 'Automatic collection is delayed; check the times below.') : t('自动采集时间暂无法完整核验。', 'Collection freshness cannot currently be fully verified.')}</p>
        {freshness.schedule !== 'fresh' && <p>{t('最近 GitHub 原生定时运行：', 'Last native GitHub scheduled run: ')}{format(report.schedule.lastRunAt)}</p>}
        {report.backup?.enabled && <p>{t('Cloudflare 备用调度最近检查：', 'Cloudflare backup last checked: ')}{format(report.backup.lastCheckAt)}</p>}
        <p className="break-words">{t('最近成功采集：', 'Last successful collection: ')}{t('投票 ', 'Votes ')}{format(collectionObservationTime(report.sources.votes))}{t('；治理 ', '; Governance ')}{format(collectionObservationTime(report.sources.governance))}{t('；国库 ', '; Treasury ')}{format(collectionObservationTime(report.sources.treasury))}</p>
        <p>{t('页面保留最后可用记录，可能尚未包含后续变化。', 'The last available records are retained and may not include later changes.')} <a href={report.schedule.runUrl ?? COLLECTION_WORKFLOW_URL} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{t('查看采集记录', 'View collection records')}</a></p>
      </div>
    </div>
  </aside>;
}
