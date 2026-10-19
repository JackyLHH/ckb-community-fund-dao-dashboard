import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { discussionDeadline, discussionLikeCount, lifecycleLabel, lifecycleStatus, pendingLifecycleEvents, readDiscussionEvidence, voteLifecycleEvents } from '../lib/digest-lifecycle.ts';

const createdAt = '2026-10-01T01:23:45.000Z';
const deadline = discussionDeadline(createdAt);
assert.equal(new Date(deadline).toISOString(), '2026-10-08T01:23:45.000Z');
const before = new Date(deadline - 1).toISOString();
const after = new Date(deadline).toISOString();
assert.equal(discussionLikeCount(['a', 'b', 'c'], { a: before, b: after, c: after }, createdAt, 3), 1);
assert.equal(discussionLikeCount(['a', 'b', 'c'], { b: before, c: after }, createdAt, 3), 2, 'Infer an earlier timestamp only from ordered, verified evidence');
assert.equal(discussionLikeCount(['a', 'b', 'c'], { a: before, c: after }, createdAt, 3), null, 'A missing timestamp straddling the deadline is not guessable');
assert.equal(discussionLikeCount(['a', 'a'], { a: before }, createdAt, 2), null);
assert.equal(discussionLikeCount(['a'], { a: before }, createdAt, 38), null, 'Never use a truncated like list or topic-wide count');
assert.equal(discussionLikeCount(['a', 'b'], { a: after, b: before }, createdAt, 2), 1, 'Complete timestamps are sufficient without relying on user ordering');
assert.equal(discussionLikeCount(['a', 'b', 'c'], { a: after, b: before }, createdAt, 3), null, 'Unordered evidence must not be used to infer an unknown time');
assert.equal(discussionLikeCount(['a', 'b', 'c'], { a: after, b: before }, createdAt, 3, ['c']), 2, 'An observation before the cutoff can establish a private user’s missing timestamp');
assert.equal(discussionLikeCount([], {}, createdAt, 0), 0);
const likers = Array.from({ length: 35 }, (_, index) => ({ username: `user${index}`,
  created_at: new Date(index < 30 ? deadline - (30 - index) * 1000 : deadline + (index - 30) * 1000).toISOString() }));
const evidenceSource = async (path) => {
  if (path === '/t/123.json') return { post_stream: { posts: [{ id: 456, post_number: 1, actions_summary: [{ id: 2, count: 35 }] }] } };
  if (path.includes('reactions-users')) return { reaction_users: [{ id: 'heart', count: 35, users: likers.slice(8) }] };
  if (path.includes('post_action_users')) return { post_action_users: likers };
  throw new Error('Unexpected request while reconstructing complete, ordered likes');
};
const evidence = await readDiscussionEvidence({ id: 123, created_at: createdAt }, undefined, evidenceSource, deadline + 10000);
assert.equal(evidence.likes, 30, 'Late likes must not turn a failed discussion into an eligible one');
assert.equal((await readDiscussionEvidence({ id: 123, created_at: createdAt }, undefined, evidenceSource, deadline - 1)).likes, null, 'Do not publish before the 7-day window closes');
await assert.rejects(() => readDiscussionEvidence({ id: 123, created_at: createdAt }, undefined,
  async () => ({ post_stream: { posts: [{ id: 456, post_number: 1 }] } })), /Missing first-post/);

const base = { topicId: 999991, occurredAt: before, sourceUrl: 'https://talk.nervos.org/t/test/999991/1' };
const below = { ...base, id: 'discussion-ended:999991', kind: 'discussion-ended', likes: 29 };
const eligible = { ...base, topicId: 999992, id: 'discussion-ended:999992', kind: 'discussion-ended', likes: 30 };
assert.match(lifecycleLabel(below, 'zh'), /29 个赞，未达到 30/);
assert.match(lifecycleLabel(eligible, 'zh'), /30 个赞，核验通过后/);
assert.match(lifecycleLabel(below, 'en'), /will not proceed to voting/);
assert.deepEqual(lifecycleStatus(below), ['ended']);
assert.deepEqual(lifecycleStatus(eligible), []);
const vote = { url: 'https://dao.ckb.community/thread/vot-test-12345', status: 'approved', closed: true,
  totalVotes: 244888704, yesPercent: 52.82, openedAt: '2026-10-02T00:00:00Z', closedAt: '2026-10-09T00:00:00Z' };
