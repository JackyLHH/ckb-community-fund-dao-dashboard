'use client';

import { ArrowRight, ThumbsUp, UserRound, WalletCards } from 'lucide-react';
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
          aria-labelledby={`featured-title-${proposal.id}`}
          className="group flex min-h-[390px] flex-col rounded-[24px] border border-border bg-card p-6 transition hover:border-primary/60 hover:shadow-lg sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ProposalStatusTags proposal={proposal} compact />
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              <I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} />
            </span>
          </div>

          <h3 id={`featured-title-${proposal.id}`} className="mt-5 text-xl font-bold leading-7 tracking-[-.025em] transition group-hover:text-primary">
            <I18nText zh={getProposalTitle(proposal, 'zh')} en={getProposalTitle(proposal, 'en')} />
          </h3>
          <p className="mb-6 mt-3 line-clamp-6 text-base leading-7 text-muted-foreground">
            <I18nText zh={getProposalOverview(proposal, 'zh')} en={getProposalOverview(proposal, 'en')} />
          </p>

          <div className="mt-auto grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><UserRound className="size-4 text-primary" aria-hidden="true" /><I18nText zh="提案人" en="Proposer" /> {proposal.author}</span>
            <span className="inline-flex items-center gap-2"><ThumbsUp className="size-4 text-primary" aria-hidden="true" /> <I18nText zh={`${formatCompact(proposal.discussion.likes)} 个首帖赞`} en={`${formatCompact(proposal.discussion.likes)} first-post likes`} /></span>
            <span className="inline-flex items-center gap-2"><WalletCards className="size-4 text-primary" aria-hidden="true" /><I18nText zh="预算" en="Budget" /> {proposal.budgetLabel ?? <I18nText zh="预算待核验" en="Budget to verify" />}</span>
          </div>

          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
            <I18nText zh="查看提案" en="View proposal" /> <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
