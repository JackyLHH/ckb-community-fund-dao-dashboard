import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { extractProposalBudget, stripForumHtml } from '../lib/digest-activity.ts';
import { structuredMilestoneRow } from '../lib/proposal-milestone-table.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';
import { voteEvidenceByProposalId } from '../lib/status-evidence.ts';
const cooked = await readFile(new URL('./fixtures/keyme-milestones.html', import.meta.url), 'utf8');
assert.equal(extractProposalBudget(stripForumHtml(cooked)), '$9,500');
assert.equal(extractProposalBudget('Hardware: $562. Grant requested: $9,500, in five payments of $1,900.'), '$9,500');
assert.equal(proposalOverridesById['11258'].budgetLabel, '$9,500');
const rows = [...cooked.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => [...match[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(cell => stripForumHtml(cell[1])));
const stages = rows.slice(1).map(row => structuredMilestoneRow(rows[0], row));
assert.deepEqual(stages.map(row => row.key), ['kickoff', '1', '2', '3', '4']);
assert.deepEqual(stages.map(row => row.eta), ['Week 1', 'Week 3', 'Week 6', 'Week 10', 'Week 14']);
for (const row of stages) {
 assert.match(row.description, /Work: .+Acceptance: /);
 assert.ok(proposalOverridesById['11258'].milestoneDescriptionZhByTitle[row.title]);
 assert.equal(row.budget, undefined, 'A table without payment columns does not invent stage budgets');
}
assert.equal(structuredMilestoneRow(['#', 'Week', 'Work', 'Acceptance'], ['Stage 2 record', '6', 'Reference', 'Reference']), null);
assert.equal(structuredMilestoneRow(['Part', 'Qty', 'Cost'], ['M1', '4', '$562']), null);
assert.equal(structuredMilestoneRow(['#', 'Week', 'Work', 'Acceptance'], ['M1', '', 'Work', 'Acceptance']), null);
const compile = async (file, exports) => {
 const result = await build({ entryPoints: [new URL(file, import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false, footer: { js: `export { ${exports} };` } });
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const originalSnapshot = await readFile(new URL('../data/votes.generated.json', import.meta.url), 'utf8');
const live = await compile('../lib/live-data.ts', 'buildVoting');
const vote = live.buildVoting('11089', null);
assert.equal(vote.status, 'approved'); assert.equal(vote.closed, true);
assert.equal(vote.totalVotes, 113857181); assert.equal(vote.yesPercent, 100);
assert.equal(vote.minimumVotes, 59100000); assert.equal(vote.passPercent, 51);
assert.equal(vote.closedAt, '2026-11-16T23:59:59.000Z');
assert.equal(vote.url, 'https://talk.nervos.org/t/11089/19');
assert.match(vote.noteEn, /113,755,181/); assert.match(vote.noteZh, /102,000/);
assert.deepEqual(vote, voteEvidenceByProposalId['11089']);
assert.equal(await readFile(new URL('../data/votes.generated.json', import.meta.url), 'utf8'), originalSnapshot, 'Reviewing forum evidence must not mutate the Metaforo snapshot');
const api = await compile('../api/subscription.ts', 'buildDigestTopic, digestMessage, telegramDigestMessages');
const savedFetch = globalThis.fetch;
let sends = 0;
globalThis.fetch = async input => {
 const url = new URL(input instanceof Request ? input.url : String(input));
 if (url.host === 'talk.nervos.org' && url.pathname.includes('/11258.json')) return Response.json({ post_stream: { posts: [{ id: 27563, post_number: 1, username: 'WuodOdhis', cooked }], stream: [27563] } });
 if (url.pathname === '/api/translation') return Response.json({ ok: false });
 if (url.host === 'api.resend.com' || url.host === 'api.telegram.org') sends++;
 throw new Error('Unexpected offline request ' + url.host + url.pathname);
};
try {
 const item = await api.buildDigestTopic({ id: 11258, title: '[DIS] KeyMe', slug: 'keyme', created_at: '2026-11-19T00:00:00Z', posts_count: 1 });
 for (const locale of ['zh', 'en']) {
  const email = api.digestMessage(locale, [item], [], 'https://offline.example/unsubscribe');
  const tg = api.telegramDigestMessages(locale, [item], []).join('\n');
  for (const content of [email.html, email.text, tg]) assert.match(content, /9,500/);
 }
 assert.equal(sends, 0);
} finally { globalThis.fetch = savedFetch; }
console.log('Validated KeyMe grant/table/acceptance/week data, offline bilingual digest (zero sends), and source-backed Cellula result over the unchanged stale snapshot.');
