'use client';

import { StaticLink as Link } from '@/components/static-link';
import { ArrowRight, CalendarDays, Eye, MessageCircle, ThumbsUp, UserRound } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { rememberDirectoryContext } from '@/lib/directory-utils';
import { getProposalOverview, formatCompact, formatDate, getProposalTitle, projectTypeLabels, type Proposal } from '@/lib/proposals';
import { useLocale } from '@/lib/use-locale';

function formatCardDate(value: string, locale: 'zh' | 'en') {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'en-CA', {
    year: 'numeric',
    month: locale === 'en' ? 'short' : '2-digit',
    day: locale === 'en' ? 'numeric' : '2-digit',
    timeZone: 'Asia/Shanghai',
  });
  if (locale === 'en') return formatter.format(date);
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}.${parts.month}.${parts.day}`;
}

export function ProjectCard({ proposal, compact = false }: { proposal: Proposal; compact?: boolean }) {
  const { locale, t } = useLocale();
  const titleId = `proposal-title-${proposal.id}`;
  const likesExplanation = t('当前首帖赞数，不等同于 7 天讨论期截止时的赞数', 'Current first-post likes; not the verified count at the seven-day deadline');
  const typeField = <span data-proposal-field="type" className="font-semibold"><I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} /></span>;
  const authorField = <span data-proposal-field="author" className="inline-flex min-w-0 max-w-full items-center gap-1.5"><UserRound className="size-3.5 shrink-0" aria-hidden="true" /><span className="break-all">{proposal.author}</span></span>;
  const likesField = <span data-proposal-field="likes" className="inline-flex items-center gap-1.5" title={likesExplanation}><ThumbsUp className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">{likesExplanation}: </span><span className="tabular-nums">{formatCompact(proposal.discussion.likes)}</span></span>;
  const updatedField = <span data-proposal-field="updated" className="inline-flex max-w-full items-start gap-1.5"><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>{t('更新于 ', 'Updated ')}<time dateTime={proposal.updatedAt}>{formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</time></span></span>;
  return (
    <Link
      data-testid="proposal-card"
      data-proposal-card={compact ? 'compact' : 'card'}
      href={`/project?id=${proposal.id}`}
      aria-labelledby={titleId}
      onClick={rememberDirectoryContext}
      className={`group flex min-w-0 flex-col rounded-2xl border border-border bg-card text-card-foreground transition duration-200 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${compact ? 'p-4 sm:px-5 sm:py-4' : 'h-full p-5 sm:p-6'}`}
    >
      <div className="min-w-0">
        {compact ? <div className="flex items-start justify-between gap-3">
          <ProposalStatusTags proposal={proposal} compact />
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </div> : <div data-proposal-header="card" className="flex items-start justify-between gap-3">
          <span data-proposal-field="type" className="inline-flex max-w-[46%] shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold leading-4 text-muted-foreground"><I18nText zh={projectTypeLabels[proposal.projectType] ?? proposal.projectType} en={proposal.projectType} /></span>
          <div data-proposal-field="status" className="min-w-0 flex-1 [&>div]:justify-end"><ProposalStatusTags proposal={proposal} compact /></div>
        </div>}
        <h2 id={titleId} className={`break-words font-bold leading-snug tracking-[-.015em] transition group-hover:text-primary ${compact ? 'mt-2 text-lg' : 'mt-4 line-clamp-3 text-xl'}`}>
          {getProposalTitle(proposal, locale)}
        </h2>
        {!compact && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{getProposalOverview(proposal, locale)}</p>}
      </div>

      {compact ? (
        <div data-proposal-metadata="compact" className="mt-3 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5 text-muted-foreground">
          {typeField}
          {authorField}
          <span data-proposal-field="budget" className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5"><span>{t('申请预算', 'Requested budget')}</span><span className="break-words font-mono font-semibold text-foreground tabular-nums">{proposal.budgetLabel ?? t('待核验', 'To verify')}</span></span>
          {likesField}
          {updatedField}
        </div>
      ) : (
      <div className="mt-auto min-w-0 pt-6">
        <div data-proposal-field="budget" className="min-w-0 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground"><I18nText zh="申请预算" en="Requested budget" /></p>
          <p className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">{proposal.budgetLabel ?? <I18nText zh="待核验" en="To verify" />}</p>
        </div>
        <div data-proposal-metadata="card" className="mt-3 flex min-w-0 items-center gap-x-2 overflow-x-auto whitespace-nowrap text-xs leading-5 text-muted-foreground">
          <span data-proposal-field="author" title={proposal.author} className="inline-flex min-w-8 flex-1 items-center gap-1.5"><UserRound className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{proposal.author}</span></span>
          <span className="shrink-0">{likesField}</span>
          <span data-proposal-field="replies" className="inline-flex shrink-0 items-center gap-1.5"><MessageCircle className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">{t('回复数', 'Replies')}: </span>{formatCompact(proposal.discussion.replies)}</span>
          <span data-proposal-field="views" className="inline-flex shrink-0 items-center gap-1.5"><Eye className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">{t('浏览次数', 'Views')}: </span>{formatCompact(proposal.discussion.views)}</span>
          <span data-proposal-field="updated" className="inline-flex shrink-0 items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">{t('更新日期', 'Updated date')}: </span><time dateTime={proposal.updatedAt}>{formatCardDate(proposal.updatedAt, locale)}</time></span>
        </div>
      </div>
      )}
    </Link>
  );
}
