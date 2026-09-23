import {
  dataset as fallbackDataset,
  isProposalProgressUpdate,
  normalizeProjectType,
  type Proposal,
  type ProposalDataset,
  type ProposalOverview,
  type ProposalStatusTag,
  type ProposalVoting,
} from '@/lib/proposals';
import {
  completionEvidenceByProposalId,
  invalidVotingProposalIds,
  voteEvidenceByProposalId,
} from '@/lib/status-evidence';
import { proposalOverridesById } from '@/lib/proposal-overrides';
import { translateMissingProposalOverview } from '@/lib/proposal-translation';
import { translateMissingProposalMilestones } from '@/lib/proposal-milestone-translation';
import {
  extractMilestoneBudget,
  extractProposalBudget as extractBudget,
  extractProposalObjective,
} from '@/lib/digest-activity';

const categoryEndpoint = '/live/nervos/category';
const fundedTopicEndpoint = '/live/nervos/topic/7793';
const topicEndpoint = (id: string) => `/live/nervos/topic/${encodeURIComponent(id)}`;
const balanceEndpoint = '/live/ckb/dao-balance';
const forumBase = 'https://talk.nervos.org';
const daoAddressUrl = 'https://explorer.nervos.org/address/ckb1qyqnrg4jfx82g29l44q6d93jnrm5ytcp0d8sjfev2q';

type CategoryTopic = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string;
  created_at: string;
  last_posted_at?: string;
  bumped_at?: string;
  tags?: Proposal['tags'];
  like_count?: number;
  op_like_count?: number;
  reply_count?: number;
  posts_count?: number;
  views?: number;
  posters?: Array<{ user_id?: number }>;
};

type CategoryResponse = {
  users?: Array<{ id: number; username: string }>;
  topic_list?: { topics?: CategoryTopic[]; more_topics_url?: string | null };
};

type TopicPost = {
  post_number: number;
  username: string;
  created_at?: string;
  updated_at?: string;
  cooked?: string;
  like_count?: number;
  actions_summary?: Array<{ id: number; count?: number }>;
  reactions?: Array<{ id: string; count: number }>;
};

type TopicResponse = {
  id?: number;
  slug?: string;
  title?: string;
  posts_count?: number;
  reply_count?: number;
  views?: number;
  like_count?: number;
  op_like_count?: number;
  highest_post_number?: number;
  last_posted_at?: string;
  post_stream?: { posts?: TopicPost[] };
};

type FundedEntry = { id: string; budgetLabel: string | null; note: string };

export type LiveDataState = 'loading' | 'live' | 'fallback';

let datasetPromise: Promise<ProposalDataset> | null = null;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function decodeEntities(input = '') {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    return textarea.value;
  }
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

