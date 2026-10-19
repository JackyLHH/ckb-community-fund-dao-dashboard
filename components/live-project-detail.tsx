'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { StaticLink as Link } from '@/components/static-link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Circle, CircleDot, Clock3, Copy, ExternalLink, FileText, RefreshCw, UserRound } from 'lucide-react';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { ProposalStatusTags } from '@/components/proposal-status-tags';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { classifyProgressUpdate, progressUpdateCategoryLabel } from '@/lib/digest-activity';
import { detailStageStates, detailUpdateCategory, localizedSourceLabel, sortDetailUpdates, updateMatchesFilter, updateMonthKey, type UpdateFilter } from '@/lib/proposal-detail-ux';
import { getProposalOverview, formatCompact, formatDate, getProposalStatusTags, getProposalTitle, projectTypeLabels, type Proposal } from '@/lib/proposals';
import { useLiveProject } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

const panel = 'rounded-2xl border border-border bg-card p-5 sm:p-7';
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';

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
  if (!voting) return <section id="voting" className={`${panel} scroll-mt-28`} aria-labelledby="vote-title"><h2 id="vote-title" className="text-lg font-bold">{t('Metaforo 投票', 'Metaforo voting')}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{proposal.votingPageNotFound ? t('未找到对应投票页。', 'No corresponding voting page was found.') : t('尚未核验到对应投票页。发现链接不代表已经开始或完成投票。', 'A corresponding voting page has not been verified. Finding a link alone does not establish that voting has started or finished.')}</p></section>;
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
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>('all');
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
  useEffect(() => {
    if (copied === 'idle') return;
    const timer = window.setTimeout(() => setCopied('idle'), 4000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied('done'); } catch { setCopied('failed'); }
  }

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
  const latestUpdate = updates[0];
  const filteredUpdates = updates.filter((update) => updateMatchesFilter(detailUpdateCategory(update, classifyProgressUpdate(update.title)).kind, updateFilter, update.title));
  const groups = new Map<string, typeof updates>();
  for (const update of filteredUpdates) { const key = updateMonthKey(update.date); groups.set(key, [...(groups.get(key) ?? []), update]); }
  const localizedDate = (date: string) => formatDate(date, locale === 'en' ? 'en-US' : 'zh-CN');
  const steps = [
    { title: t('讨论', 'Discussion'), detail: statusTags.includes('discussion') ? t('处于七天讨论阶段', 'Within the seven-day discussion stage') : t('讨论阶段已结束', 'Discussion stage ended') },
    { title: t('投票', 'Voting'), detail: proposal.voting?.status === 'active' ? t('投票进行中，当前结果仍会变化', 'Voting is open; the tally can still change') : statusTags.includes('vote-passed') ? t('投票通过', 'Vote passed') : statusTags.includes('vote-failed') ? t('投票未通过', 'Vote not passed') : proposal.voting ? t('已发现链接，投票状态待核验', 'Link found; voting status unverified') : t('尚未发现投票页', 'No voting page found') },
    { title: t('执行', 'Execution'), detail: completed ? t('已完成', 'Completed') : stageStates[2] === 'current' ? t('正在进行中', 'In progress') : stageStates[2] === 'ended' ? t('已结束', 'Ended') : t('尚未开始', 'Not started') },
  ];
  const nav = [['overview', t('概览', 'Overview')], ...(milestones.length ? [['milestones', t('里程碑', 'Milestones')]] : []), ['governance', t('治理路径', 'Governance')], ['voting', t('投票', 'Voting')], ['updates', t('进展', 'Updates')], ['sources', t('来源', 'Sources')]];

  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main-content" tabIndex={-1}>
    <section className="border-b border-border bg-card"><div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href={directoryUrl} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden="true" />{t('返回提案目录', 'Back to proposals')}</Link><LiveSyncBadge state={state} fetchedAt={proposal.lastVerifiedAt} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><ProposalStatusTags proposal={proposal} /><span className="text-sm font-semibold text-muted-foreground">{locale === 'en' ? proposal.projectType : projectTypeLabels[proposal.projectType] ?? proposal.projectType}</span><span className="font-mono text-xs text-muted-foreground">#{proposal.id}</span></div>
      <h1 className={`mt-4 max-w-5xl break-words font-bold tracking-tight ${locale === 'zh' ? 'text-[clamp(1.75rem,3.8vw,2.75rem)] leading-[1.3]' : 'text-[clamp(1.75rem,3.8vw,3rem)] leading-[1.15]'}`}>{displayTitle}</h1>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><UserRound className="size-4" aria-hidden="true" />{t('提案人：', 'Proposer: ')}{proposal.author}</span><span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />{t('发布于 ', 'Published ')}<time dateTime={proposal.createdAt}>{localizedDate(proposal.createdAt)}</time></span><span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />{t('论坛最近活动：', 'Forum activity: ')}<time dateTime={proposal.updatedAt}>{localizedDate(proposal.updatedAt)}</time></span></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-secondary p-4"><p className="text-xs font-semibold text-muted-foreground">{t('申请预算', 'Requested budget')}</p><p className="mt-1 break-words font-mono text-xl font-semibold tabular-nums">{proposal.budgetLabel ?? t('原帖未明确标注', 'Not clearly stated')}</p></div><a href={latestUpdate ? '#updates' : '#sources'} className="rounded-xl border border-border p-4 hover:bg-muted/60"><p className="text-xs font-semibold text-muted-foreground">{t('提案人最近公开更新', 'Latest proposer update')}</p><p className="mt-1 text-sm font-semibold">{latestUpdate ? `${latestUpdate.date ? localizedDate(latestUpdate.date) : t('日期待核验', 'Date unverified')} · ${progressUpdateCategoryLabel(detailUpdateCategory(latestUpdate, classifyProgressUpdate(latestUpdate.title)), locale)}` : t('尚未发现可核验的公开更新', 'No verifiable public update found')}</p></a></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><a href={proposal.originalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">{t('查看原始提案', 'View original proposal')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>{proposal.voting?.status === 'active' && <a href={proposal.voting.url} target="_blank" rel="noreferrer" className={action}>{t('前往投票', 'Cast your vote')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>}<Link href={`/subscription?proposal=${encodeURIComponent(proposal.id)}`} className={action}>{t('关注此提案', 'Watch updates')}</Link><button type="button" className={action} onClick={copyLink}><Copy className="size-4" aria-hidden="true" />{t('复制链接', 'Copy link')}</button><output aria-live="polite" className="text-sm text-muted-foreground">{copied === 'done' ? t('链接已复制', 'Link copied') : copied === 'failed' ? t('未能复制，请从浏览器地址栏复制链接', 'Could not copy. Copy the URL from your browser address bar.') : ''}</output></div>
      {state === 'fallback' && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/60 p-3 text-sm"><p className="flex-1 leading-6 text-muted-foreground">{t('当前显示最近可用记录；部分公开来源暂不可用，不能据此判断提案已终止。', 'Showing the latest available record. Some public sources are unavailable; this does not imply the proposal ended.')}</p><button type="button" onClick={retry} className={action}><RefreshCw className="size-4" aria-hidden="true" />{t('重试', 'Retry')}</button></div>}
    </div></section>

    <nav aria-label={t('本页导航', 'On this page')} className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 lg:px-8">{nav.map(([anchor, label]) => <a key={anchor} href={`#${anchor}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">{label}</a>)}</div></nav>

    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8 lg:px-8 lg:py-10">
      <div className="lg:col-start-2 lg:row-start-1"><VotePanel proposal={proposal} /></div>
      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:row-span-2">
        <article id="overview" className={`${panel} scroll-mt-28`} aria-labelledby="overview-title"><h2 id="overview-title" className="text-xl font-bold">{t('提案概览', 'Proposal overview')}</h2><p className="mt-4 max-w-prose text-base leading-8 text-foreground/85 sm:text-lg">{getProposalOverview(proposal, locale)}</p><dl className="mt-6 rounded-xl bg-muted/60 p-4"><dt className="text-xs font-semibold text-muted-foreground">{t('里程碑结构', 'Milestone structure')}</dt><dd className="mt-1 font-semibold">{milestoneStructure ?? (milestones.length ? t(`${milestones.length} 个阶段`, `${milestones.length} milestone${milestones.length === 1 ? '' : 's'}`) : t('原帖未明确拆分', 'No explicit breakdown'))}</dd></dl>
          {milestones.length > 0 ? <section id="milestones" className="mt-7 scroll-mt-28" aria-labelledby="milestones-title"><h2 id="milestones-title" className="text-lg font-bold">{t('路线图与里程碑', 'Roadmap & milestones')}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('以下是提案的计划交付内容，列出阶段不代表已完成；交付情况请核对进展报告。', 'These are planned deliverables. Listing a stage does not establish completion; consult delivery reports for evidence.')}</p><ol className="mt-4 space-y-3">{milestones.map((milestone, index) => {
            const title = locale === 'en' ? milestone.titleEn ?? milestone.title : milestone.titleZh ?? milestone.title;
            const description = locale === 'en' ? milestone.descriptionEn ?? milestone.description : milestone.descriptionZh ?? milestone.description;
            const budget = locale === 'en' ? milestone.budgetEn ?? milestone.budget : milestone.budgetZh ?? milestone.budget;
            return <li key={`${milestone.title}-${index}`} className="rounded-xl border border-border bg-background/60 p-4 sm:p-5"><div className="flex items-start gap-3"><span aria-hidden="true" className="pt-0.5 font-mono text-sm font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><h3 className="font-semibold leading-7">{title}</h3>{budget && <p className="mt-2 font-mono text-sm font-semibold text-primary">{t('对应预算：', 'Allocated budget: ')}{budget}</p>}<p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{description}</p></div></div></li>;
          })}</ol></section> : <p className="mt-4 text-sm leading-6 text-muted-foreground">{t('原始提案未明确拆分里程碑；此处仅展示可从来源核验的目标与预算。', 'The source does not explicitly break down milestones. Only verifiable objectives and budget are shown.')}</p>}
        </article>

        <section id="governance" className={`${panel} scroll-mt-28`} aria-labelledby="governance-title"><h2 id="governance-title" className="text-xl font-bold">{t('治理路径', 'Governance path')}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('空心圆：未开始 · 圆点：进行中 · 勾：阶段完成 · 横线：已结束', 'Open circle: not started · Dot: in progress · Check: stage complete · Dash: ended')}</p><ol className="mt-5 grid gap-4 sm:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="rounded-xl border border-border p-4"><div className="flex items-center gap-2"><span aria-hidden="true" className="text-primary">{stageStates[index] === 'complete' ? <Check className="size-5" /> : stageStates[index] === 'current' ? <CircleDot className="size-5" /> : stageStates[index] === 'ended' ? <span className="inline-block w-5 text-center">—</span> : <Circle className="size-5" />}</span><h3 className="font-semibold">{step.title}</h3><span className="sr-only">{stageStates[index] === 'complete' ? t('阶段完成', 'Stage complete') : stageStates[index] === 'current' ? t('进行中', 'In progress') : stageStates[index] === 'ended' ? t('已结束', 'Ended') : t('尚未开始', 'Not started')}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p></li>)}</ol></section>

        <section id="updates" className={`${panel} scroll-mt-28`} aria-labelledby="updates-title"><h2 id="updates-title" className="text-xl font-bold">{t('进展与更新', 'Progress and updates')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('最新发布的更新在前；发帖日期与报告涵盖的周期可能不同。', 'Newest posts first. The posting date can differ from the period covered by a report.')}</p>
          {progressNote && <div className="mt-4 rounded-xl bg-secondary p-4 text-sm leading-7"><InlineLinks text={progressNote} /></div>}
          {updates.length > 0 ? <><fieldset aria-label={t('按更新类别筛选', 'Filter update categories')} className="mt-5 flex flex-wrap gap-2">{(['all', 'milestone', 'completion', 'major'] as UpdateFilter[]).map((filter, index) => <button key={filter} type="button" aria-pressed={updateFilter === filter} onClick={() => setUpdateFilter(filter)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${updateFilter === filter ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>{[t('全部', 'All'), t('里程碑报告', 'Milestones'), t('结项报告', 'Completion'), t('关键交付与事项', 'Key events')][index]}</button>)}</fieldset><output className="mt-3 text-xs text-muted-foreground">{t(`${filteredUpdates.length} 条更新`, `${filteredUpdates.length} update${filteredUpdates.length === 1 ? '' : 's'}`)}</output>
            {filteredUpdates.length === 0 && <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{t('此类别下暂无记录，请切换到“全部”。', 'No records in this category. Switch to All to see every update.')}</p>}
            {[...groups].map(([month, entries]) => <div key={month} className="mt-6"><h3 className="border-b border-border pb-2 text-sm font-semibold">{month === 'unknown' ? t('日期待核验', 'Dates unverified') : new Date(`${month}-15T00:00:00Z`).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', timeZone: 'Asia/Shanghai' })}</h3><ol className="divide-y divide-border">{entries.map((update) => {
              const category = detailUpdateCategory(update, classifyProgressUpdate(update.title));
              const label = progressUpdateCategoryLabel(category, locale);
              const rawTitle = locale === 'en' ? update.titleEn ?? update.title : update.titleZh ?? update.title;
              const title = rawTitle.length > 150 ? label : rawTitle;
              return <li key={update.url} className="py-4"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t('发布于 ', 'Posted ')}{update.date ? <time dateTime={update.date}>{localizedDate(update.date)}</time> : t('日期待核验', 'Date unverified')}</span><span>{t('更新者：', 'By ')}{update.author}</span></div><h4 className="mt-2 font-semibold leading-7">{title}</h4>{title !== label && <p className="mt-1 text-sm text-muted-foreground">{label}</p>}<a href={update.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">{t('查看本次更新', 'View this update')}<ExternalLink className="size-4" aria-hidden="true" /></a></li>;
            })}</ol></div>)}</> : !progressNote && <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground">{t('尚未发现提案人发布的可核验进展或完结报告。这不代表项目没有开展工作；完整回帖请查看原始提案。', 'No verifiable progress or completion report from the proposer was found. This does not establish inactivity; see the source for the complete discussion.')}</p>}
        </section>
      </div>

      <aside className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-2" aria-label={t('讨论与来源', 'Discussion and sources')}>
        <section className={panel} aria-labelledby="discussion-title"><h2 id="discussion-title" className="text-lg font-bold">{t('公开讨论', 'Public discussion')}</h2><dl className="mt-4 grid grid-cols-3 gap-2">{[[t('当前首帖赞数', 'Current first-post likes'), formatCompact(proposal.discussion.likes)], [t('回复', 'Replies'), formatCompact(proposal.discussion.replies)], [t('浏览', 'Views'), formatCompact(proposal.discussion.views)]].map(([label, value]) => <div key={label}><dt className="min-h-9 text-xs leading-5 text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-lg font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-muted-foreground">{t('当前赞数并非七天截止时的赞数，不能仅凭当前数量判断是否在讨论期内达到门槛。', 'The current like count is not a seven-day cutoff snapshot and does not by itself prove the discussion threshold was met in time.')}</p></section>
        <section id="sources" className={`${panel} scroll-mt-28`} aria-labelledby="sources-title"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden="true" /><h2 id="sources-title" className="text-lg font-bold">{t('来源与核验', 'Sources and verification')}</h2></div><ul className="mt-3 divide-y divide-border">{proposal.sources.map((source) => <li key={`${source.label}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm font-semibold leading-6 text-primary">{localizedSourceLabel(source.label, source.url, locale)}<ExternalLink className="size-4 shrink-0" aria-hidden="true" /></a></li>)}</ul><p className="mt-4 text-xs leading-6 text-muted-foreground">{t('记录读取时间：', 'Record read: ')}<time dateTime={proposal.lastVerifiedAt}>{localizedDate(proposal.lastVerifiedAt)}</time>{t('。这不代表每个来源都在同一时间更新。', '. Sources may have different update times.')}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{t('申请、批准和实际拨付是不同概念。数据存在冲突时，以原始论坛、投票页和链上证据为准。', 'Requested, approved, and disbursed amounts are different. When records conflict, consult the original forum, voting page, and on-chain evidence.')}</p></section>
      </aside>
    </div></main><SiteFooter />
  </div>;
}
