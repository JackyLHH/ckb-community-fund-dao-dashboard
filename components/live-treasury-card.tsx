'use client';

import { Landmark } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveTreasuryCard() {
  const { data, state } = useLiveDataset();
  const { t } = useLocale();
  const treasury = data.treasury;

  return (
    <a href="#treasury-history" aria-labelledby="treasury-balance-heading" aria-describedby="treasury-card-help" className="block rounded-[28px] border border-white/12 bg-white/[.07] p-6 shadow-2xl backdrop-blur transition hover:border-[#7fe0bc]/50 hover:bg-white/[.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff67] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b0f0e] sm:p-8">
      <div className="mb-5"><LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} dark /></div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p id="treasury-balance-heading" className="label-caps text-white/75"><I18nText zh="国库余额" en="Treasury balance" /></p>
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
      <span id="treasury-card-help" className="sr-only"><I18nText zh="查看国库余额与支出" en="View treasury balance and spending" /></span>
    </a>
  );
}
