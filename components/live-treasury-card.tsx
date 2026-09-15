'use client';

import { ArrowUpRight, Landmark } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { useLiveDataset } from '@/lib/use-live-data';

export function LiveTreasuryCard() {
  const { data, state } = useLiveDataset();
  const treasury = data.treasury;
  const balanceLink = treasury.addressUrl ?? treasury.sourceUrl;

  return (
    <div className="rounded-[28px] border border-white/12 bg-white/[.07] p-6 shadow-2xl backdrop-blur sm:p-8">
      <div className="mb-5"><LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} dark /></div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="label-caps text-white/45"><I18nText zh="国库余额" en="Treasury balance" /></p>
          <p className="mt-4 font-mono text-[clamp(2rem,5vw,4rem)] font-semibold tracking-[-.06em] text-[#c8ff67]">
            {Number(treasury.remainingCkb).toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-sm text-white/50"><I18nText zh="剩余 CKB" en="CKB remaining" /></p>
        </div>
        <Landmark className="size-7 text-[#7fe0bc]" aria-hidden="true" />
      </div>
      <div className="mt-9 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#00cc8e] transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, treasury.remainingPercent))}%` }} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-white/48">
        <span><I18nText zh={`剩余 ${treasury.remainingPercent}%`} en={`${treasury.remainingPercent}% remaining`} /></span>
        <span><I18nText zh="初始持有资金 2.76 亿 CKB" en="Initial · 276M CKB" /></span>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
        <div>
          <p className="font-mono text-2xl font-semibold">{treasury.fundedProposalCount}</p>
          <p className="mt-1 text-xs text-white/45"><I18nText zh="已资助提案" en="Funded proposals" /></p>
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold">{treasury.asOf.replaceAll('-', '.')}</p>
          <p className="mt-1 text-xs text-white/45"><I18nText zh="余额读取日期" en="Balance read date" /></p>
        </div>
      </div>
      <a href={balanceLink} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#7fe0bc] hover:text-[#c8ff67]">
        <I18nText zh="查看余额来源" en="View balance source" /> <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  );
}
