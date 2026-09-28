import assert from 'node:assert/strict';
import { mergeLiveTopicEnrichment } from '../lib/live-data-enrichment.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const reviewedOverview = proposalOverridesById['10739'].overview;
const proposal = {
    id: '10739',
    title: 'RIVET',
    slug: 'rivet',
    originalTitle: '[DIS] RIVET',
    summary: reviewedOverview.objective,
    author: 'rivet-team',
    originalUrl: 'https://talk.nervos.org/t/10739',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    projectType: 'Infrastructure',
    budgetLabel: null,
    discussion: { likes: 0, replies: 0, views: 0 },
    voting: null,
    funded: false,
    fundingNote: null,
    updates: [],
    status: 'discussion',
    statusTags: ['discussion'],
    statusReason: '',
    overview: reviewedOverview,
    lastVerifiedAt: new Date().toISOString(),
    sources: [],
};
const enriched = mergeLiveTopicEnrichment(
  proposal,
  { author: 'rivet-team', budgetLabel: '$5,000', updatedAt: '2026-09-28T13:27:33.949Z' },
  {
    objective: 'A raw forum extract that must not replace reviewed content.',
    milestones: [{ title: 'Milestone 1', description: 'Raw milestone.', budget: '$150 CKB' }],
  },
);
assert.equal(enriched.overview, reviewedOverview, 'Reviewed overview must remain intact');
assert.equal(enriched.overview.milestones.length, 2);
assert.equal(enriched.overview.milestones[0].budget, '$2,500');
assert.equal(enriched.budgetLabel, '$5,000');

console.log('Validated field-level live enrichment preserves reviewed proposal content.');
