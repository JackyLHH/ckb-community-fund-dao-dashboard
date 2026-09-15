'use client';

import { CheckCircle2 } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { useLiveDataset } from '@/lib/use-live-data';

export function LiveMethodologyStatus() {
  const { data, state } = useLiveDataset();
  return (
    <div className="mt-12 flex items-start gap-3 rounded-[20px] border border-[#00a873]/20 bg-[#eaf8f1] p-5">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#087958]" />
      <div>
        <LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} />
        <p className="mt-3 text-sm leading-6 text-black/58">
          <I18nText
            zh={<>提案目录、互动数据和提案详情在每次打开网站时重新读取。DAO 余额优先读取公布地址的链上余额；已资助清单本身最后更新于 {data.treasury.forumAsOf ?? data.treasury.asOf}。来源暂时不可用时，网站会明确提示并回退到最近一次可用快照。</>}
            en={<>The proposal directory, interaction metrics, and proposal details are refreshed whenever the site opens. The DAO balance comes from the published on-chain address; the funded proposals list itself was last updated on {data.treasury.forumAsOf ?? data.treasury.asOf}. If a source is unavailable, the site clearly falls back to the latest snapshot.</>}
          />
        </p>
      </div>
    </div>
  );
}
