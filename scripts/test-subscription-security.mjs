import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: [new URL('../api/subscription.ts', import.meta.url).pathname], bundle: true,
  platform: 'node', format: 'esm', write: false });
const { GET, POST } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
process.env.SUPABASE_URL = 'https://security-db.example';
process.env.SUPABASE_SECRET_KEY = 'offline-only';
process.env.RESEND_API_KEY = 'offline-only';
const webhookBytes = new Uint8Array(32).fill(42);
process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from(webhookBytes).toString('base64')}`;
const records = [
  { id: 'active', email: 'active@example.test', status: 'confirmed', locale: 'en', confirmation_token: 'a'.repeat(64), unsubscribe_token: '1'.repeat(64), confirmed_at: '2026-01-01T00:00:00Z' },
  { id: 'suppressed', email: 'blocked@example.test', status: 'complained', locale: 'zh', confirmation_token: 'b'.repeat(64), unsubscribe_token: '2'.repeat(64) },
  { id: 'pending', email: 'pending@example.test', status: 'pending', locale: 'en', confirmation_token: 'c'.repeat(64), unsubscribe_token: '3'.repeat(64) },
];
const leases = new Set(), emails = [], patches = [];
let suppressBeforePatch = '';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  if (url.host === 'security-db.example') {
    if (url.pathname.endsWith('/claim_digest_delivery')) {
      if (leases.has(body.p_key)) return Response.json(false);
      leases.add(body.p_key); return Response.json(true);
    }
    assert.equal(url.pathname, '/rest/v1/email_subscribers');
    const matched = records.filter((record) => [...url.searchParams].every(([key, value]) => {
      if (['select', 'limit'].includes(key)) return true;
      if (value.startsWith('eq.')) return String(record[key]) === value.slice(3);
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(record[key]);
      throw new Error(`Unhandled offline database predicate: ${key}`);
    }));
    if (init.method === 'POST') {
      const inserted = { ...body, id: `new-${records.length}` }; records.push(inserted); return Response.json([inserted]);
    }
    if (init.method === 'PATCH') {
      if (suppressBeforePatch) {
        const record = records.find((item) => item.id === suppressBeforePatch);
        record.status = 'complained'; suppressBeforePatch = '';
      }
      const guarded = matched.filter((record) => {
        const condition = url.searchParams.get('status');
        return !condition || condition === `eq.${record.status}` || condition.startsWith('in.') && condition.slice(4, -1).split(',').includes(record.status);
      });
      guarded.forEach((record) => { patches.push({ id: record.id, ...body }); Object.assign(record, body); });
      return init.headers.Prefer?.includes('return=representation') ? Response.json(guarded) : new Response(null, { status: 204 });
    }
    return Response.json(matched);
  }
  if (url.host === 'api.resend.com') { emails.push(body); return Response.json({ id: 'offline-message' }); }
  throw new Error(`Unexpected real-service request in offline security test: ${url.host}${url.pathname}`);
};
const post = (action, body, query = '') => POST(new Request(`https://ckbcommunityfunddao.xyz/api/subscription?action=${action}${query}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));
const confirm = (value) => GET(new Request(`https://ckbcommunityfunddao.xyz/api/subscription?action=confirm&token=${value}`));
try {
  const receipts = [];
  for (const email of ['new@example.test', 'active@example.test', 'blocked@example.test']) {
    const result = await post('subscribe', { email, locale: 'en' });
    assert.equal(result.status, 200);
    const payload = await result.json(); receipts.push({ ...payload, destination: 'masked' });
  }
  assert.deepEqual(receipts[0], receipts[1]); assert.deepEqual(receipts[1], receipts[2], 'Signup must not reveal confirmed or suppressed addresses');
  assert.equal(emails.length, 2, 'Only new confirmations and active management links are sent');
  assert.ok(!emails.some((message) => message.to.includes('blocked@example.test')));
  assert.equal(records.find((record) => record.id === 'suppressed').status, 'complained');

  leases.clear(); records.find((record) => record.id === 'active').management_sent_at = null;
  const beforeParallel = emails.length;
  const parallel = await Promise.all(Array.from({ length: 5 }, () => post('manage-link', { email: 'active@example.test' })));
  assert.ok(parallel.every((response) => response.status === 200));
  assert.equal(emails.length - beforeParallel, 1, 'Atomic shared mail lease prevents parallel management replays');
  await post('subscribe', { email: 'active@example.test' });
  assert.equal(emails.length - beforeParallel, 1, 'The subscribe path cannot bypass the management cooldown');
  leases.clear();
  const unknown = await (await post('manage-link', { email: 'unknown@example.test' })).json();
  const blocked = await (await post('manage-link', { email: 'blocked@example.test' })).json();
  assert.deepEqual(unknown, blocked, 'Management responses do not enumerate addresses');

  const pending = records.find((record) => record.id === 'pending');
  const confirmation = await confirm(pending.confirmation_token);
  assert.equal(confirmation.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(confirmation.headers.get('cache-control'), 'no-store');
  assert.ok(confirmation.headers.get('location').endsWith('subscription=confirmed'));
  const confirmedAt = pending.confirmed_at;
  const writes = patches.length;
  await confirm(pending.confirmation_token);
  assert.equal(patches.length, writes); assert.equal(pending.confirmed_at, confirmedAt, 'Repeated confirmation preserves the first confirmation date');
  pending.status = 'pending'; suppressBeforePatch = pending.id;
  assert.ok((await confirm(pending.confirmation_token)).headers.get('location').endsWith('subscription=invalid'));
  assert.equal(pending.status, 'complained', 'A webhook winning the confirmation race must remain authoritative');

  const originalBlocked = records.find((record) => record.id === 'suppressed');
  const beforeUnsubscribe = patches.length;
  await post('unsubscribe', {}, `&token=${originalBlocked.unsubscribe_token}`);
  assert.equal(originalBlocked.status, 'complained'); assert.equal(patches.length, beforeUnsubscribe, 'Unsubscribe cannot erase a suppression');
  assert.ok((await confirm(originalBlocked.confirmation_token)).headers.get('location').endsWith('subscription=invalid'));
  assert.equal((await post('preferences', { token: originalBlocked.unsubscribe_token, locale: 'en', preferences: {} })).status, 401);

  const active = records.find((record) => record.id === 'active');
  const chosen = { categories: ['progress'], scope: 'selected', proposalIds: ['10015'] };
  assert.equal((await post('preferences', { token: active.unsubscribe_token, locale: 'en', preferences: chosen })).status, 200);
  const boundary = active.preferences_updated_at;
  assert.ok(Number.isFinite(Date.parse(boundary)));
  assert.equal((await post('preferences', { token: active.unsubscribe_token, locale: 'zh', preferences: chosen })).status, 200);
  assert.ok(!Object.hasOwn(patches.at(-1), 'preferences_updated_at'), 'A language-only save must not reset the no-backfill boundary and discard queued events');
  assert.equal(active.preferences_updated_at, boundary);

  const body = JSON.stringify({ type: 'email.complained', data: { to: ['active@example.test'] } });
  const id = 'offline-webhook'; const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', webhookBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))).toString('base64');
  const webhook = (sig) => POST(new Request('https://ckbcommunityfunddao.xyz/api/subscription?action=resend-webhook', { method: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${sig}` }, body }));
  assert.equal((await webhook('invalid')).status, 401);
  assert.equal(active.status, 'confirmed');
  assert.equal((await webhook(signature)).status, 200);
  assert.equal(active.status, 'complained');
  await webhook(signature);
  assert.equal(active.status, 'complained', 'Verified webhook replay is a harmless, idempotent suppression');
} finally { globalThis.fetch = originalFetch; }

const migration = await readFile(new URL('../supabase/migrations/20261019_subscription_preferences.sql', import.meta.url), 'utf8');
assert.match(migration, /enable row level security/); assert.match(migration, /revoke all .* from anon, authenticated/);
const page = await readFile(new URL('../app/subscription/page.tsx', import.meta.url), 'utf8');
assert.match(page, /referrer: 'no-referrer'/); assert.match(page, /index: false/);
const analytics = await readFile(new URL('../components/privacy-analytics.tsx', import.meta.url), 'utf8');
assert.match(analytics, /startsWith\('\/subscription'\)/); assert.match(analytics, /url\.hash = ''/);
console.log('Validated generic responses, atomic mail cooldown, token/suppression guards, confirmation replay, webhook authentication, private metadata and RLS (offline; no messages sent).');
