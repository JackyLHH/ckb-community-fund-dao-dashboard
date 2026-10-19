import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { confirmationCooldown, filterSubscriptionDigest, maskedEmail, normalizeSubscriptionPreferences, subscriptionCategories } from '../lib/subscription-preferences.ts';

const fresh = [{ topic: { id: 1 } }, { topic: { id: 2 } }, { topic: { id: 1 } }];
const progress = { topic: { id: 1 }, latestPostNumber: 10 };
const discussion = { topic: { id: 1 }, lifecycleEvent: { id: 'discussion-ended:1', kind: 'discussion-ended' } };
const vote = { topic: { id: 2 }, lifecycleEvent: { id: 'vote-ended:2:12345', kind: 'vote-ended' } };
const updates = [progress, discussion, vote, progress, discussion];
assert.deepEqual(normalizeSubscriptionPreferences().categories, subscriptionCategories);
assert.equal(normalizeSubscriptionPreferences().scope, 'all');
assert.deepEqual(normalizeSubscriptionPreferences({ proposalIds: ['1', 1, '0', '../secret', 2], categories: ['new', 'bogus', 'new'] }),
  { version: 1, categories: ['new'], scope: 'all', proposalIds: ['1', '2'] });
assert.equal(normalizeSubscriptionPreferences({ proposalIds: Array.from({ length: 150 }, (_, i) => i + 1) }).proposalIds.length, 100);
assert.deepEqual(filterSubscriptionDigest(undefined, fresh, updates), { fresh: fresh.slice(0, 2), updates: [progress, discussion, vote] }, 'Legacy subscribers preserve all types and scopes, without duplicate cards');
const privateResult = filterSubscriptionDigest({ scope: 'selected', proposalIds: ['1'], categories: ['progress', 'vote-ended'] }, fresh, updates);
assert.deepEqual(privateResult, { fresh: [], updates: [progress] });
assert.deepEqual(filterSubscriptionDigest({ scope: 'selected', proposalIds: [], categories: ['new'] }, fresh, updates), { fresh: [], updates: [] });
assert.deepEqual(filterSubscriptionDigest({ categories: [] }, fresh, updates), { fresh: [], updates: [] });
assert.equal(filterSubscriptionDigest(undefined, fresh, updates).updates.length, 3, 'A private choice must not mutate the global source arrays');
assert.equal(maskedEmail('jacky@example.test'), 'j***@example.test');
assert.equal(maskedEmail('invalid'), '***');
assert.equal(confirmationCooldown('2026-10-01T00:00:00Z', Date.parse('2026-10-01T00:00:30Z')), 30);
assert.equal(confirmationCooldown(null), 0);

const bundled = await build({ entryPoints: [new URL('../api/subscription.ts', import.meta.url).pathname], bundle: true,
  platform: 'node', format: 'esm', write: false, footer: { js: 'export { digestMessage, confirmationMessage, managementUrl, digestIdempotencyKey };' } });
const { GET, POST, digestMessage, confirmationMessage, managementUrl, digestIdempotencyKey } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const token = 'a'.repeat(64);
assert.equal(managementUrl(token), `https://ckbcommunityfunddao.xyz/subscription#token=${token}`);
assert.equal(managementUrl(token, '10015'), `https://ckbcommunityfunddao.xyz/subscription?proposal=10015#token=${token}`);
assert.ok(!managementUrl(token, '../evil').includes('?'));
const digestItem = { topic: { id: 1, slug: 'test', title: 'Example' }, proposer: 'Alice', budget: '$3,000',
  firstPostExcerpt: '', overviewZh: '示例概览', overviewEn: 'Example overview', latestPostAuthor: 'Alice', latestPostExcerpt: '', latestPostNumber: 10, newPostCount: 1 };
for (const locale of ['zh', 'en']) {
  const message = digestMessage(locale, [], [digestItem], 'https://ckbcommunityfunddao.xyz/api/unsubscribe?token=private', managementUrl(token));
  assert.ok(message.html.includes(managementUrl(token)));
  assert.ok(message.text.includes(managementUrl(token)));
  assert.ok(message.subject.includes(locale === 'en' ? '0 new proposals, 1 proposal update' : '0 份新提案，1 条进展更新'));
  assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(confirmationMessage(locale, 'https://ckbcommunityfunddao.xyz/api/confirm?token=private').html.includes('16:00'));
}
assert.equal(await digestIdempotencyKey('email:one', [], [digestItem]), await digestIdempotencyKey('email:one', [], [digestItem]));
assert.notEqual(await digestIdempotencyKey('email:one', [], [digestItem]), await digestIdempotencyKey('email:two', [], [digestItem]), 'One recipient cannot suppress another recipient’s message');

