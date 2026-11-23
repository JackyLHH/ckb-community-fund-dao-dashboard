import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectForumProgressUpdates } from '../lib/proposal-update-title.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';
import { translateMissingProposalUpdates } from '../lib/proposal-update-translation.ts';

const requestedUrls = [];
const chineseUpdate = {
  id: '99998',
  updates: [{
    title: '周报：完成 CKB 合约和前端功能开发',
    date: '2026-09-28T00:00:00.000Z',
    url: 'https://talk.nervos.org/t/example/99998/2',
    author: 'builder',
  }],
};
const translatedChinese = await translateMissingProposalUpdates(chineseUpdate, async (url) => {
  assert.equal(typeof url, 'string');
  requestedUrls.push(url);
  return Response.json({ ok: true, translation: 'Weekly report: completed CKB contract and frontend development.' });
});
assert.equal(translatedChinese.updates[0].titleZh, chineseUpdate.updates[0].title);
assert.equal(translatedChinese.updates[0].titleEn, 'Weekly report: completed CKB contract and frontend development.');
assert.equal(new URL(requestedUrls[0], 'https://example.test').searchParams.get('kind'), 'proposal-update');

const englishUpdate = {
  ...chineseUpdate,
  updates: [{ ...chineseUpdate.updates[0], title: 'Weekly report: testnet release completed.' }],
};
const translatedEnglish = await translateMissingProposalUpdates(englishUpdate, async (url) => {
  assert.equal(typeof url, 'string');
  requestedUrls.push(url);
  return Response.json({ ok: true, translation: '周报：测试网版本已发布。' });
});
assert.equal(translatedEnglish.updates[0].titleEn, englishUpdate.updates[0].title);
assert.equal(translatedEnglish.updates[0].titleZh, '周报：测试网版本已发布。');
assert.notEqual(requestedUrls[0], requestedUrls[1], 'Edited source text must produce a different CDN request key.');

const humanBilingual = {
  ...chineseUpdate,
  updates: [{
    ...chineseUpdate.updates[0],
    titleZh: '人工中文更新',
    titleEn: 'Human English update',
  }],
};
const preservedHuman = await translateMissingProposalUpdates(humanBilingual, async () => {
  throw new Error('Complete human translations must not call automatic translation.');
});
assert.equal(preservedHuman.updates[0].titleZh, '人工中文更新');
assert.equal(preservedHuman.updates[0].titleEn, 'Human English update');

console.log('Validated automatic bilingual proposal-update translation and source-change cache invalidation.');

const sourceReports = JSON.parse(await readFile(new URL('./fixtures/invisibook-short-reports.json',import.meta.url),'utf8'));
const recentReports = selectForumProgressUpdates(sourceReports,'Lawliet_Chan','10015','dis-decentralized-privacy-order-book-appchain-based-on-ckb-l1-2026-phase-1');
assert.equal(recentReports.length,5); assert.ok(recentReports.every(row=>row.title==='周报'));
const priorWindow=globalThis.window;
const poisoned = new Map();
function hash(value){let result=2166136261;for(let i=0;i<value.length;i++){result^=value.charCodeAt(i);result=Math.imul(result,16777619);}return(result>>>0).toString(36);}
for(const row of recentReports)poisoned.set(`proposal-update-translation:v2:10015:${hash(row.url)}:en:${hash(row.title)}`,'Magazine');
let cacheReads=0, providerCalls=0;
globalThis.window={localStorage:{getItem:key=>{cacheReads++;return poisoned.get(key)??null;},setItem:(key,value)=>poisoned.set(key,value)}};
try{
 const fixed=await translateMissingProposalUpdates({id:'10015',updates:recentReports},async()=>{providerCalls++;throw Error('Exact headings must bypass the provider');});
 assert.equal(cacheReads,0,'Exact headings bypass even poisoned automatic caches');assert.equal(providerCalls,0);
 for(let i=0;i<fixed.updates.length;i++){
  assert.equal(fixed.updates[i].titleEn,'Weekly Report');assert.equal(fixed.updates[i].titleZh,'周报');
  for(const field of ['title','date','url','author'])assert.equal(fixed.updates[i][field],recentReports[i][field]);
 }
 const headings={'日报':'Daily Report','周报':'Weekly Report','双周报':'Biweekly Report','月报':'Monthly Report','季报':'Quarterly Report','年报':'Annual Report'};
 for(const [title,english] of Object.entries(headings)){
  const result=await translateMissingProposalUpdates({id:'10015',updates:[{...recentReports[0],title}]},()=>{throw Error('Deterministic heading requested translation');});
  assert.equal(result.updates[0].titleEn,english);
 }
 const manual={...recentReports[0],titleEn:'  Weekly Report — reviewed wording, punctuation retained.  '};
 const manualResult=await translateMissingProposalUpdates({id:'10015',updates:[manual]},()=>{throw Error('Reviewed English must win');});
 assert.equal(manualResult.updates[0].titleEn,manual.titleEn,'Reviewed English is preserved byte for byte');
 const historical=proposalOverridesById['10015'].updates;
 const preserved=await translateMissingProposalUpdates({id:'10015',updates:historical},()=>{throw Error('Reviewed bilingual history must not request translation');});
 assert.deepEqual(preserved.updates,historical);
 const monthlyLong={...recentReports[0],title:'月报：完成主网部署'};
 let longRequests=0;
 const longResult=await translateMissingProposalUpdates({id:'10015',updates:[monthlyLong]},async()=>{longRequests++;return Response.json({ok:true,translation:'Monthly report: mainnet deployment completed.'});});
 assert.equal(longRequests,1,'Longer titles retain their content and normal translation path');
 assert.equal(longResult.updates[0].titleEn,'Monthly report: mainnet deployment completed.');
}finally{if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
console.log('Validated five source weekly reports over poisoned Magazine cache, exact short report headings, original metadata and byte-identical reviewed English.');
