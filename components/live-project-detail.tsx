'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { StaticLink as Link } from '@/components/static-link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Circle, CircleDot, Clock3, ExternalLink, FileText, RefreshCw, UserRound } from 'lucide-react';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { detailStageStates, localizedSourceLabel, sortDetailUpdates } from '@/lib/proposal-detail-ux';
import { getProposalOverview, formatCompact, formatDate, getProposalStatusTags, getProposalTitle, projectTypeLabels, type Proposal } from '@/lib/proposals';
import { useLiveProject } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

const panel = 'rounded-2xl border border-border bg-card p-5 sm:p-7';
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';
const heroAction = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7fe0bc]';

function InlineLinks({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /\[((?:\\.|[^\]])+)\]\((https?:\/\/[^)]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<a key={`${match[2]}-${index}`} href={match[2]} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">{match[1].replaceAll('\\[', '[').replaceAll('\\]', ']')}</a>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function plainInlineText(text: string) {
  return text.replace(/\[((?:\\.|[^\]])+)\]\((https?:\/\/[^)]+)\)/g, (_match, label: string) => label.replaceAll('\\[', '[').replaceAll('\\]', ']'));
}

function DetailSkeleton({ label }: { label: string }) {
  return <section aria-busy="true" aria-label={label} className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
    <output className="block text-sm text-muted-foreground">{label}</output>
    <div aria-hidden="true" className="mt-6 space-y-5 motion-safe:animate-pulse">
      <div className="h-5 w-40 rounded bg-muted" /><div className="h-12 max-w-2xl rounded bg-muted" /><div className="h-6 max-w-md rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]"><div className="h-72 rounded-2xl bg-muted" /><div className="h-72 rounded-2xl bg-muted" /></div>
    </div>
  </section>;
}

