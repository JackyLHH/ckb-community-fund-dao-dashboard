import { collectionHealthState, emptyCollectionHealth, observedCollectionHealth, type CollectionHealth, type WorkflowRun, type WorkflowJob } from '../lib/collection-health.js';

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
async function readHealth(): Promise<CollectionHealth> {
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
  return report;
}
function response(report: CollectionHealth) {
  const freshness = collectionHealthState(report);
  return Response.json({ ...report, state: freshness.state, sourceStates: freshness.sources, scheduleState: freshness.schedule }, { headers: { 'Cache-Control': report.available ? 'public, max-age=30, s-maxage=300' : 'no-store' } });
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