const events = voteLifecycleEvents(999993, vote, createdAt);
assert.deepEqual(events.map((event) => event.kind), ['vote-started', 'vote-ended']);
assert.match(lifecycleLabel(events[0], 'zh'), /投票地址：https:\/\/dao.ckb.community/);
assert.match(lifecycleLabel(events[1], 'zh'), /244,888,704，赞成比例：52.82%，投票结果：通过/);
assert.match(lifecycleLabel({ ...events[1], approved: false }, 'en'), /Not passed/);
assert.deepEqual(voteLifecycleEvents(999993, { ...vote, closed: false, status: 'active' }, createdAt).map((event) => event.kind), ['vote-started']);
assert.equal(voteLifecycleEvents(999993, { ...vote, totalVotes: undefined }, createdAt).length, 1);
assert.equal(voteLifecycleEvents(999993, vote, '2026-10-10T00:00:00Z').length, 0, 'No historical flood on rollout');
assert.notEqual(events[0].id, voteLifecycleEvents(999993, { ...vote, url: 'https://dao.ckb.community/thread/vot-again-45678' }, createdAt)[0].id);
assert.equal(events[0].id, voteLifecycleEvents(999993, { ...vote, url: 'https://dao.ckb.community/thread/vot-renamed-title-12345' }, createdAt)[0].id, 'Renaming a poll must not emit a second start notification');
const snapshot = { version: 1, enabledAt: createdAt, checkedAt: before, discussions: {}, events: [below, below, eligible, ...events] };
assert.equal(pendingLifecycleEvents(snapshot, deadline + 864000000).length, 4, 'Durable, unique events survive an outage longer than 24 hours');
assert.equal(pendingLifecycleEvents(snapshot, Date.parse(createdAt)).length, 0, 'No premature day-8 or future events');

// Bundle the real endpoint and renderers, rather than duplicate template logic.
const bundled = await build({ entryPoints: [new URL('../api/subscription.ts', import.meta.url).pathname],
  bundle: true, platform: 'node', format: 'esm', write: false,
  footer: { js: 'export { digestMessage, telegramDigestMessages };' } });
