import {
  cleanSummary,
  getProposalStatusTags,
  getProposalTitle,
  projectTypeLabels,
  proposals,
  statusMeta,
  type Proposal,
} from '../lib/proposals.js';
import {
  DIGEST_LOOKBACK_MS,
  isRecentTopic,
  progressUpdatePosts,
  stripForumHtml,
  topicChanged,
} from '../lib/digest-activity.js';

const forumBaseUrl = 'https://talk.nervos.org';
const categoryPath = '/c/daos-funding/ckb-community-fund-dao/65/l/latest.json';
const publicSiteUrl = 'https://ckbcommunityfunddao.xyz';
const replyTo = 'jacky@ckba.build';

type Locale = 'zh' | 'en';
type Subscriber = {
  id: string;
  email: string;
  locale: Locale;
  status: string;
  confirmation_token: string;
  unsubscribe_token: string;
};
type Topic = {
  id: number;
  slug: string;
  title: string;
  posts_count: number;
  like_count: number;
  created_at: string;
  last_posted_at?: string;
  bumped_at?: string;
};
type TopicState = {
  topic_id: number;
  posts_count: number;
  last_posted_at: string;
};
type ForumPost = {
  post_number: number;
  username: string;
  name?: string | null;
  created_at?: string;
  cooked?: string;
};
type TopicDetail = {
  highest_post_number?: number;
  post_stream?: { posts?: ForumPost[] };
};
type DigestTopic = {
  topic: Topic;
  proposal?: Proposal;
  proposer: string;
  budget: string | null;
  firstPostExcerpt: string;
  latestPostAuthor: string;
  latestPostCreatedAt?: string;
  latestPostExcerpt: string;
  latestPostNumber?: number;
  newPostCount: number;
};
type EmailMessage = {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};
type ResendWebhookEvent = {
  type?: string;
  data?: {
    to?: string[];
  };
};
type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
  parameters?: { retry_after?: number };
};
type TelegramDelivery = {
  configured: boolean;
  locale: Locale;
  messagesSent: number;
  messageIds: number[];
};

const proposalById = new Map(proposals.map((proposal) => [proposal.id, proposal]));

const json = (data: unknown, status = 200) => Response.json(data, { status });
const siteUrl = () => publicSiteUrl;
const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

