'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { StaticLink as Link } from '@/components/static-link';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDot,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  MessageCircle,
  ThumbsUp,
  UserRound,
  Vote,
  WalletCards,
} from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import {
  getProposalOverview,
  formatCompact,
  formatDate,
  getProposalStatusTags,
  getProposalTitle,
  projectTypeLabels,
  type Proposal,
} from '@/lib/proposals';
import { useLiveProject } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

function InlineLinks({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /\[((?:\\.|[^\]])+)\]\((https?:\/\/[^)]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <a key={`${match[2]}-${index}`} href={match[2]} target="_blank" rel="noreferrer" className="font-semibold text-[#087958] underline decoration-[#087958]/30 underline-offset-2 hover:decoration-[#087958]">
        {match[1].replaceAll('\\[', '[').replaceAll('\\]', ']')}
      </a>,
    );
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function LiveProjectDetail({ id, initialProposal }: { id?: string; initialProposal?: Proposal }) {
  const { locale, t } = useLocale();
  const [resolvedId, setResolvedId] = useState<string | null>(id ?? initialProposal?.id ?? null);

  useEffect(() => {
    if (resolvedId) return;
    const value = new URLSearchParams(window.location.search).get('id');
    queueMicrotask(() => setResolvedId(value));
  }, [resolvedId]);

  const { proposal, state } = useLiveProject(resolvedId, initialProposal);

  if (!proposal) {
    const isLoading = state === 'loading';
    return (
      <main className="min-h-screen bg-[#f5f7f2] text-[#0b0f0e]">
        <SiteHeader />
        <section className="grid min-h-[65vh] place-items-center px-5 text-center">
          <div>
            <LiveSyncBadge state={state} />
            <h1 className="mt-6 text-3xl font-black">{isLoading ? t('正在读取最新提案数据…', 'Loading the latest proposal data…') : t('没有找到这个提案', 'Proposal not found')}</h1>
            <p className="mt-3 text-sm text-black/50">{isLoading ? t('正在连接 Nervos Talk 公共来源。', 'Connecting to the public Nervos Talk source.') : t('提案可能已移动或来源暂时不可用。', 'The proposal may have moved or its source may be unavailable.')}</p>
            {!isLoading && <Link href="/projects" className="mt-7 inline-flex rounded-full bg-[#096c4c] px-5 py-3 text-sm font-bold text-white"><I18nText zh="返回提案目录" en="Back to proposals" /></Link>}
          </div>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const proposalStatusTags = getProposalStatusTags(proposal);
  const hasPassedVote = proposalStatusTags.includes('vote-passed');
  const isCompleted = proposalStatusTags.includes('completed');
  const executionStarted = proposal.executionComplete !== false
    && (proposal.funded || proposalStatusTags.includes('executing') || isCompleted || proposal.executionComplete === true);
  const voteDetailZh = proposal.voting?.status === 'approved' || (proposal.voting?.status === 'unknown' && hasPassedVote)
    ? '投票已通过'
    : proposal.voting?.status === 'rejected'
      ? '投票未通过'
      : proposal.voting?.status === 'active'
        ? '投票正在进行'
        : proposal.voting
          ? '已发现投票页，结果待核验'
          : '未发现投票链接';
  const voteDetailEn = proposal.voting?.status === 'approved' || (proposal.voting?.status === 'unknown' && hasPassedVote)
    ? 'Vote approved'
    : proposal.voting?.status === 'rejected'
      ? 'Vote not passed'
      : proposal.voting?.status === 'active'
        ? 'Voting is open'
        : proposal.voting
          ? 'Voting page found; result to verify'
          : 'No voting link found';
  const governanceSteps = [
    { titleZh: '讨论', titleEn: 'Discussion', done: true, detailZh: `首帖 ${proposal.discussion.likes ?? '—'} 个赞 · ${proposal.discussion.replies ?? '—'} 条回复`, detailEn: `${proposal.discussion.likes ?? '—'} first-post likes · ${proposal.discussion.replies ?? '—'} replies` },
    { titleZh: '投票', titleEn: 'Voting', done: Boolean(proposal.voting), detailZh: voteDetailZh, detailEn: voteDetailEn },
    {
      titleZh: '执行',
      titleEn: 'Execution',
      done: executionStarted,
      detailZh: executionStarted ? (isCompleted ? '已完成' : '正在进行中') : '尚未开始',
      detailEn: executionStarted ? (isCompleted ? 'Completed' : 'In progress') : 'Not started',
    },
  ];
  const overview = proposal.overview;
  const overviewObjective = getProposalOverview(proposal, locale);
  const milestoneCount = overview?.milestones.length ?? 0;
  const milestoneStructure = locale === 'en'
    ? proposal.milestoneStructureEn ?? proposal.milestoneStructureZh
    : proposal.milestoneStructureZh ?? proposal.milestoneStructureEn;
  const progressNote = locale === 'en'
    ? proposal.progressNoteEn ?? proposal.progressNoteZh
    : proposal.progressNoteZh ?? proposal.progressNoteEn;
  const displayTitle = getProposalTitle(proposal, locale);
  const hiddenTags = new Set([
    'dis',
    'discussion',
    'proposal',
    'meta rule amendment',
    ...(proposal.hiddenTags ?? []).map((tag) => tag.toLocaleLowerCase().replace(/[-_]+/g, ' ').trim()),
  ]);
  const visibleTags = proposal.tags.filter((tag) => {
    const name = typeof tag === 'string' ? tag : tag.name ?? tag.slug ?? '';
    return !hiddenTags.has(name.toLocaleLowerCase().replace(/[-_]+/g, ' ').trim());
  });
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#0b0f0e]">
      <SiteHeader />
      <section className="border-b border-white/10 bg-[#0b0f0e] text-white">
        <div className="ledger-grid mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-18">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/projects" className="inline-flex items-center gap-2 text-xs font-bold text-white/50 transition hover:text-[#c8ff67]">
              <ArrowLeft className="size-4" /> <I18nText zh="返回提案目录" en="Back to proposals" />
            </Link>
            <LiveSyncBadge state={state} fetchedAt={proposal.lastVerifiedAt} dark />
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <ProposalStatusTags proposal={proposal} />
                <span className="label-caps text-white/35">{proposal.projectType}</span>
              </div>
              <h1 className="mt-6 max-w-5xl text-[clamp(2.4rem,6vw,5.8rem)] font-black leading-[.95] tracking-[-.055em]">{displayTitle}</h1>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/48">
                <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{proposal.author}</span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(proposal.createdAt, locale === 'en' ? 'en-US' : 'zh-CN')}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /><I18nText zh="更新于" en="Updated" /> {formatDate(proposal.updatedAt, locale === 'en' ? 'en-US' : 'zh-CN')}</span>
              </div>
            </div>
            <a href={proposal.originalUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#c8ff67] px-6 text-sm font-black text-[#102119] transition hover:bg-[#b9ed60]">
              <I18nText zh="查看原始提案" en="View original proposal" /> <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <article className="rounded-[24px] border border-black/10 bg-white p-6 sm:p-8">
              <p className="label-caps text-[#087958]"><I18nText zh="提案概览" en="Proposal overview" /></p>
              <p className="mt-5 max-w-4xl text-lg leading-8 text-black/68">
                {overviewObjective}
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f1f5f1] p-4">
                  <p className="text-[11px] font-bold text-black/38"><I18nText zh="申请预算" en="Requested budget" /></p>
                  <p className="mt-2 font-mono text-lg font-semibold">{proposal.budgetLabel ?? t('原帖未明确标注', 'Not clearly stated')}</p>
                </div>
                <div className="rounded-2xl bg-[#f1f5f1] p-4">
                  <p className="text-[11px] font-bold text-black/38"><I18nText zh="里程碑结构" en="Milestone structure" /></p>
                  <p className="mt-2 text-lg font-black">
                    {milestoneStructure ?? (milestoneCount > 0
                      ? t(`${milestoneCount} 个阶段`, `${milestoneCount} milestone${milestoneCount === 1 ? '' : 's'}`)
                      : t('原帖未明确拆分', 'No explicit breakdown'))}
                  </p>
                </div>
              </div>

              {milestoneCount > 0 ? (
                <div className="mt-8">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-black/8" />
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-black/35"><I18nText zh="路线图与里程碑" en="Roadmap & milestones" /></p>
                    <span className="h-px flex-1 bg-black/8" />
                  </div>
                  <ol className="mt-5 grid gap-3">
                    {overview?.milestones.map((milestone, index) => {
                      const milestoneTitle = locale === 'en'
                        ? milestone.titleEn ?? milestone.title
                        : milestone.titleZh ?? milestone.title;
                      const milestoneDescription = locale === 'en'
                        ? milestone.descriptionEn ?? milestone.description
                        : milestone.descriptionZh ?? milestone.description;
                      const milestoneBudget = locale === 'en'
                        ? milestone.budgetEn ?? milestone.budget
                        : milestone.budgetZh ?? milestone.budget;
                      return (
                        <li key={`${milestone.title}-${index}`} className="grid gap-4 rounded-2xl border border-black/8 bg-[#fbfcfa] p-5 sm:grid-cols-[42px_1fr]">
                          <span className="grid size-10 place-items-center rounded-full bg-[#102119] font-mono text-xs font-bold text-[#c8ff67]">{String(index + 1).padStart(2, '0')}</span>
                          <div>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h3 className="font-black leading-6">{milestoneTitle}</h3>
                              <div className="flex flex-wrap gap-2">
                                {milestoneBudget && <span className="rounded-full bg-[#e3f8ef] px-2.5 py-1 font-mono text-[10px] font-bold text-[#087958]">{milestoneBudget}</span>}
                              </div>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-black/55">{milestoneDescription}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-black/15 bg-[#f5f7f2] p-5 text-sm leading-6 text-black/48">
                  <I18nText zh="原始提案没有明确拆分阶段性里程碑；概览仅呈现可以从原帖直接核验的目标和总预算。" en="The original proposal does not explicitly separate milestone stages, so this overview only shows the objective and total budget that can be verified from the source." />
                </div>
              )}
              <div className="mt-7 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#e8efea] px-3 py-1.5 text-xs font-bold">{locale === 'en' ? proposal.projectType : projectTypeLabels[proposal.projectType] ?? proposal.projectType}</span>
                {visibleTags.slice(0, 5).map((tag) => {
                  const name = typeof tag === 'string' ? tag : tag.name ?? tag.slug;
                  return name ? <span key={name} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/50">#{name}</span> : null;
                })}
              </div>
            </article>

            <section className="rounded-[24px] border border-black/10 bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="label-caps text-[#087958]"><I18nText zh="治理时间线" en="Governance timeline" /></p><h2 className="mt-3 text-2xl font-black tracking-[-.03em]"><I18nText zh="治理路径" en="Governance path" /></h2></div>
                <span className="text-xs text-black/35"><I18nText zh="状态来自公开证据，不做无依据推断" en="Statuses follow public evidence; no unsupported assumptions" /></span>
              </div>
              <ol className="mt-8 grid gap-4">
                {governanceSteps.map((step, index) => (
                  <li key={step.titleEn} className="grid grid-cols-[42px_1fr] gap-4">
                    <div className="relative flex justify-center">
                      <span className={`z-10 grid size-9 place-items-center rounded-full border ${step.done ? 'border-[#00a873] bg-[#e3f8ef] text-[#087958]' : 'border-black/12 bg-[#f5f7f2] text-black/30'}`}>
                        {step.done ? <Check className="size-4" /> : <CircleDot className="size-4" />}
                      </span>
                      {index < governanceSteps.length - 1 && <span className="absolute top-9 h-[calc(100%+1rem)] w-px bg-black/10" />}
                    </div>
                    <div className="pb-5">
                      <h3 className="font-black"><I18nText zh={step.titleZh} en={step.titleEn} /></h3>
                      <p className="mt-1.5 text-sm leading-6 text-black/50"><I18nText zh={step.detailZh} en={step.detailEn} /></p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-[24px] border border-black/10 bg-white p-6 sm:p-8">
              <p className="label-caps text-[#087958]"><I18nText zh="提案记录" en="Proposal record" /></p>
              <h2 className="mt-3 text-2xl font-black tracking-[-.03em]"><I18nText zh="进展与更新" en="Progress and updates" /></h2>
              {progressNote && (
                <div className="mt-6 rounded-xl border border-[#00a873]/20 bg-[#eef9f3] p-5 text-base leading-7 text-black/65">
                  <InlineLinks text={progressNote} />
                </div>
              )}
              {proposal.updates.length > 0 ? (
                <div className="mt-7 divide-y divide-black/8">
                  {proposal.updates.map((update) => (
                    <a key={update.url} href={update.url} target="_blank" rel="noreferrer" className="group grid gap-2 py-5 first:pt-0 sm:grid-cols-[120px_1fr_auto] sm:gap-5">
                      <p className="font-mono text-[11px] text-black/35">{update.date ? formatDate(update.date, locale === 'en' ? 'en-US' : 'zh-CN') : t('日期待核验', 'Date to verify')}</p>
                      <div><p className="line-clamp-2 text-sm font-semibold leading-6 group-hover:text-[#087958]">{locale === 'en' ? update.titleEn ?? update.title : update.titleZh ?? update.title}</p><p className="mt-1 text-[11px] text-black/35">by {update.author}</p></div>
                      <ExternalLink className="size-4 text-black/25 group-hover:text-[#087958]" />
                    </a>
                  ))}
                </div>
              ) : !progressNote ? (
                <div className="mt-6 rounded-xl border border-dashed border-black/15 bg-[#f5f7f2] p-6 text-sm text-black/45"><I18nText zh="尚未发现提案人发布的项目进展、更新或完结报告；完整回复仍可在原始提案中查看。" en="No project update, progress report, or completion report from the proposal author was found; the complete reply history remains available in the source proposal." /></div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ThumbsUp, labelZh: '首帖赞数', labelEn: 'First-post likes', value: formatCompact(proposal.discussion.likes) },
                { icon: MessageCircle, labelZh: '回复', labelEn: 'Replies', value: formatCompact(proposal.discussion.replies) },
                { icon: Eye, labelZh: '浏览', labelEn: 'Views', value: formatCompact(proposal.discussion.views) },
                {
                  icon: Vote,
                  labelZh: '投票页',
                  labelEn: 'Voting page',
                  value: proposal.voting
                    ? t('已发现', 'Found')
                    : proposal.votingPageNotFound
                      ? t('未找到', 'Not Found')
                      : t('待核验', 'To verify'),
                },
              ].map(({ icon: Icon, labelZh, labelEn, value }) => (
                <div key={labelEn} className="rounded-2xl border border-black/10 bg-white p-4">
                  <Icon className="size-4 text-[#087958]" /><p className="mt-4 font-mono text-lg font-semibold">{value}</p><p className="mt-1 text-[11px] text-black/40"><I18nText zh={labelZh} en={labelEn} /></p>
                </div>
              ))}
            </div>

            <div className="rounded-[22px] bg-[#0b0f0e] p-6 text-white">
              <WalletCards className="size-5 text-[#7fe0bc]" />
              <p className="label-caps mt-5 text-white/35"><I18nText zh="申请预算" en="Requested budget" /></p>
              <p className="mt-3 font-mono text-2xl font-semibold text-[#c8ff67]">{proposal.budgetLabel ?? t('待核验', 'To verify')}</p>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-white/48"><I18nText zh="申请、批准和实际拨付是不同概念；本页仅展示已找到的原始金额与证据。" en="Requested, approved, and actually disbursed funds are different. This page shows only the amounts and evidence found in public sources." /></p>
            </div>

            {proposal.voting && (
              <div className="overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-amber-950"><I18nText zh="Metaforo 投票结果" en="Metaforo vote result" /></p>
                      <p className="mt-1 text-[11px] text-amber-900/55">
                        {proposal.voting.verifiedAt
                          ? t(`核验于 ${formatDate(proposal.voting.verifiedAt, 'zh-CN')}`, `Verified ${formatDate(proposal.voting.verifiedAt, 'en-US')}`)
                          : t('等待来源数据', 'Awaiting source data')}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${proposal.voting.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {proposal.voting.status === 'active'
                        ? t('正在投票', 'Voting now')
                        : proposal.voting.status === 'approved'
                          ? t('通过', 'Approved')
                          : proposal.voting.status === 'rejected'
                            ? t('未通过', 'Not passed')
                            : hasPassedVote
                              ? t('通过 · 票数待补', 'Approved · tally pending')
                              : t('待核验', 'To verify')}
                    </span>
                  </div>

                  {proposal.voting.totalVotes != null || proposal.voting.yesPercent != null ? (
                    <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-amber-900/10 pt-5">
                      {proposal.voting.totalVotes != null && <div><p className="font-mono text-base font-semibold">{proposal.voting.totalVotes.toLocaleString('en-US')}</p><p className="mt-1 text-[10px] text-amber-900/50"><I18nText zh="总投票数" en="Total votes" /></p></div>}
                      {proposal.voting.yesPercent != null && <div><p className="font-mono text-base font-semibold">{proposal.voting.yesPercent.toFixed(2)}%</p><p className="mt-1 text-[10px] text-amber-900/50"><I18nText zh="赞成票比例" en="Yes votes" /></p></div>}
                      {proposal.voting.minimumVotes != null && <div><p className="font-mono text-base font-semibold">{proposal.voting.minimumVotes.toLocaleString('en-US')}</p><p className="mt-1 text-[10px] text-amber-900/50"><I18nText zh="投票页最低票数" en="Metaforo minimum" /></p></div>}
                      {proposal.voting.passPercent != null && <div><p className="font-mono text-base font-semibold">{proposal.voting.passPercent}%</p><p className="mt-1 text-[10px] text-amber-900/50"><I18nText zh="通过比例" en="Pass threshold" /></p></div>}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs leading-5 text-amber-900/60"><I18nText zh="已发现投票页，但公开票数尚未录入。" en="A voting page was found, but its public tally has not yet been recorded." /></p>
                  )}
                  {proposal.voting.minimumVotes === 0 && (
                    <p className="mt-4 text-[11px] leading-5 text-amber-900/60"><I18nText zh="该投票页将最低票数记录为 0；此处按 Metaforo 原页面如实展示。" en="This poll records its minimum vote count as 0; the value is reproduced exactly as shown on Metaforo." /></p>
                  )}
                  {(proposal.voting.noteZh || proposal.voting.noteEn) && (
                    <p className="mt-4 rounded-xl bg-white/55 p-3 text-[11px] leading-5 text-amber-950/65">
                      {locale === 'en' ? proposal.voting.noteEn ?? proposal.voting.noteZh : proposal.voting.noteZh ?? proposal.voting.noteEn}
                    </p>
                  )}
                </div>
                <a href={proposal.voting.url} target="_blank" rel="noreferrer" className="flex items-center justify-between border-t border-amber-900/10 px-5 py-3 text-xs font-black text-amber-900 transition hover:bg-amber-100">
                  <I18nText zh="打开结果来源" en="Open result source" /><ArrowUpRight className="size-4" />
                </a>
              </div>
            )}

            <div className="rounded-[22px] border border-black/10 bg-white p-5">
              <div className="flex items-center gap-2"><FileText className="size-4 text-[#087958]" /><h2 className="text-sm font-black"><I18nText zh="来源" en="Sources" /></h2></div>
              <div className="mt-4 divide-y divide-black/8">
                {proposal.sources.map((source) => (
                  <a key={`${source.label}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 py-3 text-xs font-semibold text-black/55 hover:text-[#087958]">
                    {source.label}<ExternalLink className="size-3.5 shrink-0" />
                  </a>
                ))}
              </div>
              <p className="mt-4 rounded-lg bg-[#f5f7f2] p-3 text-[10px] leading-4 text-black/40">{t('本次读取：', 'Read on: ')}{formatDate(proposal.lastVerifiedAt, locale === 'en' ? 'en-US' : 'zh-CN')}{t('。', '. ')}<I18nText zh="数据存在冲突时，以原始来源为准。" en="When data conflicts, the original source takes precedence." /></p>
            </div>
          </aside>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
