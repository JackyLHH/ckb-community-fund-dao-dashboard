import assert from 'node:assert/strict';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const kaze = proposalOverridesById['10736'];
assert.ok(kaze, 'Proposal 10736 must have a reviewed data override');
assert.equal(kaze.budgetLabel, '$3,000');
assert.equal(kaze.projectType, 'Community & Content');
assert.ok(kaze.overview?.objectiveEn?.includes('three university tours in Kenya'));
assert.ok(kaze.overview?.objectiveZh?.includes('肯尼亚三所大学'));
assert.equal(kaze.overview?.milestones.length, 3);

console.log('Validated reviewed proposal overrides.');
