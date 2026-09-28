import assert from 'node:assert/strict';
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
  assert.equal(longBody.ok, false);
  assert.equal(longBody.code, 'public_query_too_long');
  assert.equal(fetchUrls.length, 0);
} finally {
  globalThis.fetch = originalFetch;
  if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
}

console.log('Validated public translation query length handling.');
