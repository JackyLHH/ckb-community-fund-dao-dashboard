import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: [new URL('../api/subscription.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false });
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
process.env.SUPABASE_URL = 'https://offline-db.example';
process.env.SUPABASE_SECRET_KEY = 'offline-only';
process.env.CRON_SECRET = 'offline-only';
process.env.TELEGRAM_BOT_TOKEN = 'offline-only';
process.env.RESEND_API_KEY = 'offline-only';
const originalFetch = globalThis.fetch;
const originalError = console.error;
const recent = new Date(Date.now() - 3_600_000).toISOString();
let migrationApplied = false, hasNewTopic = false, emails = 0, telegram = 0;
const patches = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const body = init.body ? JSON.parse(init.body) : null;
  if (url.host === 'offline-db.example') {
    const table = url.pathname.split('/').at(-1);
    if (table === 'claim_digest_delivery') return Response.json(body.p_key === 'daily-digest-lock');
    if (table === 'digest_runs') {
      if (init.method === 'POST') return Response.json([{ id: 'offline-run' }]);
      if (body.status === 'no_changes' && !migrationApplied) return Response.json({ code: '23514', message: 'digest_runs_status_check' }, { status: 400 });
      patches.push(body); return new Response(null, { status: 204 });
    }
    if (table === 'proposal_digest_state') return init.method === 'POST' ? new Response(null, { status: 204 }) : Response.json([{ topic_id: 10583, posts_count: 1, last_posted_at: recent }]);
    if (table === 'email_subscribers') return Response.json([]);
    if (table === 'digest_delivery_receipts') return init.method !== 'GET' ? new Response(null, { status: 204 }) : Response.json(['zh', 'en'].map(locale => ({ key: `lifecycle:telegram:${locale}:vote-ended:10583:offline` })));
  }
  if (url.host === 'talk.nervos.org' && url.pathname.endsWith('/latest.json')) return Response.json({ topic_list: { topics: [{ id: 10583, slug: 'offline-topic', title: '[DIS] Offline source proposal', posts_count: 1, created_at: recent, last_posted_at: recent }] } });
  if (url.host === 'talk.nervos.org' && url.pathname.startsWith('/t/')) return Response.json({ post_stream: { posts: [{ post_number: 1, username: 'builder', cooked: '<p>This proposal requests $5,000 for an open-source application.</p>' }] } });
  if (url.host === 'raw.githubusercontent.com') return Response.json({ version: 1, enabledAt: new Date(Date.now() - 86_400_000).toISOString(), events: hasNewTopic ? [{ id: 'vote-ended:10583:offline', topicId: 10583, kind: 'vote-ended', occurredAt: recent, sourceUrl: 'https://offline.example/vote', totalVotes: 1, yesPercent: 100, approved: true }] : [], discussions: {} });
  if (url.pathname === '/api/translation') return Response.json({ ok: false });
  if (url.host === 'api.resend.com') { emails++; throw new Error('Unexpected email send'); }
  if (url.host === 'api.telegram.org') { telegram++; throw new Error('Unexpected Telegram send'); }
  throw new Error(`Unexpected offline request: ${url.host}${url.pathname}`);
};
const run = () => GET(new Request('https://offline-app.example/api/subscription?action=digest', { headers: { authorization: 'Bearer offline-only' } }));
try {
  console.error = () => {};
  assert.equal((await run()).status, 500, 'Reproduce the legacy constraint failure; never mislabel it as sent');
  migrationApplied = true;
  patches.length = 0;
  const noChanges = await run();
  assert.equal(noChanges.status, 200);
  assert.equal((await noChanges.json()).sent, 0);
  assert.equal(patches.at(-1).status, 'no_changes');
  hasNewTopic = true;
  const duplicateOnly = await run();
  assert.equal(duplicateOnly.status, 200);
  assert.equal(patches.at(-1).status, 'no_changes', 'The final run-summary path also retains no_changes when receipts suppress all sends');
  assert.equal(emails, 0); assert.equal(telegram, 0);
  assert.ok(!patches.some((patch) => patch.status === 'completed'));
} finally { globalThis.fetch = originalFetch; console.error = originalError; }
console.log('Offline no_changes: 200, truthful run status, zero email and Telegram sends (both completion paths).');