async function db<T>(
  table: string,
  query = '',
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const response = await fetch(`${requiredEnv('SUPABASE_URL')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: requiredEnv('SUPABASE_SECRET_KEY'),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) throw new Error(`Database ${response.status}: ${(await response.text()).slice(0, 400)}`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function sendEmail(to: string, message: EmailMessage) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'CKB Community Fund DAO <updates@mail.ckbcommunityfunddao.xyz>',
      to: [to],
      reply_to: replyTo,
      ...message,
    }),
  });
  if (!response.ok) throw new Error(`Email ${response.status}: ${(await response.text()).slice(0, 400)}`);
}

const TELEGRAM_CHANNELS: Record<Locale, string> = {
  zh: '@CKBCommunityFundDAO_CN',
  en: '@CKBCommunityFundDAO',
};

const telegramChannel = (locale: Locale) =>
  process.env[locale === 'en' ? 'TELEGRAM_CHANNEL_EN' : 'TELEGRAM_CHANNEL_ZH']?.trim() || TELEGRAM_CHANNELS[locale];

function telegramChannelUrl(locale: Locale) {
  const explicit = process.env[locale === 'en' ? 'TELEGRAM_CHANNEL_URL_EN' : 'TELEGRAM_CHANNEL_URL_ZH']?.trim();
  if (explicit) return explicit;
  const channel = telegramChannel(locale);
  if (channel?.startsWith('@')) return `https://t.me/${channel.slice(1)}`;
  throw new Error(`Missing public Telegram channel URL for ${locale}`);
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function sendTelegramMessage(chatId: string, text: string, retry = true): Promise<number | undefined> {
  const response = await fetch(`https://api.telegram.org/bot${requiredEnv('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as TelegramApiResponse;
  if ((!response.ok || !payload.ok) && response.status === 429 && retry && payload.parameters?.retry_after) {
    await wait((payload.parameters.retry_after + 1) * 1_000);
    return await sendTelegramMessage(chatId, text, false);
  }
  if (!response.ok || !payload.ok) throw new Error(`Telegram ${response.status}: ${(payload.description ?? 'Unknown error').slice(0, 300)}`);
  return payload.result?.message_id;
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function esc(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function shell(content: string, footer: string, preheader = '') {
  return `<!doctype html><html><body style="margin:0;background:#f5f7f2;color:#0b0f0e;font-family:Arial,sans-serif">${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>` : ''}<div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#0b0f0e;border-radius:20px 20px 0 0;padding:24px;color:white"><b style="background:#c8ff67;color:#0b0f0e;border-radius:8px;padding:7px 9px">CKB</b><b style="margin-left:10px">Community Fund DAO</b></div><div style="background:white;border:1px solid #d6ded8;border-top:0;border-radius:0 0 20px 20px;padding:30px">${content}</div><p style="margin:18px 4px;color:#65706a;font-size:12px;line-height:1.6">${footer}</p></div></body></html>`;
}

function confirmationMessage(locale: Locale, url: string) {
  const en = locale === 'en';
  const greeting = en ? 'Hello, and welcome to the CKB community 👋' : '你好，欢迎加入 CKB 社区 👋';
  const heading = en ? 'Please confirm your subscription' : '请确认你的订阅';
  const body = en
    ? 'Thank you for subscribing to CKB Community Fund DAO proposal updates. Please use the button below to confirm that this email address belongs to you. After confirmation, you will receive one daily digest at 16:00 China Standard Time when new proposals or proposal updates are detected. No changes means no email.'
    : '感谢你订阅 CKB Community Fund DAO 提案动态。请点击下方按钮，确认这个邮箱地址属于你。确认后，当网站发现新提案或提案更新时，你会在每天北京时间 16:00 收到一封汇总邮件；没有变化时不会发送。';
  const button = en ? 'Confirm subscription' : '确认订阅';
  const footer = en
    ? `Questions or feedback? Simply reply to this email. If you did not request this subscription, you can safely ignore it.`
    : '如果你有任何问题或建议，直接回复这封邮件即可。如果不是你发起的订阅，可以放心忽略此邮件。';
  return {
    subject: en ? 'Confirm your CKB Community Fund DAO subscription' : '确认订阅 CKB Community Fund DAO 提案更新',
    html: shell(`<p style="margin:0 0 10px;color:#087958;font-weight:bold">${greeting}</p><h1 style="margin:0 0 14px">${heading}</h1><p style="color:#4d5953;line-height:1.75">${body}</p><a href="${esc(url)}" style="display:inline-block;margin-top:16px;background:#087958;color:white;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:bold">${button}</a>`, footer, heading),
    text: `${greeting}\n\n${heading}\n\n${body}\n\n${button}: ${url}\n\n${footer}`,
  };
}

const topicUrl = (topic: Topic, postNumber?: number) => `${forumBaseUrl}/t/${topic.slug}/${topic.id}${postNumber ? `/${postNumber}` : ''}`;
const proposalUrl = (topic: Topic) => `${siteUrl()}/project?id=${topic.id}`;

function clipped(value: string, length = 320) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length).trim()}…` : compact;
}

function extractDigestBudget(text: string) {
  const value = String.raw`((?:USD\s*)?\$?\s*[\d,.]+\s*(?:USD|USDT|CKB(?:s)?)?)`;
  const match = text.match(new RegExp(String.raw`(?:funding requested|requested budget|requested amount|total budget|grant amount|申请总额|总申请金额|申请金额|申请预算|总预算)\s*[:：\-–—]?\s*${value}`, 'i'));
  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

async function fetchTopicDetail(topic: Topic) {
  const load = async (suffix = '') => {
    const response = await fetch(`${forumBaseUrl}/t/${topic.id}.json${suffix}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Topic ${topic.id}: ${response.status}`);
    return await response.json() as TopicDetail;
  };
  const detail = await load();
  const posts = detail.post_stream?.posts ?? [];
  const highest = detail.highest_post_number ?? posts.at(-1)?.post_number ?? topic.posts_count ?? 1;
  if (!posts.some((post) => post.post_number === highest) && highest > 1) {
    const latestWindow = await load(`?post_number=${highest}`);
    posts.push(...(latestWindow.post_stream?.posts ?? []));
  }
  return [...new Map(posts.map((post) => [post.post_number, post])).values()]
    .sort((a, b) => a.post_number - b.post_number);
}

async function buildDigestTopic(topic: Topic, previous?: TopicState, knownPosts?: ForumPost[]): Promise<DigestTopic> {
  const proposal = proposalById.get(String(topic.id));
  const fallback = {
    topic,
    proposal,
    proposer: proposal?.author ?? 'Unknown',
    budget: proposal?.budgetLabel ?? null,
    firstPostExcerpt: proposal?.summary ?? '',
    latestPostAuthor: proposal?.author ?? 'Unknown',
    latestPostCreatedAt: topic.last_posted_at ?? topic.bumped_at ?? topic.created_at,
    latestPostExcerpt: '',
    latestPostNumber: undefined,
    newPostCount: Math.max(0, topic.posts_count - (previous?.posts_count ?? topic.posts_count)),
  } satisfies DigestTopic;
  try {
    const posts = knownPosts ?? await fetchTopicDetail(topic);
    const firstPost = posts.find((post) => post.post_number === 1) ?? posts[0];
    const latestPost = posts.at(-1) ?? firstPost;
    const firstText = stripForumHtml(firstPost?.cooked);
    return {
      ...fallback,
      proposer: firstPost?.username ?? fallback.proposer,
      budget: proposal?.budgetLabel ?? extractDigestBudget(firstText),
      firstPostExcerpt: clipped(firstText || fallback.firstPostExcerpt),
      latestPostAuthor: latestPost?.username ?? fallback.latestPostAuthor,
      latestPostCreatedAt: latestPost?.created_at ?? fallback.latestPostCreatedAt,
      latestPostExcerpt: clipped(stripForumHtml(latestPost?.cooked)),
      latestPostNumber: latestPost?.post_number,
    };
  } catch {
    return fallback;
  }
}

async function buildProgressDigestTopics(topic: Topic, previous: TopicState, cutoffMs: number): Promise<DigestTopic[]> {
  try {
    const posts = await fetchTopicDetail(topic);
    const firstPost = posts.find((post) => post.post_number === 1) ?? posts[0];
    const firstText = stripForumHtml(firstPost?.cooked);
    const base = await buildDigestTopic(topic, previous, posts);
    return progressUpdatePosts(posts, previous, cutoffMs).map((post) => ({
      ...base,
      proposer: firstPost?.username ?? base.proposer,
      budget: base.proposal?.budgetLabel ?? extractDigestBudget(firstText),
      firstPostExcerpt: clipped(firstText || base.firstPostExcerpt),
      latestPostAuthor: post.username,
      latestPostCreatedAt: post.created_at,
      latestPostExcerpt: clipped(stripForumHtml(post.cooked)),
      latestPostNumber: post.post_number,
      newPostCount: 1,
    }));
  } catch {
    // A failed topic fetch must never create an unverified "progress update" email.
    return [];
  }
}

function digestDate(locale: Locale, value = new Date()) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai',
  }).format(value);
}

function digestTime(locale: Locale, value?: string | Date) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
  }).format(date);
}

function localizedTitle(item: DigestTopic, locale: Locale) {
  return item.proposal ? getProposalTitle(item.proposal, locale) : item.topic.title.replace(/^\s*[[(]\s*DIS\s*[\])]?\s*/i, '').trim();
}

function localizedOverview(item: DigestTopic, locale: Locale) {
  return item.proposal ? cleanSummary(item.proposal, 320, locale) : clipped(item.firstPostExcerpt || (locale === 'en' ? 'Open the source discussion to read the full proposal.' : '请打开原始讨论阅读完整提案。'));
}

function localizedStatus(item: DigestTopic, locale: Locale) {
  const tags = item.proposal ? getProposalStatusTags(item.proposal) : ['discussion'] as const;
  return tags.map((tag) => statusMeta[tag][locale]).join(' · ');
}

function localizedType(item: DigestTopic, locale: Locale) {
  if (!item.proposal) return locale === 'en' ? 'Proposal' : '提案';
  return locale === 'en' ? item.proposal.projectType : projectTypeLabels[item.proposal.projectType] ?? item.proposal.projectType;
}

function digestMessage(locale: Locale, newTopics: DigestTopic[], updatedTopics: DigestTopic[], unsubscribeUrl: string) {
  const en = locale === 'en';
  const newCount = newTopics.length;
  const updatedCount = updatedTopics.length;
  const plural = (count: number, singular: string, pluralValue = `${singular}s`) => count === 1 ? singular : pluralValue;
  const subject = en
    ? `CKB Community Fund DAO: ${newCount} new ${plural(newCount, 'proposal')}, ${updatedCount} ${plural(updatedCount, 'proposal update')}`
    : `CKB Community Fund DAO：${newCount} 份新提案，${updatedCount} 条进展更新`;
  const generatedAt = digestTime(locale, new Date());
  const dateLabel = digestDate(locale);
  const greeting = en ? 'Hello, CKB community 👋' : '你好，CKB 社区的朋友 👋';
  const intro = en
    ? `Here is today’s Community Fund DAO digest. Thank you for following how community funds are discussed, voted on, and put to work.`
    : '这是今天的 Community Fund DAO 提案动态。感谢你持续关注社区资金如何被讨论、投票与执行。';
  const summary = en
    ? `${newCount} new ${plural(newCount, 'proposal')} and ${updatedCount} ${plural(updatedCount, 'proposal update')} were detected.`
    : `今天检测到 ${newCount} 份新提案和 ${updatedCount} 条提案进展更新。`;
  const stats = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-collapse:separate;border-spacing:8px 0"><tr><td width="50%" style="background:#f1f5ef;border-radius:14px;padding:16px"><div style="font-size:24px;font-weight:bold;color:#087958">${newCount}</div><div style="margin-top:4px;color:#65706a;font-size:12px">${en ? plural(newCount, 'new proposal') : '新提案'}</div></td><td width="50%" style="background:#f1f5ef;border-radius:14px;padding:16px"><div style="font-size:24px;font-weight:bold;color:#087958">${updatedCount}</div><div style="margin-top:4px;color:#65706a;font-size:12px">${en ? plural(updatedCount, 'proposal update') : '进展更新'}</div></td></tr></table>`;
  const proposalCard = (item: DigestTopic) => {
    const title = localizedTitle(item, locale);
    const overview = localizedOverview(item, locale);
    const status = localizedStatus(item, locale);
    const type = localizedType(item, locale);
    const budget = item.budget ?? (en ? 'Not stated' : '未标明');
    return `<li style="margin:0 0 14px;padding:19px;border:1px solid #dce3de;border-radius:16px;list-style:none"><div style="margin-bottom:8px;color:#087958;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">${en ? 'New proposal' : '新提案'} · ${esc(status)}</div><a href="${proposalUrl(item.topic)}" style="color:#0b0f0e;text-decoration:none;font-size:17px;font-weight:bold;line-height:1.4">${esc(title)}</a><p style="margin:10px 0 14px;color:#4d5953;font-size:14px;line-height:1.7">${esc(overview)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:12px;color:#65706a"><tr><td style="padding:4px 8px 4px 0"><b style="color:#0b0f0e">${en ? 'Proposer' : '提案人'}:</b> ${esc(item.proposer)}</td><td style="padding:4px 0"><b style="color:#0b0f0e">${en ? 'Budget' : '预算'}:</b> ${esc(budget)}</td></tr><tr><td style="padding:4px 8px 4px 0"><b style="color:#0b0f0e">${en ? 'Type' : '类型'}:</b> ${esc(type)}</td><td style="padding:4px 0"><b style="color:#0b0f0e">${en ? 'Status' : '状态'}:</b> ${esc(status)}</td></tr></table><p style="margin:16px 0 0"><a href="${proposalUrl(item.topic)}" style="display:inline-block;background:#087958;color:white;text-decoration:none;border-radius:999px;padding:10px 15px;font-size:12px;font-weight:bold">${en ? 'View proposal' : '查看提案'}</a> <a href="${topicUrl(item.topic)}" style="margin-left:8px;color:#087958;text-decoration:none;font-size:12px;font-weight:bold">${en ? 'Source discussion →' : '原始讨论 →'}</a></p></li>`;
  };
  const updateCard = (item: DigestTopic) => {
    const title = localizedTitle(item, locale);
    const status = localizedStatus(item, locale);
    const postCount = item.newPostCount > 0
      ? en ? `${item.newPostCount} new ${plural(item.newPostCount, 'post')}` : `新增 ${item.newPostCount} 篇帖子`
      : en ? 'New activity detected' : '检测到新动态';
    const postedAt = digestTime(locale, item.latestPostCreatedAt);
    const metadata = en
      ? `Posted by ${item.latestPostAuthor}${postedAt ? ` · ${postedAt}` : ''} · ${postCount}`
      : `由 ${item.latestPostAuthor} 发布${postedAt ? ` · ${postedAt}` : ''} · ${postCount}`;
    const excerpt = item.latestPostExcerpt || (en ? 'A new reply or proposal update was posted. Open the discussion to read it.' : '该提案出现了新的回复或进展，请打开讨论查看详情。');
    return `<li style="margin:0 0 14px;padding:19px;border:1px solid #dce3de;border-radius:16px;list-style:none"><div style="margin-bottom:8px;color:#087958;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">${en ? 'Proposal update' : '提案进展'} · ${esc(status)}</div><a href="${proposalUrl(item.topic)}" style="color:#0b0f0e;text-decoration:none;font-size:17px;font-weight:bold;line-height:1.4">${esc(title)}</a><p style="margin:8px 0;color:#7a847f;font-size:12px">${esc(metadata)}</p><p style="margin:12px 0 0;color:#4d5953;font-size:14px;line-height:1.7">${esc(excerpt)}</p><p style="margin:16px 0 0"><a href="${topicUrl(item.topic, item.latestPostNumber)}" style="display:inline-block;background:#087958;color:white;text-decoration:none;border-radius:999px;padding:10px 15px;font-size:12px;font-weight:bold">${en ? 'View this update' : '查看本次更新'}</a> <a href="${proposalUrl(item.topic)}" style="margin-left:8px;color:#087958;text-decoration:none;font-size:12px;font-weight:bold">${en ? 'Proposal record →' : '提案记录 →'}</a></p></li>`;
  };
  const section = (title: string, items: DigestTopic[], render: (item: DigestTopic) => string) => items.length
    ? `<h2 style="margin:30px 0 12px;font-size:19px">${title}</h2><ul style="padding:0;margin:0">${items.map(render).join('')}</ul>`
    : '';
  const footer = en
    ? `You receive this email because you subscribed to daily proposal updates. Generated at ${esc(generatedAt)} China Standard Time. <a href="${esc(unsubscribeUrl)}">Unsubscribe</a>.`
    : `你收到此邮件是因为订阅了每日提案更新。本期汇总生成于北京时间 ${esc(generatedAt)}。<a href="${esc(unsubscribeUrl)}">取消订阅</a>。`;
  const preheader = en
    ? `${newCount} new ${plural(newCount, 'proposal')} and ${updatedCount} ${plural(updatedCount, 'proposal update')} in today’s digest.`
    : `今日汇总：${newCount} 份新提案，${updatedCount} 条进展更新。`;
  const textItem = (item: DigestTopic, updated: boolean) => {
    const title = localizedTitle(item, locale);
    if (updated) return `${title}\n${en ? 'Updated by' : '更新者'}: ${item.latestPostAuthor}\n${item.latestPostExcerpt}\n${topicUrl(item.topic, item.latestPostNumber)}`;
    return `${title}\n${en ? 'Proposer' : '提案人'}: ${item.proposer}\n${en ? 'Budget' : '预算'}: ${item.budget ?? (en ? 'Not stated' : '未标明')}\n${localizedOverview(item, locale)}\n${proposalUrl(item.topic)}`;
  };
  const textSections = [
    newTopics.length ? `${en ? 'NEW PROPOSALS' : '新提案'}\n\n${newTopics.map((item) => textItem(item, false)).join('\n\n')}` : '',
    updatedTopics.length ? `${en ? 'PROPOSAL UPDATES' : '提案进展'}\n\n${updatedTopics.map((item) => textItem(item, true)).join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n');
  const content = `<p style="margin:0 0 8px;color:#087958;font-size:12px;font-weight:bold;letter-spacing:.05em;text-transform:uppercase">${esc(dateLabel)} · ${en ? 'Daily proposal digest' : '每日提案动态'}</p><h1 style="margin:0 0 14px;font-size:28px;line-height:1.25">${greeting}</h1><p style="margin:0;color:#4d5953;line-height:1.75">${intro}</p><p style="margin:12px 0 0;color:#0b0f0e;font-weight:bold;line-height:1.6">${summary}</p>${stats}${section(en ? 'New proposals' : '新提案', newTopics, proposalCard)}${section(en ? 'Proposal updates' : '提案进展更新', updatedTopics, updateCard)}<p style="margin:28px 0 0"><a href="${siteUrl()}/projects" style="color:#087958;font-weight:bold;text-decoration:none">${en ? 'Open the full proposal directory →' : '查看完整提案目录 →'}</a></p>`;
  return {
    subject,
    html: shell(content, footer, preheader),
    text: `${greeting}\n${dateLabel}\n\n${intro}\n${summary}\n\n${textSections}\n\n${en ? 'Open the proposal directory' : '查看提案目录'}: ${siteUrl()}/projects\n${en ? 'Unsubscribe' : '取消订阅'}: ${unsubscribeUrl}`,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

function telegramDigestMessages(locale: Locale, newTopics: DigestTopic[], updatedTopics: DigestTopic[]) {
  const en = locale === 'en';
  const newCount = newTopics.length;
  const updatedCount = updatedTopics.length;
  const plural = (count: number, singular: string, pluralValue = `${singular}s`) => count === 1 ? singular : pluralValue;
  const header = en
    ? `<b>Hello, CKB community 👋</b>\n\nToday: ${newCount} new ${plural(newCount, 'proposal')} and ${updatedCount} ${plural(updatedCount, 'progress update')}:`
    : `<b>你好，CKB 社区的朋友 👋</b>\n\n今天有 ${newCount} 份新提案和 ${updatedCount} 条进展更新：`;
  const newProposalBlock = (item: DigestTopic) => {
    const title = localizedTitle(item, locale);
    const overview = clipped(localizedOverview(item, locale), 360);
    const budget = item.budget ?? (en ? 'Not stated' : '未标明');
    return `<a href="${esc(proposalUrl(item.topic))}"><b>${esc(title)}</b></a>\n\n- <b>${en ? 'Overview' : '简介'}:</b> ${esc(overview)}\n\n- <b>${en ? 'Proposer' : '提案人'}:</b> ${esc(item.proposer)}\n\n- <b>${en ? 'Budget' : '预算'}:</b> ${esc(budget)}\n\n<a href="${esc(topicUrl(item.topic))}">${en ? 'View source proposal →' : '查看原始提案 →'}</a>`;
  };
  const updateBlock = (item: DigestTopic) => {
    const title = localizedTitle(item, locale);
    const excerpt = clipped(item.latestPostExcerpt || (en ? 'A new proposal update was posted.' : '该提案发布了新的进展。'), 360);
    return `<a href="${esc(proposalUrl(item.topic))}"><b>${esc(title)}</b></a>\n\n- ${esc(excerpt)}\n\n<a href="${esc(topicUrl(item.topic, item.latestPostNumber))}">${en ? 'Read this update →' : '阅读本次更新 →'}</a>`;
  };
  const messages: string[] = [];
  let current = header;
  let hasSection = false;
  const appendSection = (title: string, entries: string[]) => {
    entries.forEach((entry, index) => {
      const firstInSection = index === 0;
      const block = firstInSection ? `${title}\n\n${entry}` : entry;
      const joiner = firstInSection && hasSection ? '\n\n────────\n\n' : '\n\n';
      const candidate = `${current}${joiner}${block}`;
      if (candidate.length > 3_800) {
        messages.push(current);
        const continued = index > 0 ? (en ? ' <i>(continued)</i>' : '<i>（续）</i>') : '';
        current = `${title}${continued}\n\n${entry}`;
      } else {
        current = candidate;
      }
    });
    if (entries.length) hasSection = true;
  };
  appendSection(en ? `🆕 <b>${plural(newCount, 'New proposal')}</b>` : '🆕 <b>新提案</b>', newTopics.map(newProposalBlock));
  appendSection(en ? `🔄 <b>${plural(updatedCount, 'Progress update')}</b>` : '🔄 <b>进展更新</b>', updatedTopics.map(updateBlock));
  const directoryLink = `<a href="${siteUrl()}/projects">${en ? 'View all proposals →' : '查看全部提案 →'}</a>`;
  if (`${current}\n\n${directoryLink}`.length > 3_800) {
    messages.push(current);
    current = directoryLink;
  } else {
    current = `${current}\n\n${directoryLink}`;
  }
  if (current) messages.push(current);
  return messages;
}

async function sendTelegramDigest(locale: Locale, newTopics: DigestTopic[], updatedTopics: DigestTopic[]): Promise<TelegramDelivery> {
  const channel = telegramChannel(locale);
  if (!channel) return { configured: false, locale, messagesSent: 0, messageIds: [] };
  requiredEnv('TELEGRAM_BOT_TOKEN');
  const messages = telegramDigestMessages(locale, newTopics, updatedTopics);
  const messageIds: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const messageId = await sendTelegramMessage(channel, messages[index]);
    if (messageId !== undefined) messageIds.push(messageId);
    if (index < messages.length - 1) await wait(1_100);
  }
  return { configured: true, locale, messagesSent: messages.length, messageIds };
}

function isProposal(title: string) {
  const value = title.trim();
  if (/^\s*(?:\[|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|\))/i.test(value)) return false;
  return /^\s*(?:\[|\()\s*DIS\s*(?:\]|\))/i.test(value) || /(grant|funding|sponsorship)\s+proposal|资助提案|赞助提案/i.test(value);
}

async function forumTopics() {
  const topics = new Map<number, Topic>();
  for (let page = 0; page < 30; page += 1) {
    const response = await fetch(`${forumBaseUrl}${categoryPath}?page=${page}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Forum ${response.status}`);
    const data = await response.json() as { topic_list?: { topics?: Topic[]; more_topics_url?: string } };
    const pageTopics = data.topic_list?.topics ?? [];
    pageTopics.filter((topic) => isProposal(topic.title)).forEach((topic) => topics.set(topic.id, topic));
    if (!data.topic_list?.more_topics_url || pageTopics.length === 0) break;
  }
  return [...topics.values()];
}

function state(topic: Topic) {
  return {
    topic_id: topic.id,
    slug: topic.slug,
    title: topic.title,
    posts_count: topic.posts_count ?? 0,
    like_count: topic.like_count ?? 0,
    last_posted_at: topic.last_posted_at ?? topic.bumped_at ?? topic.created_at,
    last_seen_at: new Date().toISOString(),
  };
}

async function saveStates(topics: Topic[]) {
  if (topics.length) await db<void>('proposal_digest_state', 'on_conflict=topic_id', {
    method: 'POST', body: topics.map(state), prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

async function subscribe(request: Request) {
  const input = await request.json() as { email?: string; locale?: string; company?: string };
  if (input.company) return json({ ok: true });
  const email = input.email?.trim().toLowerCase() ?? '';
  const locale: Locale = input.locale === 'en' ? 'en' : 'zh';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, code: 'invalid_email' }, 400);
  const existing = await db<Subscriber[]>('email_subscribers', `select=*&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (existing[0]?.status === 'confirmed') return json({ ok: true, code: 'already_subscribed' });
  if (['bounced', 'complained', 'suppressed'].includes(existing[0]?.status ?? '')) {
    return json({ ok: false, code: 'delivery_blocked' }, 409);
  }
  const confirmationToken = token();
  const record = {
    email,
    locale,
    status: 'pending',
    confirmation_token: confirmationToken,
    unsubscribe_token: existing[0]?.unsubscribe_token ?? token(),
    confirmed_at: null,
    unsubscribed_at: null,
  };
  await db<void>('email_subscribers', existing[0] ? `id=eq.${existing[0].id}` : '', {
    method: existing[0] ? 'PATCH' : 'POST', body: record,
  });
  const confirmationUrl = `${siteUrl()}/api/confirm?token=${confirmationToken}`;
  await sendEmail(email, confirmationMessage(locale, confirmationUrl));
  return json({ ok: true, code: 'confirmation_sent' });
}

async function updateSubscription(request: Request, action: 'confirm' | 'unsubscribe', redirect = true) {
  const value = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(value)) {
    return redirect ? Response.redirect(`${siteUrl()}/?subscription=invalid`, 302) : json({ ok: false }, 400);
  }
  const column = action === 'confirm' ? 'confirmation_token' : 'unsubscribe_token';
  const matches = await db<Subscriber[]>('email_subscribers', `select=*&${column}=eq.${value}&limit=1`);
  if (!matches[0]) {
    return redirect ? Response.redirect(`${siteUrl()}/?subscription=invalid`, 302) : json({ ok: true });
  }
  const now = new Date().toISOString();
  await db<void>('email_subscribers', `id=eq.${matches[0].id}`, {
    method: 'PATCH',
    body: action === 'confirm'
      ? { status: 'confirmed', confirmed_at: now, unsubscribed_at: null }
      : { status: 'unsubscribed', unsubscribed_at: now },
  });
  return redirect
    ? Response.redirect(`${siteUrl()}/?subscription=${action === 'confirm' ? 'confirmed' : 'unsubscribed'}`, 302)
    : json({ ok: true });
}

function decodeBase64(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyResendWebhook(request: Request, payload: string) {
  const webhookId = request.headers.get('svix-id') ?? '';
  const timestamp = request.headers.get('svix-timestamp') ?? '';
  const signatureHeader = request.headers.get('svix-signature') ?? '';
  const timestampNumber = Number(timestamp);
  if (!webhookId || !Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const encodedSecret = requiredEnv('RESEND_WEBHOOK_SECRET').replace(/^whsec_/, '');
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase64(encodedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedPayload = new TextEncoder().encode(`${webhookId}.${timestamp}.${payload}`);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, signedPayload));
  const expected = btoa(String.fromCharCode(...signature));
  return signatureHeader.split(/\s+/).some((candidate) => {
    const [version, value] = candidate.split(',');
    if (version !== 'v1' || !value) return false;
    return constantTimeEqual(value, expected);
  });
}

async function handleResendWebhook(request: Request) {
  const payload = await request.text();
  if (!await verifyResendWebhook(request, payload)) return json({ ok: false }, 401);

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(payload) as ResendWebhookEvent;
  } catch {
    return json({ ok: false }, 400);
  }
  if (!['email.bounced', 'email.complained', 'email.suppressed'].includes(event.type ?? '')) return json({ ok: true });

  const email = event.data?.to?.[0]?.trim().toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: true });
  await db<void>('email_subscribers', `email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: { status: event.type?.replace('email.', '') ?? 'unsubscribed', unsubscribed_at: new Date().toISOString() },
  });
  return json({ ok: true });
}

async function digest(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return json({ ok: false }, 401);
  let runId = '';
  try {
    const run = await db<Array<{ id: string }>>('digest_runs', 'select=id', {
      method: 'POST', body: { status: 'running' }, prefer: 'return=representation',
    });
    runId = run[0]?.id ?? '';
    const [topics, previous] = await Promise.all([
      forumTopics(),
      db<TopicState[]>('proposal_digest_state', 'select=topic_id,posts_count,last_posted_at'),
    ]);
    if (!previous.length) {
      await saveStates(topics);
      if (runId) await db<void>('digest_runs', `id=eq.${runId}`, { method: 'PATCH', body: { status: 'seeded', completed_at: new Date().toISOString() } });
      return json({ ok: true, seeded: topics.length, sent: 0 });
    }
    const byId = new Map(previous.map((item) => [item.topic_id, item]));
    const cutoffMs = Date.now() - DIGEST_LOOKBACK_MS;
    const fresh = topics.filter((topic) => !byId.has(topic.id) && isRecentTopic(topic, cutoffMs));
    const changed = topics.filter((topic) => {
      const old = byId.get(topic.id);
      return Boolean(old && topicChanged(topic, old));
    });
    const [freshDigestTopics, progressTopicGroups] = await Promise.all([
      Promise.all(fresh.map((topic) => buildDigestTopic(topic))),
      Promise.all(changed.map((topic) => buildProgressDigestTopics(topic, byId.get(topic.id)!, cutoffMs))),
    ]);
    const updatedDigestTopics = progressTopicGroups.flat();
    if (!freshDigestTopics.length && !updatedDigestTopics.length) {
      await saveStates(topics);
      if (runId) await db<void>('digest_runs', `id=eq.${runId}`, { method: 'PATCH', body: { status: 'no_changes', completed_at: new Date().toISOString() } });
      return json({ ok: true, changes: 0, sent: 0 });
    }
    const subscribers = await db<Subscriber[]>('email_subscribers', 'select=*&status=eq.confirmed');
    let sent = 0;
    let failed = 0;
    for (let offset = 0; offset < subscribers.length; offset += 10) {
      const chunk = subscribers.slice(offset, offset + 10);
      const results = await Promise.allSettled(chunk.map(async (subscriber) => {
        const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
        await sendEmail(subscriber.email, digestMessage(subscriber.locale, freshDigestTopics, updatedDigestTopics, unsubscribeUrl));
        await db<void>('email_subscribers', `id=eq.${subscriber.id}`, { method: 'PATCH', body: { last_sent_at: new Date().toISOString() } });
      }));
      results.forEach((result) => result.status === 'fulfilled' ? sent += 1 : failed += 1);
    }
    const telegramResults = await Promise.allSettled([
      sendTelegramDigest('zh', freshDigestTopics, updatedDigestTopics),
      sendTelegramDigest('en', freshDigestTopics, updatedDigestTopics),
    ]);
    const telegramDeliveries = telegramResults
      .filter((result): result is PromiseFulfilledResult<TelegramDelivery> => result.status === 'fulfilled')
      .map((result) => result.value);
    const telegramFailed = telegramResults.filter((result) => result.status === 'rejected').length;
    const telegramMessages = telegramDeliveries.reduce((total, delivery) => total + delivery.messagesSent, 0);
    const telegramConfigured = telegramDeliveries.filter((delivery) => delivery.configured).map((delivery) => delivery.locale);
    const deliveryErrors = telegramResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : 'Unknown Telegram error');
    await saveStates(topics);
    if (runId) await db<void>('digest_runs', `id=eq.${runId}`, {
      method: 'PATCH',
      body: {
        status: failed || telegramFailed ? 'partial' : 'completed',
        completed_at: new Date().toISOString(),
        new_proposals: freshDigestTopics.length,
        updated_proposals: updatedDigestTopics.length,
        recipients: sent,
        error_message: [failed ? `${failed} email delivery failure(s)` : '', ...deliveryErrors].filter(Boolean).join('; ').slice(0, 500) || null,
      },
    });
    const partial = failed > 0 || telegramFailed > 0;
    return json({
      ok: !partial,
      newProposals: freshDigestTopics.length,
      updatedProposals: updatedDigestTopics.length,
      email: { sent, failed },
      telegram: { configuredLocales: telegramConfigured, messagesSent: telegramMessages, failed: telegramFailed },
    }, partial ? 207 : 200);
  } catch (error) {
    console.error('Daily digest failed', error);
    if (runId) await db<void>('digest_runs', `id=eq.${runId}`, { method: 'PATCH', body: { status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' } }).catch(() => undefined);
    return json({ ok: false }, 500);
  }
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get('action');
  try {
    if (action === 'subscribe') return await subscribe(request);
    if (action === 'unsubscribe') return await updateSubscription(request, 'unsubscribe', false);
    if (action === 'resend-webhook') return await handleResendWebhook(request);
    return json({ ok: false }, 404);
  } catch (error) {
    console.error('Subscription request failed', error);
    return json({ ok: false, code: 'service_unavailable' }, 503);
  }
}

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get('action');
  try {
    if (action === 'confirm') return await updateSubscription(request, 'confirm');
    if (action === 'unsubscribe') return await updateSubscription(request, 'unsubscribe');
    if (action === 'telegram') {
      const locale = new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'zh';
      return Response.redirect(telegramChannelUrl(locale), 302);
    }
    if (action === 'digest') return await digest(request);
    return json({ ok: false }, 404);
  } catch (error) {
    console.error('Subscription action failed', error);
    if (action === 'digest') return json({ ok: false }, 500);
    return Response.redirect(`${siteUrl()}/?subscription=error`, 302);
  }
}
