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

const explicitProgressPattern = /(?:\b(?:weekly|bi[\s-]?weekly|monthly|status|progress|project|development|milestone|completion|delivery|final)\s+(?:updates?|reports?)\b|\b(?:week|month|milestone|phase|stage)\s*#?\d+\s*(?:updates?|reports?|completed|complete|delivered)\b|\b(?:update|report)\s*#\s*\d+\b|周报|双周报|月报|状态更新|(?:项目|工作)?进展(?:更新|报告)|进度(?:更新|报告)|项目更新|里程碑(?:报告|更新|进展)|里程碑\s*[#第]?[一二三四五六七八九十\d]+\s*(?:已完成|完成|已交付)|完结报告|完成报告|交付报告)/i;

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
