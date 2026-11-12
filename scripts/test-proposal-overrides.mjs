import assert from 'node:assert/strict';
import { applyProposalMilestoneCorrections, proposalOverridesById } from '../lib/proposal-overrides.ts';

const kaze = proposalOverridesById['10736'];
assert.ok(kaze, 'Proposal 10736 must have a reviewed data override');
assert.equal(kaze.budgetLabel, '$3,000');
assert.equal(kaze.projectType, 'Community & Content');
assert.equal(
  kaze.overview?.objectiveEn,
  'This proposal requests $3,000 to run three university tours in Kenya, teaching 210–300 students Bitcoin and CKB fundamentals and guiding them to create self-custodial CKB wallets with Kaze’s Passkey flow. Each three-hour tour also includes app installation, a campus mapping activity, and ambassador recruitment.',
);
assert.equal(
  kaze.overview?.objectiveZh,
  '该提案申请 3,000 美元，在肯尼亚三所大学开展巡回活动，向 210–300 名学生介绍比特币和 CKB 基础知识，并指导他们使用 Kaze 的 Passkey 流程现场创建自托管 CKB 钱包。每场三小时活动还包括安装应用、校园地点标注和校园大使招募。',
);
assert.equal(kaze.overview?.milestones.length, 3);

const voteCalculation = proposalOverridesById['7120'];
assert.equal(voteCalculation.titleZh, '修改票数的计算方式');
assert.equal(voteCalculation.titleEn, 'Changing How Votes Are Calculated');

const invisibookUpdates = proposalOverridesById['10015'].updates ?? [];
const september21 = invisibookUpdates.find((update) => /\/10015\/45(?:\?|$)/.test(update.url));
const september28 = invisibookUpdates.find((update) => /\/10015\/46(?:\?|$)/.test(update.url));
assert.match(september21?.titleEn ?? '', /L1 censorship-resistance/);
assert.match(september28?.titleEn ?? '', /CKB contract/);

console.log('Validated reviewed proposal overrides.');

const before = {
  id: '10937', budgetLabel: '$5,000', approvedBudget: 'unchanged',
  overview: { objective: 'Live source overview', milestones: [
    { title: 'M3', descriptionEn: 'Another milestone', descriptionZh: '其他里程碑', budget: '$1,000' },
    { title: 'M4: Keeper tip, pledge window and early finalization', description: 'Original English', descriptionEn: 'Original English', descriptionZh: '显示在活动中 page.', budget: '$800', eta: 'Week 12' },
  ] },
};
const corrected = applyProposalMilestoneCorrections(before);
assert.equal(corrected.overview.milestones[0], before.overview.milestones[0]);
assert.deepEqual({ ...corrected.overview.milestones[1], descriptionZh: before.overview.milestones[1].descriptionZh }, before.overview.milestones[1], 'Only the requested Chinese description changes');
assert.ok(corrected.overview.milestones[1].descriptionZh.endsWith('创作者可在目标达成后提前结算；该选项在创建活动时设置，此后不可更改，并在活动页面展示。'));
assert.equal(corrected.overview.objective, before.overview.objective);
assert.equal(before.overview.milestones[1].descriptionZh, '显示在活动中 page.', 'Do not mutate source data');
assert.equal(proposalOverridesById['10739'].budgetLabel, '$5,000');
assert.equal(applyProposalMilestoneCorrections({ id: 'unknown' }).id, 'unknown');
