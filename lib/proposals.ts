import rawDataset from '../data/proposals.generated.json' with { type: 'json' };
import { cleanProposalTitle } from './proposal-title.js';
import { executionStatusTags } from './proposal-lifecycle.js';
import { proposalCardSummariesById } from './proposal-card-summaries.js';
import { proposalOverviewTranslationsById } from './proposal-overview-translations.js';
import { proposalOverridesById } from './proposal-overrides.js';
import { applyPersistedMilestoneTranslations } from './proposal-milestone-translation.js';
import { applyPersistedTitleTranslation } from './proposal-title-translation.js';
import { isProposalProgressUpdate } from './proposal-progress.ts';
export { isProposalProgressUpdate } from './proposal-progress.ts';

export type ProposalStatusTag =
  | 'discussion'
  | 'voting'
  | 'vote-passed'
  | 'executing'
  | 'vote-failed'
  | 'completed'
  | 'ended';

// `paused` remains readable for the generated fallback dataset. It is normalized
// to the public `ended` label before anything is rendered.
export type ProposalStatus = ProposalStatusTag | 'paused';

export type ProposalVoting = {
  url: string;
  status: 'unknown' | 'active' | 'approved' | 'rejected';
  totalVotes?: number;
  minimumVotes?: number;
  yesPercent?: number;
  passPercent?: number;
  closed?: boolean;
  closesAt?: string;
  openedAt?: string;
  closedAt?: string;
  verifiedAt?: string;
  noteZh?: string;
  noteEn?: string;
};

export type ProposalOverview = {
  objective: string;
  objectiveZh?: string;
  objectiveEn?: string;
  milestones: Array<{
    title: string;
    titleZh?: string;
    titleEn?: string;
    description: string;
    descriptionZh?: string;
    descriptionEn?: string;
    budget?: string | null;
    budgetZh?: string | null;
    budgetEn?: string | null;
    eta?: string | null;
    etaZh?: string | null;
    etaEn?: string | null;
  }>;
};

export type Proposal = {
  id: string;
  slug: string;
  title: string;
  titleZh?: string;
  titleEn?: string;
  originalTitle: string;
  summary: string;
  author: string;
  originalUrl: string;
  createdAt: string;
  updatedAt: string;
  tags: Array<string | { id?: number; name?: string; slug?: string }>;
  projectType: string;
  budgetLabel: string | null;
  discussion: { likes: number | null; replies: number | null; views: number | null };
  voting: ProposalVoting | null;
  funded: boolean;
  fundingNote: string | null;
  updates: Array<{ title: string; titleZh?: string; titleEn?: string; date?: string; url: string; author: string; source?: 'manual' | 'forum' }>;
  status: ProposalStatus;
  statusTags?: ProposalStatusTag[];
  statusReason: string;
  statusExplanationZh?: string;
  statusExplanationEn?: string;
  progressNoteZh?: string;
  progressNoteEn?: string;
  milestoneStructureZh?: string;
  milestoneStructureEn?: string;
  executionComplete?: boolean;
  votingPageNotFound?: boolean;
  hiddenTags?: string[];
  overview?: ProposalOverview;
  lastVerifiedAt: string;
  sources: Array<{ label: string; url: string }>;
};

export type ProposalDataset = {
  meta: {
    generatedAt: string;
    categoryUrl: string;
    proposalCount: number;
    methodology: string;
    sourceUpdatedAt?: string;
    isLive?: boolean;
    usedFallback?: boolean;
  };
  treasury: {
    initialCkb: string;
    remainingCkb: string;
    remainingPercent: number;
    fundedProposalCount: number;
    asOf: string;
    sourceUrl: string;
    forumAsOf?: string;
    balanceSource?: 'chain' | 'funded-list';
    addressUrl?: string;
  };
  proposals: Proposal[];
};

const sourceDataset = rawDataset as ProposalDataset;

export function normalizeProjectType(value: string) {
  const aliases: Record<string, string> = {
    apps: 'Apps',
    'apps & culture': 'Apps',
    'community & content': 'Community & Content',
    ecosystem: 'Ecosystem',
    governance: 'Governance',
    'meta-rule amendment': 'Governance',
    infrastructure: 'Infrastructure',
  };
  return aliases[value.trim().toLocaleLowerCase()] ?? 'Ecosystem';
}

function isUpdateByProposalAuthor(
  update: Proposal['updates'][number],
  proposal: Pick<Proposal, 'author'>,
) {
  return update.author.trim().toLocaleLowerCase() === proposal.author.trim().toLocaleLowerCase()
    && (update.source === 'forum' || isProposalProgressUpdate(update.title));
}

