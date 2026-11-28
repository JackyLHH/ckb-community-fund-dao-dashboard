import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { classifyProgressUpdate, isMeaningfulProgressUpdate, stripForumHtml, progressUpdatePosts } from '../lib/digest-activity.ts';
import { isProposalProgressUpdate } from '../lib/proposal-progress.ts';
import { selectForumProgressUpdates } from '../lib/proposal-update-title.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';
import { translateMissingProposalUpdates } from '../lib/proposal-update-translation.ts';
const fixture = JSON.parse(await readFile(new URL('./fixtures/progress-evidence-nov23.json', import.meta.url), 'utf8'));
const nov26 = JSON.parse(await readFile(new URL('./fixtures/progress-evidence-nov26.json', import.meta.url), 'utf8'));
const grantAnswers = JSON.parse(await readFile(new URL('./fixtures/productathon-grant-answers.json', import.meta.url), 'utf8'));
const fibernuts = JSON.parse(await readFile(new URL('./fixtures/fibernuts-m1-report.json', import.meta.url), 'utf8'));
const testReport = JSON.parse(await readFile(new URL('./fixtures/cellula-test-report.json', import.meta.url), 'utf8'));
const check = (cooked, expected) => {
 assert.equal(isMeaningfulProgressUpdate(cooked), expected, 'Digest: ' + stripForumHtml(cooked).slice(0,110));
 assert.equal(isProposalProgressUpdate(stripForumHtml(cooked)), expected, 'Website: ' + stripForumHtml(cooked).slice(0,110));
};
for (const post of fixture.twine) check(post.cooked, false);
for (const post of [...fixture.rivet, fixture.cellula, testReport]) check(post.cooked, true);
for (const text of [
 'We will order servers next week. Milestone 1 will start after deployment. See our GitHub testnet release.',
 'Servers will be ordered after approval.',
 'We will publish a weekly report after Milestone 3 is completed.',
 'Milestone 1 will be completed next month; see the GitHub release plan.',
 'If we ran all three recovery tests and all three passed on testnet, would you approve?', 'If servers are ordered, setup starts now.',
 'We have not purchased the servers.', 'Have we purchased servers?',
 'Setup starts tomorrow.', 'Deployment has not started.',
 'When deployment is completed, the weekly report is published.',
 'Deployment may have been completed; we still need confirmation.',
 '服务器尚未订购，计划下周付款并开始部署。',
]) check('<p>'+text+'</p>', false);
for (const text of [
 'Servers ordered on 20 November: two KVM 8 machines, paid for 24 months up front.',
 'We have purchased two servers.', 'We paid for hosting.', 'Deployment has started.',
 '已订购两台服务器，已付款，部署现在开始。',
]) check('<p>'+text+'</p>', true);
for (const heading of ['Weekly report', 'Biweekly update', 'Monthly report', 'Test report']) check('<h2>'+heading+'</h2><p>We completed the testnet release and verified the deployment.</p>',true);
check(nov26.twine26.cooked, false);
check(nov26.vellum28.cooked, true);
assert.equal(selectForumProgressUpdates([nov26.twine26], 'ebubedev', '11228', 'twine').length, 0);
assert.match(selectForumProgressUpdates([nov26.vellum28], 'truthixify', '10613', 'vellum')[0].url, /10613\/28$/);
const retrospective = '<p>My previous Community Fund grant was Fiber Studio. We shipped the release and published the completion report.</p>';
for (const tail of ['', '<p>For this proposal, we will complete Milestone 1 next week.</p>', '<p>For this proposal, we have not completed Milestone 1.</p>']) check(retrospective + tail, false);
const mixed = retrospective + '<p>For this proposal, we completed Milestone 1 and deployed the testnet trade flow.</p>';
check(mixed, true);
const mixedPost = { ...nov26.twine26, cooked: mixed };
const mixedSelected = selectForumProgressUpdates([mixedPost], 'ebubedev', '11228', 'twine')[0];
assert.ok(!mixedSelected.title.includes('Fiber Studio'));
assert.ok(mixedSelected.title.includes('Milestone 1'));
const mixedDigest = progressUpdatePosts([{post_number:1,username:'ebubedev'},mixedPost], {last_posted_at:'2026-11-25T08:00:00Z'}, Date.parse('2026-11-25T08:00:00Z'));
assert.equal(mixedDigest.length, 1);
assert.ok(!mixedDigest[0].cooked.includes('Fiber Studio'));
assert.equal(mixedPost.cooked, mixed, 'Do not mutate historical source posts');
check(grantAnswers.cooked, false);
assert.notEqual(classifyProgressUpdate(grantAnswers.cooked).kind,'completion');
assert.equal(selectForumProgressUpdates([grantAnswers],'Fidelcoder','11262','productathon').length,0);
for(const text of [
 'The final report for an older Arbitrum grant is posted under my name.',
 'Here is the Arbitrum final report.',
 'Draft final report',
]) { check('<p>'+text+'</p>',false); assert.notEqual(classifyProgressUpdate('<p>'+text+'</p>').kind,'completion'); }
for(const title of ['Final report','CKB tool — Completion Report','结项报告']) {
 const cooked='<h2>'+title+'</h2><p>All deliverables for this proposal are complete.</p>';
 check(cooked,true);assert.equal(classifyProgressUpdate(cooked).kind,'completion');
}
const scopedAnswer=grantAnswers.cooked+'<p>For this proposal, we deployed the event registration page and tested the checkout. See an earlier Arbitrum final report for background.</p>';
check(scopedAnswer,true);
assert.notEqual(classifyProgressUpdate(scopedAnswer).kind,'completion');
const scopedUpdate=selectForumProgressUpdates([{...grantAnswers,cooked:scopedAnswer}],'Fidelcoder','11262','productathon')[0];
assert.ok(scopedUpdate.title.includes('deployed'));assert.ok(!scopedUpdate.title.includes('Arbitrum'));
const weeklyWithReference='<h2>Weekly report</h2><p>We deployed the registration page.</p><p>See the old Arbitrum final report for background.</p>';
check(weeklyWithReference,true);assert.equal(classifyProgressUpdate(weeklyWithReference).kind,'weekly');
check(fibernuts.cooked, true);
const m1 = { kind: 'milestone', milestone: '1', completion: false };
assert.deepEqual(classifyProgressUpdate(fibernuts.cooked), m1);
assert.match(selectForumProgressUpdates([fibernuts], 'Code3ks', '11051', 'fibernuts')[0].url, /11051\/15$/);
for (const heading of ['M1 delivery report', 'M2 delivery report plan', 'Is the M1 report ready?']) {
 const planned = '<h2>'+heading+'</h2><p>Expected result: all tests should pass after release.</p>';
 check(planned, false);
 assert.notEqual(classifyProgressUpdate(planned).kind, 'milestone');
}
const quoted='<blockquote>'+fixture.cellula.cooked+'</blockquote><p>Is this the plan?</p>';
assert.equal(isMeaningfulProgressUpdate(quoted),false);
assert.equal(selectForumProgressUpdates([{...fixture.cellula,cooked:quoted}],'LusoCryptoLabs','11089','dis-cellula').length,0);
const cellula = selectForumProgressUpdates([fixture.cellula], 'LusoCryptoLabs', '11089', 'dis-cellula');
assert.equal(cellula.length,1); assert.equal(cellula[0].date,'2026-11-20T01:46:03.522Z'); assert.match(cellula[0].url,/11089\/23$/);
assert.equal(selectForumProgressUpdates([{...fixture.cellula,username:'someone-else'}],'LusoCryptoLabs','11089','dis-cellula').length,0);
const reviewed=proposalOverridesById['11089'].updates.find(row=>row.url.endsWith('/23'));
assert.equal(reviewed.author,'LusoCryptoLabs'); assert.equal(reviewed.date,fixture.cellula.created_at);
assert.ok(stripForumHtml(fixture.cellula.cooked).includes(reviewed.titleZh)); assert.ok(stripForumHtml(fixture.cellula.cooked).includes(reviewed.titleEn));
assert.equal(proposalOverridesById['11089'].budgetLabel,'$22,258.48');
const translated=await translateMissingProposalUpdates({id:'11089',updates:[reviewed]},()=>{throw Error('Source bilingual text must not be machine-translated');});
assert.equal(translated.updates[0].titleZh,reviewed.titleZh);
const bundled=await build({entryPoints:[new URL('../api/subscription.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false,footer:{js:'export { buildProgressDigestTopics, digestMessage, telegramDigestMessages };'}});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const oldFetch=globalThis.fetch;let selectedSource,sends=0;
globalThis.fetch=async input=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.host==='talk.nervos.org')return Response.json(selectedSource);
 if(url.pathname==='/api/translation')return Response.json({ok:false});
 if(url.host==='api.resend.com'||url.host==='api.telegram.org')sends++;
 throw Error('Unexpected offline request '+url.host+url.pathname);
};
async function replay(id,author,source,start,end,expected){
 const original={topic_id:id,posts_count:1,last_posted_at:start}; const preserved=structuredClone(original);
 const posts=[{post_number:1,username:author,cooked:'<p>Original proposal</p>',created_at:'2026-11-01T00:00:00Z'},...source.filter(p=>Date.parse(p.created_at)<=Date.parse(end))];
 selectedSource={highest_post_number:posts.at(-1).post_number,post_stream:{posts}};
 const topic={id,title:'[DIS] Historical offline replay',slug:'replay',created_at:'2026-11-01T00:00:00Z',last_posted_at:end,posts_count:posts.length};
 const result=await api.buildProgressDigestTopics(topic,original,Date.parse(start));
 assert.deepEqual(result.map(item=>item.latestPostNumber),expected);
 assert.deepEqual(progressUpdatePosts(posts,original,Date.parse(start)).map(p=>p.post_number),expected);
 assert.deepEqual(original,preserved,'Historical state must not be modified');
 for(const item of result){
  assert.equal(item.latestPostCreatedAt,source.find(p=>p.post_number===item.latestPostNumber).created_at);
  for(const locale of ['zh','en']){
   const mail=api.digestMessage(locale,[],[item],'https://offline.example/unsubscribe');
   const tg=api.telegramDigestMessages(locale,[],[item]).join('\n');
   for(const content of [mail.html,mail.text,tg]) assert.ok(content.includes('/'+item.latestPostNumber));
  }
 }
 return result;
}
try{
 const result=await replay(11089,'LusoCryptoLabs',[fixture.cellula,{...fixture.cellula,post_number:24,username:'other'}],'2026-11-19T08:00:00Z','2026-11-20T08:00:00Z',[23]);
 assert.equal(result[0].budget,'$22,258.48');
 await replay(11228,'ebubedev',fixture.twine,'2026-11-19T08:00:00Z','2026-11-20T08:00:00Z',[]);
 await replay(11228,'ebubedev',fixture.twine,'2026-11-20T08:00:00Z','2026-11-21T08:00:00Z',[]);
 await replay(10739,'Jedi_dtechmaker',fixture.rivet,'2026-11-21T08:00:00Z','2026-11-22T08:00:00Z',[17]);
 await replay(11228,'ebubedev',[nov26.twine26],'2026-11-25T08:00:00Z','2026-11-26T08:00:00Z',[]);
 await replay(10613,'truthixify',[nov26.vellum28],'2026-11-25T08:00:00Z','2026-11-26T08:00:00Z',[28]);
 const mixedReplay=await replay(11228,'ebubedev',[mixedPost],'2026-11-25T08:00:00Z','2026-11-26T08:00:00Z',[26]);
 assert.ok(!mixedReplay[0].latestPostExcerpt.includes('Fiber Studio'));
 await replay(11262,'Fidelcoder',[grantAnswers],'2026-11-26T08:00:00Z','2026-11-27T08:00:00Z',[]);
 const fiberReplay=await replay(11051,'Code3ks',[fibernuts],'2026-11-27T08:00:00Z','2026-11-28T08:00:00Z',[15]);
 assert.deepEqual(fiberReplay[0].updateCategory,m1);
 assert.equal(sends,0);
}finally{globalThis.fetch=oldFetch;}
console.log('Validated shared observed-work eligibility, Twine #16/#17 exclusion, author-owned bilingual Cellula #23, RIVET delivery and historical digest replay (offline, zero sends/state writes).');
