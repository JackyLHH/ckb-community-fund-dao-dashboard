'use client';

import { Info } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { useLiveDataset } from '@/lib/use-live-data';

export function LiveMethodologyStatus() {
  const { data, state } = useLiveDataset();
  return (
    <div className="mt-10 flex items-start gap-3 rounded-[20px] border border-border bg-secondary p-5">
      <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} />
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <I18nText
            zh={<>打开网站时会尝试读取公开来源，并使用短期缓存减少等待；“来源读取时间”不等于每个字段的更新时间。DAO 余额优先读取链上地址，余额来源日期为 {data.treasury.asOf}；已资助清单更新于 {data.treasury.forumAsOf ?? data.treasury.asOf}。自动投票核验、人工审校和原帖活动有各自的时间。来源暂不可用时会显示缓存记录，不应将其视为刚刚更新的数据。</>}
            en={<>Opening the site checks public sources, using short-lived caches to reduce waiting. The source-check time is not the update time of every field. The balance prioritizes the on-chain address and is dated {data.treasury.asOf}; the funding list is dated {data.treasury.forumAsOf ?? data.treasury.asOf}. Vote checks, manual reviews, and forum activity have separate timestamps. Cached records shown during source outages should not be mistaken for newly updated data.</>}
          />
        </p>
      </div>
    </div>
  );
}
