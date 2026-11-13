import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { translateMissingProposalMilestones } from '../lib/proposal-milestone-translation.ts';
import { GET as translate } from '../api/translation.ts';
const bundled = await build({ entryPoints: [new URL('../lib/live-data.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false });
const live = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const savedFetch = globalThis.fetch, savedTimer = globalThis.setTimeout, savedWarn = console.warn;
const savedKey = process.env.AI_GATEWAY_API_KEY;
const storage = new Map();
const savedWindow = globalThis.window;
globalThis.window = { localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
let mode = 'hang', translationCalls = 0;
const source = { id: 10937, slug: 'dis-crowdcell', title: '[DIS] CrowdCell source', created_at: new Date().toISOString(), posts_count: 1, excerpt: 'This proposal requests $5,000 for testnet crowdfunding.', posters: [{ user_id: 1 }] };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input, 'https://offline.example');
  if (url.pathname === '/api/translation') { translationCalls++; return mode === 'hang' ? new Promise(() => {}) : new Response(null, { status: 504 }); }
  if (url.pathname === '/live/metaforo/votes') return Response.json({ version: 1, votes: {} });
  if (url.pathname === '/live/nervos/category') return Response.json({ users: [{ id: 1, username: 'builder' }], topic_list: { topics: [source] } });
  if (url.pathname === '/live/ckb/dao-balance') return Response.json({ data: [] });
  if (url.pathname === '/live/nervos/topic/7793') return Response.json({ post_stream: { posts: [{ cooked: '<p>Funded proposals</p>' }] } });
  if (url.pathname === '/live/nervos/topic/10937') return Response.json({ title: source.title, slug: source.slug, post_stream: { posts: [{ id: 1, post_number: 1, username: 'builder', cooked: '<p>This proposal requests a grant of $5,000 to ship testnet crowdfunding.</p>' }] } });
  throw new Error(`Unexpected request: ${url.pathname}`);
};
const deadline = async promise => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = savedTimer(() => reject(new Error('Source data blocked by translation')), 500); })]); }
  finally { clearTimeout(timer); }
};
try {
  const data = await deadline(live.loadLiveDataset());
  assert.equal(data.meta.usedFallback, false); assert.equal(data.proposals.length, 1);
  const result = await deadline(live.loadLiveProjectWithState('10937'));
  assert.equal(result.state, 'live'); assert.match(result.proposal.overview.objective, /crowdfunding/);
  assert.equal(result.proposal.budgetLabel, '$5,000'); assert.ok(result.proposal.statusTags.length > 0);
  assert.equal(translationCalls, 0, 'Neither factual loader calls or awaits translation');
  // Advance only translation deadlines; hung fetchers deliberately ignore abort.
  globalThis.setTimeout = (fn, ms, ...args) => savedTimer(fn, [8000, 3500].includes(ms) ? 1 : ms, ...args);
  const background = await deadline(live.translateLiveProposal(result.proposal));
  assert.equal(background.budgetLabel, '$5,000'); assert.equal(background.overview.objective, result.proposal.overview.objective);
  assert.equal(storage.size, 0, 'A timeout is never written to successful browser cache');
  mode = '504';
  await deadline(live.translateLiveProposal(result.proposal));
  assert.equal(storage.size, 0, '504 responses are not cached as translations');
  const manual = { id: '999999', overview: { objective: 'Source', milestones: [{ title: 'M1', titleZh: '人工标题', titleEn: 'M1', description: 'Original description', descriptionZh: '人工说明', descriptionEn: 'Original description', budget: '$500' }] } };
  const preserved = await translateMissingProposalMilestones(manual, () => { throw new Error('Reviewed text must not request translation'); });
  assert.equal(preserved.overview.milestones[0].descriptionZh, '人工说明');
  // API failure and late success: neither can populate its successful cache.
  console.warn = () => {}; delete process.env.AI_GATEWAY_API_KEY;
  let release, providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; return new Promise(resolve => { release = resolve; }); };
  const request = new Request('https://offline.example/api/translation?proposalId=999997&target=zh&text=Uncached%20source%20text');
  const failure = await deadline(translate(request));
  assert.equal(failure.status, 200); assert.equal(failure.headers.get('cache-control'), null);
  const failedBody = await failure.json(); assert.equal(failedBody.ok, false); assert.equal(failedBody.source, 'Uncached source text');
  release(Response.json({ responseStatus: 200, responseData: { translatedText: '迟到译文' } }));
  await new Promise(resolve => savedTimer(resolve, 5));
  globalThis.fetch = async () => { providerCalls++; return Response.json({ responseStatus: 200, responseData: { translatedText: '新的成功译文' } }); };
  const retry = await (await translate(request)).json();
  assert.equal(retry.cached, undefined); assert.equal(retry.translation, '新的成功译文'); assert.equal(providerCalls, 2);
} finally {
  globalThis.fetch = savedFetch; globalThis.setTimeout = savedTimer; console.warn = savedWarn;
  if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
  if (savedKey === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = savedKey;
}
console.log('Offline hanging/504 translations: list/detail source data render independently, manual text survives, failures and late responses do not poison caches.');
