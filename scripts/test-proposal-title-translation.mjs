import assert from 'node:assert/strict';
import fs from 'node:fs';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';
import {
  applyPersistedTitleTranslation,
  translateMissingProposalTitle,
} from '../lib/proposal-title-translation.ts';

const dataset = JSON.parse(fs.readFileSync(new URL('../data/proposals.generated.json', import.meta.url), 'utf8'));
const backfill = JSON.parse(fs.readFileSync(new URL('../data/proposal-title-translations.json', import.meta.url), 'utf8'));

const expectedIds = new Set(dataset.proposals.map((proposal) => String(proposal.id)));
for (const [id, override] of Object.entries(proposalOverridesById)) {
  if (override.titleZh || override.titleEn) expectedIds.add(id);
}
expectedIds.add('10739');

assert.equal(backfill.version, 1);
assert.deepEqual(new Set(Object.keys(backfill.translations)), expectedIds);
for (const [id, translation] of Object.entries(backfill.translations)) {
  assert.ok(translation.sourceTitle?.trim(), `Proposal ${id} is missing its source title`);
  assert.ok(translation.zh?.trim(), `Proposal ${id} is missing its Chinese title`);
  assert.ok(translation.en?.trim(), `Proposal ${id} is missing its English title`);
  const override = proposalOverridesById[id];
  if (override?.titleZh) assert.equal(translation.zh, override.titleZh);
  if (override?.titleEn) assert.equal(translation.en, override.titleEn);
}

const persisted = applyPersistedTitleTranslation({
  id: '10015',
  title: 'Decentralized privacy order-book appchain based on CKB L1 - 2026.phase-1',
});
assert.equal(persisted.titleEn, 'Decentralized privacy order-book appchain based on CKB L1 - 2026.phase-1');
assert.match(persisted.titleZh, /隐私订单簿/);

const futureEnglish = { id: '99998', title: 'Future CKB proposal' };
const requestedUrls = [];
const translatedFuture = await translateMissingProposalTitle(futureEnglish, async (url) => {
  assert.equal(typeof url, 'string');
  requestedUrls.push(url);
  return Response.json({ ok: true, translation: '未来的 CKB 提案' });
});
assert.equal(translatedFuture.titleEn, 'Future CKB proposal');
assert.equal(translatedFuture.titleZh, '未来的 CKB 提案');
assert.equal(new URL(requestedUrls[0], 'https://example.test').searchParams.get('kind'), 'proposal-title');

const changedSource = { id: '10015', title: 'A completely changed source title' };
const translatedChanged = await translateMissingProposalTitle(changedSource, async (url) => {
  assert.equal(typeof url, 'string');
  requestedUrls.push(url);
  return Response.json({ ok: true, translation: '完全变更后的源标题' });
});
assert.equal(translatedChanged.titleEn, changedSource.title);
assert.equal(translatedChanged.titleZh, '完全变更后的源标题');
assert.match(requestedUrls[1], /A\+completely\+changed\+source\+title/);

const humanBilingual = {
  id: '99997',
  title: 'Source title',
  titleZh: '人工中文标题',
  titleEn: 'Human English title',
};
const preservedHuman = await translateMissingProposalTitle(humanBilingual, async () => {
  throw new Error('Complete human translations must not call automatic translation.');
});
assert.equal(preservedHuman.titleZh, '人工中文标题');
assert.equal(preservedHuman.titleEn, 'Human English title');

console.log(`Validated ${Object.keys(backfill.translations).length} persisted bilingual titles and automatic title translation fallbacks.`);
