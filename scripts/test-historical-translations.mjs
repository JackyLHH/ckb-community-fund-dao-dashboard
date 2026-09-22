import assert from 'node:assert/strict';
import fs from 'node:fs';
import { proposalCardSummariesById } from '../lib/proposal-card-summaries.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const dataset = JSON.parse(fs.readFileSync(new URL('../data/proposals.generated.json', import.meta.url), 'utf8'));
const backfill = JSON.parse(fs.readFileSync(new URL('../data/proposal-overview-translations.json', import.meta.url), 'utf8'));
const expectedIds = new Set(dataset.proposals.map((proposal) => String(proposal.id)));
for (const [id, override] of Object.entries(proposalOverridesById)) {
  if (override.overview) expectedIds.add(id);
}

assert.equal(backfill.version, 1);
assert.deepEqual(new Set(Object.keys(backfill.translations)), expectedIds);
for (const id of expectedIds) {
  const translation = backfill.translations[id];
  assert.ok(translation?.zh?.trim(), `Proposal ${id} is missing historical Chinese overview`);
  assert.ok(translation?.en?.trim(), `Proposal ${id} is missing historical English overview`);
  assert.doesNotMatch(translation.zh, /概览尚未提供/);
  assert.doesNotMatch(translation.en, /overview is not yet available/i);

  const manual = proposalOverridesById[id]?.overview;
  const card = proposalCardSummariesById[id];
  if (manual?.objectiveZh) assert.equal(translation.zh, manual.objectiveZh);
  if (manual?.objectiveEn) assert.equal(translation.en, manual.objectiveEn);
  if (!manual?.objectiveZh && card?.zh) assert.equal(translation.zh, card.zh);
  if (!manual?.objectiveEn && card?.en) assert.equal(translation.en, card.en);
}

console.log(`Validated ${expectedIds.size} persisted bilingual proposal overviews.`);
