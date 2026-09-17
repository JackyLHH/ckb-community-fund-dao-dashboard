const forumBaseUrl = 'https://talk.nervos.org';
const categoryPath = '/c/daos-funding/ckb-community-fund-dao/65.json';

export type SubscriberLocale = 'zh' | 'en';

export interface Subscriber {
  id: string;
  email: string;
  locale: SubscriberLocale;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirmation_token: string;
  unsubscribe_token: string;
}

export interface ForumTopic {
  id: number;
  slug: string;
  title: string;
  posts_count: number;
  like_count: number;
  created_at: string;
  last_posted_at?: string;
  bumped_at?: string;
}

export interface DigestState {
  topic_id: number;
  slug: string;
  title: string;
  posts_count: number;
  like_count: number;
  last_posted_at: string;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function siteUrl() {
  return (process.env.SITE_URL ?? 'https://ckb-community-fund-dao-dashboard.vercel.app').replace(/\/$/, '');
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function databaseRequest<T>(
  table: string,
  query: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const url = `${requiredEnv('SUPABASE_URL')}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      apikey: requiredEnv('SUPABASE_SECRET_KEY'),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Database request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'CKB Community Fund DAO <updates@mail.ckbcommunityfunddao.xyz>',
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailShell(content: string, footer: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f7f2;color:#0b0f0e;font-family:Inter,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">CKB Community Fund DAO proposal update</div>
  <div style="max-width:640px;margin:0 auto;padding:28px 16px">
    <div style="background:#0b0f0e;border-radius:20px 20px 0 0;padding:24px;color:#fff">
      <div style="display:inline-block;background:#c8ff67;color:#0b0f0e;border-radius:8px;padding:7px 9px;font-weight:800;font-size:12px">CKB</div>
      <span style="margin-left:10px;font-weight:700">Community Fund DAO</span>
    </div>
    <div style="background:#fff;border:1px solid #d6ded8;border-top:0;border-radius:0 0 20px 20px;padding:30px">${content}</div>
    <p style="margin:18px 4px 0;color:#65706a;font-size:12px;line-height:1.6">${footer}</p>
  </div>
</body></html>`;
}

export function confirmationEmail(locale: SubscriberLocale, confirmationUrl: string) {
  const isEnglish = locale === 'en';
  const subject = isEnglish
    ? 'Confirm your CKB Community Fund DAO updates subscription'
    : '确认订阅 CKB Community Fund DAO 提案更新';
  const heading = isEnglish ? 'One click to confirm' : '还差一步：确认订阅';
  const body = isEnglish
    ? 'After confirmation, you will receive one daily digest at 08:00 China Standard Time when new proposals or proposal updates are detected. No changes means no email.'
    : '确认后，当网站发现新提案或提案更新时，你会在每天北京时间 08:00 收到一封汇总邮件；没有变化时不会发送。';
  const button = isEnglish ? 'Confirm subscription' : '确认订阅';
  const footer = isEnglish
    ? 'You received this email because this address was entered on the CKB Community Fund DAO dashboard. Ignore it if this was not you.'
    : '你收到此邮件，是因为这个邮箱被填写在 CKB Community Fund DAO 仪表盘中。如果不是你操作，请忽略。';
  const html = emailShell(
    `<h1 style="margin:0 0 14px;font-size:28px;line-height:1.15">${heading}</h1>
     <p style="margin:0;color:#4d5953;font-size:15px;line-height:1.75">${body}</p>
     <a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;margin-top:24px;background:#087958;color:#fff;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:750">${button}</a>
     <p style="margin:24px 0 0;color:#7a847f;font-size:12px;word-break:break-all">${escapeHtml(confirmationUrl)}</p>`,
    footer,
  );
  const text = `${heading}\n\n${body}\n\n${button}: ${confirmationUrl}\n\n${footer}`;
  return { subject, html, text };
}

function topicUrl(topic: ForumTopic) {
  return `${forumBaseUrl}/t/${topic.slug}/${topic.id}`;
}

export function digestEmail(
  locale: SubscriberLocale,
  newTopics: ForumTopic[],
  updatedTopics: ForumTopic[],
  unsubscribeUrl: string,
) {
  const isEnglish = locale === 'en';
  const total = newTopics.length + updatedTopics.length;
  const subject = isEnglish
    ? `CKB Community Fund DAO: ${total} proposal ${total === 1 ? 'update' : 'updates'}`
    : `CKB Community Fund DAO：${total} 条提案动态`;
  const heading = isEnglish ? 'Today’s proposal digest' : '今日提案更新汇总';
  const intro = isEnglish
    ? `${newTopics.length} new proposal(s) and ${updatedTopics.length} updated proposal(s) were detected.`
    : `检测到 ${newTopics.length} 份新提案和 ${updatedTopics.length} 份有更新的提案。`;

  const renderSection = (title: string, topics: ForumTopic[], isUpdate: boolean) => {
    if (topics.length === 0) return '';
    const items = topics.map((topic) => {
      const meta = isEnglish
        ? `${topic.posts_count} posts${isUpdate ? ' · New activity in the discussion' : ''}`
        : `${topic.posts_count} 篇帖子${isUpdate ? ' · 讨论中出现新动态' : ''}`;
      return `<li style="margin:0 0 14px;padding:16px;border:1px solid #dce3de;border-radius:14px;list-style:none">
        <a href="${escapeHtml(topicUrl(topic))}" style="color:#087958;text-decoration:none;font-weight:750;line-height:1.45">${escapeHtml(topic.title)}</a>
        <div style="margin-top:7px;color:#7a847f;font-size:12px">${meta}</div>
      </li>`;
    }).join('');
    return `<h2 style="margin:28px 0 12px;font-size:18px">${title}</h2><ul style="padding:0;margin:0">${items}</ul>`;
  };

  const footer = isEnglish
    ? `You subscribed to daily proposal updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#59645f">Unsubscribe</a>.`
    : `你订阅了每日提案更新。<a href="${escapeHtml(unsubscribeUrl)}" style="color:#59645f">取消订阅</a>。`;
  const html = emailShell(
    `<h1 style="margin:0 0 14px;font-size:28px;line-height:1.15">${heading}</h1>
     <p style="margin:0;color:#4d5953;font-size:15px;line-height:1.75">${intro}</p>
     ${renderSection(isEnglish ? 'New proposals' : '新提案', newTopics, false)}
     ${renderSection(isEnglish ? 'Proposal updates' : '提案更新', updatedTopics, true)}
     <a href="${siteUrl()}/projects" style="display:inline-block;margin-top:20px;color:#087958;font-weight:750;text-decoration:none">${isEnglish ? 'Open proposal directory →' : '查看提案目录 →'}</a>`,
    footer,
  );

  const lines = [heading, '', intro, ''];
  if (newTopics.length) {
    lines.push(isEnglish ? 'New proposals:' : '新提案：');
    for (const topic of newTopics) lines.push(`- ${topic.title}: ${topicUrl(topic)}`);
    lines.push('');
  }
  if (updatedTopics.length) {
    lines.push(isEnglish ? 'Proposal updates:' : '提案更新：');
    for (const topic of updatedTopics) lines.push(`- ${topic.title}: ${topicUrl(topic)}`);
    lines.push('');
  }
  lines.push(isEnglish ? `Unsubscribe: ${unsubscribeUrl}` : `取消订阅：${unsubscribeUrl}`);
  return { subject, html, text: lines.join('\n') };
}

function looksLikeProposal(title: string) {
  const normalized = title.trim();
  if (/^\s*(?:\[|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|\))/i.test(normalized)) return false;
  if (/^\s*(?:\[|\()\s*DIS\s*(?:\]|\))/i.test(normalized)) return true;
  return /(grant|funding|sponsorship)\s+proposal|资助提案|赞助提案/i.test(normalized);
}

export async function fetchForumTopics() {
  const topics = new Map<number, ForumTopic>();
  for (let page = 0; page < 30; page += 1) {
    const response = await fetch(`${forumBaseUrl}${categoryPath}?page=${page}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Forum request failed (${response.status})`);
    const payload = await response.json() as {
      topic_list?: { topics?: ForumTopic[]; more_topics_url?: string };
    };
    const pageTopics = payload.topic_list?.topics ?? [];
    for (const topic of pageTopics) {
      if (looksLikeProposal(topic.title)) topics.set(topic.id, topic);
    }
    if (!payload.topic_list?.more_topics_url || pageTopics.length === 0) break;
  }
  return [...topics.values()];
}

export function stateForTopic(topic: ForumTopic) {
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
