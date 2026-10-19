export const DISCUSSION_PERIOD_MS = 7 * 24 * 60 * 60 * 1_000;

export type LifecycleEvent = {
  id: string;
  topicId: number;
  occurredAt: string;
  sourceUrl: string;
} & (
  | { kind: 'discussion-ended'; likes: number }
  | { kind: 'vote-started' }
  | { kind: 'vote-ended'; totalVotes: number; yesPercent: number; approved: boolean }
);

export type LifecycleSnapshot = {
  version: 1;
  enabledAt: string | null;
  checkedAt: string | null;
  events: LifecycleEvent[];
  discussions: Record<string, { postId: number; timestamps: Record<string, string>; seenBeforeDeadline?: string[] }>;
};

export function discussionDeadline(createdAt: string) {
  return Date.parse(createdAt) + DISCUSSION_PERIOD_MS;
}

// Discourse's post_action_users list is ordered by action creation time. Its
// reactions endpoint includes timestamps but truncates long lists. A missing
// timestamp can only be inferred when a known later like precedes the cutoff,
// or a known earlier like follows it. Never substitute today's total likes.
export function discussionLikeCount(
  orderedUsers: string[],
  timestamps: Record<string, string>,
  createdAt: string,
  expectedCount: number,
  seenBeforeDeadline: string[] = [],
): number | null {
  const users = orderedUsers.map((user) => user.toLowerCase());
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0
    || new Set(users).size !== expectedCount || users.length !== expectedCount) return null;
  const start = Date.parse(createdAt);
  const deadline = discussionDeadline(createdAt);
  if (!Number.isFinite(start)) return null;
  const times = users.map((user) => Date.parse(timestamps[user] || ''));
  const observedInTime = new Set(seenBeforeDeadline.map((user) => user.toLowerCase()));
  let last = -Infinity;
  let ordered = true;
  for (const time of times) {
    if (!Number.isFinite(time)) continue;
    if (time < start) return null;
    if (time < last) ordered = false;
    last = time;
  }
  let count = 0;
  for (let index = 0; index < times.length; index += 1) {
    const time = times[index];
    if (Number.isFinite(time)) { if (time < deadline) count += 1; continue; }
    // An observation while the window was open proves this like already existed,
    // without needing access to that voter's potentially private profile.
    if (observedInTime.has(users[index])) { count += 1; continue; }
    const later = times.slice(index + 1).find(Number.isFinite);
    const earlier = times.slice(0, index).findLast(Number.isFinite);
    if (ordered && later !== undefined && later < deadline) count += 1;
    else if (ordered && earlier !== undefined && earlier >= deadline) continue;
    else return null;
  }
  return count;
}

type ForumEvidence = {
  post_stream?: { posts?: Array<{ id: number; post_number: number;
    reactions?: Array<{ id: string; count: number }>;
    actions_summary?: Array<{ id: number; count: number }> }> };
  reaction_users?: Array<{ id: string; count: number; users?: Array<{ username: string; created_at: string }> }>;
  post_action_users?: Array<{ username: string }>;
  user_actions?: Array<{ post_id: number; post_number: number; topic_id: number; created_at: string }>;
};

