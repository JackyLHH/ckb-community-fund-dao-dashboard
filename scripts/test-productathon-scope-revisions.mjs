import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { extractProposalBudget, stripForumHtml, isProposalScopeRevision, isMeaningfulProgressUpdate, progressUpdatePosts } from '../lib/digest-activity.ts';
import { isProposalProgressUpdate } from '../lib/proposal-progress.ts';
import { selectForumProgressUpdates } from '../lib/proposal-update-title.ts';
import { applyProposalMilestoneCorrections, proposalOverridesById } from '../lib/proposal-overrides.ts';
const read = async name => JSON.parse(await readFile(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
const cooked = await readFile(new URL('./fixtures/productathon-plan.html', import.meta.url), 'utf8');
assert.equal(extractProposalBudget(stripForumHtml(cooked)), '$10,925');
assert.equal(extractProposalBudget('Prizes: $4,000. Ask: $10,925 for the full programme.'), '$10,925');
assert.equal(extractProposalBudget('Please ask: what about the $4,000 prize pool?'), null);
assert.equal(extractProposalBudget('Task: $4,000 in prizes. Ask: $10,925 for the programme.'), '$10,925');
assert.equal(extractProposalBudget('We ask $4,000 for prizes.'), null);
const base = { id: '11262', titleZh: '已有人工标题', budgetLabel: '$10,925', author: 'Fidelcoder', overview: { objective: 'Live source objective', objectiveZh: '已有人工概览', objectiveEn: 'Reviewed objective', milestones: [] } };
const reviewed = applyProposalMilestoneCorrections(base);
for (const key of ['objective', 'objectiveZh', 'objectiveEn']) assert.equal(reviewed.overview[key], base.overview[key]);
assert.equal(reviewed.titleZh, base.titleZh); assert.equal(reviewed.author, base.author);
assert.equal(reviewed.overview.milestones.length, 8);
assert.ok(reviewed.overview.milestones.every(m => m.budget == null && m.titleZh && m.titleEn && m.descriptionZh && m.descriptionEn));
assert.match(reviewed.overview.milestones[0].title, /December 2026/);
assert.match(reviewed.overview.milestones[2].descriptionEn, /28 January/);
assert.match(reviewed.overview.milestones[2].descriptionZh, /尚不要求/);
assert.match(reviewed.overview.milestones[5].descriptionEn, /at least 5 distinct beta users/);
assert.match(reviewed.overview.milestones[5].descriptionZh, /交易链接和测试者确认/);
assert.match(reviewed.overview.milestones[6].descriptionEn, /9 March/);
assert.match(reviewed.overview.milestones[7].descriptionEn, /24 March/);
assert.ok(reviewed.overview.milestones.every(m => /tentative/.test(m.descriptionEn)));
const replies = await read('twine-scope-replies.json');
for (const post of replies) {
 assert.equal(isProposalScopeRevision(stripForumHtml(post.cooked)), true, 'Twine #' + post.post_number);
 assert.equal(isMeaningfulProgressUpdate(post.cooked), false);
 assert.equal(isProposalProgressUpdate(stripForumHtml(post.cooked)), false);
}
const cellula = await read('cellula-test-report.json');
const real = [
 {post_number:9,username:'ebubedev',created_at:'2026-11-19T00:00:00Z',cooked:'<h2>Weekly report</h2><p>I edited the proposal. We completed the testnet wallet release.</p>'},
 {post_number:10,username:'ebubedev',created_at:'2026-11-19T00:00:00Z',cooked:'<h2>Monthly report</h2><p>We deployed the mainnet app and published the source code.</p>'},
 {post_number:11,username:'ebubedev',created_at:'2026-11-19T00:00:00Z',cooked:'<h2>Test report</h2><p>I edited the proposal. We ran all three recovery tests and all three passed on testnet.</p>'},
];
for (const post of [...real, cellula]) {
 assert.equal(isMeaningfulProgressUpdate(post.cooked), true);
 assert.equal(isProposalProgressUpdate(stripForumHtml(post.cooked)), true);
}
const first = {post_number:1,username:'ebubedev',cooked:'<p>Original proposal</p>'};
const posts=[first,...replies,...real];
assert.deepEqual(progressUpdatePosts(posts,{topic_id:11228,posts_count:1,last_posted_at:'2026-11-16T00:00:00Z'},Date.parse('2026-11-16T00:00:00Z')).map(p=>p.post_number),[9,10,11]);
assert.deepEqual(selectForumProgressUpdates(posts,'ebubedev','11228','twine').map(p=>Number(p.url.split('/').at(-1))),[9,10,11]);
assert.equal(isMeaningfulProgressUpdate('<p>I edited the proposal. Milestone 4 uses the testnet release and the completed demo.</p><ul><li><a href="https://github.com/example">Old repository</a></li></ul>'),false);
for (const content of ['We will run all three recovery scenarios on testnet.', 'All three passed. Thanks!', 'We ran all three and all three passed. Movie reviews.']) assert.equal(isMeaningfulProgressUpdate('<p>'+content+'</p>'),false);
const result=await build({entryPoints:[new URL('../api/subscription.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false,footer:{js:'export { buildDigestTopic, digestMessage, telegramDigestMessages };'}});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const oldFetch=globalThis.fetch; let sends=0;
globalThis.fetch=async input=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.host==='talk.nervos.org'&&url.pathname.includes('/11262.json'))return Response.json({post_stream:{posts:[{id:27574,post_number:1,username:'Fidelcoder',cooked}],stream:[27574]}});
 if(url.pathname==='/api/translation')return Response.json({ok:false});
 if(url.host==='api.resend.com'||url.host==='api.telegram.org')sends++;
 throw Error('Unexpected offline request '+url.host+url.pathname);
};
try{
 const item=await api.buildDigestTopic({id:11262,title:'[DIS] CKB Productathon',slug:'productathon',created_at:'2026-11-19T05:01:33.288Z',posts_count:1});
 for(const locale of ['zh','en']){
  const email=api.digestMessage(locale,[item],[],'https://offline.example/unsubscribe');
  const tg=api.telegramDigestMessages(locale,[item],[]).join('\n');
  for(const output of [email.html,email.text,tg])assert.match(output,/10,925/);
 }
 assert.equal(sends,0);
}finally{globalThis.fetch=oldFetch;}
console.log('Validated Productathon total/bilingual 8-stage plan and offline digests; Twine source replies #2/#8 excluded, weekly/monthly/test reports retained, zero sends.');
