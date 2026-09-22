import assert from 'node:assert/strict';
import {
  classifyProgressUpdate,
  isMeaningfulProgressUpdate,
  isRecentTopic,
  progressUpdateCategoryLabel,
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

const weeklyExample = '周报 2026.9.21 讨论并增加 proof of buy 中的 L1 抗审查攻击方案';
const milestoneExample = 'Pocket Node for iOS: Milestone 1 completion report Milestone 1 of the iOS grant is complete.';
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate(weeklyExample), 'zh'), '发布了周报');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate(weeklyExample), 'en'), 'Published a weekly update.');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate(milestoneExample), 'zh'), '发布了里程碑1的报告');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate(milestoneExample), 'en'), 'Published Milestone 1 completion report');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate('Biweekly report'), 'zh'), '发布了双周报');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate('Q3 quarterly report'), 'en'), 'Published a quarterly update.');
assert.equal(progressUpdateCategoryLabel(classifyProgressUpdate('Project completion report'), 'zh'), '发布了结项报告');

console.log('Validated daily digest activity classification.');
