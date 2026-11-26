import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDiscussionEvidence, discussionDeadline } from '../lib/digest-lifecycle.ts';
const f=JSON.parse(await readFile(new URL('./fixtures/twine-deadline-evidence.json',import.meta.url),'utf8'));
const now=Date.parse(f.observedAt),deadline=discussionDeadline(f.topic.created_at);
let mode='private';
const get=async path=>{
 if(path==='/t/11228.json')return f.detail;
 if(path.includes('reactions-users'))return mode==='race'?{reaction_users:[{...f.reactions.reaction_users[0],count:99}]}:f.reactions;
 if(path.includes('post_action_users'))return f.users;
 if(path.includes('/user_actions.json')){
  assert.ok(path.toLowerCase().includes('qwin_daline'));
  if(mode==='private')throw Error('Forum 404: public like activity unavailable');
  return {user_actions:[{post_id:27455,post_number:1,topic_id:11228,created_at:new Date(deadline+(mode==='before'?-1:1)).toISOString()}]};
 }
 throw Error('Unexpected evidence request '+path);
};
const original=structuredClone(f.saved);
const pending=await readDiscussionEvidence(f.topic,f.saved,get,now);
assert.equal(pending.likes,null);assert.equal(pending.verification.status,'pending');
assert.equal(pending.verification.confirmedBefore,29);assert.equal(pending.verification.confirmedAfter,1);
assert.deepEqual(pending.verification.unresolvedUsers,['qwin_daline']);assert.equal(pending.verification.issues.qwin_daline,'activity-unavailable');
assert.equal(pending.timestamps.fx_dior,'2026-11-24T06:04:05.000Z','Newly verified late timestamp survives the unresolved private user');
for(const [user,time] of Object.entries(f.saved.timestamps))assert.equal(pending.timestamps[user],time);
assert.deepEqual(f.saved,original,'Source checkpoint is immutable');
const retry=await readDiscussionEvidence(f.topic,pending,get,now+1000);
assert.equal(retry.likes,null);assert.equal(retry.timestamps.fx_dior,pending.timestamps.fx_dior);
mode='before';const before=await readDiscussionEvidence(f.topic,pending,get,now);
assert.equal(before.likes,30);assert.equal(before.verification.status,'verified');
mode='after';const after=await readDiscussionEvidence(f.topic,pending,get,now);
assert.equal(after.likes,29,'Never use the present-day total of 31');
mode='race';const race=await readDiscussionEvidence(f.topic,pending,get,now);
assert.equal(race.likes,null);assert.equal(race.verification.listComplete,false);assert.match(race.verification.sourceError,/changed/);
assert.deepEqual(race.timestamps,pending.timestamps);
// Execute the actual collection script in an isolated fixture repository. A
// pending topic must persist evidence, fail the scan and not block other topics.
const temporary=await mkdtemp(join(tmpdir(),'dao-discussion-checkpoint-'));
try{
 for(const dir of ['scripts','lib','data'])await mkdir(join(temporary,dir));
 await writeFile(join(temporary,'package.json'),'{"type":"module"}');
 for(const [from,to] of [['scripts/sync-lifecycle.mjs','scripts/sync-lifecycle.mjs'],['lib/digest-lifecycle.ts','lib/digest-lifecycle.ts'],['lib/proposal-title.js','lib/proposal-title.js']])await copyFile(new URL('../'+from,import.meta.url),join(temporary,to));
 const start={version:1,enabledAt:'2026-10-19T00:00:00Z',checkedAt:null,events:[],discussions:{'11228':f.saved}};
 await writeFile(join(temporary,'data/lifecycle.generated.json'),JSON.stringify(start));await writeFile(join(temporary,'data/votes.generated.json'),'{"votes":{}}');
 await writeFile(join(temporary,'fixture.json'),JSON.stringify(f));
 await writeFile(join(temporary,'mock.mjs'),`import {readFile} from 'node:fs/promises';const f=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));globalThis.fetch=async input=>{const u=new URL(input);let body;if(u.pathname.includes('/latest.json'))body={topic_list:{topics:[f.topic,{id:999999,title:'[DIS] Independent proposal',slug:'independent',created_at:'2026-11-01T00:00:00Z'}]}};else if(u.pathname==='/t/11228.json')body=f.detail;else if(u.pathname==='/t/999999.json')body={post_stream:{posts:[{id:999999,post_number:1,reactions:[{id:'heart',count:0}]}]}};else if(u.pathname.includes('reactions-users'))body=f.reactions;else if(u.pathname.includes('post_action_users'))body=f.users;else if(u.pathname.includes('user_actions'))return new Response('{}',{status:404});else throw Error('Unexpected offline request '+u.pathname);return Response.json(body);};`);
 const result=spawnSync(process.execPath,['--experimental-strip-types','--import',join(temporary,'mock.mjs'),join(temporary,'scripts/sync-lifecycle.mjs')],{encoding:'utf8'});
 assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/qwin_daline/);
 const saved=JSON.parse(await readFile(join(temporary,'data/lifecycle.generated.json'),'utf8'));
 assert.ok(!saved.events.some(event=>event.topicId===11228));assert.ok(saved.events.some(event=>event.topicId===999999),'Other proposals continue collecting');
 assert.equal(saved.discussions['11228'].timestamps.fx_dior,pending.timestamps.fx_dior);
 assert.deepEqual(saved.discussions['11228'].verification.unresolvedUsers,['qwin_daline']);
 const firstBytes=await readFile(join(temporary,'data/lifecycle.generated.json'),'utf8');
 const repeat=spawnSync(process.execPath,['--experimental-strip-types','--import',join(temporary,'mock.mjs'),join(temporary,'scripts/sync-lifecycle.mjs')],{encoding:'utf8'});
 assert.equal(repeat.status,1);assert.equal(await readFile(join(temporary,'data/lifecycle.generated.json'),'utf8'),firstBytes,'Unchanged evidence does not fabricate new checkpoint time or commits');
}finally{await rm(temporary,{recursive:true,force:true});}
console.log('Validated real Twine 29-before/1-after/1-unknown checkpoint, complete-evidence replay, source races and actual collector partial persistence/failure with other topics continuing (offline).');

