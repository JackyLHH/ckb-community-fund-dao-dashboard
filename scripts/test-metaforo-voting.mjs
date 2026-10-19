import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeVoteSnapshots, parseMetaforoVoteCard, resolveVoteLifecycle, sourceProposalId } from '../lib/metaforo-voting.ts';
import { voteEvidenceByProposalId } from '../lib/status-evidence.ts';
import { executionStatusTags } from '../lib/proposal-lifecycle.ts';

const text = '[VOT] RIVET Total Votes: 244,888,704 · Voting Closed Yes 52.82% (129,338,247) No 47.18% (115,550,457) quorum 244,888,704/ 11,718,750 Minimum number of votes 52.82%/ 51% Votes required to pass approved!';
const url = voteEvidenceByProposalId['10739'].url;
const now = new Date('2026-10-19T00:00:00Z');
const closed = parseMetaforoVoteCard(text, url, now);
assert.equal(closed.status, 'approved');
assert.equal(closed.totalVotes, 244888704);
assert.equal(closed.yesPercent, 52.82);
assert.equal(closed.minimumVotes, 11718750);
assert.deepEqual(closed, voteEvidenceByProposalId['10739']);
assert.deepEqual(executionStatusTags(['vote-passed'], closed.status === 'approved'), ['vote-passed', 'executing'], 'Rivet must enter execution immediately after approval without waiting for the funded list');
assert.deepEqual(executionStatusTags(['discussion'], true), ['vote-passed', 'executing'], 'Future newly approved proposals enter execution automatically');
assert.deepEqual(executionStatusTags(['vote-passed', 'completed'], true), ['vote-passed', 'completed']);
assert.deepEqual(executionStatusTags(['vote-passed', 'ended'], true), ['vote-passed', 'ended']);
assert.deepEqual(executionStatusTags(['vote-passed', 'executing', 'completed'], true), ['vote-passed', 'completed'], 'Completion replaces execution');
assert.deepEqual(executionStatusTags(['vote-passed', 'executing', 'ended'], true), ['vote-passed', 'ended'], 'Termination replaces execution');
assert.deepEqual(executionStatusTags(['ended'], true), ['ended'], 'Reviewed historical closures must not be reopened');
assert.deepEqual(executionStatusTags(['voting']), ['voting'], 'Open votes do not enter execution');
assert.deepEqual(executionStatusTags(['vote-failed', 'ended']), ['vote-failed', 'ended']);
assert.equal(parseMetaforoVoteCard(text.replace(' · Voting Closed', ''), url, now).status, 'active', 'Passing provisional votes must remain active');
assert.equal(parseMetaforoVoteCard(text.replaceAll('52.82%', '50.00%'), url, now).status, 'rejected');
assert.equal(parseMetaforoVoteCard(text.replace('11,718,750', '300,000,000'), url, now).status, 'rejected');
assert.throws(() => parseMetaforoVoteCard('Total Votes: 244,888,704', url), /incomplete/);
assert.throws(() => parseMetaforoVoteCard(text.replace('quorum 244,888,704', 'quorum 1'), url), /inconsistent/);
const active = { ...closed, status: 'active', closed: false, closesAt: '2026-10-20T00:00:00Z' };
assert.equal(resolveVoteLifecycle(active, now.getTime()).status, 'active');
assert.equal(resolveVoteLifecycle(active, Date.parse('2026-10-20T00:00:01Z')).status, 'unknown', 'An expired provisional tally is not a verified final result');
assert.equal(resolveVoteLifecycle({ ...active, closesAt: undefined }, now.getTime() + 3 * 3600000).status, 'unknown', 'Stale active votes must not remain active indefinitely');