function VotePanel({ proposal }: { proposal: Proposal }) {
  const { locale, t } = useLocale();
  const voting = proposal.voting;
  if (!voting) return <section id="voting" className={`${panel} scroll-mt-28`} aria-labelledby="vote-title"><h2 id="vote-title" className="text-lg font-bold">{t('Metaforo 投票', 'Metaforo voting')}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{proposal.votingPageNotFound ? t('未找到对应投票页。', 'No corresponding voting page was found.') : t('尚未核验到对应投票页。', 'A corresponding voting page has not been verified.')}</p></section>;
  const active = voting.status === 'active';
  const passed = voting.status === 'approved' || (voting.status === 'unknown' && getProposalStatusTags(proposal).includes('vote-passed'));
  const rejected = voting.status === 'rejected';
  const final = voting.status === 'approved' || rejected;
  const timestamp = voting.verifiedAt ? new Date(voting.verifiedAt) : null;
  const checks = [
    { label: t('最低投票权重', 'Quorum requirement'), actual: voting.totalVotes, required: voting.minimumVotes, percent: false },
    { label: t('最低赞成比例', 'Approval requirement'), actual: voting.yesPercent, required: voting.passPercent, percent: true },
  ];
  return <section id="voting" className={`${panel} scroll-mt-28`} aria-labelledby="vote-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 id="vote-title" className="text-lg font-bold">{t('Metaforo 投票', 'Metaforo voting')}</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{active ? t('正在投票 · 暂时数据', 'Voting open · provisional') : rejected ? t('最终结果：未通过', 'Final result: not passed') : final && passed ? t('最终结果：通过', 'Final result: approved') : passed ? t('投票通过 · 完整票数待核验', 'Approved · full tally pending') : t('结果待核验', 'Result unverified')}</span></div>
    {active && <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('投票尚未结束，当前票数和赞成比例不是最终结果。', 'Voting is still open. The current tally and approval percentage are not a final result.')}</p>}
    <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4"><div><dt className="text-xs text-muted-foreground">{t('总投票权重（CKB）', 'Total voting weight (CKB)')}</dt><dd className="mt-2 break-words font-mono text-lg font-semibold tabular-nums">{voting.totalVotes?.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') ?? '—'}</dd></div><div><dt className="text-xs text-muted-foreground">{t('赞成比例', 'Approval')}</dt><dd className="mt-2 font-mono text-lg font-semibold tabular-nums">{voting.yesPercent != null ? `${voting.yesPercent.toFixed(2)}%` : '—'}</dd></div></dl>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('按 CKB 权重计算，并非参与投票的人数。', 'CKB-weighted votes, not the number of people voting.')}</p>
    <div className="mt-5 space-y-3">{checks.map((check) => {
      const known = check.actual != null && check.required != null;
      const met = known && check.actual! >= check.required!;
      return <div key={check.label} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{check.label}</h3><span className="text-xs text-muted-foreground">{known ? met ? t('已达到', 'Met') : t('未达到', 'Not met') : t('待核验', 'Unverified')}</span></div><p className="mt-1 font-mono text-sm tabular-nums">{check.required != null ? `${check.required.toLocaleString('en-US')}${check.percent ? '%' : ' CKB'}` : '—'}</p></div>;
    })}</div>
    {voting.minimumVotes === 0 && <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('Metaforo 原页面的最低票数为 0，此处按来源展示。', 'Metaforo records a quorum of 0; this value is reproduced from the source.')}</p>}
    {(voting.noteZh || voting.noteEn) && <p className="mt-4 text-sm leading-6 text-muted-foreground">{locale === 'en' ? voting.noteEn ?? voting.noteZh : voting.noteZh ?? voting.noteEn}</p>}
    {timestamp && Number.isFinite(timestamp.getTime()) && <p className="mt-4 text-xs leading-5 text-muted-foreground">{t('投票数据核验时间：', 'Voting data verified: ')}<time dateTime={voting.verifiedAt}>{timestamp.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' })}</time> UTC+8</p>}
    <a href={voting.url} target="_blank" rel="noreferrer" className={`${action} mt-5 w-full text-primary`}>{active ? t('前往投票', 'Cast your vote') : t('查看投票来源', 'View voting source')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>
  </section>;
}

export function LiveProjectDetail({ id, initialProposal }: { id?: string; initialProposal?: Proposal }) {
  const { locale, t } = useLocale();
  const [resolvedId, setResolvedId] = useState<string | null>(id ?? initialProposal?.id ?? null);
  const [idResolved, setIdResolved] = useState(Boolean(id ?? initialProposal?.id));
  const [directoryUrl, setDirectoryUrl] = useState('/projects');
  useEffect(() => {
    try {
      const context = JSON.parse(window.sessionStorage.getItem('ckb-dao-directory-context') ?? 'null') as { url?: string } | null;
      if (context?.url && /^\/projects(?:[?#]|$)/.test(context.url)) queueMicrotask(() => setDirectoryUrl(context.url!));
    } catch { /* A direct visit needs no stored directory state. */ }
    if (idResolved) return;
    const value = new URLSearchParams(window.location.search).get('id');
    queueMicrotask(() => { setResolvedId(value); setIdResolved(true); });
  }, [idResolved]);
  const { proposal, state, error, retry } = useLiveProject(resolvedId, initialProposal);
  const displayTitle = proposal ? getProposalTitle(proposal, locale) : '';
  useEffect(() => {
    document.title = displayTitle ? `${displayTitle} — CKB Community Fund DAO` : locale === 'en' ? 'Proposal — CKB Community Fund DAO' : '提案 — CKB Community Fund DAO';
  }, [displayTitle, locale]);

  if (!proposal) {
    const missingId = idResolved && !resolvedId;
    const loading = !missingId && !error && state === 'loading';
    return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main-content" tabIndex={-1}>
      {loading ? <DetailSkeleton label={t('正在读取提案；已有记录会优先展示', 'Loading proposal; available records are shown first')} /> : <section className="mx-auto min-h-[55vh] max-w-2xl px-5 py-16">
        <p className="text-sm font-semibold text-primary">{t('提案记录', 'Proposal record')}</p><h1 className="mt-4 text-3xl font-bold">{missingId || error === 'invalid' ? t('提案编号无效', 'Invalid proposal ID') : error === 'not-found' ? t('没有找到这个提案', 'Proposal not found') : t('暂时无法读取提案', 'Proposal temporarily unavailable')}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">{missingId || error === 'invalid' ? t('请从提案目录打开记录，或检查链接中的编号。', 'Open a record from the directory or check the ID in the link.') : error === 'not-found' ? t('原始来源返回了不存在的记录，请检查编号。', 'The original source returned a missing record. Please check the ID.') : t('公开来源可能连接失败或暂时限制访问，这不代表提案已被删除。请稍后重试。', 'The public source may be offline or rate-limited. This does not mean the proposal was deleted. Please try again.')}</p>
        <div className="mt-6 flex flex-wrap gap-3">{!missingId && error !== 'invalid' && <button type="button" onClick={retry} className={action}><RefreshCw className="size-4" aria-hidden="true" />{t('重新读取', 'Try again')}</button>}<Link href="/projects" className={action}>{t('返回提案目录', 'Back to proposals')}</Link></div>
      </section>}
      </main><SiteFooter /></div>;
  }

  const statusTags = getProposalStatusTags(proposal);
  const stageStates = detailStageStates(proposal, statusTags);
  const completed = statusTags.includes('completed');
  const milestones = proposal.overview?.milestones ?? [];
  const milestoneStructure = locale === 'en' ? proposal.milestoneStructureEn ?? proposal.milestoneStructureZh : proposal.milestoneStructureZh ?? proposal.milestoneStructureEn;
  const progressNote = locale === 'en' ? proposal.progressNoteEn ?? proposal.progressNoteZh : proposal.progressNoteZh ?? proposal.progressNoteEn;
  const updates = sortDetailUpdates(proposal.updates);
  const localizedDate = (date: string) => formatDate(date, locale === 'en' ? 'en-US' : 'zh-CN');
  const steps = [
    { title: t('讨论', 'Discussion'), detail: statusTags.includes('discussion') ? t('处于七天讨论阶段', 'Within the seven-day discussion stage') : t('讨论阶段已结束', 'Discussion stage ended') },
    { title: t('投票', 'Voting'), detail: proposal.voting?.status === 'active' ? t('投票进行中，当前结果仍会变化', 'Voting is open; the tally can still change') : statusTags.includes('vote-passed') ? t('投票通过', 'Vote passed') : statusTags.includes('vote-failed') ? t('投票未通过', 'Vote not passed') : proposal.voting ? t('已发现链接，投票状态待核验', 'Link found; voting status unverified') : t('尚未发现投票页', 'No voting page found') },
    { title: t('执行', 'Execution'), detail: completed ? t('已完成', 'Completed') : stageStates[2] === 'current' ? t('正在进行中', 'In progress') : stageStates[2] === 'ended' ? t('已结束', 'Ended') : t('尚未开始', 'Not started') },
  ];

  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main-content" tabIndex={-1}>
    <section data-proposal-hero className="border-b border-white/10 bg-[#0b0f0e] text-white"><div className="ledger-grid mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href={directoryUrl} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-white/70 hover:text-[#7fe0bc] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7fe0bc]"><ArrowLeft className="size-4" aria-hidden="true" />{t('返回提案目录', 'Back to proposals')}</Link><LiveSyncBadge state={state} fetchedAt={proposal.lastVerifiedAt} dark /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><ProposalStatusTags proposal={proposal} /><span className="text-sm font-semibold text-white/70">{locale === 'en' ? proposal.projectType : projectTypeLabels[proposal.projectType] ?? proposal.projectType}</span></div>
      <h1 className={`mt-4 max-w-5xl break-words font-bold tracking-tight ${locale === 'zh' ? 'text-[clamp(1.75rem,3.8vw,2.75rem)] leading-[1.3]' : 'text-[clamp(1.75rem,3.8vw,3rem)] leading-[1.15]'}`}>{displayTitle}</h1>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75"><span className="inline-flex min-w-0 max-w-full items-center gap-2"><UserRound className="size-4 shrink-0" aria-hidden="true" /><span className="break-all">{t('提案人：', 'Proposer: ')}{proposal.author}</span></span><span className="inline-flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{t('发布于 ', 'Published ')}<time dateTime={proposal.createdAt}>{localizedDate(proposal.createdAt)}</time></span><span title={t('论坛最近活动，可能包含社区回复，并不一定是提案人的进展报告', 'Latest forum activity may include community replies, not just proposer progress reports')} className="inline-flex items-center gap-2"><Clock3 className="size-4 shrink-0" aria-hidden="true" />{t('更新于 ', 'Updated ')}<time dateTime={proposal.updatedAt}>{localizedDate(proposal.updatedAt)}</time></span></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><a href={proposal.originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c8ff67] px-5 py-2.5 text-sm font-semibold text-[#102119] transition hover:bg-[#b9ed60] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7fe0bc]">{t('查看原始提案', 'View original proposal')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>{proposal.voting?.status === 'active' && <a href={proposal.voting.url} target="_blank" rel="noreferrer" className={heroAction}>{t('前往投票', 'Cast your vote')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>}<Link href={`/subscription?proposal=${encodeURIComponent(proposal.id)}`} className={heroAction}>{t('关注此提案', 'Watch updates')}</Link></div>
      {state === 'fallback' && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-white/5 p-3 text-sm"><p className="flex-1 leading-6 text-white/75">{t('当前显示最近可用记录；部分公开来源暂不可用，不能据此判断提案已终止。', 'Showing the latest available record. Some public sources are unavailable; this does not imply the proposal ended.')}</p><button type="button" onClick={retry} className={heroAction}><RefreshCw className="size-4" aria-hidden="true" />{t('重试', 'Retry')}</button></div>}
    </div></section>

    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8 lg:px-8 lg:py-10">
      <div className="min-w-0 space-y-6">
        <article id="overview" className={`${panel} scroll-mt-28`} aria-labelledby="overview-title"><h2 id="overview-title" className="text-xl font-bold">{t('提案概览', 'Proposal overview')}</h2><p className="mt-4 max-w-prose text-base leading-8 text-foreground/85 sm:text-lg">{getProposalOverview(proposal, locale)}</p><dl className="mt-6 grid gap-3 sm:grid-cols-2"><div data-detail-budget className="min-w-0 rounded-xl bg-muted/60 p-4"><dt className="text-xs font-semibold text-muted-foreground">{t('申请预算', 'Requested budget')}</dt><dd className="mt-1 break-words font-mono text-xl font-semibold tabular-nums">{proposal.budgetLabel ?? t('原帖未明确标注', 'Not clearly stated')}</dd></div><div className="min-w-0 rounded-xl bg-muted/60 p-4"><dt className="text-xs font-semibold text-muted-foreground">{t('里程碑结构', 'Milestone structure')}</dt><dd className="mt-1 font-semibold">{milestoneStructure ?? (milestones.length ? t(`${milestones.length} 个阶段`, `${milestones.length} milestone${milestones.length === 1 ? '' : 's'}`) : t('原帖未明确拆分', 'No explicit breakdown'))}</dd></div></dl>
          {milestones.length > 0 ? <section id="milestones" className="mt-7 scroll-mt-28" aria-labelledby="milestones-title"><h2 id="milestones-title" className="text-lg font-bold">{t('路线图与里程碑', 'Roadmap & milestones')}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('以下是提案的计划交付内容，列出阶段不代表已完成；交付情况请核对进展报告。', 'These are planned deliverables. Listing a stage does not establish completion; consult delivery reports for evidence.')}</p><ol className="mt-4 space-y-3">{milestones.map((milestone, index) => {
            const title = locale === 'en' ? milestone.titleEn ?? milestone.title : milestone.titleZh ?? milestone.title;
            const description = locale === 'en' ? milestone.descriptionEn ?? milestone.description : milestone.descriptionZh ?? milestone.description;
            const budget = locale === 'en' ? milestone.budgetEn ?? milestone.budget : milestone.budgetZh ?? milestone.budget;
            return <li key={`${milestone.title}-${index}`} className="rounded-xl border border-border bg-background/60 p-4 sm:p-5"><div className="flex items-start gap-3"><span aria-hidden="true" className="pt-0.5 font-mono text-sm font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div data-milestone-heading className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2"><h3 className="min-w-0 basis-full font-semibold leading-7 sm:basis-0 sm:grow">{title}</h3>{budget && <p data-milestone-budget className="ml-auto max-w-full break-words text-right font-mono text-sm font-semibold leading-7 text-primary">{t('对应预算：', 'Allocated budget: ')}{budget}</p>}</div><p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{description}</p></div></div></li>;
          })}</ol></section> : <p className="mt-4 text-sm leading-6 text-muted-foreground">{t('原始提案未明确拆分里程碑；此处仅展示可从来源核验的目标与预算。', 'The source does not explicitly break down milestones. Only verifiable objectives and budget are shown.')}</p>}
        </article>

        <section id="governance" className={`${panel} scroll-mt-28`} aria-labelledby="governance-title"><h2 id="governance-title" className="text-xl font-bold">{t('治理路径', 'Governance path')}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('空心圆：未开始 · 圆点：进行中 · 勾：阶段完成 · 横线：已结束', 'Open circle: not started · Dot: in progress · Check: stage complete · Dash: ended')}</p><ol className="mt-5 grid gap-4 sm:grid-cols-3">{steps.map((step, index) => <li data-governance-step={index + 1} key={step.title} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="inline-flex min-w-0 items-center gap-2 font-semibold"><span data-governance-number aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">{index + 1}</span>{step.title}</h3><span aria-hidden="true" className="text-primary">{stageStates[index] === 'complete' ? <Check className="size-5" /> : stageStates[index] === 'current' ? <CircleDot className="size-5" /> : stageStates[index] === 'ended' ? <span className="inline-block w-5 text-center">—</span> : <Circle className="size-5" />}</span><span className="sr-only">{stageStates[index] === 'complete' ? t('阶段完成', 'Stage complete') : stageStates[index] === 'current' ? t('进行中', 'In progress') : stageStates[index] === 'ended' ? t('已结束', 'Ended') : t('尚未开始', 'Not started')}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p></li>)}</ol></section>

        <section id="updates" className={`${panel} scroll-mt-28`} aria-labelledby="updates-title"><h2 id="updates-title" className="text-xl font-bold">{t('进展与更新', 'Progress and updates')}</h2>
          {progressNote && <div className="mt-4 rounded-xl bg-secondary p-4 text-sm leading-7"><p data-progress-note className="line-clamp-1 min-w-0 focus-within:line-clamp-none" title={plainInlineText(progressNote)}><InlineLinks text={progressNote} /></p></div>}
          {updates.length > 0 ? <ol className="mt-6 divide-y divide-border">{updates.map((update) => <li key={update.url}>
            <a data-proposal-update href={update.url} target="_blank" rel="noreferrer" className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-lg py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:gap-x-5">
              <span className="col-start-1 row-start-1 font-mono text-xs leading-6 text-muted-foreground">{update.date ? <time dateTime={update.date}>{localizedDate(update.date)}</time> : t('日期待核验', 'Date unverified')}</span>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1"><h3 className="line-clamp-1 break-words text-sm font-semibold leading-6 group-hover:text-primary" title={locale === 'en' ? update.titleEn ?? update.title : update.titleZh ?? update.title}>{locale === 'en' ? update.titleEn ?? update.title : update.titleZh ?? update.title}</h3><p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{t('更新者：', 'By ')}{update.author}</p></div>
              <ExternalLink className="col-start-2 row-start-1 mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary sm:col-start-3" aria-hidden="true" />
            </a>
          </li>)}</ol> : !progressNote && <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground">{t('尚未发现提案人发布的可核验进展或完结报告。这不代表项目没有开展工作；完整回帖请查看原始提案。', 'No verifiable progress or completion report from the proposer was found. This does not establish inactivity; see the source for the complete discussion.')}</p>}
        </section>
      </div>

      <aside data-detail-sidebar className="min-w-0 space-y-6" aria-label={t('讨论与来源', 'Discussion and sources')}>
        <section className={panel} aria-labelledby="discussion-title"><h2 id="discussion-title" className="text-lg font-bold">{t('公开讨论', 'Public discussion')}</h2><dl className="mt-4 grid grid-cols-3 gap-2">{[[t('当前首帖赞数', 'Current first-post likes'), formatCompact(proposal.discussion.likes)], [t('回复', 'Replies'), formatCompact(proposal.discussion.replies)], [t('浏览', 'Views'), formatCompact(proposal.discussion.views)]].map(([label, value]) => <div key={label}><dt className="min-h-9 text-xs leading-5 text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-lg font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-muted-foreground">{t('当前赞数并非七天截止时的赞数，不能仅凭当前数量判断是否在讨论期内达到门槛。', 'The current like count is not a seven-day cutoff snapshot and does not by itself prove the discussion threshold was met in time.')}</p></section>
        <VotePanel proposal={proposal} />
        <section id="sources" className={`${panel} scroll-mt-28`} aria-labelledby="sources-title"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden="true" /><h2 id="sources-title" className="text-lg font-bold">{t('来源与核验', 'Sources and verification')}</h2></div><ul className="mt-3 divide-y divide-border">{proposal.sources.map((source) => <li key={`${source.label}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm font-semibold leading-6 text-primary">{localizedSourceLabel(source.label, source.url, locale)}<ExternalLink className="size-4 shrink-0" aria-hidden="true" /></a></li>)}</ul><p className="mt-3 text-xs leading-6 text-muted-foreground">{t('申请、批准和实际拨付是不同概念。数据存在冲突时，以原始论坛、投票页和链上证据为准。', 'Requested, approved, and disbursed amounts are different. When records conflict, consult the original forum, voting page, and on-chain evidence.')}</p></section>
      </aside>
    </div></main><SiteFooter />
  </div>;
}
