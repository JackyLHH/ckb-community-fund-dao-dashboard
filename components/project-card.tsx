'use client';

import { StaticLink as Link } from '@/components/static-link';
import { ArrowRight, CalendarDays, Eye, MessageCircle, ThumbsUp, UserRound } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { rememberDirectoryContext } from '@/lib/directory-utils';
import { getProposalOverview, formatCompact, formatDate, getProposalTitle, projectTypeLabels, type Proposal } from '@/lib/proposals';
import { useLocale } from '@/lib/use-locale';

export function ProjectCard({ proposal, compact = false }: { proposal: Proposal; compact?: boolean }) {
  const { locale, t } = useLocale();
  const titleId = `proposal-title-${proposal.id}`;
  const likesExplanation = t('当前首帖赞数，不等同于 7 天讨论期截止时的赞数', 'Current first-post likes; not the verified count at the seven-day deadline');
  return (
    <Link
      href={`/project?id=${proposal.id}`}
      aria-labelledby={titleId}
      onClick={rememberDirectoryContext}
      className={`group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground transition duration-200 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${compact ? 'gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(150px,210px)] md:items-center' : 'h-full sm:p-6'}`}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <ProposalStatusTags proposal={proposal} compact />
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs font-semibold text-muted-foreground">
          <I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} />
          <span className="mx-2" aria-hidden="true">·</span><span>#{proposal.id}</span>
        </p>
        <h2 id={titleId} className={`mt-2 break-words font-bold leading-snug tracking-[-.015em] transition group-hover:text-primary ${compact ? 'text-lg' : 'line-clamp-3 text-xl'}`}>
          {getProposalTitle(proposal, locale)}
        </h2>
        <p className={`mt-3 text-sm leading-6 text-muted-foreground ${compact ? 'line-clamp-2' : 'line-clamp-6'}`}>{getProposalOverview(proposal, locale)}</p>
        {compact && <p className="mt-3 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{proposal.author}</span></p>}
      </div>

      <div className={compact ? 'min-w-0 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0' : 'mt-auto min-w-0 pt-6'}>
        <div className={`min-w-0 ${compact ? '' : 'border-t border-border pt-4'}`}>
          <p className="text-xs text-muted-foreground"><I18nText zh="申请预算" en="Requested budget" /></p>
          <p className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">{proposal.budgetLabel ?? <I18nText zh="待核验" en="To verify" />}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title={likesExplanation}><ThumbsUp className="size-3.5" aria-hidden="true" /><span className="sr-only">{likesExplanation}: </span>{formatCompact(proposal.discussion.likes)}<span>{t('当前首帖赞', 'current first-post likes')}</span></span>
          {!compact && <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" aria-hidden="true" /><span className="sr-only">{t('回复数', 'Replies')}: </span>{formatCompact(proposal.discussion.replies)}</span>}
          {!compact && <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" aria-hidden="true" /><span className="sr-only">{t('浏览次数', 'Views')}: </span>{formatCompact(proposal.discussion.views)}</span>}
        </div>
        <div className={`mt-4 flex gap-2 text-xs leading-5 text-muted-foreground ${compact ? 'flex-col' : 'flex-wrap items-start justify-between'}`}>
          {!compact && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><UserRound className="size-3.5 shrink-0" aria-hidden="true" /><span className="break-all">{proposal.author}</span></span>}
          <span className="inline-flex items-start gap-1.5" title={t('论坛最近活动，可能包含社区回复，并不一定是提案人的进展报告', 'Latest forum activity may include community replies, not just proposer progress reports')}><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>{t('更新于 ', 'Updated ')}<time dateTime={proposal.updatedAt}>{formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</time></span></span>
        </div>
      </div>
    </Link>
  );
}
