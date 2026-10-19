'use client';

import { ArrowUpRight, Landmark } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveTreasuryCard() {
  const { data, state } = useLiveDataset();
  const { t } = useLocale();
  const treasury = data.treasury;
  const balanceLink = treasury.addressUrl ?? treasury.sourceUrl;

  return (
    <div className="rounded-[28px] border border-white/12 bg-white/[.07] p-6 shadow-2xl backdrop-blur sm:p-8">
      <div className="mb-5"><LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} dark /></div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="label-caps text-white/75"><I18nText zh="国库余额" en="Treasury balance" /></p>
          <p className="mt-4 whitespace-nowrap font-mono text-[clamp(1.25rem,3.2vw,2.6rem)] font-semibold tracking-[-.04em] text-[#c8ff67]">
            {Number(treasury.remainingCkb).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          </p>
          <p className="mt-1 text-sm text-white/75"><I18nText zh="剩余 CKB" en="CKB remaining" /></p>
        </div>
        <Landmark className="hidden size-7 shrink-0 text-[#7fe0bc] sm:block" aria-hidden="true" />
      </div>
      <meter aria-label={t('国库剩余比例', 'Treasury remaining percentage')} min={0} max={100} value={Math.min(100, Math.max(0, treasury.remainingPercent))} className="sr-only">{treasury.remainingPercent}%</meter>
      <div aria-hidden="true" className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#00cc8e] transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, treasury.remainingPercent))}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-white/75">
        <span><I18nText zh={`剩余 ${treasury.remainingPercent}%`} en={`${treasury.remainingPercent}% remaining`} /></span>
        <span><I18nText zh="初始持有资金 2.76 亿 CKB" en="Initial · 276M CKB" /></span>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
        <div>
          <p className="font-mono text-2xl font-semibold">{treasury.fundedProposalCount}</p>
          <p className="mt-1 text-sm text-white/75"><I18nText zh="已资助提案" en="Funded proposals" /></p>
        </div>
        <div>
          <p className="font-mono text-lg font-semibold">{treasury.asOf.replaceAll('-', '.')}</p>
          <p className="mt-1 text-sm text-white/75"><I18nText zh={treasury.balanceSource === 'chain' ? '链上余额读取日期' : '论坛余额快照日期'} en={treasury.balanceSource === 'chain' ? 'On-chain balance read date' : 'Forum balance snapshot date'} /></p>
        </div>
      </div>
      <a href={balanceLink} target="_blank" rel="noreferrer" className="touch-target mt-2 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[#7fe0bc] hover:text-[#c8ff67]">
        <I18nText zh="查看余额来源" en="View balance source" /> <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  );
}