const { GET, digestMessage, telegramDigestMessages } = await import(`data:text/javascript;base64,${Buffer.from(`${bundled.outputFiles[0].text}\n//# sourceURL=ckb-digest-under-test.mjs`).toString('base64')}`);
const topic = { id: 999991, slug: 'test', title: '[DIS] Test proposal', posts_count: 1, like_count: 999, created_at: createdAt };
const topics = [topic, { ...topic, id: 999992 }, { ...topic, id: 999993, created_at: '2026-09-01T00:00:00Z' }];
const recent = new Date(Date.now() - 3600000).toISOString();
const liveEvents = [below, eligible, ...events].map((event) => ({ ...event, occurredAt: recent }));
const item = { topic, proposer: 'Alice', firstPostExcerpt: '', overviewZh: '', overviewEn: '', latestPostAuthor: 'Metaforo', latestPostCreatedAt: recent, latestPostExcerpt: '', newPostCount: 0, lifecycleEvent: liveEvents[3] };
for (const locale of ['zh', 'en']) {
  const email = digestMessage(locale, [], [item], 'https://ckbcommunityfunddao.xyz/api/unsubscribe?token=test');
  const label = lifecycleLabel(liveEvents[3], locale);
  assert.ok(email.html.includes(label)); assert.ok(email.text.includes(label));
  assert.ok(email.html.includes(`href="${vote.url}"`));
  assert.ok(email.html.includes(locale === 'en' ? 'Proposal record' : '提案记录'));
  const telegram = telegramDigestMessages(locale, [], [item]).join('\n');
  assert.ok(telegram.includes(label)); assert.ok(telegram.includes('1. <a href=')); assert.ok(telegram.includes(vote.url));
}

process.env.SUPABASE_URL = 'https://database.example';
process.env.SUPABASE_SECRET_KEY = 'test-only';
process.env.CRON_SECRET = 'test-only';
process.env.RESEND_API_KEY = 'test-only';
process.env.TELEGRAM_BOT_TOKEN = 'test-only';
const subscribers = ['zh', 'en'].map((locale) => ({ id: locale, email: `${locale}@example.test`, locale, status: 'confirmed', unsubscribe_token: 'test', confirmed_at: createdAt }));
const originalFetch = globalThis.fetch;
let lease = false, initial = false, failEnglish = false, omitDiscussion = false;
const receipts = new Map();
const emails = [], telegram = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const body = init.body ? JSON.parse(init.body) : null;
  if (url.host === 'database.example') {
    const table = url.pathname.split('/').at(-1);
    if (table === 'claim_digest_delivery') { if (lease) return Response.json(false); lease = true; return Response.json(true); }
    if (table === 'digest_delivery_receipts') {
      if (init.method === 'PATCH') { lease = false; return new Response(null, { status: 204 }); }
      if (init.method === 'POST') { for (const receipt of body) receipts.set(receipt.key, receipt); return new Response(null, { status: 204 }); }
      const requested = JSON.parse(`[${url.searchParams.get('key').slice(4, -1)}]`);
      return Response.json(requested.filter((key) => receipts.has(key)).map((key) => ({ key })));
    }
    if (table === 'digest_runs') return init.method === 'POST' ? Response.json([{ id: 'test-run' }]) : new Response(null, { status: 204 });
    if (table === 'email_subscribers') return init.method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json(subscribers);
    if (table === 'proposal_digest_state') return init.method === 'POST' ? new Response(null, { status: 204 })
      : Response.json(initial ? [] : topics.map((topic) => ({ topic_id: topic.id, posts_count: 1, last_posted_at: createdAt })));
  }
  if (url.host === 'talk.nervos.org' && url.pathname.endsWith('/latest.json')) return Response.json({ topic_list: { topics } });
  if (url.host === 'talk.nervos.org' && url.pathname === '/t/999991.json') return Response.json({ post_stream: { posts: [{ id: 12345, post_number: 1, actions_summary: [] }] } });
  if (url.host === 'raw.githubusercontent.com') return Response.json({ ...snapshot, events: omitDiscussion ? liveEvents.slice(1) : liveEvents });
  if (url.host === 'api.resend.com') {
    if (failEnglish && body.to[0] === 'en@example.test') return new Response('Test failure', { status: 500 });
    assert.ok(init.headers['Idempotency-Key']); emails.push(body); return Response.json({ id: 'test' });
  }
  if (url.host === 'api.telegram.org') { telegram.push(body); return Response.json({ ok: true, result: { message_id: telegram.length } }); }
  throw new Error(`Unexpected network request in offline test: ${url.host}${url.pathname}`);
};
const request = () => new Request('https://ckbcommunityfunddao.xyz/api/subscription?action=digest', { headers: { authorization: 'Bearer test-only' } });
try {
  initial = true;
  assert.equal((await (await GET(request())).json()).sent, 0, 'Seeding must not push historical events');
  initial = false;
  const first = await GET(request());
  assert.equal(first.status, 200); assert.equal(emails.length, 2); assert.equal(telegram.length, 2);
  assert.equal(receipts.size, 16, 'Four events are receipted independently for two subscribers and two channels');
  assert.match(emails[0].subject, /4 条进展更新/); assert.match(emails[1].subject, /4 proposal updates/);
  const repeated = await GET(request());
  assert.equal((await repeated.json()).updatedProposals, 0, 'Old receipted events must not inflate daily statistics');
  assert.equal(emails.length, 2, 'Delivered events must not be sent again the next day');
  assert.equal(telegram.length, 2);
  receipts.clear(); failEnglish = true;
  const partial = await GET(request());
  assert.equal(partial.status, 207);
  assert.equal(receipts.size, 12, 'A failed email must not be acknowledged as delivered');
  failEnglish = false;
  const retry = await GET(request());
  assert.equal(retry.status, 200); assert.equal((await retry.json()).email.sent, 1, 'Only the failed subscriber is retried');
  assert.equal(receipts.size, 16);
  receipts.clear(); omitDiscussion = true;
  const catchUp = await GET(request());
  assert.equal(catchUp.status, 200);
  assert.equal((await catchUp.json()).updatedProposals, 4, 'A deadline after the latest background scan must be checked by the daily digest itself');
  assert.ok(emails.at(-2).html.includes('0 个赞，未达到 30'));
  omitDiscussion = false;
  lease = true;
  assert.equal((await (await GET(request())).json()).skipped, 'already_running');
  assert.equal((await GET(new Request('https://example.test/?action=digest'))).status, 401);
} finally { globalThis.fetch = originalFetch; }
console.log('Validated bilingual lifecycle digests, exact discussion window, vote transitions, receipt deduplication, retry isolation and cron locking (offline; no messages sent).');
