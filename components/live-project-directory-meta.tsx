'use client';

import { Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { getProposalStatusTags } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';

export function LiveProjectStats() {
  const { data } = useLiveDataset();
  const fundedCount = data.proposals.filter((proposal) => proposal.funded).length;
  const governanceCount = data.proposals.filter((proposal) => proposal.projectType === 'Governance').length;
  const discussionCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('discussion')).length;
  const votingCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('voting')).length;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
      <div><p className="font-mono text-2xl font-semibold text-[#c8ff67]">{data.meta.proposalCount}</p><p className="mt-1 text-[11px] text-white/40"><I18nText zh="提案" en="Proposals" /></p></div>
      <div><p className="font-mono text-2xl font-semibold">{fundedCount}</p><p className="mt-1 text-[11px] text-white/40"><I18nText zh="已资助" en="Funded" /></p></div>
      <div><p className="font-mono text-2xl font-semibold">{governanceCount}</p><p className="mt-1 text-[11px] text-white/40"><I18nText zh="治理提案" en="Governance Proposals" /></p></div>
      <div><p className="font-mono text-2xl font-semibold">{discussionCount}</p><p className="mt-1 text-[11px] text-white/40"><I18nText zh="讨论中" en="Discussion" /></p></div>
      <div><p className="font-mono text-2xl font-semibold">{votingCount}</p><p className="mt-1 text-[11px] text-white/40"><I18nText zh="正在投票" en="Voting now" /></p></div>
    </div>
  );
}

export function LiveDirectoryFacts() {
  const { data, state } = useLiveDataset();
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3">
        <Database className="size-4 text-[#087958]" />
        <div><p className="text-xs font-bold"><I18nText zh={`${data.meta.proposalCount} 份提案记录`} en={`${data.meta.proposalCount} proposal records`} /></p><p className="mt-0.5 text-[11px] text-black/40"><I18nText zh="实时读取 Nervos Talk 分类页" en="Read live from Nervos Talk" /></p></div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3">
        <ShieldCheck className="size-4 text-[#087958]" />
        <div><p className="text-xs font-bold"><I18nText zh="证据优先" en="Evidence first" /></p><p className="mt-0.5 text-[11px] text-black/40"><I18nText zh="缺少数据时显示待核验" en="Missing data is marked for verification" /></p></div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3">
        <RefreshCw className="size-4 text-[#087958]" />
        <div><p className="text-xs font-bold"><I18nText zh="打开即更新" en="Refreshes on open" /></p><div className="mt-1"><LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} /></div></div>
      </div>
    </div>
  );
}
