'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Grid2X2, Info, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { ProjectCard } from '@/components/project-card';
import { StaticLink as Link } from '@/components/static-link';
import { matchesDirectoryQuery, rememberDirectoryContext } from '@/lib/directory-utils';
import { getProposalOverview, getProposalStatusTags, projectTypeLabels, statusDescriptions, statusMeta, type Proposal, type ProposalStatusTag } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

type SortKey = 'updated' | 'newest' | 'likes';
type ViewMode = 'grid' | 'list';
const statusOptions = Object.keys(statusMeta) as ProposalStatusTag[];
const projectTypes = Object.keys(projectTypeLabels);
const validSorts: SortKey[] = ['updated', 'newest', 'likes'];
const statusGuidePreferenceKey = 'ckb-dao-status-guide-hidden';
const viewPreferenceKey = 'ckb-dao-directory-view';
const inputClass = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/35';
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function searchableProposal(proposal: Proposal) {
  return `${proposal.title} ${proposal.titleZh ?? ''} ${proposal.titleEn ?? ''} ${proposal.author} ${getProposalOverview(proposal, 'en')} ${getProposalOverview(proposal, 'zh')} ${proposal.projectType} ${projectTypeLabels[proposal.projectType] ?? ''}`;
}

export function ProjectsExplorer() {
  const { data, state: liveState } = useLiveDataset();
  const { locale, t } = useLocale();
  const proposals = data.proposals;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ProposalStatusTag>('all');
  const [projectType, setProjectType] = useState('all');
  const [fundedOnly, setFundedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('updated');
  const [showStatusGuide, setShowStatusGuide] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');
  const [initialized, setInitialized] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const guideRestoreRef = useRef<HTMLButtonElement>(null);
  const guideTitleRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);
  const fundedRef = useRef<HTMLButtonElement>(null);
  const filtersToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function readLocation() {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      const nextStatus = params.get('status');
      setStatus(nextStatus && statusOptions.includes(nextStatus as ProposalStatusTag) ? nextStatus as ProposalStatusTag : 'all');
      const nextType = params.get('type');
      setProjectType(nextType && projectTypes.includes(nextType) ? nextType : 'all');
      setFundedOnly(params.get('funded') === '1');
      const nextSort = params.get('sort');
      setSort(nextSort && validSorts.includes(nextSort as SortKey) ? nextSort as SortKey : 'updated');
    }
    queueMicrotask(() => {
      readLocation();
      try {
        setShowStatusGuide(window.localStorage.getItem(statusGuidePreferenceKey) !== '1');
        setView(window.localStorage.getItem(viewPreferenceKey) === 'list' ? 'list' : 'grid');
      } catch {
        // Default preferences remain usable without browser storage.
      }
      setInitialized(true);
    });
    window.addEventListener('popstate', readLocation);
    window.addEventListener('pagehide', rememberDirectoryContext);
    return () => {
      window.removeEventListener('popstate', readLocation);
      window.removeEventListener('pagehide', rememberDirectoryContext);
    };
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'set_project_filters',
      title: 'Filter CKB DAO proposals',
      description: 'Update proposal directory filters. Search accepts a title, proposer, number, or Nervos Talk/dashboard proposal URL.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Proposal title, author, overview, ID, or proposal URL.' },
          status: { type: 'string', enum: ['all', ...statusOptions] },
          projectType: { type: 'string', enum: ['all', ...projectTypes] },
          fundedOnly: { type: 'boolean' },
          sort: { type: 'string', enum: validSorts },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Input must be an object.');
        const values = input as Record<string, unknown>;
        if (values.query !== undefined && typeof values.query !== 'string') throw new Error('Query must be a string.');
        if (values.status !== undefined && typeof values.status !== 'string') throw new Error('Status must be a string.');
        if (values.projectType !== undefined && typeof values.projectType !== 'string') throw new Error('Proposal type must be a string.');
        if (values.fundedOnly !== undefined && typeof values.fundedOnly !== 'boolean') throw new Error('fundedOnly must be a boolean.');
        if (values.sort !== undefined && typeof values.sort !== 'string') throw new Error('Sort must be a string.');
        const nextQuery = values.query ?? '';
        const nextStatus = values.status ?? 'all';
        const nextType = values.projectType ?? 'all';
        const nextFunded = values.fundedOnly === true;
        const nextSort = values.sort ?? 'updated';
        if (nextStatus !== 'all' && !statusOptions.includes(nextStatus as ProposalStatusTag)) throw new Error('Unknown status.');
        if (nextType !== 'all' && !projectTypes.includes(nextType)) throw new Error('Unknown proposal type.');
        if (!validSorts.includes(nextSort as SortKey)) throw new Error('Unknown sort order.');
        setQuery(nextQuery);
        setStatus(nextStatus as 'all' | ProposalStatusTag);
        setProjectType(nextType);
        setFundedOnly(nextFunded);
        setSort(nextSort as SortKey);
        const resultCount = proposals.filter((proposal) => {
          if (nextStatus !== 'all' && !getProposalStatusTags(proposal).includes(nextStatus as ProposalStatusTag)) return false;
          if (nextType !== 'all' && proposal.projectType !== nextType) return false;
          if (nextFunded && !proposal.funded) return false;
          return matchesDirectoryQuery(proposal.id, searchableProposal(proposal), nextQuery);
        }).length;
        return { query: nextQuery, status: nextStatus, projectType: nextType, fundedOnly: nextFunded, sort: nextSort, resultCount };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [proposals]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    for (const key of ['q', 'status', 'type', 'funded', 'sort']) params.delete(key);
    if (query) params.set('q', query);
    if (status !== 'all') params.set('status', status);
    if (projectType !== 'all') params.set('type', projectType);
    if (fundedOnly) params.set('funded', '1');
    if (sort !== 'updated') params.set('sort', sort);
    const search = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  }, [initialized, query, status, projectType, fundedOnly, sort]);

  const results = useMemo(() => proposals.filter((proposal) => {
    if (status !== 'all' && !getProposalStatusTags(proposal).includes(status)) return false;
    if (projectType !== 'all' && proposal.projectType !== projectType) return false;
    if (fundedOnly && !proposal.funded) return false;
    return matchesDirectoryQuery(proposal.id, searchableProposal(proposal), query);
  }).sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'likes') return (b.discussion.likes ?? -1) - (a.discussion.likes ?? -1);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }), [fundedOnly, projectType, proposals, query, sort, status]);

  const resultLabel = t(`找到 ${results.length} / 共 ${proposals.length} 份提案`, `${results.length} of ${proposals.length} proposals`);
  useEffect(() => {
    if (!initialized) return;
    const timer = window.setTimeout(() => setAnnouncement(resultLabel), 500);
    return () => window.clearTimeout(timer);
  }, [initialized, resultLabel]);

  const sortLabel = sort === 'newest' ? t('最新发布', 'Newest first') : sort === 'likes' ? t('当前首帖赞数', 'Current first-post likes') : t('最近论坛活动', 'Recent forum activity');
  const chips = [
    ...(query ? [{ key: 'query', label: t(`搜索：${query}`, `Search: ${query}`) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: locale === 'en' ? statusMeta[status].en : statusMeta[status].zh }] : []),
    ...(projectType !== 'all' ? [{ key: 'type', label: locale === 'en' ? projectType : projectTypeLabels[projectType] ?? projectType }] : []),
    ...(fundedOnly ? [{ key: 'funded', label: t('已获资助', 'Funded only') }] : []),
    ...(sort !== 'updated' ? [{ key: 'sort', label: sortLabel }] : []),
  ];

  function removeChip(key: string) {
    if (key === 'query') setQuery('');
    if (key === 'status') setStatus('all');
    if (key === 'type') setProjectType('all');
    if (key === 'funded') setFundedOnly(false);
    if (key === 'sort') setSort('updated');
    // A removed chip also removes its focused button. Move focus to a visible
    // related control rather than dropping keyboard users back to the page.
    const control = key === 'status' ? statusRef.current : key === 'type' ? typeRef.current : key === 'sort' ? sortRef.current : key === 'funded' ? fundedRef.current : searchRef.current;
    const target = control?.getClientRects().length ? control : filtersToggleRef.current;
    target?.focus();
  }

  function reset() {
    setQuery(''); setStatus('all'); setProjectType('all'); setFundedOnly(false); setSort('updated');
    searchRef.current?.focus();
  }

  function toggleStatusGuide(visible: boolean) {
    setShowStatusGuide(visible);
    try {
      if (visible) window.localStorage.removeItem(statusGuidePreferenceKey);
      else window.localStorage.setItem(statusGuidePreferenceKey, '1');
    } catch {
      // Preference still applies for this page visit.
    }
    window.requestAnimationFrame(() => (visible ? guideTitleRef.current : guideRestoreRef.current)?.focus());
  }

  function selectView(next: ViewMode) {
    setView(next);
    try { window.localStorage.setItem(viewPreferenceKey, next); } catch { /* The selected view remains usable. */ }
  }

  return (
    <div>
      <section id="status-guide-panel" hidden={!showStatusGuide} aria-labelledby="status-guide-title" className="relative rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5">
          <button type="button" onClick={() => toggleStatusGuide(false)} aria-label={t('隐藏提案状态说明', 'Hide proposal status guide')} title={t('隐藏提案状态说明', 'Hide proposal status guide')} className={`absolute right-3 top-3 grid size-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground ${focusClass}`}><X className="size-5" aria-hidden="true" /></button>
          <div className="pr-12">
            <h2 ref={guideTitleRef} tabIndex={-1} id="status-guide-title" className={`w-fit rounded text-lg font-bold ${focusClass}`}><I18nText zh="提案状态说明" en="Proposal status guide" /></h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground"><I18nText zh="状态反映不同阶段，同一提案可能同时拥有两个状态。" en="Statuses describe different stages. A proposal may have two at once." /> <Link href="/methodology" className={`inline-flex items-center gap-1 rounded font-semibold text-primary underline-offset-4 hover:underline ${focusClass}`}><I18nText zh="了解判断依据" en="How we verify" /><ArrowRight className="size-3.5" aria-hidden="true" /></Link></p>
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {statusOptions.map((key) => <div key={key} className="flex flex-col items-start gap-1.5">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta[key].className}`}>{locale === 'en' ? statusMeta[key].en : statusMeta[key].zh}</span>
              <p className="text-sm leading-6 text-muted-foreground">{locale === 'en' ? statusDescriptions[key].en : statusDescriptions[key].zh}</p>
            </div>)}
          </div>
      </section>
      {!showStatusGuide && (
        <div className="flex justify-end"><button ref={guideRestoreRef} type="button" onClick={() => toggleStatusGuide(true)} aria-expanded={false} aria-controls="status-guide-panel" className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground ${focusClass}`}><Info className="size-4" aria-hidden="true" /><I18nText zh="显示提案状态说明" en="Show status guide" /></button></div>
      )}

      <search id="proposal-directory" aria-labelledby="directory-search-title" className="mt-5 block scroll-mt-28 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id="directory-search-title" className="text-base font-bold"><I18nText zh="搜索与筛选" en="Search and filter" /></h2><button ref={filtersToggleRef} type="button" aria-expanded={filtersOpen} aria-controls="directory-filters" onClick={() => setFiltersOpen((value) => !value)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted md:hidden ${focusClass}`}><SlidersHorizontal className="size-4" aria-hidden="true" />{t('筛选', 'Filters')}<ChevronDown className={`size-4 transition ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button></div>
        <label htmlFor="proposal-search" className="block text-sm font-medium"><I18nText zh="名称、提案人、编号或链接" en="Name, proposer, number, or link" /></label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input ref={searchRef} id="proposal-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('例如：Fiber、10015，或粘贴提案链接', 'Try Fiber, 10015, or paste a proposal link')} className={`${inputClass} pl-10 pr-12 [&::-webkit-search-cancel-button]:hidden`} autoComplete="off" />
          {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label={t('清除搜索', 'Clear search')} className={`absolute right-0 top-0 grid size-11 place-items-center rounded-xl text-muted-foreground hover:text-foreground ${focusClass}`}><X className="size-4" aria-hidden="true" /></button>}
        </div>
        <div id="directory-filters" className={`mt-4 gap-3 sm:grid-cols-2 md:grid-cols-3 ${filtersOpen ? 'grid' : 'hidden md:grid'}`}>
          <label className="block text-sm font-medium"><span>{t('状态', 'Status')}</span><select ref={statusRef} value={status} onChange={(event) => setStatus(event.target.value as 'all' | ProposalStatusTag)} className={`${inputClass} mt-2`}><option value="all">{t('全部状态', 'All statuses')}</option>{statusOptions.map((value) => <option key={value} value={value}>{locale === 'en' ? statusMeta[value].en : statusMeta[value].zh}</option>)}</select></label>
          <label className="block text-sm font-medium"><span>{t('类型', 'Type')}</span><select ref={typeRef} value={projectType} onChange={(event) => setProjectType(event.target.value)} className={`${inputClass} mt-2`}><option value="all">{t('全部类型', 'All types')}</option>{projectTypes.map((value) => <option key={value} value={value}>{locale === 'en' ? value : projectTypeLabels[value]}</option>)}</select></label>
          <label className="block text-sm font-medium"><span>{t('排序', 'Sort by')}</span><select ref={sortRef} value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className={`${inputClass} mt-2`}><option value="updated">{t('最近论坛活动', 'Recent forum activity')}</option><option value="newest">{t('最新发布', 'Newest first')}</option><option value="likes">{t('当前首帖赞数', 'Current first-post likes')}</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <button ref={fundedRef} type="button" onClick={() => setFundedOnly((value) => !value)} aria-pressed={fundedOnly} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${focusClass} ${fundedOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/60'}`}><span className={`grid size-4 place-items-center rounded border ${fundedOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`} aria-hidden="true">{fundedOnly && <Check className="size-3" />}</span><I18nText zh="仅看已获资助的提案" en="Funded proposals only" /></button>
          {chips.length > 0 && <button type="button" onClick={reset} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-primary ${focusClass}`}><X className="size-4" aria-hidden="true" /><I18nText zh="清除所有筛选" en="Clear all filters" /></button>}
        </div>
        {chips.length > 0 && <ul aria-label={t('已选条件；不同条件需同时符合', 'Active filters; results must match every filter')} className="mt-3 flex flex-wrap gap-2">{chips.map((chip) => <li key={chip.key} className="max-w-full"><button type="button" onClick={() => removeChip(chip.key)} aria-label={t(`移除条件：${chip.label}`, `Remove filter: ${chip.label}`)} className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-2 pl-3 pr-2 text-xs font-semibold text-foreground ${focusClass}`}><span className="max-w-64 truncate">{chip.label}</span><X className="size-4 shrink-0" aria-hidden="true" /></button></li>)}</ul>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{sort === 'likes' ? t('显示当前首帖赞数；是否达到讨论门槛，以 7 天截止时的核验为准。', 'Likes are the current first-post count. Eligibility depends on the verified seven-day deadline count.') : t('“最近论坛活动”可能包含社区回复，并不一定是提案人的进展报告。', 'Recent forum activity may include community replies, not only proposer progress reports.')}</p>
      </search>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-foreground">{resultLabel}</p><div className="mt-1"><LiveSyncBadge state={liveState} fetchedAt={data.meta.generatedAt} /></div></div>
        <fieldset className="inline-flex rounded-xl border border-border bg-card p-1"><legend className="sr-only">{t('提案显示方式', 'Proposal display mode')}</legend>
          <button type="button" onClick={() => selectView('grid')} aria-pressed={view === 'grid'} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${focusClass} ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><Grid2X2 className="size-4" aria-hidden="true" />{t('卡片', 'Cards')}</button>
          <button type="button" onClick={() => selectView('list')} aria-pressed={view === 'list'} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${focusClass} ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><List className="size-4" aria-hidden="true" />{t('紧凑列表', 'Compact list')}</button>
        </fieldset>
      </div>
      <output aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</output>

      {results.length > 0 ? <div className={`mt-4 grid gap-4 ${view === 'grid' ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`}>{results.map((proposal) => <ProjectCard key={proposal.id} proposal={proposal} compact={view === 'list'} />)}</div> : <div className="mt-5 grid min-h-60 place-items-center rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center text-card-foreground"><div><p className="text-lg font-bold"><I18nText zh="没有匹配的提案" en="No matching proposals" /></p><p className="mt-2 text-sm text-muted-foreground"><I18nText zh="检查编号或关键词，或者逐个移除上面的筛选条件。" en="Check the number or keywords, or remove an active filter above." /></p><div className="mt-4 flex flex-wrap justify-center gap-2">{query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className={`min-h-11 rounded-xl border border-border px-4 text-sm font-semibold ${focusClass}`}>{t('只清除搜索词', 'Clear search only')}</button>}<button type="button" onClick={reset} className={`min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground ${focusClass}`}><I18nText zh="查看全部提案" en="Show all proposals" /></button></div></div></div>}
      <p className="mt-5 text-xs leading-5 text-muted-foreground"><I18nText zh="筛选条件保存在网址中，可以复制网址分享当前结果；显示方式仅保存在本设备。" en="Filters are saved in the URL so you can share these results. The display mode is remembered on this device." /></p>
    </div>
  );
}
