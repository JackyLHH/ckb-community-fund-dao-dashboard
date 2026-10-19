import assert from 'node:assert/strict';
import { detailStageStates, detailUpdateCategory, localizedSourceLabel, proposalUnavailableReason, reviewedDetailCache, sortDetailUpdates, updateMatchesFilter, updateMonthKey, validProposalId } from '../lib/proposal-detail-ux.ts';

const base = { voting: null, funded: false };
assert.deepEqual(detailStageStates(base, ['discussion']), ['current', 'upcoming', 'upcoming']);
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'unknown' } }, ['discussion']), ['current', 'upcoming', 'upcoming'], 'A discovered link is not a completed vote');
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'active' } }, ['voting']), ['complete', 'current', 'upcoming']);
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'approved' } }, ['vote-passed', 'executing']), ['complete', 'complete', 'current'], 'In progress is not completed');
assert.deepEqual(detailStageStates(base, ['vote-passed', 'completed']), ['complete', 'complete', 'complete']);
assert.deepEqual(detailStageStates(base, ['vote-passed', 'ended']), ['complete', 'complete', 'ended']);
assert.deepEqual(detailStageStates({ ...base, executionComplete: false }, ['vote-passed']), ['complete', 'complete', 'upcoming']);
const updates = [{ url: 'old', date: '2026-09-01' }, { url: 'unknown' }, { url: 'new', date: '2026-10-02' }];
assert.deepEqual(sortDetailUpdates(updates).map((update) => update.url), ['new', 'old', 'unknown']);
assert.equal(updates[0].url, 'old', 'Sorting must not mutate source evidence');
assert.equal(updateMatchesFilter('weekly', 'major'), false);
assert.equal(updateMatchesFilter('milestone', 'major'), true);
assert.equal(updateMatchesFilter('general', 'major', 'Funds were refunded'), true);
assert.equal(updateMatchesFilter('milestone', 'completion'), false, 'A milestone completion is not whole-project completion');
assert.equal(updateMonthKey('2026-09-30T18:00:00Z'), '2026-10');
assert.equal(updateMonthKey('invalid'), 'unknown');
assert.equal(localizedSourceLabel('List of funded proposals', '', 'zh'), '已资助提案清单');
assert.equal(localizedSourceLabel('CKBoost product delivery report', '', 'zh'), '交付或完成记录');
assert.equal(proposalUnavailableReason(404), 'not-found');
assert.equal(proposalUnavailableReason(429), 'unavailable');
assert.equal(proposalUnavailableReason(503), 'unavailable');
assert.equal(validProposalId('10015'), true);
assert.equal(validProposalId('../10015'), false);
assert.equal(validProposalId(null), false);
assert.equal(validProposalId('0'), false);
for (const [title, milestone] of [
  ['Milestone 1 completed: repository and verification guide published', '1'],
  ['Milestone 2 completed: the code repository and verification guide were published.', '2'],
  ['里程碑 3 已完成：Proof of Buying 代码、检验指南和完整设计文档已发布', '3'],
]) {
  assert.deepEqual(detailUpdateCategory({ title }, { kind: 'general' }), { kind: 'milestone', milestone, completion: true });
}
assert.deepEqual(detailUpdateCategory({ title: 'Development report', titleZh: '里程碑 2 已完成：代码仓库与检验指南已发布' }, { kind: 'progress' }), { kind: 'milestone', milestone: '2', completion: true });
for (const title of ['Milestone 1 updated to include a revised scope', 'Milestone 1 is not complete', 'Weekly update · Milestone 1: Three checkpoints completed; final evidence remained', 'We plan to finish Milestone 1 next month', '里程碑1现已更新，加入新的要求']) {
  assert.deepEqual(detailUpdateCategory({ title }, { kind: 'general' }), { kind: 'general' }, `Do not promote a passing mention into a milestone report: ${title}`);
}
const oldCache = { titleEn: 'Old manual title', budgetLabel: '$150', overview: { objective: 'old', milestones: [] }, updates: [{ url: 'recent', title: 'Latest real weekly report' }] };
const review = { titleEn: 'New reviewed title', budgetLabel: '$2,500', overview: { objective: 'new', milestones: [{ title: 'Reviewed milestone' }] }, updates: [{ url: 'report', title: 'Reviewed delivery report' }] };
const restored = reviewedDetailCache(oldCache, review);
assert.equal(restored.titleEn, 'New reviewed title');
assert.equal(restored.budgetLabel, '$2,500');
assert.equal(restored.overview, review.overview);
assert.deepEqual(restored.updates.map((update) => update.url), ['recent', 'report'], 'Keep recent source updates while giving reviewed entries priority');
assert.equal(oldCache.titleEn, 'Old manual title', 'Do not mutate cached evidence');
assert.equal(reviewedDetailCache(oldCache), oldCache);
console.log('Validated detail stages, evidence ordering, filtering, localization, and safe error distinctions.');