// The rendered countdown is source-backed lifecycle evidence, unlike a
// provisional "approved!" badge or the age of the most recent observation.
const openText = text.replace(' · Voting Closed', '');
for (const [countdown, duration, precision] of [
  ['3 days', 3 * 86400000, 86400000],
  ['13 hours', 13 * 3600000, 3600000],
  ['24 minutes', 24 * 60000, 60000],
  ['7 seconds', 7000, 1000],
  ['1 day, 2 hours, 3 minutes, 4 seconds', 86400000 + 2 * 3600000 + 3 * 60000 + 4000, 1000],
  ['3 DAYS 12 HOURS 39 MINUTES', 3 * 86400000 + 12 * 3600000 + 39 * 60000, 60000],
  ['0 days 0 hours 5 minutes', 5 * 60000, 60000],
  ['0 days 0 hours 0 minutes 0 seconds', 0, 1000],
  ['0 minutes', 0, 60000],
]) {
  const vote = parseMetaforoVoteCard(`${openText} Voting ends in ${countdown}`, url, now);
  assert.equal(vote.status, 'active', `The passing tally remains provisional with countdown ${countdown}`);
  assert.equal(vote.closed, false);
  assert.equal(vote.closesAt, new Date(now.getTime() + duration + precision).toISOString(), 'Retain one unit of countdown precision so rounded UI text cannot close a poll early');
}
for (const suffix of [
  '', 'Voting ends in', 'Voting ends in soon', 'Voting ends in -2 days',
  'Voting ends in 1.5 days', 'Voting ends in 3 months',
  `Voting ends in ${'9'.repeat(400)} days`,
  'Voting ends in 9999999999999999 days',
]) {
  const vote = parseMetaforoVoteCard(`${openText} ${suffix}`, url, now);
  assert.equal(vote.status, 'active', 'A missing or unusable deadline cannot turn a provisional tally into a final approval');
  assert.equal(vote.closesAt, undefined, `Unsafe or malformed countdown is ignored: ${suffix.slice(0, 80)}`);
  assert.equal(resolveVoteLifecycle(vote, now.getTime() + 3 * 3600000).status, 'unknown', 'Without a safe deadline, the conservative legacy freshness rule still applies');
}
const knownDeadline = { ...active, closesAt: '2026-10-24T00:00:00Z' };
for (const ageHours of [3, 49, 96]) {
  const resolved = resolveVoteLifecycle(knownDeadline, now.getTime() + ageHours * 3600000);
  assert.equal(resolved.status, 'active', `A known future deadline outlives a ${ageHours}-hour observation age`);
  assert.equal(resolved.closed, false);
  assert.equal(resolved.closesAt, knownDeadline.closesAt);
}
assert.deepEqual(resolveVoteLifecycle(knownDeadline, Date.parse(knownDeadline.closesAt)), { ...knownDeadline, status: 'unknown', closed: true }, 'Deadline expiry means closure, not a verified passing final tally');
for (const closesAt of [undefined, '', 'not-a-date']) {
  const legacy = { ...active, closesAt };
  assert.equal(resolveVoteLifecycle(legacy, now.getTime() + 2 * 3600000).status, 'active', 'Legacy observations remain valid through the two-hour freshness window');
  const stale = resolveVoteLifecycle(legacy, now.getTime() + 2 * 3600000 + 1);
  assert.equal(stale.status, 'unknown');
  assert.equal(stale.closed, false, 'Age alone does not establish voting closure');
  for (const verifiedAt of [undefined, '', 'invalid']) {
    const unbounded = resolveVoteLifecycle({ ...legacy, verifiedAt }, now.getTime());
    assert.equal(unbounded.status, 'unknown', 'Without a valid deadline or observation time, an active legacy snapshot is not reliable');
    assert.equal(unbounded.closed, false, 'Unverified legacy evidence cannot establish closure either');
  }
}
for (const verifiedAt of [undefined, '', 'invalid']) {
  assert.equal(resolveVoteLifecycle({ ...knownDeadline, verifiedAt }, now.getTime() + 49 * 3600000).status, 'active', 'A valid source-backed future deadline remains bounded even without a usable observation timestamp');
}
for (const status of ['approved', 'rejected']) {
  const final = { ...closed, status, closesAt: '2026-10-18T00:00:00Z' };
  assert.equal(resolveVoteLifecycle(final, now.getTime() + 49 * 3600000), final, 'Verified final results are not downgraded by either age or deadline');
}
assert.equal(resolveVoteLifecycle(null, now.getTime()), null);
const finalizedWithCountdown = parseMetaforoVoteCard(`${text} Voting ends in 3 days`, url, now);
assert.equal(finalizedWithCountdown.status, 'approved');
assert.equal(finalizedWithCountdown.closesAt, undefined, 'Explicit Voting Closed takes priority over any stale countdown text');

// Preserve the failing production observation as a fixture, not assertions on
// the mutable generated file that legitimately changes on the next vote sync.
const kaze = {
  url: 'https://dao.ckb.community/thread/vot-kaze-x-ckb-unitour-continuation-proposal-80384',
  totalVotes: 94483205, minimumVotes: 5721552, yesPercent: 100, passPercent: 51,
  closed: false, status: 'active', verifiedAt: '2026-10-19T11:21:13.809Z',
  closesAt: '2026-10-23T00:00:13.809Z', openedAt: '2026-10-15T17:19:39.000Z',
};
assert.equal(resolveVoteLifecycle(kaze, Date.parse('2026-10-19T20:00:00Z')).status, 'active', 'The Kaze vote stays visibly open after the old two-hour expiry');
assert.equal(resolveVoteLifecycle(kaze, Date.parse('2026-10-21T20:00:00Z')).status, 'active', 'The Kaze deadline also survives observations older than 48 hours');
assert.deepEqual(resolveVoteLifecycle(kaze, Date.parse('2026-10-23T00:00:14Z')), { ...kaze, status: 'unknown', closed: true }, 'A final result must be re-observed after the Kaze countdown expires');

