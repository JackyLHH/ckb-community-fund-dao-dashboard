import { collectionHealthState, emptyCollectionHealth, observedCollectionHealth, type CollectionHealth, type CollectionBackup, type WorkflowRun, type WorkflowJob } from '../lib/collection-health.js';

const repository = 'https://api.github.com/repos/JackyLHH/ckb-community-fund-dao-dashboard';
const ttl = 5 * 60 * 1000;
let cached: { at: number; report: CollectionHealth } | null = null;
let pending: Promise<CollectionHealth> | null = null;
async function publicJson(path: string) {
  const response = await fetch(repository + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CKB-Community-Fund-Dashboard/collection-health' },
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error('Public Actions metadata unavailable');
  return response.json();
}
async function backupStatus(): Promise<CollectionBackup | undefined> {
  const configured = process.env.COLLECTION_WATCHDOG_STATUS_URL;
  if (!configured) return undefined;
  const url = new URL(configured);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/status' || url.username || url.password || url.search || url.hash) throw new Error('Invalid watchdog status URL');
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3_000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Unavailable');
    const body = await response.json();
    if (body.version !== 1 || body.provider !== 'cloudflare-watchdog' || typeof body.enabled !== 'boolean') throw new Error('Invalid status');
    return { provider: 'cloudflare-watchdog', enabled: body.enabled, statusUrl: url.href, lastCheckAt: typeof body.lastCheckAt === 'string' ? body.lastCheckAt : null, error: body.error ? 'unavailable' : null };
  } catch {
    return { provider: 'cloudflare-watchdog', enabled: cached?.report.backup?.enabled ?? false, statusUrl: url.href, lastCheckAt: cached?.report.backup?.lastCheckAt ?? null, error: 'unavailable' };
  }
}
async function readHealth(): Promise<CollectionHealth> {
  const backup = backupStatus().catch(() => undefined);
  const result = await publicJson('/actions/workflows/sync-votes.yml/runs?branch=main&per_page=10');
  if (!Array.isArray(result.workflow_runs) || result.workflow_runs.length === 0) throw new Error('Incomplete run metadata');
  const runs = result.workflow_runs as WorkflowRun[];
  // At most four public requests per five minutes; no GitHub token or new
  // privileges. Per-step timestamps also expose partial collection failures.
  const completed = runs.filter(run => run.head_branch === 'main' && run.status === 'completed').slice(0, 3);
  const settled = await Promise.allSettled(completed.map(async run => {
    const result = await publicJson(`/actions/runs/${run.id}/attempts/${run.run_attempt ?? 1}/jobs?per_page=100`);
    if (!Array.isArray(result.jobs)) throw new Error('Incomplete job metadata');
    return { run, jobs: result.jobs as WorkflowJob[] };
  }));
  const report = observedCollectionHealth(runs, settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []), Date.now(), cached?.report);
  if (settled.some(result => result.status === 'rejected')) { report.available = false; report.error = 'unavailable'; }
  const observedBackup = await backup;
  if (observedBackup) report.backup = observedBackup;
  return report;
}
function response(report: CollectionHealth) {
  const freshness = collectionHealthState(report);
  return Response.json({ ...report, state: freshness.state, sourceStates: freshness.sources, scheduleState: freshness.schedule, effectiveSchedule: freshness.effectiveSchedule }, { headers: { 'Cache-Control': report.available ? 'public, max-age=30, s-maxage=300' : 'no-store' } });
}
export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.at >= ttl) {
    pending ??= readHealth().then(report => { cached = { at: Date.now(), report }; return report; })
      .catch(() => ({ ...(cached?.report ?? emptyCollectionHealth()), available: false, error: 'unavailable' as const }))
      .finally(() => { pending = null; });
    const report = await pending;
    return response(report);
  }
  return response(cached.report);
}
