'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Info, Search, SlidersHorizontal, X } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveSyncBadge } from '@/components/live-sync-badge';
import { ProjectCard } from '@/components/project-card';
import { getProposalOverview, getProposalStatusTags, projectTypeLabels, statusDescriptions, statusMeta, type ProposalStatusTag } from '@/lib/proposals';
import { useLiveDataset } from '@/lib/use-live-data';
import { useLocale } from '@/lib/use-locale';

type SortKey = 'updated' | 'newest' | 'likes';

const statusOptions = Object.keys(statusMeta) as ProposalStatusTag[];
const statusGuidePreferenceKey = 'ckb-dao-status-guide-hidden';

export function ProjectsExplorer() {
  const { data, state: liveState } = useLiveDataset();
  const { locale, t } = useLocale();
  const proposals = data.proposals;
  const projectTypes = useMemo(() => [...new Set(proposals.map((proposal) => proposal.projectType))].sort(), [proposals]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ProposalStatusTag>('all');
  const [projectType, setProjectType] = useState('all');
  const [fundedOnly, setFundedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('updated');
  const [showStatusGuide, setShowStatusGuide] = useState(true);

  useEffect(() => {
    try {
      setShowStatusGuide(window.localStorage.getItem(statusGuidePreferenceKey) !== '1');
    } catch {
      setShowStatusGuide(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery(params.get('q') ?? '');
      const nextStatus = params.get('status');
      if (nextStatus && statusOptions.includes(nextStatus as ProposalStatusTag)) setStatus(nextStatus as ProposalStatusTag);
      const nextType = params.get('type');
      if (nextType && projectTypes.includes(nextType)) setProjectType(nextType);
      setFundedOnly(params.get('funded') === '1');
      const nextSort = params.get('sort');
      if (nextSort && ['updated', 'newest', 'likes'].includes(nextSort)) setSort(nextSort as SortKey);
    });
  }, [projectTypes]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validSorts: SortKey[] = ['updated', 'newest', 'likes'];

    void Promise.resolve(
      context.registerTool(
        {
          name: 'set_project_filters',
          title: 'Filter CKB DAO proposals',
          description: 'Update the visible CKB Community Fund DAO proposal directory filters and return the number of matching proposals.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Text to search in proposal title, author, summary, or tags.' },
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

            const normalized = nextQuery.trim().toLowerCase();
            const resultCount = proposals.filter((proposal) => {
              if (nextStatus !== 'all' && !getProposalStatusTags(proposal).includes(nextStatus as ProposalStatusTag)) return false;
              if (nextType !== 'all' && proposal.projectType !== nextType) return false;
              if (nextFunded && !proposal.funded) return false;
              if (!normalized) return true;
              return `${proposal.title} ${proposal.titleZh ?? ''} ${proposal.titleEn ?? ''} ${proposal.author} ${getProposalOverview(proposal, 'en')} ${getProposalOverview(proposal, 'zh')}`.toLowerCase().includes(normalized);
            }).length;
            return { query: nextQuery, status: nextStatus, projectType: nextType, fundedOnly: nextFunded, sort: nextSort, resultCount };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [projectTypes, proposals]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status !== 'all') params.set('status', status);
    if (projectType !== 'all') params.set('type', projectType);
    if (fundedOnly) params.set('funded', '1');
    if (sort !== 'updated') params.set('sort', sort);
    const search = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
  }, [query, status, projectType, fundedOnly, sort]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return proposals
      .filter((proposal) => {
        if (status !== 'all' && !getProposalStatusTags(proposal).includes(status)) return false;
        if (projectType !== 'all' && proposal.projectType !== projectType) return false;
        if (fundedOnly && !proposal.funded) return false;
        if (!normalized) return true;
        return `${proposal.title} ${proposal.titleZh ?? ''} ${proposal.titleEn ?? ''} ${proposal.author} ${getProposalOverview(proposal, 'en')} ${getProposalOverview(proposal, 'zh')} ${proposal.tags.map((tag) => typeof tag === 'string' ? tag : tag.name ?? tag.slug ?? '').join(' ')}`
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => {
        if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === 'likes') return (b.discussion.likes ?? -1) - (a.discussion.likes ?? -1);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [fundedOnly, projectType, proposals, query, sort, status]);

  const hasFilters = query || status !== 'all' || projectType !== 'all' || fundedOnly || sort !== 'updated';

  function reset() {
    setQuery('');
    setStatus('all');
    setProjectType('all');
    setFundedOnly(false);
    setSort('updated');
  }

  function hideStatusGuide() {
    setShowStatusGuide(false);
    try {
      window.localStorage.setItem(statusGuidePreferenceKey, '1');
    } catch {
      // Keep the current-page preference even when browser storage is unavailable.
    }
  }

  function revealStatusGuide() {
    setShowStatusGuide(true);
    try {
      window.localStorage.removeItem(statusGuidePreferenceKey);
    } catch {
      // Keep the current-page preference even when browser storage is unavailable.
    }
  }

  return (
    <div>
      {showStatusGuide ? (
        <section aria-labelledby="status-guide-title" className="relative rounded-[22px] border border-black/10 bg-white p-5 shadow-[0_12px_35px_rgb(11_15_14/4%)] sm:p-6">
          <button
            type="button"
            onClick={hideStatusGuide}
            aria-label={t('隐藏提案状态说明', 'Hide proposal status guide')}
            title={t('隐藏提案状态说明', 'Hide proposal status guide')}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-black/10 bg-[#f5f7f2] text-black/45 transition hover:border-[#00a873]/40 hover:bg-[#e3f8ef] hover:text-[#087958] focus:outline-none focus:ring-2 focus:ring-[#00a873]/30 sm:right-5 sm:top-5"
          >
            <X className="size-4" />
          </button>

          <div className="pr-11">
            <p className="label-caps text-[#087958]"><I18nText zh="状态图例" en="Status guide" /></p>
            <h2 id="status-guide-title" className="mt-2 text-xl font-black tracking-[-.025em] sm:text-2xl">
              <I18nText zh="每个提案状态代表什么" en="What each proposal status means" />
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
              <I18nText zh="状态根据讨论、投票、拨款和公开交付证据判断；同一提案可能同时拥有两个状态。" en="Statuses are based on discussion, voting, funding, and public delivery evidence. A proposal may carry two statuses at the same time." />
            </p>
            <a href="/methodology" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#087958] transition hover:text-[#00a873]">
              <I18nText zh="查看完整数据方法" en="View full methodology" /> <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-4 border-t border-black/8 pt-5 sm:grid-cols-2 xl:grid-cols-3">
            {statusOptions.map((key) => {
              const item = statusMeta[key];
              const description = statusDescriptions[key];
              return (
                <div key={key} className="grid grid-cols-[auto_1fr] items-start gap-3">
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${item.className}`}>
                    {locale === 'en' ? item.en : item.zh}
                  </span>
                  <p className="text-sm leading-6 text-black/52">{locale === 'en' ? description.en : description.zh}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={revealStatusGuide}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs font-bold text-black/55 shadow-[0_8px_24px_rgb(11_15_14/4%)] transition hover:border-[#00a873]/40 hover:bg-[#e3f8ef] hover:text-[#087958] focus:outline-none focus:ring-2 focus:ring-[#00a873]/30"
          >
            <Info className="size-4" />
            <I18nText zh="显示提案状态说明" en="Show proposal status guide" />
          </button>
        </div>
      )}

      <div className="mt-5 rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_12px_35px_rgb(11_15_14/5%)] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_190px_170px]">
          <label className="relative block">
            <span className="sr-only"><I18nText zh="搜索提案" en="Search proposals" /></span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('搜索提案、作者或标签…', 'Search proposals, authors, or tags…')}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#f5f7f2] pl-10 pr-3 text-sm outline-none transition focus:border-[#00a873] focus:ring-2 focus:ring-[#00a873]/20"
            />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | ProposalStatusTag)}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#f5f7f2] px-3 text-sm outline-none focus:ring-2 focus:ring-[#00a873]"
            >
              <option value="all">{t('全部状态', 'All statuses')}</option>
              {statusOptions.map((value) => <option key={value} value={value}>{locale === 'en' ? statusMeta[value].en : statusMeta[value].zh}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Proposal type</span>
            <select
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#f5f7f2] px-3 text-sm outline-none focus:ring-2 focus:ring-[#00a873]"
            >
              <option value="all">{t('全部类型', 'All types')}</option>
              {projectTypes.map((value) => <option key={value} value={value}>{locale === 'en' ? value : projectTypeLabels[value] ?? value}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#f5f7f2] px-3 text-sm outline-none focus:ring-2 focus:ring-[#00a873]"
            >
              <option value="updated">{t('最近更新', 'Recently updated')}</option>
              <option value="newest">{t('最新发布', 'Newest')}</option>
              <option value="likes">{t('最多赞', 'Most liked')}</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4">
          <button
            type="button"
            onClick={() => setFundedOnly((value) => !value)}
            aria-pressed={fundedOnly}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition ${
              fundedOnly ? 'border-[#00a873] bg-[#e3f8ef] text-[#087958]' : 'border-black/10 bg-white text-black/55 hover:border-[#00a873]/50'
            }`}
          >
            <span className={`grid size-4 place-items-center rounded-full border ${fundedOnly ? 'border-[#00a873] bg-[#00a873] text-white' : 'border-black/20'}`}>
              {fundedOnly && <Check className="size-3" />}
            </span>
            <I18nText zh="仅看已获资助的提案" en="Funded only" />
          </button>
          {hasFilters && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/45 hover:text-[#087958]">
              <X className="size-3.5" /> <I18nText zh="清除筛选" en="Reset filters" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-black/55">
            <I18nText zh={`找到 ${results.length} 个提案`} en={`${results.length} proposals`} />
          </p>
          <LiveSyncBadge state={liveState} fetchedAt={data.meta.generatedAt} />
        </div>
        <p className="hidden items-center gap-1.5 text-xs text-black/35 sm:inline-flex"><SlidersHorizontal className="size-3.5" /><I18nText zh="筛选状态保存在网址中" en="Filters are saved in the URL" /></p>
      </div>

      {results.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((proposal) => <ProjectCard key={proposal.id} proposal={proposal} />)}
        </div>
      ) : (
        <div className="mt-5 grid min-h-72 place-items-center rounded-[22px] border border-dashed border-black/15 bg-white px-6 text-center">
          <div>
            <p className="text-lg font-black"><I18nText zh="没有匹配的提案" en="No matching proposals" /></p>
            <p className="mt-2 text-sm text-black/45"><I18nText zh="尝试清除部分筛选条件。" en="Try removing one or more filters." /></p>
            <button type="button" onClick={reset} className="mt-5 rounded-full bg-[#096c4c] px-4 py-2 text-xs font-bold text-white"><I18nText zh="重置筛选" en="Reset filters" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
