'use client';

import { StaticLink as Link } from '@/components/static-link';
import { ArrowRight } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { formatDate, getProposalOverview, getProposalStatusTags, getProposalTitle, statusMeta } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

export function LiveHomeActivity() {
  const { data, state } = useLiveDataset();
  const { locale } = useLocale();
  const latestProjects = [...data.proposals].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3);
  const executingCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('executing')).length;
  const votingCount = data.proposals.filter((proposal) => getProposalStatusTags(proposal).includes('voting')).length;

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-18">
        <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-end lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="label-caps text-primary"><I18nText zh="提案动态" en="Live directory" /></p>
              <LiveSyncBadge state={state} fetchedAt={data.meta.generatedAt} />
            </div>
            <h2 className="section-heading mt-3"><I18nText zh="最新提案活动" en="Latest proposal activity" /></h2>
            <p title={locale === 'en' ? 'The update time includes forum replies, not only proposer progress reports.' : '更新时间包含论坛回复，并不一定是提案人的进展报告。'} className="mt-3 max-w-md text-sm leading-6 text-muted-foreground"><I18nText zh="按最近更新时间排序" en="Ordered by latest update" /></p>
            <div className="mt-6 flex gap-7">
              {[
                { href: '/projects', count: data.meta.proposalCount, zh: '提案记录', en: 'Proposals' },
                { href: '/projects?status=executing', count: executingCount, zh: '执行中', en: 'In progress' },
                { href: '/projects?status=voting', count: votingCount, zh: '正在投票', en: 'Voting now' },
              ].map(item => <Link key={item.href} href={item.href} className="touch-target rounded-lg underline-offset-4 hover:text-primary hover:underline"><p className="font-mono text-2xl font-semibold">{state === 'loading' ? '—' : item.count}</p><p className="mt-1 text-sm text-muted-foreground"><I18nText zh={item.zh} en={item.en} /></p></Link>)}
            </div>
          </div>
          <div className="grid min-w-0 gap-3">
            {latestProjects.map((proposal) => {
              const tags = getProposalStatusTags(proposal);
              const leadStatus = statusMeta[tags[0]];
              return (
                <Link key={proposal.id} href={`/project?id=${proposal.id}`} aria-labelledby={`activity-title-${proposal.id}`} className="group grid min-w-0 gap-4 rounded-2xl border border-border bg-background p-5 transition hover:border-primary/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`size-2 rounded-full ${leadStatus.dotClassName}`} aria-hidden="true" />
                      <span title={locale === 'en' ? 'Latest forum activity may include community replies.' : '更新时间可能包含社区回复。'} className="text-xs font-semibold text-muted-foreground">{tags.map((tag) => locale === 'en' ? statusMeta[tag].en : statusMeta[tag].zh).join(' · ')} · <I18nText zh="更新于" en="Updated" /> <time dateTime={proposal.updatedAt}>{formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</time></span>
                    </div>
                    <h3 id={`activity-title-${proposal.id}`} className="mt-2 font-bold group-hover:text-primary">{getProposalTitle(proposal, locale)}</h3>
                    <p className="mt-1 line-clamp-1 text-sm leading-6 text-muted-foreground">{getProposalOverview(proposal, locale)}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mt-8 text-right">
          <Link href="/projects" className="touch-target inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"><I18nText zh={`浏览全部 ${data.meta.proposalCount} 个提案`} en={`Explore all ${data.meta.proposalCount} proposals`} /> <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