const freshOpen = { ...knownDeadline, verifiedAt: '2026-10-19T11:00:00Z' };
const olderOpen = { ...freshOpen, totalVotes: 1, verifiedAt: '2026-10-19T09:00:00Z', closesAt: '2026-10-23T00:00:00Z' };
const freshClosed = { ...closed, verifiedAt: '2026-10-19T12:00:00Z' };
const oldSnapshot = structuredClone({ '10739': olderOpen });
for (const current of [freshOpen, freshClosed]) {
  const prior = { '10739': current };
  for (const incoming of [oldSnapshot, { '10739': { ...closed, verifiedAt: olderOpen.verifiedAt } }]) {
    const merged = mergeVoteSnapshots(prior, incoming);
    assert.equal(merged['10739'], current, 'Older active or closed raw CDN observations cannot replace newer evidence, including its deadline');
  }
  assert.equal(prior['10739'], current, 'Merging never mutates the current snapshot');
}
assert.deepEqual(oldSnapshot, { '10739': olderOpen }, 'Merging never changes incoming raw snapshots');
assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': freshClosed })['10739'], freshClosed, 'A newer verified closure replaces a provisional active card');
const sameTimeOpen = { ...freshOpen, verifiedAt: freshClosed.verifiedAt };
assert.equal(mergeVoteSnapshots({ '10739': freshClosed }, { '10739': sameTimeOpen })['10739'], freshClosed, 'A same-timestamp active observation cannot undo verified closure');
assert.equal(mergeVoteSnapshots({ '10739': sameTimeOpen }, { '10739': freshClosed })['10739'], freshClosed, 'At equal observation times a closed card can replace an active one');
const freshNoDeadline = { ...freshOpen, verifiedAt: '2026-10-19T13:00:00Z', closesAt: undefined, totalVotes: 250000000 };
assert.deepEqual(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': freshNoDeadline })['10739'], { ...freshNoDeadline, closesAt: freshOpen.closesAt }, 'A newer partial observation of the same poll preserves its known closing deadline');
const invalidDeadline = { ...freshNoDeadline, closesAt: 'invalid' };
assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': invalidDeadline })['10739'].closesAt, freshOpen.closesAt, 'Invalid incoming deadlines cannot erase valid same-poll evidence');
const differentPoll = { ...freshNoDeadline, url: `${url}-different-poll` };
assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': differentPoll })['10739'], differentPoll, 'A different voting URL must not inherit another poll deadline');
assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': differentPoll })['10739'].closesAt, undefined);
for (const verifiedAt of [undefined, '', 'invalid']) {
  const undated = { ...freshClosed, verifiedAt };
  assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10739': undated })['10739'], freshOpen, 'An unverified or malformed timestamp cannot replace a known verified observation');
}
const newVote = { ...freshOpen, url: `${url}-new` };
assert.equal(mergeVoteSnapshots({ '10739': freshOpen }, { '10736': newVote })['10736'], newVote, 'Previously unseen proposals are still incorporated');

const syncSource = await readFile(new URL('../scripts/sync-votes.mjs', import.meta.url), 'utf8');
assert.match(syncSource, /if \(thread\.poll_status === 'on'\)\s*\{[\s\S]*?Voting ends in[\s\S]*?waitFor/, 'The synchronizer waits for the hydrated countdown before reading an open vote');
assert.match(syncSource, /if \(!vote\.closed && !vote\.closesAt\) throw new Error/, 'A missing active countdown retains the previous snapshot instead of publishing a deadline-less vote');
const liveSource = await readFile(new URL('../lib/live-data.ts', import.meta.url), 'utf8');
assert.match(liveSource, /liveVotes\s*=\s*mergeVoteSnapshots\(liveVotes,\s*latest\.votes\)/, 'Live data reconciles raw CDN observations by verification time, not object spread or arrival order');
assert.equal(sourceProposalId('https://talk.nervos.org/t/example/10687 https://talk.nervos.org/t/dis-kaze-proposal/10736'), '10736');
assert.equal(sourceProposalId('https://talk.nervos.org/t/dis-a/1 https://talk.nervos.org/t/dis-b/2'), null);
console.log('Validated Metaforo quorum parsing, safe countdowns, source-backed deadlines, stale CDN merges, final-result lifecycle, and proposal matching.');
