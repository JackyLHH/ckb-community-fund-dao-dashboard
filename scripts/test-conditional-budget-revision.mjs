import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { extractProposalBudget, stripForumHtml, isProposalScopeRevision, isMeaningfulProgressUpdate, progressUpdatePosts } from '../lib/digest-activity.ts';
import { isProposalProgressUpdate } from '../lib/proposal-progress.ts';
import { selectForumProgressUpdates } from '../lib/proposal-update-title.ts';
const sourceBudget = 'The proposed core budget is USD 26,500, covering packages A, C, E and F. Packages B and D are optional; including both brings the current estimate to USD 35,500. The final package list, auditor quote and CKB request will be confirmed before voting.';
const label = extractProposalBudget(sourceBudget);
assert.equal(label, 'Core $26,500 / with optional packages $35,500 (requested estimate; final confirmation before voting)');
assert.match(label, /26,500/); assert.match(label, /35,500/); assert.match(label, /core/i); assert.match(label, /optional/i); assert.match(label, /before voting/); assert.doesNotMatch(label, /approved/i);
assert.equal(extractProposalBudget('Grant Amount Requested: $12,000 USD'), '$12,000 USD');
const revision = "<p><a class=\"mention\" href=\"/u/t_silva\">@T_Silva</a> sent this in a DM, so the thread never had it. I am edited the proposal to answer it. This is the feedback, and what I changed.</p>\n<p><strong>A new buyer has no inbound CKB.</strong> The daemon does not open or fund a channel. An earlier build did open a one-way channel from the hub at release. That came out. Milestone 4 builds a Fiber Studio LSP. It opens the inbound channel from its own node, on testnet, and the CKB in that channel is mine. The grant pays for building the LSP, not for the coins. JIT receive inside testnet Cellula is a collaboration I will do with the Cellula developers. Cellula has not signed onto that, and it is not part of this $15,000. Until a route exists, payment instructions stay closed.</p>";
assert.equal(isProposalScopeRevision(stripForumHtml(revision)), true);
assert.equal(isMeaningfulProgressUpdate(revision), false);
assert.equal(isProposalProgressUpdate(stripForumHtml(revision)), false);
const date='2026-11-18T08:00:00Z';
const posts=[{post_number:1,username:'builder',cooked:'<p>Original proposal</p>'},
 {post_number:2,username:'builder',created_at:date,cooked:revision},
 {post_number:3,username:'builder',created_at:date,cooked:'<h2>Weekly report</h2><p>We revised the proposal to address feedback. We completed the app release and deployed the code to testnet.</p>'},
 {post_number:4,username:'builder',created_at:date,cooked:'<h2>Monthly update</h2><p>We edited the proposal to respond to feedback. We have completed the testnet release and published the source code.</p>'}];
assert.deepEqual(progressUpdatePosts(posts,{topic_id:11228,posts_count:1,last_posted_at:'2026-11-18T00:00:00Z'},Date.parse('2026-11-17T00:00:00Z')).map(p=>p.post_number),[3,4]);
assert.deepEqual(selectForumProgressUpdates(posts,'builder','11228','twine').map(p=>Number(p.url.split('/').at(-1))),[3,4]);

const bundled=await build({entryPoints:[new URL('../api/subscription.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false,footer:{js:'export { buildDigestTopic, digestMessage, telegramDigestMessages };'}});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const oldFetch=globalThis.fetch;
let sends=0;
globalThis.fetch=async input=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.host==='talk.nervos.org'&&url.pathname.includes('/11254.json')) return Response.json({post_stream:{posts:[{id:1,post_number:1,username:'builder',cooked:'<p>This proposal builds an on-chain claim option for Fiber.</p><p>'+sourceBudget+'</p>'}],stream:[1]}});
 if(url.pathname==='/api/translation') return Response.json({ok:false});
 if(url.host==='api.resend.com'||url.host==='api.telegram.org')sends++;
 throw new Error('Unexpected offline request '+url.host+url.pathname);
};
try{
 const item=await api.buildDigestTopic({id:11254,title:'[DIS] Fiber Claim Cell',slug:'fiber-claim-cell',created_at:date,last_posted_at:date,posts_count:1});
 for(const locale of ['zh','en']){
  const email=api.digestMessage(locale,[item],[],'https://offline.example/unsubscribe');
  const telegram=api.telegramDigestMessages(locale,[item],[]).join('\n');
  for(const content of [email.html,email.text,telegram]){
   assert.match(content,/26,500/);assert.match(content,/35,500/);
   assert.match(content,locale==='zh'?/申请估算，投票前最终确认/:/requested estimate; final confirmation before voting/);
  }
 }
 assert.equal(sends,0,'Rendering a conditional budget must not send messages');
}finally{globalThis.fetch=oldFetch;}
console.log('Validated conditional budget in parser/email/Telegram, shared revision exclusion and real weekly/monthly reports (offline; zero sends).');
