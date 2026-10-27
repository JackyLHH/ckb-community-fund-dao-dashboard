import assert from 'node:assert/strict';
import { splitTranslationText, preserveTechnicalTerms } from '../lib/translation-terms.js';
import { GET } from '../api/translation.ts';

const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
delete process.env.AI_GATEWAY_API_KEY;

const originalFetch = globalThis.fetch;
let fetchUrls = [];
globalThis.fetch = async (input) => {
  const url = input instanceof Request ? input.url : String(input);
  fetchUrls.push(url);
  return Response.json({ responseStatus: 200, responseData: { translatedText: '测试译文' } });
};

function translationUrl(text) {
  const url = new URL('https://ckbcommunityfunddao.xyz/api/translation');
  url.searchParams.set('proposalId', '10739');
  url.searchParams.set('target', 'zh');
  url.searchParams.set('kind', 'milestone-description');
  url.searchParams.set('text', text);
  return url;
}

try {
  const shortResponse = await GET(new Request(translationUrl('Publish the working release on CKB testnet.')));
  const shortBody = await shortResponse.json();
  assert.equal(shortResponse.status, 200);
  assert.equal(shortBody.ok, true);
  assert.equal(shortBody.translation, '测试译文');
  assert.equal(fetchUrls.length, 1);
  assert.match(fetchUrls[0], /mymemory\.translated\.net/);

  fetchUrls = [];
  const longText = `${'Deliver a cross-platform CLI binary. '.repeat(20).trim()} Remaining funds.`;
  assert.ok(new TextEncoder().encode(longText).length > 500);
  const longResponse = await GET(new Request(translationUrl(longText)));
  const longBody = await longResponse.json();
  assert.equal(longResponse.status, 200);
  assert.equal(longBody.ok, true);
  assert.equal(fetchUrls.length, 2);
  assert.ok(fetchUrls.every(url => new TextEncoder().encode(new URL(url).searchParams.get('q')).length <= 500));
  assert.equal(longBody.translation, '测试译文 测试译文');
  for (const source of ['中'.repeat(330), 'a'.repeat(999), 'Fiber Network integration. '.repeat(25)]) {
    const parts = splitTranslationText(source);
    assert.ok(parts.every(part => new TextEncoder().encode(part).length <= 500));
    assert.equal(parts.join('').replace(/\s/g, ''), source.replace(/\s/g, ''));
  }
  assert.equal(preserveTechnicalTerms('光纤上的支付与光线网络集成', 'Payments over Fiber and Fiber Network'), 'Fiber上的支付与Fiber Network集成');
  assert.equal(preserveTechnicalTerms('普通光纤电缆', 'Optical cable'), '普通光纤电缆');
  globalThis.fetch = async () => Response.json({ responseStatus: 200, responseData: { translatedText: '光纤支付与光纤网络' } });
  const terms = await (await GET(new Request(translationUrl('Fiber payment and Fiber Network')))).json();
  assert.equal(terms.translation, 'Fiber支付与Fiber Network');
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ responseStatus: 200, responseData: { translatedText: '成功部分' } })
    : Response.json({ responseStatus: 403, quotaFinished: true });
  const partial = await (await GET(new Request(translationUrl('Unique segment. '.repeat(60))))).json();
  assert.equal(partial.ok, false, 'Never cache a partially translated milestone');
} finally {
  globalThis.fetch = originalFetch;
  if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
}

console.log('Validated public translation query length handling.');