export async function readDiscussionEvidence(
  topic: { id: number; created_at: string },
  saved: LifecycleSnapshot['discussions'][string] | undefined,
  get: (path: string) => Promise<ForumEvidence>,
  now = Date.now(),
) {
  const detail = await get(`/t/${topic.id}.json`);
  const post = detail.post_stream?.posts?.find((item) => item.post_number === 1);
  if (!post?.id || (!Array.isArray(post.reactions) && !Array.isArray(post.actions_summary))) throw new Error('Missing first-post like evidence');
  const count = post.reactions?.find((reaction) => reaction.id === 'heart')?.count
    ?? post.actions_summary?.find((action) => action.id === 2)?.count ?? 0;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid first-post like count');
  const timestamps: Record<string, string> = saved?.postId === post.id ? { ...saved.timestamps } : {};
  const seen = new Set(saved?.postId === post.id ? saved.seenBeforeDeadline || [] : []);
  const users: string[] = [];
  if (count) {
    const reactions = await get(`/discourse-reactions/posts/${post.id}/reactions-users.json`);
    const heart = reactions.reaction_users?.find((reaction) => reaction.id === 'heart');
    if (!heart || heart.count !== count) throw new Error('Like count changed during read; retry later');
    for (const user of heart.users || []) {
      const time = Date.parse(user.created_at);
      if (Number.isFinite(time)) timestamps[user.username.toLowerCase()] = new Date(time).toISOString();
    }
    for (let page = 0; page < 25; page += 1) {
      const data = await get(`/post_action_users.json?id=${post.id}&post_action_type_id=2&limit=200&page=${page}`);
      const batch = data.post_action_users;
      if (!Array.isArray(batch)) throw new Error('Incomplete first-post likes');
      users.push(...batch.map((user) => user.username.toLowerCase()));
      if (batch.length < 200) break;
    }
    if (users.length !== count || new Set(users).size !== count) throw new Error('Incomplete/changed like list');
  }
  if (now < discussionDeadline(topic.created_at)) users.forEach((user) => seen.add(user));
  let likes = now < discussionDeadline(topic.created_at) ? null : discussionLikeCount(users, timestamps, topic.created_at, count, [...seen]);
  if (likes === null && now >= discussionDeadline(topic.created_at)) {
    // A truncated list must be reconstructed, never replaced with today's total.
    // Private or truncated activity histories are a visible error, not evidence.
    for (const user of users.filter((username) => !timestamps[username] && !seen.has(username)).reverse()) {
      try {
        for (let offset = 0; offset < 2_000; offset += 100) {
          const data = await get(`/user_actions.json?username=${encodeURIComponent(user)}&filter=1&limit=100&offset=${offset}`);
          const actions = data.user_actions;
          if (!Array.isArray(actions)) throw new Error('Incomplete like activity history');
          const action = actions.find((item) => item.post_id === post.id && item.post_number === 1 && item.topic_id === topic.id);
          if (action && Number.isFinite(Date.parse(action.created_at))) { timestamps[user] = action.created_at; break; }
          if (actions.length < 100 || Date.parse(actions.at(-1)?.created_at || '') < Date.parse(topic.created_at)) break;
        }
      } catch {
        // Another public timestamp can still bracket a private user's action.
        // Fail closed below if the remaining evidence cannot establish a count.
      }
      likes = discussionLikeCount(users, timestamps, topic.created_at, count, [...seen]);
      if (likes !== null) break;
    }
    if (likes === null) throw new Error('Unable to verify likes within the 7-day window');
  }
  const current = new Set(users);
  return { likes, postId: post.id,
    seenBeforeDeadline: [...seen].filter((user) => current.has(user)),
    timestamps: Object.fromEntries(Object.entries(timestamps).filter(([user]) => current.has(user))) };
}

export function lifecycleLabel(event: LifecycleEvent, locale: 'zh' | 'en') {
  const en = locale === 'en';
  if (event.kind === 'discussion-ended') {
    if (event.likes < 30) return en
      ? `This proposal received ${event.likes} likes on its first post during the 7-day discussion period, below the 30-like threshold, and will not proceed to voting.`
      : `该提案在 7 天讨论期内获得了 ${event.likes} 个赞，未达到 30 个赞的门槛，将不进入投票阶段`;
    return en
      ? `This proposal received ${event.likes} likes on its first post during the 7-day discussion period and may proceed to voting after verification.`
      : `提案在 7 天讨论期内获得了 ${event.likes} 个赞，核验通过后，可进入投票阶段`;
  }
  if (event.kind === 'vote-started') return en
    ? `Voting is now open for this proposal. Whether you support or oppose it, please cast your vote. Voting page: ${event.sourceUrl}`
    : `该提案正在投票中，无论赞成与否，都请投下你的宝贵票数，投票地址：${event.sourceUrl}`;
  const total = event.totalVotes.toLocaleString('en-US');
  const percent = event.yesPercent.toFixed(2);
  return en
    ? `Voting has ended for this proposal. Total voting weight: ${total}; approval: ${percent}%; result: ${event.approved ? 'Passed' : 'Not passed'}.`
    : `该提案的投票已结束，总票数：${total}，赞成比例：${percent}%，投票结果：${event.approved ? '通过' : '未通过'}`;
}

