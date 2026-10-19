import type { ProposalStatusTag } from './proposals';

// Voting approval starts execution; payment-list publication can lag behind it.
// Reviewed completion/termination evidence always prevents automatic reactivation.
export function executionStatusTags(tags: ProposalStatusTag[], approved = false): ProposalStatusTag[] {
  if (tags.includes('completed') || tags.includes('ended')) {
    return tags.filter((tag) => tag !== 'executing' && tag !== 'voting');
  }
  if (approved || tags.includes('vote-passed')) return ['vote-passed', 'executing'];
  return tags;
}
