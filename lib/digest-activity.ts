export const DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1_000;

export type DigestActivityTopic = {
  id: number;
  posts_count: number;
  created_at: string;
  last_posted_at?: string;
  bumped_at?: string;
};

export type DigestActivityState = {
  topic_id: number;
  posts_count: number;
  last_posted_at: string;
};

export type DigestActivityPost = {
  post_number: number;
  username: string;
  created_at?: string;
  cooked?: string;
};

export type ProgressUpdateCategory =
  | { kind: 'milestone'; milestone: string; completion: boolean }
  | { kind: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'completion' | 'status' | 'delivery' | 'progress' | 'general' };

export function timestamp(value?: string) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

export function topicLastActivity(topic: DigestActivityTopic) {
  return topic.last_posted_at ?? topic.bumped_at ?? topic.created_at;
}

export function topicChanged(topic: DigestActivityTopic, previous: DigestActivityState) {
  const currentPostCount = Number(topic.posts_count) || 0;
  const previousPostCount = Number(previous.posts_count) || 0;
  const currentTime = timestamp(topicLastActivity(topic));
  const previousTime = timestamp(previous.last_posted_at);
  const hasNewerTimestamp = Number.isFinite(currentTime)
    && (!Number.isFinite(previousTime) || currentTime > previousTime);
  return currentPostCount > previousPostCount || hasNewerTimestamp;
}

export function isRecentTopic(topic: DigestActivityTopic, cutoffMs: number) {
  const createdAt = timestamp(topic.created_at);
  return Number.isFinite(createdAt) && createdAt >= cutoffMs;
}

export function stripForumHtml(value = '') {
  return value
    .replace(/<aside[^>]*class=["'][^"']*quote[^"']*["'][^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|blockquote|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function trimOverviewSentences(input: string, maxLength = 460, sentenceLimit = 2) {
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

function cleanProposalObjective(input: string) {
  let value = input
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:\d+[.)、]\s*)?(?:one[- ]paragraph overview|executive summary|summary|overview|abstract|摘要|项目摘要|项目概述|简介)\s*[:：-]?\s*/i, '')
    .trim();
  value = value.split(/\s+(?=(?:amount requested|grant amount requested|requested amount|requested budget|budget requested|ETA to completion|CKB (?:wallet|address)|funding address|wallet address|申请金额|申请预算|预算|预计完成时间|CKB 地址|收款地址)\s*[:：])/i)[0];
  value = value
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\bckb1[a-z0-9]{30,}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return trimOverviewSentences(value, 460, 2);
}

function proposalObjectiveScore(input: string) {
  const text = input.trim();
  let score = text.length >= 60 && text.length <= 650 ? 3 : 0;
  if (/\b(?:this proposal|we (?:propose|plan|aim)|aims? to|build|develop|create|integrate|provide|launch)\b|(?:本提案|我们(?:计划|希望|拟)|旨在|开发|构建|集成|推出|提供)/i.test(text)) score += 6;
  if (/^(?:\d+[.)、]\s*)?(?:title|update|link to|vote|voting|amount|budget|ETA|wallet|CKB address|标题|更新|投票|申请金额|预算|地址)/i.test(text)) score -= 12;
  if (/ckb1[a-z0-9]{20,}|https?:\/\//i.test(text)) score -= 5;
  return score;
}