export function lifecycleStatus(event: LifecycleEvent): Array<'voting' | 'vote-passed' | 'executing' | 'vote-failed' | 'ended'> {
  if (event.kind === 'vote-started') return ['voting'];
  if (event.kind === 'vote-ended') return event.approved ? ['vote-passed', 'executing'] : ['vote-failed', 'ended'];
  return event.likes < 30 ? ['ended'] : [];
}

export function voteLifecycleEvents(topicId: number, vote: {
  url: string; openedAt?: string; closedAt?: string; closed?: boolean;
  status: string; totalVotes?: number; yesPercent?: number;
}, enabledAt: string): LifecycleEvent[] {
  const enabled = Date.parse(enabledAt);
  if (!Number.isSafeInteger(topicId) || topicId <= 0 || !Number.isFinite(enabled)
    || !/^https:\/\/dao\.ckb\.community\/thread\/[^/?#]+-\d+$/.test(vote.url)) return [];
  // Use the immutable poll ID, not its editable title/slug.
  const poll = vote.url.match(/-(\d+)$/)![1];
  const events: LifecycleEvent[] = [];
  const openedAt = Date.parse(vote.openedAt || '');
  if (Number.isFinite(openedAt) && openedAt >= enabled) events.push({
    id: `vote-started:${topicId}:${poll}`, topicId, kind: 'vote-started',
    occurredAt: new Date(openedAt).toISOString(), sourceUrl: vote.url,
  });
  const closedAt = Date.parse(vote.closedAt || '');
  if (Number.isFinite(closedAt) && closedAt >= enabled && vote.closed === true
    && ['approved', 'rejected'].includes(vote.status)
    && Number.isSafeInteger(vote.totalVotes) && vote.totalVotes! >= 0
    && Number.isFinite(vote.yesPercent) && vote.yesPercent! >= 0 && vote.yesPercent! <= 100) events.push({
    id: `vote-ended:${topicId}:${poll}`, topicId, kind: 'vote-ended',
    occurredAt: new Date(closedAt).toISOString(), sourceUrl: vote.url,
    totalVotes: vote.totalVotes!, yesPercent: vote.yesPercent!, approved: vote.status === 'approved',
  });
  return events;
}

export function pendingLifecycleEvents(snapshot: LifecycleSnapshot, now = Date.now()) {
  const enabled = Date.parse(snapshot.enabledAt || '');
  const eligible = [...new Map(snapshot.events.filter((event) => {
    const time = Date.parse(event.occurredAt);
    // Durable events remain available after an outage; per-destination receipts
    // prevent repeats. The rollout baseline prevents historical notification floods.
    return Number.isFinite(time) && time >= enabled && time <= now;
  }).map((event) => [event.id, event])).values()];
  const pollKey = (event: LifecycleEvent) => `${event.topicId}:${event.sourceUrl.match(/-(\d+)$/)?.[1] || event.sourceUrl}`;
  const closed = new Set(eligible.filter((event) => event.kind === 'vote-ended').map(pollKey));
  // A delayed/retried digest must never invite users to vote in a closed poll.
  // Keep the complete audit log, but send only the final result in this case.
  return eligible.filter((event) => event.kind !== 'vote-started' || !closed.has(pollKey(event)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
}
