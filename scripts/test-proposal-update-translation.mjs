import assert from 'node:assert/strict';
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
