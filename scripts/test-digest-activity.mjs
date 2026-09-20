import assert from 'node:assert/strict';
import {
  isMeaningfulProgressUpdate,
  isRecentTopic,
  progressUpdatePosts,
  topicChanged,
} from '../lib/digest-activity.ts';

const now = Date.parse('2026-09-20T08:00:00.000Z');
const topic = {
  id: 10015,
  posts_count: 44,
  created_at: '2026-02-28T04:17:08.724Z',
  last_posted_at: '2026-09-13T07:45:14.665Z',
};
const equivalentState = {
  topic_id: 10015,
  posts_count: 44,
  last_posted_at: '2026-09-13T07:45:14.665+00:00',
};

assert.equal(topicChanged(topic, equivalentState), false, 'Equivalent ISO timestamps must not count as activity');
assert.equal(isRecentTopic(topic, now - 86_400_000), false, 'Historical topics must not be treated as new proposals');

const posts = [
  { post_number: 1, username: 'proposer', created_at: '2026-01-01T00:00:00Z', cooked: '<p>Proposal</p>' },
  { post_number: 2, username: 'community-member', created_at: '2026-09-20T07:00:00Z', cooked: '<h2>Weekly update</h2><p>Looks good.</p>' },
  { post_number: 3, username: 'proposer', created_at: '2026-09-20T07:10:00Z', cooked: '<p>Thanks for the feedback.</p>' },
  { post_number: 4, username: 'proposer', created_at: '2026-09-20T07:20:00Z', cooked: '<h2>Weekly update</h2><p>We completed the testnet release.</p>' },
];
const previous = { topic_id: 10015, posts_count: 1, last_posted_at: '2026-09-19T08:00:00Z' };

assert.deepEqual(
  progressUpdatePosts(posts, previous, now - 86_400_000).map((post) => post.post_number),
  [4],
  'Only a recent, meaningful update from the original proposer should qualify',
);
assert.equal(isMeaningfulProgressUpdate(posts[3].cooked), true);
assert.equal(isMeaningfulProgressUpdate('<h2>Biweekly updates</h2><p>Testnet release completed.</p>'), true);
assert.equal(isMeaningfulProgressUpdate('<p>Thanks for the feedback.</p>'), false);

console.log('Validated daily digest activity classification.');
