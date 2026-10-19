'use client';

import { ArrowRight } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { getProposalStatusTags } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveProjectStats() {
  const { data, state } = useLiveDataset();
  const { t } = useLocale();
  const items = [
    { key: 'all', count: data.proposals.length, zh: '全部提案', en: 'All proposals', query: '' },
    { key: 'funded', count: data.proposals.filter((proposal) => proposal.funded).length, zh: '已资助', en: 'Funded', query: '?funded=1' },
    { key: 'governance', count: data.proposals.filter((proposal) => proposal.projectType === 'Governance').length, zh: '治理提案', en: 'Governance', query: '?type=Governance' },
    { key: 'discussion', count: data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('discussion')).length, zh: '讨论中', en: 'Discussion', query: '?status=discussion' },
    { key: 'voting', count: data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('voting')).length, zh: '正在投票', en: 'Voting now', query: '?status=voting' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((item) => <a key={item.key} href={`/projects${item.query}#proposal-directory`} aria-label={t(`查看${item.zh}：${item.count} 份`, `View ${item.en.toLowerCase()}: ${item.count} proposals`)} className="group flex min-h-20 items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 transition hover:border-[#7fe0bc]/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fe0bc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f0e]">
          <div><p className={`font-mono text-2xl font-semibold tabular-nums ${item.key === 'all' ? 'text-[#c8ff67]' : 'text-white'}`}>{item.count}</p><p className="mt-1 text-xs font-medium text-white/80"><I18nText zh={item.zh} en={item.en} /></p></div><ArrowRight className="size-4 shrink-0 text-white/65 transition group-hover:translate-x-0.5 group-hover:text-[#7fe0bc]" aria-hidden="true" />
        </a>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/75"><I18nText zh="全站概况：资助、类型和阶段是不同维度，数量可能重叠。点击数字可筛选。" en="Whole-directory overview. Funding, type, and stage overlap; these counts are not additive. Select a count to filter." />{state === 'loading' && <> <I18nText zh="正在显示缓存记录，实时数据读取中。" en="Showing cached records while live data loads." /></>}{state === 'fallback' && <> <I18nText zh="来源暂不可用，当前为最近可用记录。" en="The source is unavailable; these are the latest available records." /></>}</p>
    </div>
  );
}
