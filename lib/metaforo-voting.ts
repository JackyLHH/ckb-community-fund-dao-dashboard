import type { ProposalVoting } from './proposals';

export function sourceProposalId(content: string) {
  const links = [...content.matchAll(/https:\/\/talk\.nervos\.org\/t\/(?:([^\s/"<>]+)\/)?(\d+)(?:\/\d+)?/g)];
  const discussions = links.filter((match) => /^dis-/i.test(match[1] || ''));
  const ids = [...new Set((discussions.length ? discussions : links).map((match) => match[2]))];
  return ids.length === 1 ? ids[0] : null;
}

// Parse the rendered quorum card, not the proposal body (which may mention
// unrelated amounts). This public UI is the authoritative Metaforo result.
export function parseMetaforoVoteCard(text: string, url: string, now = new Date()): ProposalVoting {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const total = normalized.match(/Total Votes:\s*([\d,]+)/i)?.[1];
  const quorum = normalized.match(/quorum\s*([\d,]+)\s*\/\s*([\d,]+)\s*Minimum number of votes/i);
  const approval = normalized.match(/([\d.]+)%\s*\/\s*([\d.]+)%\s*Votes required to pass/i);
  const closed = /Voting Closed/i.test(normalized);
  if (!total || !quorum || !approval) throw new Error('Metaforo quorum card is incomplete');
  const totalVotes = Number(total.replaceAll(',', ''));
  const quorumTotal = Number(quorum[1].replaceAll(',', ''));
  const minimumVotes = Number(quorum[2].replaceAll(',', ''));
  const yesPercent = Number(approval[1]);
  const passPercent = Number(approval[2]);
  if (totalVotes !== quorumTotal || !Number.isSafeInteger(totalVotes)
    || !Number.isSafeInteger(minimumVotes) || minimumVotes < 0
    || yesPercent < 0 || yesPercent > 100 || passPercent <= 0 || passPercent > 100) {
    throw new Error('Metaforo quorum values are inconsistent');
  }
  const passed = totalVotes >= minimumVotes && yesPercent >= passPercent;
  // "approved!" also appears before a poll closes; only closure makes it final.
  return {
    url, totalVotes, minimumVotes, yesPercent, passPercent, closed,
    status: closed ? (passed ? 'approved' : 'rejected') : 'active',
    verifiedAt: now.toISOString(),
  };
}

export function resolveVoteLifecycle(vote: ProposalVoting | null, now = Date.now()): ProposalVoting | null {
  if (!vote) return null;
  if (vote.status !== 'active') return vote;
  const closesAt = vote.closesAt ? Date.parse(vote.closesAt) : NaN;
  const checkedAt = vote.verifiedAt ? Date.parse(vote.verifiedAt) : NaN;
  if ((Number.isFinite(closesAt) && now >= closesAt)
    || (Number.isFinite(checkedAt) && now - checkedAt > 2 * 60 * 60 * 1000)) {
    // An old provisional tally cannot establish a final result. The scheduled
    // sync must observe the closed card before we publish passed/rejected.
    return { ...vote, status: 'unknown', closed: Number.isFinite(closesAt) && now >= closesAt };
  }
  return { ...vote, closed: false };
}
