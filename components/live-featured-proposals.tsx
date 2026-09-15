'use client';

import { ArrowUpRight, ThumbsUp, UserRound, WalletCards } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { StaticLink as Link } from '@/components/static-link';
import {
  formatCompact,
  getProposalOverview,
  getProposalTitle,
  projectTypeLabels,
} from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';

const featuredProposalIds = ['9756', '10015', '10583'];

export function LiveFeaturedProposals() {
  const { data } = useLiveDataset();
  const proposals = featuredProposalIds
    .map((id) => data.proposals.find((proposal) => proposal.id === id))
    .filter((proposal) => proposal !== undefined);

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-3">
      {proposals.map((proposal) => (
        <Link
          key={proposal.id}
          href={`/project?id=${proposal.id}`}
          className="group flex min-h-[390px] flex-col rounded-[24px] border border-black/10 bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#00a873]/45 hover:shadow-[0_18px_45px_rgba(11,15,14,.07)] sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ProposalStatusTags proposal={proposal} compact />
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black/45">
              <I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} />
            </span>
          </div>

          <h3 className="mt-6 text-xl font-black leading-7 tracking-[-.025em] transition group-hover:text-[#087958]">
            <I18nText zh={getProposalTitle(proposal, 'zh')} en={getProposalTitle(proposal, 'en')} />
          </h3>
          <p className="mt-3 line-clamp-5 text-sm leading-6 text-black/55">
            <I18nText zh={getProposalOverview(proposal, 'zh')} en={getProposalOverview(proposal, 'en')} />
          </p>

          <div className="mt-auto grid gap-3 border-t border-black/10 pt-5 text-xs text-black/50">
            <span className="inline-flex items-center gap-2"><UserRound className="size-3.5 text-[#087958]" /> {proposal.author}</span>
            <span className="inline-flex items-center gap-2"><ThumbsUp className="size-3.5 text-[#087958]" /> <I18nText zh={`${formatCompact(proposal.discussion.likes)} 个首帖赞`} en={`${formatCompact(proposal.discussion.likes)} first-post likes`} /></span>
            <span className="inline-flex items-center gap-2"><WalletCards className="size-3.5 text-[#087958]" /> {proposal.budgetLabel ?? <I18nText zh="预算待核验" en="Budget to verify" />}</span>
          </div>

          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-[#087958]">
            <I18nText zh="查看提案" en="View proposal" /> <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}