export const dataset: ProposalDataset = {
  ...sourceDataset,
  proposals: sourceDataset.proposals.map((proposal) => {
    const override = proposalOverridesById[proposal.id as keyof typeof proposalOverridesById];
    const merged = (override ? { ...proposal, ...override } : proposal) as Proposal;
    const normalized = {
      ...merged,
      projectType: normalizeProjectType(merged.projectType),
      tags: [],
      updates: override?.updates
        ? merged.updates.map((update) => ({ ...update, source: 'manual' as const }))
        : merged.updates.filter((update) => override?.allowNonAuthorUpdates || isUpdateByProposalAuthor(update, merged)),
    };
    return applyPersistedMilestoneTranslations(applyPersistedTitleTranslation(normalized));
  }),
};

export const proposals = dataset.proposals;

export const statusMeta: Record<
  ProposalStatusTag,
  { zh: string; en: string; className: string; dotClassName: string }
> = {
  discussion: {
    zh: '讨论中',
    en: 'Discussion',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    dotClassName: 'bg-slate-500',
  },
  voting: {
    zh: '正在投票',
    en: 'Voting now',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClassName: 'bg-amber-500',
  },
  'vote-passed': {
    zh: '投票通过',
    en: 'Vote passed',
    className: 'border-teal-200 bg-teal-50 text-teal-800',
    dotClassName: 'bg-teal-500',
  },
  executing: {
    zh: '执行中',
    en: 'In progress',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    dotClassName: 'bg-sky-500',
  },
  'vote-failed': {
    zh: '未投票通过',
    en: 'Vote not passed',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    dotClassName: 'bg-rose-500',
  },
  completed: {
    zh: '已完成',
    en: 'Completed',
    className: 'border-violet-200 bg-violet-50 text-violet-800',
    dotClassName: 'bg-violet-500',
  },
  ended: {
    zh: '已结束',
    en: 'Ended',
    className: 'border-zinc-300 bg-zinc-100 text-zinc-700',
    dotClassName: 'bg-zinc-500',
  },
};

export const statusDescriptions: Record<ProposalStatusTag, { zh: string; en: string }> = {
  discussion: {
    zh: '提案仍在 7 天讨论期内，且尚未进入投票。',
    en: 'The proposal is still within its seven-day discussion window and has not entered voting.',
  },
  voting: {
    zh: 'Metaforo 投票仍在进行，关闭前结果仍可能变化。',
    en: 'Metaforo voting is open and the result can still change before closing.',
  },
  'vote-passed': {
    zh: '投票已结束，最终票数同时满足法定票数与通过比例。',
    en: 'Voting has closed and the final tally meets both quorum and approval thresholds.',
  },
  executing: {
    zh: '提案已通过投票，尚无全部完成或终止的记录，处于执行阶段。',
    en: 'The proposal passed voting and remains in execution until completion or termination is recorded.',
  },
  'vote-failed': {
    zh: '最终投票未达到通过比例或法定票数要求。',
    en: 'The final vote did not meet its approval or quorum requirement.',
  },
  completed: {
    zh: '公开的状态更新或交付证据表明全部提案工作已经完成。',
    en: 'Public updates or delivery evidence show that all proposed work was completed.',
  },
  ended: {
    zh: '首帖未在 7 天内达到 30 个赞，或提案已终止、退款、投票失败或完成。',
    en: 'The first post missed 30 likes in seven days, or the proposal ended through rejection, termination, refund, or completion.',
  },
};

export function getProposalStatusTags(proposal: Proposal, now = new Date()): ProposalStatusTag[] {
  return executionStatusTags(baseProposalStatusTags(proposal, now), proposal.voting?.status === 'approved');
}

