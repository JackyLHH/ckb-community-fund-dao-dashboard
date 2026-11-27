export const COLLECTION_MAX_AGE_MS = 90 * 60 * 1000;
export const COLLECTION_WORKFLOW_URL = 'https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/actions/workflows/sync-votes.yml';
export const collectionSteps = {
  votes: 'Read public vote cards',
  governance: 'Observe discussion and voting events',
  treasury: 'Verify all historical treasury balances and expenditures',
} as const;
export const STRICT_COLLECTION_OUTCOME_STEP = 'Collection outcome semantics v2';
const legacyFinalCheck = 'Report incomplete observations';
export type CollectionSource = keyof typeof collectionSteps;
export type CollectionObservation = { lastSuccessAt: string | null; runUrl: string | null; evidence?: 'strict-v2' | 'legacy-aggregate' };
// Older monitoring caches could contain soft failures labelled success.
export function collectionObservationTime(observation: CollectionObservation) {
  return observation.evidence === 'strict-v2' || observation.evidence === 'legacy-aggregate' ? observation.lastSuccessAt : null;
}
export type CollectionBackup = { provider: 'cloudflare-watchdog'; enabled: boolean; lastCheckAt: string | null; statusUrl: string; error: string | null };
export type CollectionHealth = {
  backup?: CollectionBackup;
  version: 1;
  checkedAt: string;
  available: boolean;
  sources: Record<CollectionSource, CollectionObservation>;
  schedule: { lastRunAt: string | null; runUrl: string | null };
  latestRun: { url: string; event: string; status: string; conclusion: string | null } | null;
  error?: 'unavailable';
};
export type WorkflowRun = {
  id: number; run_attempt?: number; head_branch?: string; event: string;
  status: string; conclusion: string | null; created_at: string; html_url: string;
};
export type WorkflowJob = { conclusion?: string | null; steps?: Array<{ name: string; conclusion: string | null; completed_at?: string | null }> };
export function emptyCollectionHealth(now = Date.now()): CollectionHealth {
  return { version: 1, checkedAt: new Date(now).toISOString(), available: false,
    sources: { votes: { lastSuccessAt: null, runUrl: null }, governance: { lastSuccessAt: null, runUrl: null }, treasury: { lastSuccessAt: null, runUrl: null } },
    schedule: { lastRunAt: null, runUrl: null }, latestRun: null };
}
function validTime(value: string | null | undefined, now: number) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) && time <= now ? time : null;
}
export function collectionHealthState(health: CollectionHealth, now = Date.now()) {
  const age = (value: string | null) => {
    const time = validTime(value, now);
    return time === null ? 'unknown' : now - time > COLLECTION_MAX_AGE_MS ? 'stale' : 'fresh';
  };
  const sources = Object.fromEntries(Object.entries(health.sources).map(([key, source]) => [key, age(collectionObservationTime(source))])) as Record<CollectionSource, 'fresh' | 'stale' | 'unknown'>;
  const schedule = age(health.schedule.lastRunAt);
  const backupCheck = validTime(health.backup?.lastCheckAt, now);
  const backupFresh = health.backup?.enabled === true && !health.backup.error && backupCheck !== null && now - backupCheck <= 30 * 60 * 1000;
  const effectiveSchedule = backupFresh ? 'cloudflare-watchdog' : 'github-native';
  const states = [...Object.values(sources), ...(backupFresh ? [] : [schedule])];
  return { state: states.includes('stale') ? 'stale' : !health.available || (health.latestRun?.status === 'completed' && health.latestRun.conclusion !== 'success') || states.includes('unknown') ? 'unknown' : 'fresh', sources, schedule, effectiveSchedule } as const;
}
export function observedCollectionHealth(runs: WorkflowRun[], jobs: Array<{ run: WorkflowRun; jobs: WorkflowJob[] }>, now = Date.now(), previous?: CollectionHealth): CollectionHealth {
  const report = emptyCollectionHealth(now);
  report.available = true;
  // Retain only genuine successful observations, never substitute request time.
  if (previous) {
    for (const source of Object.keys(collectionSteps) as CollectionSource[]) {
      if (collectionObservationTime(previous.sources[source])) report.sources[source] = { ...previous.sources[source] };
    }
    report.schedule = { ...previous.schedule };
  }
  const main = runs.filter(run => run.head_branch === 'main');
  const latest = main[0];
  if (latest) report.latestRun = { url: latest.html_url, event: latest.event, status: latest.status, conclusion: latest.conclusion };
  const scheduled = main.find(run => run.event === 'schedule' && validTime(run.created_at, now) !== null);
  if (scheduled) report.schedule = { lastRunAt: scheduled.created_at, runUrl: scheduled.html_url };
  for (const { run, jobs: observations } of jobs) {
    if (run.head_branch !== 'main') continue;
    for (const [source, name] of Object.entries(collectionSteps) as Array<[CollectionSource, string]>) {
      for (const job of observations) {
        const strict = job.steps?.some(step => step.name === STRICT_COLLECTION_OUTCOME_STEP && step.conclusion === 'success');
        // Legacy continue-on-error runs only prove all outcomes succeeded when
        // the entire job/run succeeded and its outcome-based failure guard skipped.
        // A failed legacy run cannot identify the real per-source outcome via
        // Jobs API, even if a step conclusion says success.
        const legacy = run.status === 'completed' && run.conclusion === 'success'
          && job.conclusion === 'success'
          && job.steps?.some(step => step.name === legacyFinalCheck && step.conclusion === 'skipped');
        if (!strict && !legacy) continue;
        const step = job.steps?.find(value => value.name === name && value.conclusion === 'success');
        const time = validTime(step?.completed_at, now);
        const existing = validTime(report.sources[source].lastSuccessAt, now);
        if (time !== null && (existing === null || time > existing)) report.sources[source] = { lastSuccessAt: step!.completed_at!, runUrl: run.html_url, evidence: strict ? 'strict-v2' : 'legacy-aggregate' };
      }
    }
  }
  return report;
}