// The website detail page and daily digest both use this extractor, so a new
// proposal's overview remains consistent before an editorial override lands.
export function extractProposalObjective(cooked = '', fallbackSummary = '') {
  const withoutQuotes = cooked.replace(/<aside[^>]*class=["'][^"']*quote[^"']*["'][^>]*>[\s\S]*?<\/aside>/gi, ' ');
  const paragraphCandidates = [...withoutQuotes.matchAll(/<(?:p|blockquote)[^>]*>([\s\S]*?)<\/(?:p|blockquote)>/gi)]
    .map((match) => stripForumHtml(match[1]))
    .filter((text) => text.length > 35 && !/table of contents|目录|disclaimer|免责声明/i.test(text));
  const candidates = paragraphCandidates.length
    ? paragraphCandidates
    : [stripForumHtml(withoutQuotes), fallbackSummary].filter(Boolean);
  const selected = candidates.sort((left, right) => proposalObjectiveScore(right) - proposalObjectiveScore(left))[0]
    ?? fallbackSummary;
  return cleanProposalObjective(selected || fallbackSummary);
}

// Keep the requested-budget value identical across the detail page, proposal
// directory, email digest, and Telegram digest.
export function extractProposalBudget(text: string) {
  const value = String.raw`((?:USD|USDT|INR)\s*\$?\s*[\d,.]+|\$\s*[\d,.]+(?:\s*(?:USD|USDT))?|[\d,.]+\s*(?:USD|USDT|CKB(?:s)?|U)\b|0\s*(?:CKB)?)`;
  const labels = [
    String.raw`(?:grant amount(?: requested)?|amount requested|requested amount|total funding requested(?:\s*\(in USD\))?|total requested|total budget|budget requested|funding request|申请总额|总申请金额|申请金额|申请资金|总预算|预算申请|捐赠的金额)\s*[:：()\-–—]*\s*${value}`,
    String.raw`(?:this proposal requests|we (?:are requesting|request)|our budget is|apply for|the budget for this project is)\s*(?:a grant of|a total budget of|a total of)?\s*${value}`,
    String.raw`(?:budget breakdown|预算(?:详情|明细)?)\s*.{0,80}?\btotal\s*[:：\-–—]*\s*${value}`,
  ];
  for (const pattern of labels) {
    const match = text.match(new RegExp(pattern, 'i'))?.[1];
    if (match) return match.replace(/\s+/g, ' ').trim();
  }
  return null;
}

const explicitProgressPattern = /(?:\b(?:weekly|bi[\s-]?weekly|monthly|quarterly|annual|yearly|status|progress|project|development|milestone|completion|delivery|final)\s+(?:updates?|reports?)\b|\b(?:week|month|quarter|year|milestone|phase|stage)\s*#?\d+\s*(?:updates?|reports?|completed|complete|delivered)\b|\bq[1-4]\s+(?:updates?|reports?)\b|\b(?:update|report)\s*#\s*\d+\b|周报|双周报|月报|季报|年报|状态更新|(?:项目|工作)?进展(?:更新|报告)|进度(?:更新|报告)|项目更新|里程碑(?:报告|更新|进展)|里程碑\s*[#第]?[一二三四五六七八九十\d]+\s*(?:已完成|完成|已交付)|结项报告|完结报告|完成报告|交付报告)/i;

export function classifyProgressUpdate(cooked = ''): ProgressUpdateCategory {
  const text = stripForumHtml(cooked);
  const milestone = text.match(/\bmilestone\s*(?:#|no\.?\s*)?([0-9]+(?:\.[0-9]+)?|[ivxlcdm]+)\b/i)
    ?? text.match(/里程碑\s*(?:#|第)?\s*([0-9一二三四五六七八九十]+)(?:\s*个)?/i);
  if (milestone?.[1]) {
    return {
      kind: 'milestone',
      milestone: milestone[1].toUpperCase(),
      completion: /\b(?:completion|completed|complete|final)\b|(?:已完成|完成报告|完结|结项|已交付)/i.test(text),
    };
  }
  if (/\bbi[\s-]?weekly\b|双周报/i.test(text)) return { kind: 'biweekly' };
  if (/\bweekly\b|\bweek\s*#?\d+\s*(?:updates?|reports?)\b|周报/i.test(text)) return { kind: 'weekly' };
  if (/\bmonthly\b|\bmonth\s*#?\d+\s*(?:updates?|reports?)\b|月报/i.test(text)) return { kind: 'monthly' };
  if (/\bquarterly\b|\bq[1-4]\s+(?:updates?|reports?)\b|季报/i.test(text)) return { kind: 'quarterly' };
  if (/\b(?:annual|yearly)\b|年报/i.test(text)) return { kind: 'annual' };
  if (/\b(?:completion|final)\s+report\b|\bproject\s+completion\b|(?:结项报告|完结报告|完成报告)/i.test(text)) return { kind: 'completion' };
  if (/\bstatus\s+(?:updates?|reports?)\b|状态更新/i.test(text)) return { kind: 'status' };
  if (/\bdelivery\s+(?:updates?|reports?)\b|交付报告/i.test(text)) return { kind: 'delivery' };
  if (/\b(?:progress|project|development)\s+(?:updates?|reports?)\b|(?:项目|工作)?进展(?:更新|报告)|进度(?:更新|报告)|项目更新/i.test(text)) return { kind: 'progress' };
  return { kind: 'general' };
}

export function progressUpdateCategoryLabel(category: ProgressUpdateCategory, locale: 'zh' | 'en') {
  if (category.kind === 'milestone') {
    if (locale === 'zh') return `发布了里程碑${category.milestone}的报告`;
    return category.completion
      ? `Published Milestone ${category.milestone} completion report`
      : `Published Milestone ${category.milestone} report.`;
  }
  const labels = {
    weekly: { zh: '发布了周报', en: 'Published a weekly update.' },
    biweekly: { zh: '发布了双周报', en: 'Published a biweekly update.' },
    monthly: { zh: '发布了月报', en: 'Published a monthly update.' },
    quarterly: { zh: '发布了季报', en: 'Published a quarterly update.' },
    annual: { zh: '发布了年报', en: 'Published an annual update.' },
    completion: { zh: '发布了结项报告', en: 'Published a completion report.' },
    status: { zh: '发布了状态更新', en: 'Published a status update.' },
    delivery: { zh: '发布了交付报告', en: 'Published a delivery report.' },
    progress: { zh: '发布了项目进展更新', en: 'Published a progress update.' },
    general: { zh: '发布了提案进展更新', en: 'Published a proposal update.' },
  } as const;
  return labels[category.kind][locale];
}

export function isMeaningfulProgressUpdate(cooked = '') {
  const text = stripForumHtml(cooked);
  if (explicitProgressPattern.test(text)) return true;
  if (text.length < 160) return false;

  const signals = [
    /\b(?:completed|finished|delivered|released|shipped|launched|deployed|implemented|merged|published|now live)\b|(?:已完成|完成了|已交付|已发布|已上线|已部署|已实现|已合并)/i.test(text),
    /\b(?:github|commit|pull request|release|testnet|mainnet|demo|changelog|transaction|explorer)\b|(?:测试网|主网|演示|代码仓库|版本|交易哈希)/i.test(text),
    /\b(?:week|month|milestone|phase|stage)\s*#?\d+\b|\bnext steps?\b|(?:第[一二三四五六七八九十\d]+(?:周|月|阶段|里程碑)|下一步)/i.test(text),
    /href=["']https?:\/\//i.test(cooked) || /<(?:ul|ol|img|pre|code)\b/i.test(cooked),
  ].filter(Boolean).length;
  return signals >= 3;
}

export function progressUpdatePosts(
  posts: DigestActivityPost[],
  previous: DigestActivityState,
  cutoffMs: number,
) {
  const firstPost = posts.find((post) => post.post_number === 1) ?? posts[0];
  const proposer = firstPost?.username.trim().toLocaleLowerCase();
  if (!proposer) return [];

  const previousActivity = timestamp(previous.last_posted_at);
  const afterMs = Number.isFinite(previousActivity)
    ? Math.max(cutoffMs, previousActivity)
    : cutoffMs;

  return posts
    .filter((post) => {
      if (post.post_number <= 1 || post.username.trim().toLocaleLowerCase() !== proposer) return false;
      const createdAt = timestamp(post.created_at);
      return Number.isFinite(createdAt)
        && createdAt > afterMs
        && isMeaningfulProgressUpdate(post.cooked);
    })
    .sort((left, right) => left.post_number - right.post_number);
}
