import assert from 'node:assert/strict';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

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

console.log('Validated reviewed proposal overrides.');
