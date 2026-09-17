const forumBaseUrl = 'https://talk.nervos.org';
const categoryPath = '/c/daos-funding/ckb-community-fund-dao/65.json';

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

const json = (data: unknown, status = 200) => Response.json(data, { status });
const siteUrl = () => (process.env.SITE_URL ?? 'https://ckb-community-fund-dao-dashboard.vercel.app').replace(/\/$/, '');
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

async function sendEmail(to: string, message: { subject: string; html: string; text: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'CKB Community Fund DAO <updates@mail.ckbcommunityfunddao.xyz>',
      to: [to],
      ...message,
    }),
  });
  if (!response.ok) throw new Error(`Email ${response.status}: ${(await response.text()).slice(0, 400)}`);
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function esc(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function shell(content: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7f2;color:#0b0f0e;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#0b0f0e;border-radius:20px 20px 0 0;padding:24px;color:white"><b style="background:#c8ff67;color:#0b0f0e;border-radius:8px;padding:7px 9px">CKB</b><b style="margin-left:10px">Community Fund DAO</b></div><div style="background:white;border:1px solid #d6ded8;border-top:0;border-radius:0 0 20px 20px;padding:30px">${content}</div><p style="margin:18px 4px;color:#65706a;font-size:12px;line-height:1.6">${footer}</p></div></body></html>`;
}

function confirmationMessage(locale: Locale, url: string) {
  const en = locale === 'en';
  const heading = en ? 'One click to confirm' : 'è¿å·®ä¸æ­¥ï¼ç¡®è®¤è®¢é';
  const body = en
    ? 'After confirmation, you will receive one daily digest at 16:00 China Standard Time when new proposals or proposal updates are detected. No changes means no email.'
    : 'ç¡®è®¤åï¼å½ç½ç«åç°æ°ææ¡æææ¡æ´æ°æ¶ï¼ä½ ä¼å¨æ¯å¤©åäº¬æ¶é´ 16:00 æ¶å°ä¸å°æ±æ»é®ä»¶ï¼æ²¡æååæ¶ä¸ä¼åéã';
  const button = en ? 'Confirm subscription' : 'ç¡®è®¤è®¢é';
  const footer = en ? 'Ignore this email if you did not request it.' : 'å¦æä¸æ¯ä½ æä½ï¼è¯·å¿½ç¥æ­¤é®ä»¶ã';
  return {
    subject: en ? 'Confirm your CKB Community Fund DAO subscription' : 'ç¡®è®¤è®¢é CKB Community Fund DAO ææ¡æ´æ°',
    html: shell(`<h1 style="margin:0 0 14px">${heading}</h1><p style="color:#4d5953;line-height:1.75">${body}</p><a href="${esc(url)}" style="display:inline-block;margin-top:16px;background:#087958;color:white;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:bold">${button}</a><p style="margin-top:24px;color:#7a847f;font-size:12px;word-break:break-all">${esc(url)}</p>`, footer),
    text: `${heading}\n\n${body}\n\n${button}: ${url}\n\n${footer}`,
  };
}

const topicUrl = (topic: Topic) => `${forumBaseUrl}/t/${topic.slug}/${topic.id}`;

function digestMessage(locale: Locale, newTopics: Topic[], updatedTopics: Topic[], unsubscribeUrl: string) {
  const en = locale === 'en';
  const total = newTopics.length + updatedTopics.length;
  const section = (title: string, topics: Topic[]) => topics.length
    ? `<h2 style="margin:28px 0 12px;font-size:18px">${title}</h2><ul style="padding:0;margin:0">${topics.map((topic) => `<li style="margin:0 0 12px;padding:15px;border:1px solid #dce3de;border-radius:14px;list-style:none"><a href="${topicUrl(topic)}" style="color:#087958;text-decoration:none;font-weight:bold">${esc(topic.title)}</a><div style="margin-top:7px;color:#7a847f;font-size:12px">${topic.posts_count} ${en ? 'posts' : 'ç¯å¸å­'}</div></li>`).join('')}</ul>`
    : '';
  const intro = en
    ? `${newTopics.length} new proposal(s) and ${updatedTopics.length} updated proposal(s) were detected.`
    : `æ£æµå° ${newTopics.length} ä»½æ°ææ¡å ${updatedTopics.length} ä»½ææ´æ°çææ¡ã`;
  const footer = en
    ? `You subscribed to daily proposal updates. <a href="${esc(unsubscribeUrl)}">Unsubscribe</a>.`
    : `ä½ è®¢éäºæ¯æ¥ææ¡æ´æ°ã<a href="${esc(unsubscribeUrl)}">åæ¶è®¢é</a>ã`;
  const textItems = [...newTopics, ...updatedTopics].map((topic) => `- ${topic.title}: ${topicUrl(topic)}`).join('\n');
  return {
    subject: en ? `CKB Community Fund DAO: ${total} proposal update${total === 1 ? '' : 's'}` : `CKB Community Fund DAOï¼${total} æ¡ææ¡å¨æ`,
    html: shell(`<h1 style="margin:0 0 14px">${en ? 'Todayâs proposal digest' : 'ä»æ¥ææ¡æ´æ°æ±æ»'}</h1><p style="color:#4d5953;line-height:1.75">${intro}</p>${section(en ? 'New proposals' : 'æ°ææ¡', newTopics)}${section(en ? 'Proposal updates' : 'ææ¡æ´æ°', updatedTopics)}<a href="${siteUrl()}/projects" style="color:#087958;font-weight:bold;text-decoration:none>${en ? 'Open proposal directory â' : 'æ¥çææ¡ç®å½ 8¡'}</a>`, footer),
    text: `${intro}\n\n${textItems}\n\n${en ? 'Unsubscribe' : 'åæ¶è®¢é'}: ${unsubscribeUrl}`,
  };
}

function isProposal(title: string) {
  const value = title.trim();
  if (/^\s*(?:\[|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|\))/i.test(value)) return false;
  return /^\s*(?:\[|\()\s*DIS\s*(?:\]|\))/i.test(value) || /(grant|funding|sponsorship)\s+proposal|èµå©ææ¡|èµå©ææ¡/i.test(value);
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

async function updateSubscription(request: Request, action: 'confirm' | 'unsubscribe') {
  const value = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(value)) return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);
  const column = action === 'confirm' ? 'confirmation_token' : 'unsubscribe_token';
  const matches = await db<Subscriber[]>('email_subscribers', `select=*&${column}=eq.${value}&limit=1`);
  if (!matches[0]) return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);
  const now = new Date().toISOString();
  await db<void>('email_subscribers', `id=eq.${matches[0].id}`, {
    method: 'PATCH',
    body: action === 'confirm'
      ? { status: 'confirmed', confirmed_at: now, unsubscribed_at: null }
      : { status: 'unsubscribed', unsubscribed_at: now },
  });
  return Response.redirect(`${siteUrl()}/?subscription=${action === 'confirm' ? 'confirmed' : 'unsubscribed'}`, 302);
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
    const fresh = topics.filter((topic) => !byId.has(topic.id));
    const updated = topics.filter((topic) => {
      const old = byId.get(topic.id);
      const last = topic.last_posted_at ?? topic.bumped_at ?? topic.created_at;
      return Boolean(old && (topic.posts_count > old.posts_count || last > old.last_posted_at));
    });
    if (!fresh.length && !updated.length) {
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
        await sendEmail(subscriber.email, digestMessage(subscriber.locale, fresh, updated, unsubscribeUrl));
        await db<void>('email_subscribers', `id=eq.${subscriber.id}`, { method: 'PATCH', body: { last_sent_at: new Date().toISOString() } });
      }));
      results.forEach((result) => result.status === 'fulfilled' ? sent += 1 : failed += 1);
    }
    await saveStates(topics);
    if (runId) await db<void>('digest_runs', `id=eq.${runId}`, {
      method: 'PATCH',
      body: { status: failed ? 'partial' : 'completed', completed_at: new Date().toISOString(), new_proposals: fresh.length, updated_proposals: updated.length, recipients: sent, error_message: failed ? `${failed} delivery failure(s)` : null },
    });
    return json({ ok: !failed, newProposals: fresh.length, updatedProposals: updated.length, sent, failed }, failed ? 207 : 200);
  } catch (error) {
    console.error('Daily digest failed', error);
    if (runId) await db<void>('digest_runs', `id=eq.${runId}`, { method: 'PATCH', body: { status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' } }).catch(() => undefined);
    return json({ ok: false }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('action') !== 'subscribe') return json({ ok: false }, 404);
    return await subscribe(request);
  } catch (error) {
    console.error('Subscription failed', error);
    return json({ ok: false, code: 'service_unavailable' }, 503);
  }
}

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get('action');
  try {
    if (action === 'confirm') return await updateSubscription(request, 'confirm');
    if (action === 'unsubscribe') return await updateSubscription(request, 'unsubscribe');
    if (action === 'digest') return await digest(request);
    return json({ ok: false }, 404);
  } catch (error) {
    console.error('Subscription action failed', error);
    if (action === 'digest') return json({ ok: false }, 500);
    return Response.redirect(`${siteUrl()}/?subscription=error`, 302);
  }
}
