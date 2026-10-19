import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PublicSourceError, resolveDetailSource } from '../lib/live-project-result.ts';

const cached = { id: '10015', title: 'Reviewed title', overview: 'Reviewed objective' };
const fresh = { ...cached, fresh: true };
let reads = 0;
const success = await resolveDetailSource(cached, async () => { reads += 1; return fresh; });
assert.deepEqual(success, { proposal: fresh, state: 'live', error: null });
assert.equal(reads, 1, 'Successful reads need no duplicate source probe');
const fallback = await resolveDetailSource(cached, async () => { throw new PublicSourceError(503, 'Unavailable'); });
assert.equal(fallback.proposal, cached, 'A per-topic failure must preserve the reviewed cached record');
assert.equal(fallback.state, 'fallback');
assert.equal(fallback.error, 'unavailable');
assert.deepEqual(await resolveDetailSource(null, async () => { throw new PublicSourceError(404); }), { proposal: null, state: 'fallback', error: 'not-found' });
for (const code of [401, 403, 429, 500, 503]) {
  assert.equal((await resolveDetailSource(null, async () => { throw new PublicSourceError(code); })).error, 'unavailable', `${code} is not a missing proposal`);
}
assert.equal((await resolveDetailSource(null, async () => { throw new TypeError('offline'); })).error, 'unavailable');
assert.equal((await resolveDetailSource(cached, async () => { throw new Error('offline'); }, async () => { throw new Error('translation unavailable'); })).proposal, cached, 'Translation failure cannot hide the available record');
const loader = await readFile(new URL('../lib/live-data.ts', import.meta.url), 'utf8');
assert.match(loader, /if \(options\.forceRefresh\)\s*\{[\s\S]*?datasetPromise = null;[\s\S]*?datasetExpiresAt = 0;/, 'Retry bypasses the five-minute failed dataset cache');
assert.match(loader, /export async function loadLiveProject\(id: string\): Promise<Proposal \| null>/, 'Existing loader consumers retain their return shape');
console.log('Validated detail source diagnostics, cache fallback, missing/offline distinctions, and retry compatibility.');