// Public copy must use the seven-day cutoff, never today's total likes or
// a leftover discussion tag. Existing verified counts/events stay untouched.
{
const { build } = await import('esbuild');
const output = await build({entryPoints:[new URL('../lib/proposals.ts', import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const proposals = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const pending = {createdAt:'2026-11-17T04:51:04.145Z',status:'discussion',statusTags:['discussion'],discussion:{likes:32}};
const before = new Date('2026-11-24T04:51:04.144Z');
const at = new Date('2026-11-24T04:51:04.145Z');
assert.match(proposals.getDiscussionStageDetail(pending,'en',true,before),/Within the seven-day/);
assert.equal(proposals.getDiscussionStageDetail(pending,'zh',true,at),'讨论期已结束，截止赞数待核验。');
assert.match(proposals.getDiscussionStageDetail(pending,'en',true,at),/ended; deadline likes await verification/);
assert.equal(proposals.getDiscussionStageDetail(pending,'en',false,at),'Discussion stage ended');
assert.match(proposals.getStatusExplanation(pending,'zh'),/截止赞数待核验/);
assert.match(proposals.getStatusExplanation(pending,'en'),/deadline likes await verification/);
const ledger = JSON.parse(await readFile(new URL('../data/lifecycle.generated.json', import.meta.url), 'utf8'));
const verified = ledger.events.find(event => event.kind === 'discussion-ended');
assert.match(proposals.getDiscussionStageDetail({...pending,id:String(verified.topicId)},'en',true,at),/deadline likes verified/);
assert.equal(pending.discussion.likes,32);
assert.deepEqual(pending.statusTags,['discussion']);
}
