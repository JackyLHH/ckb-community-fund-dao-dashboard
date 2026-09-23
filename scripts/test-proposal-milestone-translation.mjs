import assert from 'node:assert/strict';
import fs from 'node:fs';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';
import {
  applyPersistedMilestoneTranslations,
  translateMissingProposalMilestones,
} from '../lib/proposal-milestone-translation.ts';

const dataset = JSON.parse(fs.readFileSync(new URL('../data/proposals.generated.json', import.meta.url), 'utf8'));
const backfill = JSON.parse(fs.readFileSync(new URL('../data/proposal-milestone-translations.json', import.meta.url), 'utf8'));

const expected = new Map();
for (const proposal of dataset.proposals) {
  if (proposal.overview?.milestones?.length) expected.set(String(proposal.id), proposal.overview.milestones);
}
for (const [id, override] of Object.entries(proposalOverridesById)) {
  if (override.overview?.milestones?.length) expected.set(id, override.overview.milestones);
}

assert.equal(backfill.version, 1);
assert.deepEqual(new Set(Object.keys(backfill.translations)), new Set(expected.keys()));
let milestoneCount = 0;
for (const [id, milestones] of expected) {
  const translations = backfill.translations[id];
  assert.equal(translations?.length, milestones.length, `Proposal ${id} milestone count differs from the backfill`);
  milestones.forEach((milestone, index) => {
    const translation = translations[index];
    assert.ok(translation?.titleZh?.trim(), `Proposal ${id} milestone ${index + 1} is missing a Chinese title`);
    assert.ok(translation?.titleEn?.trim(), `Proposal ${id} milestone ${index + 1} is missing an English title`);
    assert.ok(translation?.descriptionZh?.trim(), `Proposal ${id} milestone ${index + 1} is missing a Chinese description`);
    assert.ok(translation?.descriptionEn?.trim(), `Proposal ${id} milestone ${index + 1} is missing an English description`);
    if (milestone.titleZh) assert.equal(translation.titleZh, milestone.titleZh);
    if (milestone.titleEn) assert.equal(translation.titleEn, milestone.titleEn);
    if (milestone.descriptionZh) assert.equal(translation.descriptionZh, milestone.descriptionZh);
    if (milestone.descriptionEn) assert.equal(translation.descriptionEn, milestone.descriptionEn);
    milestoneCount += 1;
  });
}

const rivetSource = {
  id: '10739',
  overview: {
    objective: 'Rivet',
    milestones: [{
      title: 'Milestone 1: CoTA Onboarding and Sovereign Passport',
      description: 'Integrate CoTA account abstraction.',
      budget: '$2,500',
    }],
  },
};
const rivetPersisted = applyPersistedMilestoneTranslations(rivetSource);
assert.equal(rivetPersisted.overview.milestones[0].titleZh, '里程碑 1：CoTA 入门与主权护照');
assert.match(rivetPersisted.overview.milestones[0].descriptionZh, /CoTA 账户抽象/);
assert.equal(rivetPersisted.overview.milestones[0].budgetZh, '$2,500');

const futureEnglishProposal = {
  id: '99998',
  overview: {
    objective: 'Future proposal',
    milestones: [{
      title: 'Milestone 1: Testnet release',
      description: 'Publish the working release on CKB testnet.',
      budget: '$1,000',
    }],
  },
};
const requestedKinds = [];
const translatedFuture = await translateMissingProposalMilestones(futureEnglishProposal, async (url) => {
  const query = new URL(url, 'https://example.test').searchParams;
  requestedKinds.push(query.get('kind'));
  const translation = query.get('kind') === 'milestone-title'
    ? '里程碑 1：测试网发布'
    : '在 CKB 测试网上发布可运行版本。';
  return Response.json({ ok: true, translation });
});
assert.deepEqual(
  requestedKinds.sort((left, right) => String(left).localeCompare(String(right))),
  ['milestone-description', 'milestone-title'],
);
assert.equal(translatedFuture.overview.milestones[0].titleZh, '里程碑 1：测试网发布');
assert.equal(translatedFuture.overview.milestones[0].descriptionZh, '在 CKB 测试网上发布可运行版本。');
assert.equal(translatedFuture.overview.milestones[0].titleEn, 'Milestone 1: Testnet release');

const humanBilingual = {
  id: '99997',
  overview: {
    objective: 'Human bilingual proposal',
    milestones: [{
      title: 'Human English title',
      titleZh: '人工中文标题',
      titleEn: 'Human English title',
      description: 'Human English description.',
      descriptionZh: '人工中文描述。',
      descriptionEn: 'Human English description.',
    }],
  },
};
const preservedHuman = await translateMissingProposalMilestones(humanBilingual, async () => {
  throw new Error('Complete human translations must not call automatic translation.');
});
assert.equal(preservedHuman.overview.milestones[0].titleZh, '人工中文标题');
assert.equal(preservedHuman.overview.milestones[0].descriptionEn, 'Human English description.');

console.log(`Validated ${milestoneCount} persisted bilingual milestones and automatic milestone translation fallbacks.`);
