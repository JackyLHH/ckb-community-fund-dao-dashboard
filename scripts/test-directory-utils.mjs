import assert from 'node:assert/strict';
import { directoryProposalId, matchesDirectoryQuery, rememberDirectoryContext } from '../lib/directory-utils.ts';

for (const [query, expected] of [
  ['10015', '10015'],
  [' #10739 ', '10739'],
  ['https://ckbcommunityfunddao.xyz/project?id=10739', '10739'],
  ['https://ckb-community-fund-dao-dashboard.vercel.app/project?id=9879&lang=en', '9879'],
  ['https://site-hazel-one-84.vercel.app/project?id=10015', '10015'],
  ['https://talk.nervos.org/t/dis-invisibook/10015/47?u=jackylhh', '10015'],
  ['https://talk.nervos.org/t/10015', '10015'],
  ['https://talk.nervos.org/t/10015/47', '10015'],
  ['https://example.com/project?id=10015', null],
  ['https://talk.nervos.org.attacker.test/t/proposal/10015', null],
  ['https://ckbcommunityfunddao.xyz/project?id=invalid', null],
  ['https://ckbcommunityfunddao.xyz/subscription?id=10015', null],
  ['https://talk.nervos.org/c/daos-funding/65', null],
  ['Fiber', null],
  ['', null],
]) assert.equal(directoryProposalId(query), expected, query);

assert.equal(matchesDirectoryQuery('10015', 'Invisibook Lawliet 隐私订单簿', '10015'), true);
assert.equal(matchesDirectoryQuery('10015', 'Mentions 1001 in its budget', '1001'), false);
assert.equal(matchesDirectoryQuery('10015', 'Invisibook Lawliet 隐私订单簿', ' LAWLIET '), true);
assert.equal(matchesDirectoryQuery('10015', 'Invisibook Lawliet 隐私订单簿', '隐私'), true);
assert.equal(matchesDirectoryQuery('10015', '', 'https://talk.nervos.org/t/invisibook/10015/47'), true);
assert.equal(matchesDirectoryQuery('10015', 'Invisibook', ''), true);
assert.equal(matchesDirectoryQuery('10015', 'Invisibook', 'Fiber'), false);
assert.doesNotThrow(rememberDirectoryContext, 'SSR must not access browser globals');

const writes = [];
globalThis.window = {
  location: { pathname: '/projects', search: '?status=executing&q=Fiber' },
  scrollY: 840,
  sessionStorage: { setItem: (key, value) => writes.push([key, JSON.parse(value)]) },
};
rememberDirectoryContext();
assert.deepEqual(writes, [['ckb-dao-directory-context', { url: '/projects?status=executing&q=Fiber', scrollY: 840 }]]);
globalThis.window.sessionStorage.setItem = () => { throw new Error('Storage blocked'); };
assert.doesNotThrow(rememberDirectoryContext);
delete globalThis.window;

console.log('Validated exact-ID, trusted-URL and bilingual free-text search, and safe directory navigation context.');
