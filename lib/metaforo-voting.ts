import type { ProposalVoting } from './proposals';

function closingTimeFromCountdown(text: string, observedAt: Date) {
  const countdown = text.match(/\bVoting ends in\s+((?:\d+\s*(?:days?|hours?|minutes?|seconds?)[,\s]*)+)/i)?.[1];
  if (!countdown) return undefined;
  const units: Record<string, number> = { day: 86_400_000, hour: 3_600_000, minute: 60_000, second: 1_000 };
  let remaining = 0;
  let precision = Infinity;
  for (const match of countdown.matchAll(/(\d+)\s*(day|hour|minute|second)s?/gi)) {
    const unit = units[match[2].toLowerCase()];
    remaining += Number(match[1]) * unit;
    precision = Math.min(precision, unit);
  }
  // The UI rounds away the smallest displayed unit. Keep that unit as a
  // safety margin rather than declaring a poll closed up to a minute early.
  const deadline = observedAt.getTime() + remaining + precision;
  return Number.isSafeInteger(deadline) && Number.isFinite(new Date(deadline).getTime())
    ? new Date(deadline).toISOString()
    : undefined;
}

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
  const closesAt = closed ? undefined : closingTimeFromCountdown(normalized, now);
  // "approved!" also appears before a poll closes; only closure makes it final.
  return {
    url, totalVotes, minimumVotes, yesPercent, passPercent, closed,
    status: closed ? (passed ? 'approved' : 'rejected') : 'active',
    verifiedAt: now.toISOString(),
    ...(closesAt ? { closesAt } : {}),
  };
}

export function resolveVoteLifecycle(vote: ProposalVoting | null, now = Date.now()): ProposalVoting | null {
  if (!vote) return null;
  if (vote.status !== 'active') return vote;
  const closesAt = vote.closesAt ? Date.parse(vote.closesAt) : NaN;
  const checkedAt = vote.verifiedAt ? Date.parse(vote.verifiedAt) : NaN;
  if (Number.isFinite(closesAt)) {
    // Snapshot freshness is not the voting lifecycle. A delayed sync must not
    // erase an observed open vote while its source-backed deadline is ahead.
    return now < closesAt ? { ...vote, closed: false } : { ...vote, status: 'unknown', closed: true };
  }
  if (!Number.isFinite(checkedAt) || now - checkedAt > 2 * 60 * 60 * 1000) {
    // An old provisional tally cannot establish a final result. The scheduled
    // sync must observe the closed card before we publish passed/rejected.
    return { ...vote, status: 'unknown', closed: false };
  }
  return { ...vote, closed: false };
}

// CDN propagation can lag behind the deployed bundle. Merge observations by
// their verification time, not request order, so old responses cannot undo a
// newer verified result or erase a previously captured closing deadline.
export function mergeVoteSnapshots(current: Record<string, ProposalVoting>, incoming: Record<string, ProposalVoting>) {
  const merged = { ...current };
  for (const [id, candidate] of Object.entries(incoming)) {
    const previous = current[id];
    if (!previous) { merged[id] = candidate; continue; }
    const previousTime = Date.parse(previous.verifiedAt ?? '');
    const candidateTime = Date.parse(candidate.verifiedAt ?? '');
    if (Number.isFinite(previousTime) && (!Number.isFinite(candidateTime) || candidateTime < previousTime)) continue;
    if (candidateTime === previousTime && previous.closed && !candidate.closed) continue;
    merged[id] = candidate.status === 'active' && candidate.url === previous.url
      && !Number.isFinite(Date.parse(candidate.closesAt ?? '')) && Number.isFinite(Date.parse(previous.closesAt ?? ''))
      ? { ...candidate, closesAt: previous.closesAt }
      : candidate;
  }
  return merged;
}
