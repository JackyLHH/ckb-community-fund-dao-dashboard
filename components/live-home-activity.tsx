'use client';

import { StaticLink as Link } from '@/components/static-link';
import { ArrowUpRight } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { cleanSummary, formatDate, getProposalStatusTags, getProposalTitle, statusMeta } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveHomeActivity() {
  const { data, state } = useLiveDataset();
  const { locale } = useLocale();
  const latestProjects = data.proposals.slice(0, 3);
  const executingCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('executing')).length;
  const votingCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('voting')).length;

  return (
    <section className="border-t border-black/10 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-end lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="label-caps text-[#087958]">Live directory</p>
              <LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} />
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-[-.035em]"><I18nText zh="最新提案活动" en="Latest proposal activity" /></h2>
            <div className="mt-6 flex gap-7">
              <div><p className="font-mono text-2xl font-semibold">{data.meta.proposalCount}</p><p className="mt-1 text-[11px] text-black/40"><I18nText zh="提案记录" en="Proposals" /></p></div>
              <div><p className="font-mono text-2xl font-semibold">{executingCount}</p><p className="mt-1 text-[11px] text-black/40"><I18nText zh="执行中" en="In progress" /></p></div>
              <div><p className="font-mono text-2xl font-semibold">{votingCount}</p><p className="mt-1 text-[11px] text-black/40"><I18nText zh="正在投票" en="Voting now" /></p></div>
            </div>
          </div>
          <div className="grid gap-3">
            {latestProjects.map((proposal) => {
              const tags = getProposalStatusTags(proposal);
              const leadStatus = statusMeta[tags[0]];
              return (
                <Link key={proposal.id} href={`/project?id=${proposal.id}`} className="group grid gap-4 rounded-2xl border border-black/8 bg-white p-4 transition hover:border-[#00a873]/45 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`size-2 rounded-full ${leadStatus.dotClassName}`} />
                      <span className="text-[10px] font-bold text-black/40">{tags.map((tag) => locale === 'en' ? statusMeta[tag].en : statusMeta[tag].zh).join(' · ')} · {formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</span>
                    </div>
                    <p className="mt-2 font-black group-hover:text-[#087958]">{getProposalTitle(proposal, locale)}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-black/45">{cleanSummary(proposal, 160, locale)}</p>
                  </div>
                  <ArrowUpRight className="size-4 text-black/25 group-hover:text-[#087958]" />
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mt-8 text-right">
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-full bg-[#096c4c] px-5 py-3 text-xs font-black text-white"><I18nText zh={`浏览全部 ${data.meta.proposalCount} 个提案`} en={`Explore all ${data.meta.proposalCount} proposals`} /> <ArrowUpRight className="size-4" /></Link>
        </div>
      </div>
    </section>
  );
}
