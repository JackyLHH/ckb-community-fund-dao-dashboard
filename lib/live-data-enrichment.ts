import type { Proposal, ProposalOverview } from './proposals.ts';

type LiveTopicFields = Pick<Proposal, 'author' | 'budgetLabel' | 'updatedAt'>;

// Live fields are merged independently. A reviewed or previously stored
// overview is immutable here; parsing may only fill a genuinely missing one.
export function mergeLiveTopicEnrichment(
  proposal: Proposal,
  liveFields: LiveTopicFields,
  parsedOverview?: ProposalOverview,
): Proposal {
  if (proposal.overview?.objective?.trim() || !parsedOverview) {
    return { ...proposal, ...liveFields };
  }
  const objective = parsedOverview.objective.trim();
  return {
    ...proposal,
    ...liveFields,
    summary: objective || proposal.summary,
    overview: parsedOverview,
  };
}
