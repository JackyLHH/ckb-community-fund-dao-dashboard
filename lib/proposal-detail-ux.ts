import type { Proposal, ProposalStatusTag } from './proposals';
import type { ProposalOverride } from './proposal-overrides';
import type { ProgressUpdateCategory } from './digest-activity';

export type UpdateFilter = 'all' | 'milestone' | 'completion' | 'major';
export type DetailStageState = 'upcoming' | 'current' | 'complete' | 'ended';

export function reviewedDetailCache(cached: Proposal, review?: ProposalOverride, currentRecord?: Proposal): Proposal {
  if (!review) return cached;
  const { updates, allowNonAuthorUpdates: _allow, useOnlyOverrideUpdates: onlyReviewed, ...fields } = review;
  const reviewedUpdates = currentRecord?.updates ?? updates ?? [];
  return {
    ...cached,
    ...fields,
    // The current build's reviewed milestone translations outrank data saved
    // by an earlier deployment, even while the network is still loading.
    ...(review.overview ? { overview: currentRecord?.overview ?? review.overview } : {}),
    updates: onlyReviewed ? reviewedUpdates : [...new Map([...cached.updates, ...reviewedUpdates].map((update) => [update.url, update])).values()],
  };
}

// This is a display-only refinement for short, explicit report headings.
// Digest event detection deliberately remains unchanged and more conservative.
export function detailUpdateCategory(update: Pick<Proposal['updates'][number], 'title' | 'titleEn' | 'titleZh'>, fallback: ProgressUpdateCategory): ProgressUpdateCategory {
  if (fallback.kind === 'milestone' || fallback.kind === 'completion') return fallback;
  for (const value of [update.title, update.titleEn, update.titleZh]) {
    if (!value) continue;
    const heading = value.replace(/^\s*\[(?:status update|update)\]\s*/i, '').trim();
    const match = heading.match(/^(?:[^:\n]{1,70}:\s*)?milestone\s*(?:#|no\.?)?\s*([0-9]+(?:\.[0-9]+)?|[ivxlcdm]+)\s+(?:(?:is|has been)\s+)?(?:now\s+)?(completed|complete|delivered|completion\s+report|delivery\s+report)(?=\s*[:：—–.-]|\s*$)/i)
      ?? heading.match(/^(?:[^：\n]{1,50}：\s*)?里程碑\s*(?:第|#)?\s*([0-9一二三四五六七八九十]+)\s*(?:已|已经)?\s*(完成|交付)(?:报告)?(?=\s*[:：—–.-]|\s*$)/i);
    if (match) return { kind: 'milestone', milestone: match[1].toUpperCase(), completion: true };
  }
  return fallback;
}

// Presentation only: these stages never change the underlying reviewed tags.
export function detailStageStates(proposal: Pick<Proposal, 'voting' | 'executionComplete' | 'funded'>, tags: ProposalStatusTag[]): DetailStageState[] {
  const ended = tags.includes('ended');
  const complete = tags.includes('completed');
  const passed = tags.includes('vote-passed') || proposal.voting?.status === 'approved';
  const failed = tags.includes('vote-failed') || proposal.voting?.status === 'rejected';
  const voteComplete = passed || failed || proposal.voting?.closed === true;
  const voting = proposal.voting?.status === 'active' || tags.includes('voting');
  const executing = proposal.executionComplete !== false && (tags.includes('executing') || proposal.funded || proposal.executionComplete === true);
  return [
    tags.includes('discussion') ? 'current' : ended && !proposal.voting && !passed ? 'ended' : 'complete',
    voteComplete ? 'complete' : voting ? 'current' : ended ? 'ended' : 'upcoming',
    complete ? 'complete' : ended ? 'ended' : executing ? 'current' : 'upcoming',
  ];
}

export function sortDetailUpdates<T extends { date?: string; url: string }>(updates: T[]) {
  return [...updates].sort((a, b) => {
    const left = Date.parse(a.date ?? '');
    const right = Date.parse(b.date ?? '');
    return (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
  });
}

export function updateMatchesFilter(kind: string, filter: UpdateFilter, text = '') {
  if (filter === 'all') return true;
  if (filter === 'milestone') return kind === 'milestone';
  if (filter === 'completion') return kind === 'completion';
  return ['milestone', 'completion', 'delivery'].includes(kind)
    || /\b(?:refund(?:ed)?|terminat(?:ed|ion)|discontinu(?:ed|ation))\b|退款|退回|终止|停止开发/i.test(text);
}

export function updateMonthKey(date?: string) {
  const parsed = Date.parse(date ?? '');
  if (!Number.isFinite(parsed)) return 'unknown';
  // Stable Beijing grouping matches the dashboard's digest reporting calendar.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(parsed);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

export function localizedSourceLabel(label: string, url: string, locale: 'zh' | 'en') {
  if (locale === 'en') {
    if (/原始提案|原帖/.test(label)) return 'Original Nervos Talk proposal';
    if (/资助/.test(label)) return 'Funded proposals list';
    if (/投票/.test(label)) return 'Metaforo voting source';
    if (/完成|交付|结项/.test(label)) return 'Delivery or completion evidence';
    if (/[\u3400-\u9fff]/u.test(label)) return 'Original public evidence';
    return label;
  }
  if (/metaforo|corrected vote|voting/i.test(label) || /dao\.ckb\.community/.test(url)) return 'Metaforo 投票来源';
  if (/funded/i.test(label)) return '已资助提案清单';
  if (/completion|delivery|launch update/i.test(label)) return '交付或完成记录';
  if (/proposal|original|source topic/i.test(label)) return 'Nervos Talk 原始提案';
  if (!/[\u3400-\u9fff]/u.test(label)) return /talk\.nervos\.org/.test(url) ? 'Nervos Talk 相关记录' : '原始来源';
  return label;
}

export function validProposalId(id: string | null) {
  return id !== null && /^\d{1,12}$/.test(id) && Number(id) > 0;
}

export function proposalUnavailableReason(status: number) {
  // Only an explicit 404 means "not found". Forbidden/rate-limited/offline
  // public sources must not be represented as a deleted proposal.
  return status === 404 ? 'not-found' : 'unavailable';
}
