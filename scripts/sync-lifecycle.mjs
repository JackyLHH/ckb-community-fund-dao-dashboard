import { readFile, writeFile } from 'node:fs/promises';
import { discussionDeadline, readDiscussionEvidence, voteLifecycleEvents } from '../lib/digest-lifecycle.ts';
import { looksLikeProposal } from '../lib/proposal-title.js';

const output = new URL('../data/lifecycle.generated.json', import.meta.url);
const snapshot = JSON.parse(await readFile(output, 'utf8'));
const original = JSON.stringify(snapshot);
const now = Date.now();
snapshot.enabledAt ||= new Date(now).toISOString();
const enabled = Date.parse(snapshot.enabledAt);
const existing = new Set(snapshot.events.map((event) => event.id));
const append = (event) => {
  if (existing.has(event.id)) return;
  snapshot.events.push(event); existing.add(event.id);
  console.log(`Observed ${event.kind} for proposal ${event.topicId}`);
};
let failures = 0;
const domain = 'https://talk.nervos.org';
async function get(path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${domain}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 3_000)); continue;
    }
    if (!response.ok) throw new Error(`Forum ${response.status} for ${path.split('?')[0]}`);
    return response.json();
  }
}

// A poll transition must not depend on someone replying to its forum topic.
const votes = JSON.parse(await readFile(new URL('../data/votes.generated.json', import.meta.url), 'utf8'));
for (const [id, vote] of Object.entries(votes.votes)) {
  voteLifecycleEvents(Number(id), vote, snapshot.enabledAt).forEach(append);
}

const topics = new Map();
try {
  for (let page = 0; page < 30; page += 1) {
    const data = await get(`/c/daos-funding/ckb-community-fund-dao/65/l/latest.json?page=${page}`);
    const items = data.topic_list?.topics;
    if (!Array.isArray(items)) throw new Error('Incomplete forum directory');
    for (const topic of items) {
      if (looksLikeProposal(topic.title) && discussionDeadline(topic.created_at) >= enabled) topics.set(topic.id, topic);
    }
    if (!data.topic_list.more_topics_url || !items.length) break;
  }
  for (const topic of topics.values()) {
    const id = String(topic.id);
    const eventId = `discussion-ended:${id}`;
    if (existing.has(eventId)) continue;
    try {
      const evidence = await readDiscussionEvidence(topic, snapshot.discussions[id], get, now);
      snapshot.discussions[id] = { postId: evidence.postId, timestamps: evidence.timestamps, seenBeforeDeadline: evidence.seenBeforeDeadline };
      if (evidence.likes === null) continue;
      const likes = evidence.likes;
      append({ id: eventId, kind: 'discussion-ended', topicId: topic.id, likes,
        occurredAt: new Date(discussionDeadline(topic.created_at)).toISOString(),
        sourceUrl: `${domain}/t/${topic.slug}/${topic.id}/1` });
      delete snapshot.discussions[id];
    } catch (error) { failures += 1; console.error(`Proposal ${id}: ${error.message}`); }
  }
} catch (error) { failures += 1; console.error(error.message); }
snapshot.events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
if (JSON.stringify(snapshot) !== original) {
  snapshot.checkedAt = new Date().toISOString();
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
}
if (failures) process.exitCode = 1;
