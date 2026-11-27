import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, createFetchMock } from 'miniflare';
const output=await build({entryPoints:[new URL('../maintenance/collection-watchdog/entry.js',import.meta.url).pathname],bundle:true,platform:'browser',format:'esm',write:false});
const base='/repos/JackyLHH/ckb-community-fund-dao-dashboard';
const run={id:91,run_attempt:1,head_branch:'main',event:'schedule',status:'completed',conclusion:'success',created_at:new Date(Date.now()-47*60000).toISOString(),html_url:'https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/actions/runs/91'};
let dispatches=0;
async function check(redirect=false){
 const mock=createFetchMock();mock.disableNetConnect();
 const pool=mock.get('https://api.github.com');
 pool.intercept({path:base+'/actions/workflows/sync-votes.yml/runs?per_page=100',method:'GET'}).reply(redirect?302:200,redirect?'':JSON.stringify({workflow_runs:[run]}),{headers:{'content-type':'application/json'}}).persist();
 pool.intercept({path:base+'/actions/runs/91/attempts/1/jobs?per_page=100',method:'GET'}).reply(200,JSON.stringify({total_count:1,jobs:[{conclusion:'success',steps:[{name:'Collection outcome semantics v2',conclusion:'success'},...['Read public vote cards','Observe discussion and voting events','Verify all historical treasury balances and expenditures'].map(name=>({name,conclusion:'success',completed_at:new Date(Date.now()-46*60000).toISOString()}))]}]}),{headers:{'content-type':'application/json'}}).persist();
 pool.intercept({path:base+'/actions/workflows/sync-votes.yml/dispatches',method:'POST'}).reply(()=>{dispatches++;return {statusCode:204,data:''};});
 const mf=new Miniflare({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-01-01',durableObjects:{WATCHDOG:{className:'CollectionWatchdog',useSQLite:true}},bindings:{ACTIVE:'true',GITHUB_TOKEN:'github_pat_workerd_fixture',TELEGRAM_BOT_TOKEN:'12345:workerd_fixture',TELEGRAM_CHAT_ID:'12345678'},fetchMock:mock});
 try{
  const ns=await mf.getDurableObjectNamespace('WATCHDOG');const stub=ns.get(ns.idFromName('isolated-test'));
  const response=await stub.fetch('https://internal/tick',{method:'POST'});const body=await response.json();
  assert.equal(body.decision,redirect?'metadata-unavailable':'dispatch-accepted',JSON.stringify(body));
  if(redirect){
    assert.equal(body.error,'github-302');
    const read=await (await stub.fetch('https://internal/status')).json();
    assert.equal(read.lastCheckAt,body.lastCheckAt,'Read-only diagnostics cannot manufacture a scheduled check');
    assert.deepEqual(read.sources,body.sources);assert.equal(read.diagnosticError,'github-302');
  }
  else {assert.ok(body.lastDispatchAt);assert.equal(body.error,null);assert.ok(body.sources.governance.lastSuccessAt);}
  assert.equal((await mf.dispatchFetch('https://worker.test/tick',{method:'POST'})).status,404);
 }finally{await mf.dispose();await mock.close();}
}
await check();assert.equal(dispatches,1,'Cloudflare runtime actually reaches the mocked dispatch with supported options');await check(true);assert.equal(dispatches,1,'A 3xx response is refused without dispatch');
console.log('Actual workerd runtime: supported manual redirect, real Durable Object persistence, mocked GitHub dispatch and refused redirect responses pass (network disabled; zero real sends).');