function baseProposalStatusTags(proposal: Proposal, now: Date): ProposalStatusTag[] {
  if (proposal.voting?.status === 'active') return ['voting'];
  if (proposal.voting?.status === 'unknown' && proposal.statusTags?.length === 0) return [];
  if (proposal.statusTags?.length) return proposal.statusTags;
  if (proposal.status === 'paused') return ['ended'];
  if (proposal.status === 'executing') return ['vote-passed', 'executing'];
  if (proposal.status === 'voting') return ['voting'];
  if (proposal.status !== 'discussion') return [proposal.status];

  const discussionEndsAt = new Date(proposal.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  if ((proposal.discussion.likes ?? 0) < 30 && now.getTime() > discussionEndsAt) return ['ended'];
  return ['discussion'];
}

export function getStatusExplanation(proposal: Proposal, locale: 'zh' | 'en') {
  const customExplanation = locale === 'en'
    ? proposal.statusExplanationEn ?? proposal.statusExplanationZh
    : proposal.statusExplanationZh ?? proposal.statusExplanationEn;
  if (customExplanation) return customExplanation;
  const tags = getProposalStatusTags(proposal);
  if (tags.includes('completed')) return locale === 'en'
    ? 'Public delivery reports or milestone evidence indicate that all work promised in the proposal has been completed.'
    : '公开交付报告或里程碑证据表明提案承诺的工作已经全部完成。';
  if (tags.includes('vote-failed')) return locale === 'en'
    ? 'The vote did not meet its approval or quorum requirement, so the proposal is closed.'
    : '投票未达到通过比例或法定票数要求，因此提案已结束。';
  if (tags.includes('executing')) return locale === 'en'
    ? 'The proposal passed voting and remains in execution until completion or termination is recorded.'
    : '提案已通过投票，尚无全部完成或终止的记录，处于执行阶段。';
  if (tags.includes('voting')) return locale === 'en'
    ? 'Voting is currently open. The result remains unsettled until the voting period closes.'
    : '投票正在进行，最终结果要到投票期结束后才能确定。';
  if (tags.includes('vote-passed')) return locale === 'en'
    ? 'The Metaforo voting result is approved.'
    : 'Metaforo 投票结果显示该提案已通过。';
  if (tags.includes('ended')) return locale === 'en'
    ? 'The first post did not reach 30 likes within seven days, or public evidence shows the proposal was otherwise closed.'
    : '提案首帖未在 7 天内达到 30 个赞，或公开证据表明提案已经结束。';
  return locale === 'en'
    ? 'The proposal is within its seven-day discussion window and has not yet entered voting.'
    : '提案仍在 7 天讨论期内，尚未进入投票。';
}

export const projectTypeLabels: Record<string, string> = {
  Infrastructure: '基础设施',
  'Community & Content': '社区与内容',
  Governance: '治理',
  Apps: '应用',
  Ecosystem: '生态建设',
};

export function formatDate(value: string, locale = 'zh-CN') {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatCompact(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard' }).format(value);
}

export function getTagName(tag: Proposal['tags'][number]) {
  return typeof tag === 'string' ? tag : tag.name ?? tag.slug ?? '';
}

export function getProposalTitle(proposal: Proposal, locale: 'zh' | 'en') {
  return cleanProposalTitle(locale === 'en'
    ? proposal.titleEn ?? proposal.titleZh ?? proposal.title
    : proposal.titleZh ?? proposal.titleEn ?? proposal.title);
}

// Cards and detail pages share the same unabridged, localized objective.
// Reviewed objectives take precedence over older card summaries and forum excerpts.
export function getProposalOverview(proposal: Proposal, locale: 'zh' | 'en') {
  const overview = proposalOverridesById[proposal.id]?.overview;
  const localized = locale === 'en' ? overview?.objectiveEn : overview?.objectiveZh;
  if (localized?.trim()) return localized.trim();
  const isLanguageMatch = (text: string) => locale === 'en'
    ? !/[\u3400-\u9fff]/u.test(text)
    : /[\u3400-\u9fff]/u.test(text);
  if (overview?.objective?.trim() && isLanguageMatch(overview.objective)) return overview.objective.trim();
  const translatedOverride = locale === 'en' ? proposal.overview?.objectiveEn : proposal.overview?.objectiveZh;
  if (overview && translatedOverride?.trim()) return translatedOverride.trim();
  const curated = proposalCardSummariesById[proposal.id];
  if (curated) return curated[locale];
  const historical = proposalOverviewTranslationsById[proposal.id];
  if (historical?.[locale]?.trim()) return historical[locale].trim();
  const sourceObjective = locale === 'en'
    ? proposal.overview?.objectiveEn ?? proposal.overview?.objective
    : proposal.overview?.objectiveZh ?? proposal.overview?.objective;
  if (sourceObjective?.trim() && isLanguageMatch(sourceObjective)) return sourceObjective.trim();
  const sourceLanguageObjective = overview?.objective?.trim() || proposal.overview?.objective?.trim();
  if (sourceLanguageObjective) return sourceLanguageObjective;
  const summary = proposal.summary
    .replace(proposal.originalTitle, '')
    .replace(proposal.title, '')
    .replace(proposal.titleZh ?? '', '')
    .replace(proposal.titleEn ?? '', '')
    .replace(/^\s*(summary|摘要)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const isGeneratedFallback = !summary
    || summary === '原帖未提供可提取的摘要。'
    || summary === '原始讨论帖暂未提供可提取的简短摘要，请前往来源页查看完整内容。';
  if (isGeneratedFallback) return getProposalTitle(proposal, locale);
  return summary;
}

export function cleanSummary(proposal: Proposal, maxLength = 230, locale: 'zh' | 'en' = 'zh') {
  const summary = getProposalOverview(proposal, locale);
  return summary.length > maxLength ? `${summary.slice(0, maxLength).trim()}…` : summary;
}

export function findProposal(slug: string) {
  return proposals.find((proposal) => proposal.slug === slug);
}
