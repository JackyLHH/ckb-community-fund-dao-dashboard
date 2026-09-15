'use client';

import { StaticLink as Link } from '@/components/static-link';
import { ArrowUpRight, CalendarDays, Eye, MessageCircle, ThumbsUp } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import {
  getProposalOverview,
  formatCompact,
  formatDate,
  getProposalTitle,
  projectTypeLabels,
  type Proposal,
} from '@/lib/proposals';
import { useLocale } from '@/lib/use-locale';

export function ProjectCard({ proposal }: { proposal: Proposal }) {
  const { locale } = useLocale();
  return (
    <Link
      href={`/project?id=${proposal.id}`}
      className="group flex min-h-[310px] flex-col rounded-[22px] border border-black/10 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#00a873]/45 hover:shadow-[0_18px_45px_rgb(11_15_14/8%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a873] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <ProposalStatusTags proposal={proposal} compact />
        <ArrowUpRight className="size-4 text-black/25 transition group-hover:text-[#087958]" aria-hidden="true" />
      </div>

      <div className="mt-5">
        <p className="label-caps text-black/35">
          <I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} />
        </p>
        <h2 className="mt-3 line-clamp-3 text-xl font-black leading-tight tracking-[-.025em] transition group-hover:text-[#087958]">
          {getProposalTitle(proposal, locale)}
        </h2>
        <p className="mt-3 line-clamp-6 text-sm leading-6 text-black/52">{getProposalOverview(proposal, locale)}</p>
      </div>

      <div className="mt-auto pt-6">
        <div className="flex items-end justify-between gap-4 border-t border-black/8 pt-4">
          <div>
            <p className="text-[11px] text-black/40"><I18nText zh="申请预算" en="Requested" /></p>
            <p className="mt-1 font-mono text-sm font-semibold">{proposal.budgetLabel ?? <I18nText zh="待核验" en="To verify" />}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-black/42">
            <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" />{formatCompact(proposal.discussion.likes)}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" />{formatCompact(proposal.discussion.replies)}</span>
            <span className="hidden items-center gap-1 sm:inline-flex"><Eye className="size-3.5" />{formatCompact(proposal.discussion.views)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-black/40">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{proposal.author}</span>
          <span>{formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</span>
        </div>
      </div>
    </Link>
  );
}