process.env.SUPABASE_URL = 'https://preferences-db.example';
process.env.SUPABASE_SECRET_KEY = 'offline-only';
const originalFetch = globalThis.fetch;
const subscriber = { id: 'one', email: 'alice@example.test', locale: 'en', status: 'confirmed', unsubscribe_token: token };
const patches = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.equal(url.host, 'preferences-db.example', 'Offline preferences tests must not send emails or touch real services');
  assert.equal(url.pathname, '/rest/v1/email_subscribers');
  if (init.method === 'PATCH') { patches.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
  return Response.json(url.searchParams.get('unsubscribe_token') === `eq.${token}` ? [subscriber] : []);
};
const request = (data) => new Request('https://ckbcommunityfunddao.xyz/api/subscription?action=preferences', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
try {
  assert.equal((await POST(request({ token: 'wrong' }))).status, 401);
  assert.equal((await POST(request({ token: 'b'.repeat(64) }))).status, 401);
  const loaded = await POST(request({ token }));
  assert.equal(loaded.headers.get('cache-control'), 'no-store, private');
  const payload = await loaded.json();
  assert.equal(payload.destination, 'a***@example.test');
  assert.deepEqual(payload.preferences.categories, subscriptionCategories);
  assert.ok(!JSON.stringify(payload).includes(token));
  assert.ok(!JSON.stringify(payload).includes(subscriber.email));
  assert.equal(patches.length, 0, 'Reading a preference link must not change anything');
  const updated = await POST(request({ token, locale: 'zh', preferences: { scope: 'selected', proposalIds: ['10015'], categories: ['progress'] } }));
  assert.equal(updated.status, 200);
  assert.deepEqual(patches[0].preferences, { version: 1, scope: 'selected', proposalIds: ['10015'], categories: ['progress'] });
  assert.equal(patches[0].locale, 'zh');
  assert.ok(Number.isFinite(Date.parse(patches[0].preferences_updated_at)), 'Preference changes establish a no-backfill boundary');
  subscriber.status = 'complained';
  assert.equal((await POST(request({ token, locale: 'zh', preferences: {} }))).status, 401, 'Preferences cannot reactivate a suppressed address');
  assert.equal(patches.length, 1);
} finally { globalThis.fetch = originalFetch; }

// Exercise the real daily endpoint with independent private choices. Counts and
// public channels must be generated from their own, correctly scoped cards.
process.env.CRON_SECRET = 'offline-only';
process.env.RESEND_API_KEY = 'offline-only';
process.env.TELEGRAM_BOT_TOKEN = 'offline-only';
const recent = new Date(Date.now() - 3_600_000).toISOString();
const earlier = new Date(Date.now() - 2 * 86_400_000).toISOString();
const topics = [{ id: 10015, slug: 'new-example', title: '[DIS] New example', posts_count: 1, created_at: recent, last_posted_at: recent },
  { id: 10583, slug: 'progress-example', title: '[DIS] Progress example', posts_count: 2, created_at: earlier, last_posted_at: recent }];
const recipients = [
  { ...subscriber, id: 'legacy', email: 'legacy@example.test', status: 'confirmed' },
  { ...subscriber, id: 'progress', email: 'progress@example.test', status: 'confirmed', preferences: { categories: ['progress'], scope: 'selected', proposalIds: ['10583'] } },
  { ...subscriber, id: 'new', email: 'new@example.test', status: 'confirmed', preferences: { categories: ['new'], scope: 'selected', proposalIds: ['10015'] } },
  { ...subscriber, id: 'paused', email: 'paused@example.test', status: 'confirmed', preferences: { categories: [] } },
];
const emails = [], channels = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  if (url.host === 'preferences-db.example') {
    const table = url.pathname.split('/').at(-1);
    if (table === 'claim_digest_delivery') return Response.json(true);
    if (table === 'digest_runs') return init.method === 'POST' ? Response.json([{ id: 'offline' }]) : new Response(null, { status: 204 });
    if (table === 'digest_delivery_receipts') return new Response(null, { status: 204 });
    if (table === 'email_subscribers') return init.method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json(recipients);
    if (table === 'proposal_digest_state') return init.method === 'POST' ? new Response(null, { status: 204 }) : Response.json([{ topic_id: 10583, posts_count: 1, last_posted_at: earlier }]);
  }
  if (url.host === 'talk.nervos.org' && url.pathname.endsWith('/latest.json')) return Response.json({ topic_list: { topics } });
  if (url.host === 'talk.nervos.org' && /\/t\/(10015|10583)\.json/.test(url.pathname)) return Response.json({ post_stream: { posts: [
    { post_number: 1, username: 'Alice', created_at: earlier, cooked: '<p>This proposal will build open-source community tools. Budget: $3,000.</p>' },
    ...(url.pathname.includes('10583') ? [{ post_number: 2, username: 'Alice', created_at: recent, cooked: '<h2>Weekly update</h2><p>We completed the app tests and delivered the source code. Next week we will improve the interface.</p>' }] : []),
  ] } });
  if (url.host === 'raw.githubusercontent.com') return Response.json({ version: 1, enabledAt: new Date(Date.now() + 86_400_000).toISOString(), events: [], discussions: {} });
  if (url.host === 'api.resend.com') { emails.push(body); return Response.json({ id: 'offline' }); }
  if (url.host === 'api.telegram.org') { channels.push(body); return Response.json({ ok: true, result: { message_id: channels.length } }); }
  throw new Error(`Unexpected request in offline digest test: ${url.host}${url.pathname}`);
};
try {
  const result = await GET(new Request('https://ckbcommunityfunddao.xyz/api/subscription?action=digest', { headers: { authorization: 'Bearer offline-only' } }));
  assert.equal(result.status, 200);
  assert.equal(emails.length, 3, 'A paused recipient must not receive a message');
  assert.match(emails.find((message) => message.to[0] === 'legacy@example.test').subject, /1 new proposal, 1 proposal update/);
  assert.match(emails.find((message) => message.to[0] === 'progress@example.test').subject, /0 new proposals, 1 proposal update/);
  assert.match(emails.find((message) => message.to[0] === 'new@example.test').subject, /1 new proposal, 0 proposal updates/);
  assert.equal(channels.length, 2);
  assert.ok(channels.every((message) => message.text.includes('/project?id=10015') && message.text.includes('/project?id=10583')), 'Both public channels retain all global cards, not the last subscriber’s choices');
} finally { globalThis.fetch = originalFetch; }
console.log('Validated private subscription preferences, backward-compatible filtering, card counts, suppression protection, cooldowns and receipt isolation (offline; no messages sent).');
