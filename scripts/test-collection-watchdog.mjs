import assert from 'node:assert/strict';
import { tick, dispatchDecision, publicStatus, CollectionWatchdog, default as worker, MINUTE, REPOSITORY } from '../maintenance/collection-watchdog/worker.js';
import { collectionHealthState, emptyCollectionHealth } from '../lib/collection-health.ts';
const now = Date.parse('2026-11-27T10:00:00Z');
const env = { ACTIVE:'true', GITHUB_TOKEN:'github_pat_offline_fixture', TELEGRAM_BOT_TOKEN:'12345:offline_fixture', TELEGRAM_CHAT_ID:'12345678' };
const run = {id:77,head_branch:'main',run_attempt:1,event:'workflow_dispatch',status:'completed',conclusion:'success',created_at:new Date(now-4*MINUTE).toISOString(),html_url:'https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/actions/runs/77'};
const names=['Read public vote cards','Observe discussion and voting events','Verify all historical treasury balances and expenditures'];
function job(age=10,fail=null,strict=true){return {conclusion:fail?'failure':'success',steps:[...(strict?[{name:'Collection outcome semantics v2',conclusion:'success'}]:[]),...names.map(name=>({name,conclusion:name===fail?'failure':'success',completed_at:new Date(now-age*MINUTE).toISOString()})),{name:'Report incomplete observations',conclusion:fail?'failure':'skipped'}]};}
const memory = initial => { let state=structuredClone(initial); return {async get(){return structuredClone(state)},async put(_key,value){state=structuredClone(value)}}; };
function mock({age=10,fail=null,strict=true,busy=false,metadataError=false,dispatchError=false,telegramError=false}={}){
 const calls=[];
 const request=async(input,options={})=>{
  const url=String(input);calls.push({url,options});
  if(url.startsWith(REPOSITORY)){
   assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+env.GITHUB_TOKEN);
   if(url.endsWith('/dispatches')){
    assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{ref:'main',inputs:{dispatch_source:'cloudflare-watchdog',watchdog_request_id:JSON.parse(options.body).inputs.watchdog_request_id}});
    if(dispatchError)throw Error('Ambiguous network result '+env.GITHUB_TOKEN);
    return new Response(null,{status:204});
   }
   if(metadataError)return new Response('{}',{status:503});
   if(url.includes('/jobs?'))return Response.json({total_count:1,jobs:[job(age,fail,strict)]});
   if(url.includes('/runs?'))return Response.json({workflow_runs:[...(busy?[{...run,id:78,status:'queued',conclusion:null}]:[]),{...run,conclusion:fail?'failure':'success'}]});
  }
  if(url.startsWith('https://api.telegram.org/')){
   assert.equal(options.headers.Authorization,undefined,'GitHub token never goes to Telegram');
   assert.equal(JSON.parse(options.body).chat_id,env.TELEGRAM_CHAT_ID);
   assert.ok(!options.body.includes(env.GITHUB_TOKEN));
   return Response.json({ok:!telegramError},{status:telegramError?500:200});
  }
  throw Error('Unexpected outbound destination');
 };
 return {request,calls,dispatches:()=>calls.filter(c=>c.url.endsWith('/dispatches')),alerts:()=>calls.filter(c=>c.url.includes('/sendMessage'))};
}
let m=mock(),storage=memory();let state=await tick(env,storage,now,m.request);assert.equal(state.decision,'fresh');assert.equal(m.dispatches().length,0);assert.equal(m.alerts().length,0);
m=mock({age:46});storage=memory();state=await tick(env,storage,now,m.request);assert.equal(m.dispatches().length,1);assert.equal(state.lastDispatchAt,now);const originalSuccess=state.health.sources.votes.lastSuccessAt;
state=await tick(env,storage,now+15*MINUTE,m.request);assert.equal(m.dispatches().length,1,'Restarted tick respects persistent cooldown');assert.equal(state.health.sources.votes.lastSuccessAt,originalSuccess,'Dispatch never fabricates source success');
m=mock({age:100,busy:true});storage=memory();state=await tick(env,storage,now,m.request);assert.equal(state.decision,'workflow-busy');assert.equal(m.dispatches().length,0);assert.equal(m.alerts().length,1);
await tick(env,storage,now+15*MINUTE,m.request);assert.equal(m.alerts().length,1,'Alert deduplication survives repeated checks');
m=mock({age:46,dispatchError:true});storage=memory();state=await tick(env,storage,now,m.request);assert.equal(state.decision,'dispatch-unconfirmed');assert.equal(state.lastDispatchAt,undefined);await tick(env,storage,now+15*MINUTE,m.request);assert.equal(m.dispatches().length,1,'Ambiguous dispatch does not create a retry storm');assert.ok(!JSON.stringify(publicStatus(state)).includes(env.GITHUB_TOKEN));
m=mock({metadataError:true});storage=memory();state=await tick(env,storage,now,m.request);assert.equal(state.error,'metadata-unavailable');assert.equal(m.dispatches().length,0);assert.equal(m.alerts().length,0);await tick(env,storage,now+91*MINUTE,m.request);assert.equal(m.alerts().length,1,'A sustained metadata outage also alerts');
m=mock({age:100,telegramError:true});storage=memory();state=await tick(env,storage,now,m.request);assert.equal(state.lastAlertAt,undefined);assert.equal(state.alertError,'delivery-unconfirmed');m=mock({age:100});state=await tick(env,storage,now+15*MINUTE,m.request);assert.equal(m.alerts().length,1);assert.equal(state.alertError,null,'Only confirmed delivery clears alert errors');
m=mock({age:10});state=await tick(env,storage,now+16*MINUTE,m.request);assert.equal(m.alerts().length,1,'Recovery is sent once after a confirmed incident');assert.equal(state.incidentSince,null);await tick(env,storage,now+17*MINUTE,m.request);assert.equal(m.alerts().length,1);
m=mock({age:100});state=await tick({...env,ACTIVE:'false'},memory(),now,m.request);assert.equal(state.decision,'paused');assert.equal(m.dispatches().length,0);assert.equal(m.alerts().length,0);
m=mock();state=await tick({...env,TELEGRAM_CHAT_ID:'-10000000'},memory(),now,m.request);assert.equal(state.decision,'configuration-incomplete','Subscription/public channel IDs are not accepted');assert.equal(m.alerts().length,0);
m=mock({age:10,fail:names[1]});state=await tick(env,memory(),now,m.request);assert.equal(state.health.sources.governance.lastSuccessAt,null);assert.equal(state.health.sources.votes.lastSuccessAt,new Date(now-10*MINUTE).toISOString());assert.equal(m.dispatches().length,1,'Partial failure still qualifies for recovery');
m=mock({age:10,fail:names[1],strict:false});state=await tick(env,memory(),now,m.request);assert.equal(state.health.sources.votes.lastSuccessAt,null,'Legacy failed aggregate cannot prove source success');
const health=emptyCollectionHealth(now);health.available=true;health.latestRun={...run,url:run.html_url};for(const source of Object.values(health.sources)){source.lastSuccessAt=new Date(now-10*MINUTE).toISOString();source.evidence='strict-v2';}health.schedule.lastRunAt=new Date(now-180*MINUTE).toISOString();health.backup={provider:'cloudflare-watchdog',enabled:true,lastCheckAt:new Date(now).toISOString(),statusUrl:'https://example.workers.dev/status',error:null};
assert.equal(collectionHealthState(health,now).state,'fresh');assert.equal(collectionHealthState(health,now).schedule,'stale');assert.equal(collectionHealthState(health,now).effectiveSchedule,'cloudflare-watchdog');assert.equal(collectionHealthState(health,now+31*MINUTE).state,'stale','Stopped backup cannot mask the native gap');
health.sources.governance.lastSuccessAt=new Date(now-100*MINUTE).toISOString();assert.equal(collectionHealthState(health,now).state,'stale','A fresh backup heartbeat never replaces real collection success');
// No unauthenticated public route can dispatch a workflow or send an alert.
const forbidden=await worker.fetch(new Request('https://watchdog.test/tick',{method:'POST'}),{});assert.equal(forbidden.status,404);
// Coalescing protects simultaneous scheduled delivery inside the named object.
m=mock({age:46});storage=memory();let release;const gate=new Promise(resolve=>{release=resolve});let calls=0;const oldFetch=globalThis.fetch;globalThis.fetch=async(...args)=>{calls++;if(calls===1)await gate;return m.request(...args)};
try {const object=new CollectionWatchdog({storage},env);const a=object.fetch(new Request('https://internal/tick',{method:'POST'}));const b=object.fetch(new Request('https://internal/tick',{method:'POST'}));release();await Promise.all([a,b]);assert.equal(m.dispatches().length,1);}finally{globalThis.fetch=oldFetch;}
console.log('Watchdog: real-step evidence, partial failures, 45m failover, busy/cooldown, ambiguous dispatch, 90m private alerts/recovery, delivery failures, persisted dedupe, closed public routes and honest native/backup health pass (offline; zero real sends).');
