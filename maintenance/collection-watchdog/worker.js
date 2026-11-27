import { observedCollectionHealth, emptyCollectionHealth, collectionObservationTime } from '../../lib/collection-health.ts';

export const REPOSITORY = 'https://api.github.com/repos/JackyLHH/ckb-community-fund-dao-dashboard';
export const WORKFLOW = '/actions/workflows/sync-votes.yml';
export const MINUTE = 60_000;
const SOURCES = ['votes', 'governance', 'treasury'];
const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const safeTime = (value, now) => Number.isFinite(Date.parse(value || '')) && Date.parse(value) <= now ? Date.parse(value) : null;
const json = value => Response.json(value, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export function staleSources(health, minutes, now, startedAt) {
  return SOURCES.filter(source => {
    const stamp = safeTime(collectionObservationTime(health.sources[source]), now);
    return stamp === null ? now - startedAt >= minutes * MINUTE : now - stamp >= minutes * MINUTE;
  });
}
export function dispatchDecision(health, busy, state, now) {
  if (!health.available) return 'metadata-unavailable';
  if (busy) return 'workflow-busy';
  const unknown = SOURCES.some(source => !collectionObservationTime(health.sources[source]));
  if (!unknown && !staleSources(health, 45, now, state.startedAt).length) return 'fresh';
  // Persist before sending. A lost HTTP response must not cause immediate
  // retries or falsely advance any source's last-success timestamp.
  if (state.lastAttemptAt && now - state.lastAttemptAt < 30 * MINUTE) return 'cooldown';
  return 'dispatch';
}
function configured(env) {
  return /^github_pat_[A-Za-z0-9_]+$/.test(env.GITHUB_TOKEN || '')
    && /^[0-9]+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN || '')
    && /^[1-9][0-9]{4,}$/.test(env.TELEGRAM_CHAT_ID || '');
}
async function github(path, env, request, method = 'GET', body) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CKB-DAO-Collection-Watchdog/1.0' };
  // Never copy a classic/broad CLI token into this service.
  if (env.GITHUB_TOKEN) {
    if (!/^github_pat_[A-Za-z0-9_]+$/.test(env.GITHUB_TOKEN)) throw new Error('credential-format');
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  const result = await request(REPOSITORY + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(8_000) });
  if (!result.ok) throw new Error(`github-${result.status}`);
  return method === 'GET' ? result.json() : result;
}
export async function observe(env, previous, now, request = fetch) {
  const result = await github(WORKFLOW + '/runs?per_page=100', env, request);
  if (!Array.isArray(result.workflow_runs) || !result.workflow_runs.length) throw new Error('incomplete-runs');
  const runs = result.workflow_runs;
  const completed = runs.filter(run => run.head_branch === 'main' && run.status === 'completed').slice(0, 6);
  const observations = await Promise.allSettled(completed.map(async run => {
    const data = await github(`/actions/runs/${run.id}/attempts/${run.run_attempt ?? 1}/jobs?per_page=100`, env, request);
    if (!Array.isArray(data.jobs) || data.total_count > data.jobs.length) throw new Error('incomplete-jobs');
    return { run, jobs: data.jobs };
  }));
  const health = observedCollectionHealth(runs, observations.flatMap(result => result.status === 'fulfilled' ? [result.value] : []), now, previous);
  if (observations.some(result => result.status === 'rejected') || !completed.length) health.available = false;
  return { health, busy: runs.some(run => ACTIVE_STATUSES.has(run.status)) };
}
function alertText(health, sources, kind) {
  const names = { votes: '投票', governance: '治理', treasury: '国库' };
  const heading = kind === 'recovery' ? '✅ DAO 采集已恢复' : '⚠️ DAO 采集超过 90 分钟未确认成功';
  return [heading, ...(kind === 'recovery' ? SOURCES : sources).map(source => `${names[source]}：${collectionObservationTime(health.sources[source]) || '尚无可靠成功记录'}`),
    '以上为实际采集步骤成功时间（UTC），不是触发或检查时间。',
    'https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/actions/workflows/sync-votes.yml'].join('\n');
}
async function sendAlert(env, health, sources, kind, request) {
  if (!configured(env)) return false;
  const result = await request(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: alertText(health, sources, kind), disable_web_page_preview: true }),
  });
  if (!result.ok) return false;
  const body = await result.json();
  return body.ok === true;
}
// All side effects are injected for offline replay. Secrets are never stored
// in Durable Object state, returned by /status, or included in error logs.
export async function tick(env, storage, now = Date.now(), request = fetch) {
  const state = await storage.get('state') || { startedAt: now };
  if (state.leaseUntil > now) return state;
  state.leaseUntil = now + 3 * MINUTE;
  await storage.put('state', state);
  state.enabled = env.ACTIVE === 'true';
  try {
    const observed = await observe(env, state.health, now, request);
    state.health = observed.health;
    state.error = observed.health.available ? null : 'metadata-unavailable';
    state.decision = state.enabled ? dispatchDecision(state.health, observed.busy, state, now) : 'paused';
    if (state.enabled && !configured(env)) {
      state.decision = 'configuration-incomplete'; state.error = 'configuration-incomplete';
    }
    if (state.decision === 'dispatch') {
      // Recheck immediately before the side effect to reduce native/backup races.
      const current = await github(WORKFLOW + '/runs?per_page=100', env, request);
      if (!Array.isArray(current.workflow_runs)) throw new Error('incomplete-runs');
      if (current.workflow_runs.some(run => ACTIVE_STATUSES.has(run.status))) state.decision = 'workflow-busy';
      else {
        state.lastAttemptAt = now;
        state.requestId = `cf-${now}`;
        await storage.put('state', state);
        try {
          await github(WORKFLOW + '/dispatches', env, request, 'POST', { ref: 'main', inputs: { dispatch_source: 'cloudflare-watchdog', watchdog_request_id: state.requestId } });
          state.lastDispatchAt = now;
          state.decision = 'dispatch-accepted';
        } catch { state.error = 'dispatch-unconfirmed'; state.decision = 'dispatch-unconfirmed'; }
      }
    }
  } catch {
    state.health = { ...(state.health || emptyCollectionHealth(now)), available: false };
    state.error = 'metadata-unavailable'; state.decision = 'metadata-unavailable';
  }
  state.failureSince = state.health.available ? null : state.failureSince || now;
  const overdue = staleSources(state.health, 90, now, state.startedAt);
  const monitorOverdue = state.failureSince && now - state.failureSince >= 90 * MINUTE;
  if (state.enabled && (overdue.length || monitorOverdue)) {
    state.incidentSince ||= now;
    // One initial alert, then at most one reminder per six hours. Delivery
    // failures keep the incident open and are retried at the next check.
    if (!state.lastAlertAt || now - state.lastAlertAt >= 360 * MINUTE) {
      try {
        if (await sendAlert(env, state.health, overdue.length ? overdue : SOURCES, 'failure', request)) { state.lastAlertAt = now; state.alertError = null; }
        else state.alertError = 'delivery-unconfirmed';
      } catch { state.alertError = 'delivery-unconfirmed'; }
    }
  } else if (state.enabled && state.incidentSince && state.health.available) {
    if (state.lastAlertAt) {
      try {
        if (await sendAlert(env, state.health, SOURCES, 'recovery', request)) { state.incidentSince = null; state.lastAlertAt = null; state.alertError = null; }
        else state.alertError = 'delivery-unconfirmed';
      } catch { state.alertError = 'delivery-unconfirmed'; }
    } else state.incidentSince = null;
  }
  state.lastCheckAt = now;
  state.leaseUntil = 0;
  await storage.put('state', state);
  return state;
}
export function publicStatus(state) {
  return { version: 1, provider: 'cloudflare-watchdog', enabled: state?.enabled === true,
    lastCheckAt: state?.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
    lastDispatchAt: state?.lastDispatchAt ? new Date(state.lastDispatchAt).toISOString() : null,
    lastRequestId: state?.requestId || null,
    decision: state?.decision || 'not-started', error: state?.error || null,
    alertError: state?.alertError || null,
    lastAlertAt: state?.lastAlertAt ? new Date(state.lastAlertAt).toISOString() : null,
    sources: state?.health?.sources || emptyCollectionHealth().sources,
  };
}
export class CollectionWatchdog {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.pending = null; }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/status') return json(publicStatus(await this.ctx.storage.get('state')));
    if (request.method !== 'POST' || url.pathname !== '/tick') return new Response('Not found', { status: 404 });
    // Coalesce concurrent scheduled invocations inside the single named object.
    this.pending ||= tick(this.env, this.ctx.storage).finally(() => { this.pending = null; });
    return json(publicStatus(await this.pending));
  }
}
export default {
  async scheduled(_event, env, ctx) {
    const object = env.WATCHDOG.get(env.WATCHDOG.idFromName('ckb-dao-collection'));
    ctx.waitUntil(object.fetch('https://internal/tick', { method: 'POST' }).then(async response => {
      if (!response.ok) throw new Error('watchdog-tick-failed');
      console.log(JSON.stringify({ event: 'collection-watchdog', ...await response.json() }));
    }));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    // No publicly callable dispatch/alert endpoint or manual tick route.
    if (request.method !== 'GET' || url.pathname !== '/status') return new Response('Not found', { status: 404 });
    const object = env.WATCHDOG.get(env.WATCHDOG.idFromName('ckb-dao-collection'));
    return object.fetch('https://internal/status');
  },
};