export function stripHtml(input = '') {
  return decodeEntities(
    input
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<\/h\d>/gi, ' ')
      .replace(/<\/li>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function looksLikeProposal(title: string) {
  const normalized = title.trim();
  if (/^\s*(?:\[|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|\))/i.test(normalized)) return false;
  if (/^\s*(?:\[|\()\s*DIS\s*(?:\]|\))/i.test(normalized)) return true;
  return /(grant|funding|sponsorship)\s+proposal|资助提案|赞助提案/i.test(normalized);
}

function cleanTitle(title: string) {
  return title.replace(/^\s*(?:\[|\()\s*DIS\s*(?:\]|\))\s*/i, '').replace(/\s+/g, ' ').trim();
}

function classify(title: string, tags: Proposal['tags'] = []) {
  const tagText = tags.map((tag) => (typeof tag === 'string' ? tag : tag.name ?? tag.slug ?? '')).join(' ');
  const haystack = `${title} ${tagText}`.toLowerCase();
  if (/rule|governance|dao v|规则|治理/.test(haystack)) return 'Governance';
  if (/content|media|campaign|talk show|translation|community|meetup|ama/.test(haystack)) return 'Community & Content';
  if (/fiber|bridge|light client|node|wallet|appchain|infrastructure|sdk|protocol/.test(haystack)) return 'Infrastructure';
  if (/art|nft|game|creator|studio/.test(haystack)) return 'Apps';
  return 'Ecosystem';
}

function extractLinks(html = '') {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => decodeEntities(match[1]))
    .map((url) => (url.startsWith('/') ? `${forumBase}${url}` : url))
    .filter((url) => /^https?:\/\//.test(url));
}

function stripQuotedContent(html = '') {
  return html
    .replace(/<aside\b[^>]*class=["'][^"']*\bquote\b[^"']*["'][^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, ' ');
}

function sameUsername(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function canonicalUpdateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return value;
  }
}

function selectProposalProgressUpdates(posts: TopicPost[], proposer: string, id: string, slug: string) {
  return posts
    .filter((post) => post.post_number > 1 && sameUsername(post.username, proposer))
    .map((post) => ({ post, text: stripHtml(stripQuotedContent(post.cooked ?? '')) }))
    .filter(({ text }) => isProposalProgressUpdate(text))
    .sort((a, b) => a.post.post_number - b.post.post_number)
    .map(({ post, text }) => ({
      title: text.length > 240 ? `${text.slice(0, 240).trim()}…` : text,
      date: post.created_at,
      url: `${forumBase}/t/${slug}/${id}/${post.post_number}`,
      author: post.username,
    }));
}

async function loadAllTopicPosts(id: string, detail: TopicResponse) {
  const initialPosts = detail.post_stream?.posts ?? [];
  const highestPostNumber = detail.highest_post_number ?? detail.posts_count ?? initialPosts.at(-1)?.post_number ?? 1;
  const loadedNumbers = new Set(initialPosts.map((post) => post.post_number));
  const anchors: number[] = [];
  for (let postNumber = 21; postNumber <= highestPostNumber; postNumber += 20) {
    if (!loadedNumbers.has(postNumber)) anchors.push(postNumber);
  }
  if (!loadedNumbers.has(highestPostNumber)) anchors.push(highestPostNumber);
  if (!anchors.length) return initialPosts;

  const windows = await Promise.all(
    [...new Set(anchors)].map((postNumber) =>
      fetchJson<TopicResponse>(`${topicEndpoint(id)}?post_number=${postNumber}`)
        .then((topic) => topic.post_stream?.posts ?? [])
        .catch(() => []),
    ),
  );
  return [...new Map([...initialPosts, ...windows.flat()].map((post) => [post.post_number, post])).values()]
    .sort((a, b) => a.post_number - b.post_number);
}

function votingSourceLabel(voting: ProposalVoting) {
  return /talk\.nervos\.org\/.*\/8973\/70/.test(voting.url)
    ? 'DAO committee corrected vote result'
    : 'Metaforo voting page';
}

function firstPostLikeCount(post: TopicPost | undefined, topic: TopicResponse) {
  const heartReaction = post?.reactions?.find((reaction) => reaction.id === 'heart')?.count;
  const likeAction = post?.actions_summary?.find((action) => action.id === 2)?.count;
  return heartReaction ?? likeAction ?? topic.op_like_count ?? post?.like_count ?? null;
}

function buildVoting(id: string, discovered: ProposalVoting | null): ProposalVoting | null {
  if (invalidVotingProposalIds.has(id) || proposalOverridesById[id]?.votingPageNotFound) return null;
  const voting = voteEvidenceByProposalId[id] ?? discovered;
  if (voting?.status !== 'active' || !voting.closesAt || Date.now() < new Date(voting.closesAt).getTime()) return voting;
  const passed = (voting.totalVotes ?? 0) >= (voting.minimumVotes ?? Infinity)
    && (voting.yesPercent ?? 0) >= (voting.passPercent ?? Infinity);
  const status: ProposalVoting['status'] = passed ? 'approved' : 'rejected';
  return { ...voting, status, closed: true };
}

function statusTagsFor(
  id: string,
  proposal: Pick<Proposal, 'createdAt' | 'discussion' | 'funded' | 'status' | 'statusTags'>,
  voting: ProposalVoting | null,
  now = new Date(),
): ProposalStatusTag[] {
  const overriddenTags = proposalOverridesById[id]?.statusTags;
  if (overriddenTags?.length) return overriddenTags;
  if (completionEvidenceByProposalId[id]) return proposal.funded ? ['vote-passed', 'completed'] : ['completed', 'ended'];
  if (voting?.status === 'rejected') return ['vote-failed', 'ended'];
  if (proposal.status === 'paused') {
    return voting?.status === 'approved' || proposal.funded ? ['vote-passed', 'ended'] : ['ended'];
  }
  if (voting?.status === 'active') return ['voting'];
  if (voting?.status === 'approved') return proposal.funded ? ['vote-passed', 'executing'] : ['vote-passed'];
  if (proposal.statusTags?.includes('ended')) return proposal.statusTags;
  if (proposal.funded) return ['vote-passed', 'executing'];
  if (voting) return ['voting'];

  const discussionEndsAt = new Date(proposal.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  if ((proposal.discussion.likes ?? 0) < 30 && now.getTime() > discussionEndsAt) return ['ended'];
  return ['discussion'];
}

function primaryStatus(tags: ProposalStatusTag[]) {
  return tags.at(-1) ?? 'discussion';
}

function statusReasonZh(tags: ProposalStatusTag[]) {
  if (tags.includes('completed')) return '公开交付报告或里程碑证据表明提案承诺的工作已经全部完成。';
  if (tags.includes('vote-failed')) return 'Metaforo 结果显示提案未达到通过比例或法定票数要求，投票未通过。';
  if (tags.includes('executing')) return '提案已通过投票并出现在已资助清单中，目前仍处于执行阶段。';
  if (tags.includes('voting')) return '投票正在进行，最终结果尚未确定。';
  if (tags.includes('vote-passed')) return 'Metaforo 结果显示提案投票通过。';
  if (tags.includes('ended')) return '提案首帖未在 7 天内达到 30 个赞，或公开证据表明项目已终止、退款或结束。';
  return '提案仍在 7 天讨论期内，尚未进入投票。';
}

function trimMilestoneDescription(input: string, maxLength = 520, sentenceLimit = 4) {
  const normalized = input.replace(/\s+/g, ' ').trim();
  const sentences = normalized.split(/(?<=[.!?。！？])\s+(?=[A-Z\u4e00-\u9fff])/g);
  const selected = sentences
    .filter((sentence) => sentence.trim().length > 20)
    .slice(0, sentenceLimit)
    .join(' ')
    .trim();
  const value = selected || normalized;
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}…` : value;
}

function milestoneMarker(element: Element) {
  const raw = element.tagName === 'TR'
    ? element.querySelector('th, td')?.textContent ?? ''
    : element.textContent ?? '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (/^(?:initial funding|initial payment|资助启动|初始资金|首笔拨款)\b/i.test(text)) {
    return { key: 'initial', title: text.slice(0, 180) };
  }
  const english = text.match(/^(?:milestone|phase|stage)\s*(?:#\s*)?(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  const abbreviated = text.match(/^m\s*(\d+)\s*[:：.\-–—]/i);
  const chineseMilestone = text.match(/^里程碑\s*([\d一二三四五六七八九十]+)\s*[:：.\-–—]?/);
  const chineseStage = text.match(/^第?\s*([\d一二三四五六七八九十]+)\s*阶段\s*[:：.\-–—]?/);
  const match = english ?? abbreviated ?? chineseMilestone ?? chineseStage;
  if (!match) return null;
  const words: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10' };
  const token = match[1].toLowerCase();
  return { key: words[token] ?? token, title: text.slice(0, 180) };
}

function elementPieces(element: Element) {
  if (element.matches('ul, ol')) {
    return [...element.querySelectorAll(':scope > li')]
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean);
  }
  if (element.tagName === 'TR') {
    return [...element.querySelectorAll(':scope > th, :scope > td')]
      .slice(1)
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean);
  }
  const value = element.textContent?.replace(/\s+/g, ' ').trim();
  return value ? [value] : [];
}

function tableBudgetCell(element: Element) {
  if (element.tagName !== 'TR') return '';
  const table = element.closest('table');
  if (!table) return '';
  const headers = [...table.querySelectorAll('thead th')]
    .map((header) => header.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  const budgetIndex = headers.findIndex((header) => /^(?:budget|amount|payment|预算|金额|支付)$/i.test(header));
  if (budgetIndex < 0) return '';
  const cells = [...element.querySelectorAll(':scope > th, :scope > td')];
  return cells[budgetIndex]?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function parseProposalOverview(cooked: string, fallbackSummary: string): ProposalOverview {
  const objective = extractProposalObjective(cooked, fallbackSummary);
  if (typeof DOMParser === 'undefined') return { objective, milestones: [] };
  const doc = new DOMParser().parseFromString(cooked, 'text/html');

  const candidates = [...doc.querySelectorAll('h2, h3, h4, h5, h6, p, tr, li')]
    .map((element, order) => ({ element, order, marker: milestoneMarker(element) }))
    .filter((candidate): candidate is { element: Element; order: number; marker: { key: string; title: string } } => Boolean(candidate.marker));
  const milestonesByKey = new Map<string, ProposalOverview['milestones'][number] & {
    order: number;
    score: number;
    budgetConfidence: number;
  }>();
  for (const candidate of candidates) {
    const pieces: string[] = [];
    if (candidate.element.tagName === 'TR') pieces.push(...elementPieces(candidate.element));
    let sibling = candidate.element.nextElementSibling;
    while (sibling && pieces.join(' ').length < 1800) {
      if (milestoneMarker(sibling)) break;
      if (/^H[1-3]$/.test(sibling.tagName)) break;
      const text = sibling.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (/^(?:cost breakdown|budget breakdown|conclusion|总结|成本明细|预算明细|结论)\b/i.test(text)) break;
      pieces.push(...elementPieces(sibling));
      sibling = sibling.nextElementSibling;
    }
    const block = pieces.join(' ');
    const source = `${candidate.marker.title} ${block}`;
    const budgetEvidence = extractMilestoneBudget(
      candidate.marker.title,
      pieces,
      tableBudgetCell(candidate.element),
    );
    const eta = source.match(/(?:ETA|duration|delivery|timeline|预计|周期|交付时间)\s*[:：-]?\s*([^.;。；]{2,80})/i)?.[1]?.trim()
      ?? source.match(/(?:~\s*Month\s*\d+|weeks?\s*\d+(?:\s*[-–]\s*\d+)?|约第\s*\d+\s*个月)/i)?.[0]?.trim()
      ?? null;
    const deliverableSections = [...block.matchAll(/deliverables?\s*[:：]\s*([\s\S]*?)(?=\s+(?:ETA|budget|acceptance criteria|milestone|phase)\s*[:：]|$)/gi)]
      .map((match) => match[1].replace(/\s+/g, ' ').trim())
      .filter((value) => value.length > 18)
      .sort((a, b) => b.length - a.length);
    const descriptionPieces = pieces.filter((piece) =>
      piece.length > 18 && !/^(?:budget|amount|ETA|duration|timeline|payment|预算|金额|周期|交付时间|支付)\s*[:：]/i.test(piece),
    );
    let rawDescription = deliverableSections[0] || descriptionPieces.join('; ') || block || candidate.marker.title;
    const lastDeliverablesLabel = Math.max(rawDescription.toLowerCase().lastIndexOf('deliverables:'), rawDescription.lastIndexOf('交付内容：'));
    if (lastDeliverablesLabel >= 0) {
      rawDescription = rawDescription.slice(lastDeliverablesLabel).replace(/^(?:deliverables?|交付内容)\s*[:：]\s*/i, '');
    }
    const description = trimMilestoneDescription(rawDescription.replace(/\bckb1[a-z0-9]{30,}\b/gi, ''));
    const title = candidate.marker.title
      .replace(/\s*[-–—]\s*(?:\d+(?:\.\d+)?%\s+of (?:the )?grant paid|支付\s*\d+(?:\.\d+)?%\s*资金).*$/i, '')
      .slice(0, 180);
    const item = {
      title,
      description,
      budget: budgetEvidence.value,
      eta,
      order: candidate.order,
      score: description.length + pieces.length * 30,
      budgetConfidence: budgetEvidence.confidence,
    };
    const existing = milestonesByKey.get(candidate.marker.key);
    if (!existing) {
      milestonesByKey.set(candidate.marker.key, item);
      continue;
    }
    const strongerBudget = item.budgetConfidence > existing.budgetConfidence
      ? { budget: item.budget, budgetConfidence: item.budgetConfidence }
      : { budget: existing.budget, budgetConfidence: existing.budgetConfidence };
    if (item.score > existing.score + 60) {
      milestonesByKey.set(candidate.marker.key, { ...item, ...strongerBudget });
    } else if (strongerBudget.budgetConfidence > existing.budgetConfidence) {
      milestonesByKey.set(candidate.marker.key, { ...existing, ...strongerBudget });
    }
  }
  const milestones = [...milestonesByKey.values()]
    .sort((a, b) => a.order - b.order)
    .slice(0, 12)
    .map(({ order: _order, score: _score, budgetConfidence: _budgetConfidence, ...milestone }) => milestone);

  return { objective: objective || extractProposalObjective('', fallbackSummary), milestones };
}

function parseFundedTopic(topic: TopicResponse) {
  const firstPost = topic.post_stream?.posts?.[0];
  const cooked = firstPost?.cooked ?? '';
  const text = stripHtml(cooked);
  const entries = new Map<string, FundedEntry>();
  for (const match of cooked.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const html = match[1];
    const url = extractLinks(html).find((value) => /talk\.nervos\.org\/t\//i.test(value));
    const id = url?.match(/\/(\d+)(?:\/|$)/)?.[1];
    if (!id) continue;
    const itemText = stripHtml(html);
    entries.set(id, { id, budgetLabel: extractBudget(itemText), note: itemText });
  }

  const initial = text.match(/initially allocated\s+([\d,]+)\s*CKB/i)?.[1]?.replaceAll(',', '');
  const forumRemaining = text.match(/remaining balance[\s\S]{0,120}?([\d,]+)\s*CKB/i)?.[1]?.replaceAll(',', '');
  const percent = Number(text.match(/representing\s+([\d.]+)%/i)?.[1]);
  const fundedCount = Number(text.match(/total of\s+(\d+)\s+proposals/i)?.[1]);
  const forumAsOfText = text.match(/As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
  const forumAsOfDate = forumAsOfText ? new Date(`${forumAsOfText} UTC`) : null;
  const forumAsOf = forumAsOfDate && !Number.isNaN(forumAsOfDate.getTime())
    ? forumAsOfDate.toISOString().slice(0, 10)
    : firstPost?.updated_at?.slice(0, 10) ?? fallbackDataset.treasury.asOf;

  return {
    entries,
    sourceUpdatedAt: firstPost?.updated_at ?? firstPost?.created_at ?? new Date().toISOString(),
    initialCkb: initial ?? fallbackDataset.treasury.initialCkb,
    forumRemainingCkb: forumRemaining ?? fallbackDataset.treasury.remainingCkb,
    forumPercent: Number.isFinite(percent) ? percent : fallbackDataset.treasury.remainingPercent,
    fundedProposalCount: Number.isFinite(fundedCount) && fundedCount > 0 ? fundedCount : entries.size,
    forumAsOf,
  };
}

function fallbackById(id: string) {
  return fallbackDataset.proposals.find((proposal) => proposal.id === id);
}

function mapCategoryTopic(
  topic: CategoryTopic,
  usernames: Map<number, string>,
  fundedEntries: Map<string, FundedEntry>,
  fetchedAt: string,
): Proposal {
  const id = String(topic.id);
  const proposalOverride = proposalOverridesById[id];
  const fallback = fallbackById(id);
  const fundedEntry = fundedEntries.get(id);
  const funded = Boolean(fundedEntry) || fallback?.funded === true;
  const authorId = topic.posters?.[0]?.user_id;
  const author = (authorId ? usernames.get(authorId) : undefined) ?? fallback?.author ?? 'Unknown';
  const originalUrl = `${forumBase}/t/${topic.slug}/${topic.id}`;
  const discussion = {
    likes: topic.op_like_count ?? fallback?.discussion.likes ?? null,
    replies: topic.reply_count ?? Math.max(0, (topic.posts_count ?? 1) - 1),
    views: topic.views ?? fallback?.discussion.views ?? null,
  };
  const voting = buildVoting(id, fallback?.voting ?? null);
  const statusTags = statusTagsFor(id, {
    createdAt: topic.created_at,
    discussion,
    funded,
    status: fallback?.status ?? (funded ? 'executing' : voting ? 'voting' : 'discussion'),
  }, voting);
  const completionEvidence = completionEvidenceByProposalId[id];

  return {
    id,
    slug: topic.slug,
    title: cleanTitle(topic.title),
    titleZh: proposalOverride?.titleZh ?? fallback?.titleZh,
    titleEn: proposalOverride?.titleEn ?? fallback?.titleEn,
    originalTitle: topic.title,
    summary: stripHtml(topic.excerpt ?? '') || fallback?.summary || cleanTitle(topic.title),
    overview: proposalOverride?.overview ?? fallback?.overview,
    author: proposalOverride?.author ?? author,
    originalUrl,
    createdAt: topic.created_at,
    updatedAt: topic.last_posted_at ?? topic.bumped_at ?? topic.created_at,
    tags: [],
    projectType: normalizeProjectType(proposalOverride?.projectType ?? fallback?.projectType ?? classify(topic.title, topic.tags)),
    budgetLabel: proposalOverride?.budgetLabel ?? fundedEntry?.budgetLabel ?? fallback?.budgetLabel ?? extractBudget(stripHtml(topic.excerpt ?? '')),
    discussion,
    voting,
    funded,
    fundingNote: fundedEntry?.note ?? fallback?.fundingNote ?? null,
    updates: (fallback?.updates ?? []).filter((update) => sameUsername(update.author, author) && isProposalProgressUpdate(update.title)),
    status: primaryStatus(statusTags),
    statusTags,
    statusReason: statusReasonZh(statusTags),
    statusExplanationZh: proposalOverride?.statusExplanationZh ?? fallback?.statusExplanationZh,
    statusExplanationEn: proposalOverride?.statusExplanationEn ?? fallback?.statusExplanationEn,
    progressNoteZh: proposalOverride?.progressNoteZh ?? fallback?.progressNoteZh,
    progressNoteEn: proposalOverride?.progressNoteEn ?? fallback?.progressNoteEn,
    milestoneStructureZh: proposalOverride?.milestoneStructureZh ?? fallback?.milestoneStructureZh,
    milestoneStructureEn: proposalOverride?.milestoneStructureEn ?? fallback?.milestoneStructureEn,
    executionComplete: proposalOverride?.executionComplete ?? fallback?.executionComplete,
    votingPageNotFound: proposalOverride?.votingPageNotFound ?? fallback?.votingPageNotFound,
    hiddenTags: proposalOverride?.hiddenTags ?? fallback?.hiddenTags,
    lastVerifiedAt: fetchedAt,
    sources: [
      { label: 'Nervos Talk proposal', url: originalUrl },
      ...(funded ? [{ label: 'List of funded proposals', url: `${forumBase}/t/list-of-funded-proposals/7793` }] : []),
      ...(voting ? [{ label: votingSourceLabel(voting), url: voting.url }] : []),
      ...(completionEvidence ? [completionEvidence] : []),
    ],
  };
}

function needsTopicEnrichment(proposal: Proposal) {
  const age = Date.now() - new Date(proposal.createdAt).getTime();
  const isRecent = Number.isFinite(age) && age >= 0 && age <= 45 * 24 * 60 * 60 * 1_000;
  return isRecent && (!proposal.budgetLabel || !proposal.overview?.objective?.trim());
}

function isRecentProposal(proposal: Proposal) {
  const age = Date.now() - new Date(proposal.createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= 45 * 24 * 60 * 60 * 1_000;
}

async function enrichProposalFromTopic(proposal: Proposal) {
  if (!needsTopicEnrichment(proposal)) return proposal;
  try {
    const detail = await fetchJson<TopicResponse>(topicEndpoint(proposal.id));
    const firstPost = detail.post_stream?.posts?.find((post) => post.post_number === 1) ?? detail.post_stream?.posts?.[0];
    const cooked = firstPost?.cooked ?? '';
    const text = stripHtml(cooked);
    if (!text) return proposal;
    const parsed = parseProposalOverview(cooked, text);
    const objective = parsed.objective.trim();
    const sourceIsChinese = /[\u3400-\u9fff]/u.test(objective);
    const overview: ProposalOverview = {
      ...parsed,
      ...(sourceIsChinese ? { objectiveZh: objective } : { objectiveEn: objective }),
    };
    return {
      ...proposal,
      summary: objective || proposal.summary,
      overview,
      author: firstPost?.username ?? proposal.author,
      budgetLabel: proposal.budgetLabel ?? extractBudget(text),
      updatedAt: detail.last_posted_at ?? firstPost?.updated_at ?? proposal.updatedAt,
    };
  } catch {
    return proposal;
  }
}

async function fetchAllCategoryPages() {
  const topics = new Map<number, CategoryTopic>();
  const usernames = new Map<number, string>();
  for (let page = 0; page < 30; page += 1) {
    const data = await fetchJson<CategoryResponse>(`${categoryEndpoint}?page=${page}`);
    for (const user of data.users ?? []) usernames.set(user.id, user.username);
    const pageTopics = data.topic_list?.topics ?? [];
    for (const topic of pageTopics) topics.set(topic.id, topic);
    if (!data.topic_list?.more_topics_url || pageTopics.length === 0) break;
  }
  return { topics: [...topics.values()].filter((topic) => looksLikeProposal(topic.title)), usernames };
}

async function fetchChainBalance() {
  const response = await fetchJson<{ data?: Array<{ attributes?: { balance?: string } }> }>(balanceEndpoint, {
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
  });
  const shannons = response.data?.[0]?.attributes?.balance;
  if (!shannons || !/^\d+$/.test(shannons)) return null;
  const capacity = BigInt(shannons);
  const unit = BigInt(100_000_000);
  const whole = capacity / unit;
  const fractional = (capacity % unit).toString().padStart(8, '0').replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

async function buildLiveDataset(): Promise<ProposalDataset> {
  const fetchedAt = new Date().toISOString();
  const [category, fundedTopic, chainBalance] = await Promise.all([
    fetchAllCategoryPages(),
    fetchJson<TopicResponse>(fundedTopicEndpoint),
    fetchChainBalance().catch(() => null),
  ]);
  const funded = parseFundedTopic(fundedTopic);
  const enrichedProposals = await Promise.all(category.topics
    .map((topic) => mapCategoryTopic(topic, category.usernames, funded.entries, fetchedAt))
    .map(enrichProposalFromTopic));
  const proposals = (await Promise.all(enrichedProposals.map(async (proposal) => {
    const useHistorical = !proposalOverridesById[proposal.id]?.overview;
    const withOverview = isRecentProposal(proposal)
      ? await translateMissingProposalOverview(proposal, fetch, { useHistorical })
      : proposal;
    return await translateMissingProposalMilestones(withOverview, fetch, { useHistorical });
  })))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const usedSlugs = new Set<string>();
  for (const proposal of proposals) {
    if (usedSlugs.has(proposal.slug)) proposal.slug = `${proposal.slug}-${proposal.id}`;
    usedSlugs.add(proposal.slug);
  }

  const initial = Number(funded.initialCkb);
  const remaining = chainBalance ?? funded.forumRemainingCkb;
  const remainingPercent = chainBalance && initial > 0
    ? Number(((Number(chainBalance) / initial) * 100).toFixed(2))
    : funded.forumPercent;

  return {
    meta: {
      generatedAt: fetchedAt,
      sourceUpdatedAt: funded.sourceUpdatedAt,
      categoryUrl: fallbackDataset.meta.categoryUrl,
      proposalCount: proposals.length,
      methodology: 'Live Discourse category and topic JSON plus the published on-chain DAO address balance.',
      isLive: true,
      usedFallback: false,
    },
    treasury: {
      initialCkb: funded.initialCkb,
      remainingCkb: remaining,
      remainingPercent,
      fundedProposalCount: funded.fundedProposalCount,
      asOf: chainBalance ? fetchedAt.slice(0, 10) : funded.forumAsOf,
      forumAsOf: funded.forumAsOf,
      balanceSource: chainBalance ? 'chain' : 'funded-list',
      sourceUrl: fallbackDataset.treasury.sourceUrl,
      addressUrl: daoAddressUrl,
    },
    proposals,
  };
}

export function loadLiveDataset() {
  datasetPromise ??= buildLiveDataset().catch(() => ({
    ...fallbackDataset,
    meta: { ...fallbackDataset.meta, isLive: false, usedFallback: true },
    proposals: fallbackDataset.proposals.map((proposal) => {
      const voting = buildVoting(proposal.id, proposal.voting);
      const statusTags = statusTagsFor(proposal.id, proposal, voting);
      const completionEvidence = completionEvidenceByProposalId[proposal.id];
      return {
        ...proposal,
        voting,
        status: primaryStatus(statusTags),
        statusTags,
        statusReason: statusReasonZh(statusTags),
        sources: [
          ...proposal.sources.filter((source) => !/metaforo|corrected vote/i.test(source.label)),
          ...(voting ? [{ label: votingSourceLabel(voting), url: voting.url }] : []),
          ...(completionEvidence && !proposal.sources.some((source) => source.url === completionEvidence.url) ? [completionEvidence] : []),
        ],
      };
    }),
  }));
  return datasetPromise;
}

export async function loadLiveProject(id: string): Promise<Proposal | null> {
  const data = await loadLiveDataset();
  const base = data.proposals.find((proposal) => proposal.id === id) ?? fallbackById(id);
  if (!base) return null;
  const proposalOverride = proposalOverridesById[id];
  try {
    const detail = await fetchJson<TopicResponse>(topicEndpoint(id));
    const posts = await loadAllTopicPosts(id, detail);
    const firstPost = posts.find((post) => post.post_number === 1) ?? posts[0];
    const cooked = firstPost?.cooked ?? '';
    const links = extractLinks(cooked);
    const votingUrl = links.find((url) => /dao\.ckb\.community|metaforo/i.test(url));
    const proposer = firstPost?.username ?? base.author;
    const selectedUpdates = proposalOverride?.useOnlyOverrideUpdates
      ? []
      : selectProposalProgressUpdates(posts, proposer, id, detail.slug ?? base.slug);
    const updates = [...new Map([
      ...selectedUpdates,
      ...(proposalOverride?.updates ?? []).filter((update) => proposalOverride?.allowNonAuthorUpdates || sameUsername(update.author, proposer)),
    ].map((update) => [canonicalUpdateUrl(update.url), update])).values()]
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
    const discoveredVoting: ProposalVoting | null = votingUrl ? { url: votingUrl, status: 'unknown' } : base.voting;
    const voting = buildVoting(id, discoveredVoting);
    const discussion = {
      likes: firstPostLikeCount(firstPost, detail) ?? base.discussion.likes,
      replies: detail.reply_count ?? Math.max(0, (detail.posts_count ?? posts.length) - 1),
      views: detail.views ?? base.discussion.views,
    };
    const statusTags = statusTagsFor(id, { ...base, discussion }, voting);
    const completionEvidence = completionEvidenceByProposalId[id];
    const overview = proposalOverride?.overview ?? parseProposalOverview(cooked, base.summary);
    const proposal: Proposal = {
      ...base,
      title: cleanTitle(detail.title ?? base.originalTitle),
      originalTitle: detail.title ?? base.originalTitle,
      summary: overview.objective || base.summary,
      overview,
      author: firstPost?.username ?? base.author,
      updatedAt: detail.last_posted_at ?? firstPost?.updated_at ?? base.updatedAt,
      discussion,
      budgetLabel: proposalOverride?.budgetLabel ?? base.budgetLabel ?? extractBudget(stripHtml(cooked)),
      voting,
      updates,
      status: primaryStatus(statusTags),
      statusTags,
      statusReason: statusReasonZh(statusTags),
      lastVerifiedAt: new Date().toISOString(),
      sources: [
        { label: 'Nervos Talk proposal', url: base.originalUrl },
        ...(base.funded ? [{ label: 'List of funded proposals', url: `${forumBase}/t/list-of-funded-proposals/7793` }] : []),
        ...(voting ? [{ label: votingSourceLabel(voting), url: voting.url }] : []),
        ...(completionEvidence ? [completionEvidence] : []),
      ],
    };
    const useHistorical = !proposalOverride?.overview;
    const withOverview = await translateMissingProposalOverview(proposal, fetch, { useHistorical });
    return await translateMissingProposalMilestones(withOverview, fetch, { useHistorical });
  } catch {
    return base;
  }
}
