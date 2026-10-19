import assert from 'node:assert/strict';
import { extractProgressUpdateTitle, isManualProposalUpdate, selectForumProgressUpdates } from '../lib/proposal-update-title.ts';

const fixtures = [
  ['<h2>Vellum Milestone 1 delivery report</h2><p>Milestone 1 is now complete. This post lists all acceptance criteria and evidence.</p>', 'Vellum Milestone 1 delivery report'],
  ['<p><strong>Vellum Milestone 1 delivery report</strong></p><p>Milestone 1 is complete and tagged.</p>', 'Vellum Milestone 1 delivery report'],
  ['<p><b>Pocket Node for iOS: Milestone 1 completion report</b><br>Milestone 1 of the iOS grant is complete and tagged.</p>', 'Pocket Node for iOS: Milestone 1 completion report'],
  ['<p><strong>Weekly update: Invisibook</strong> We continue working on the MPC settlement implementation.</p>', 'Weekly update: Invisibook'],
  ['<p><strong>Weekly update</strong> We have completed integration work, and the detailed acceptance evidence follows below.</p>', 'Weekly update'],
  ['<p><strong>Milestone 1:</strong> Production isolation and recovery report</p><p>We have completed the required production safeguards.</p>', 'Milestone 1: Production isolation and recovery report'],
  ['<p><strong>里程碑 1：</strong>生产隔离与恢复报告</p><p>我们已完成对应的交付内容。</p>', '里程碑 1：生产隔离与恢复报告'],
  ['<h2>Pocket Node <code>v1.0.3</code> release notes</h2><p>We have shipped compatibility fixes.</p>', 'Pocket Node v1.0.3 release notes'],
  ['<p>Pocket Node <code>v1.0.3</code> release notes</p><p>We have shipped compatibility fixes.</p>', 'Pocket Node v1.0.3 release notes'],
  ['<p><strong>Pocket Node <code>v1.0.3</code> release notes</strong></p><p>We have shipped compatibility fixes.</p>', 'Pocket Node v1.0.3 release notes'],
  ['<p><code>v1.0.3</code> release notes</p><p><code>npm run verify</code></p>', 'v1.0.3 release notes'],
  ['<p>Weekly update — 2026.09.21</p><p>Continue developing Proof of Buying.</p>', 'Weekly update — 2026.09.21'],
  ['<p>FiberLatch Access — Weeks 1–2 Progress Update</p><p>The core implementation is now ready.</p><aside class="onebox"><h3>GitHub - project/source</h3></aside>', 'FiberLatch Access — Weeks 1–2 Progress Update'],
  ['<p>FiberLatch Access — Weeks 3–4 Progress Update</p><p>Development continues.</p><h2>Acceptance criteria</h2>', 'FiberLatch Access — Weeks 3–4 Progress Update'],
  ['<p>Hi everyone,</p><h2>Vellum Milestone 1 delivery report</h2><p>We have completed the work.</p>', 'Vellum Milestone 1 delivery report'],
  ['<p>大家好！👋</p><p><strong>里程碑 2 交付报告</strong></p><p>以下是本次交付内容。</p>', '里程碑 2 交付报告'],
  ['<p>Hello CKB community 👋<br>Weekly update — October 2026</p><p>We have shipped the core implementation.</p>', 'Weekly update — October 2026'],
  ['Hi everyone,\n\n# Release v1.2.3\n\nWe have shipped the compatibility update.', 'Release v1.2.3'],
  ['Week 6 — Browser integration\n\nThe code is ready for testing.', 'Week 6 — Browser integration'],
  ['第 3 周：支付集成进展\n\n本周完成测试网集成。', '第 3 周：支付集成进展'],
  ['<p>周报 2026.9.21<br>讨论并增加 Proof of Buy 中的 L1 抗审查攻击方案。</p>', '周报 2026.9.21'],
  ['<h3>里程碑 1 交付报告</h3><p>里程碑 1 已完成，代码已开源。</p>', '里程碑 1 交付报告'],
  ['<div><p><strong>维护更新：Pocket Node Android</strong></p></div><p>完成兼容性修复。</p>', '维护更新：Pocket Node Android'],
  ['# Quarterly report — Q3 2026\n\nThe team completed the following work.', 'Quarterly report — Q3 2026'],
  ['**Biweekly update — September 21**\n\nWe shipped the new testnet.', 'Biweekly update — September 21'],
  ['Public testnet is live\n=====================\n\nWe shipped the new testnet.', 'Public testnet is live'],
  ['Monthly update: September 2026\nThe public testnet is ready.', 'Monthly update: September 2026'],
  ['> Weekly update from an earlier post\n\n# Annual report 2026\nNew work follows.', 'Annual report 2026'],
  ['<blockquote><h2>Old weekly update</h2></blockquote><h2>Current monthly report</h2><p>Current work.</p>', 'Current monthly report'],
  ['<aside class="quote"><blockquote><p>Old milestone report</p></blockquote></aside><p><strong>Current maintenance update</strong></p>', 'Current maintenance update'],
  ['<script>const text = "<h2>Fake report</h2>";</script><style>body{color:red}</style><pre><code>Weekly fake update</code></pre><h2>Public testnet release</h2><p>Body.</p>', 'Public testnet release'],
  ['<!-- previous update --><h1 id="a" data-condition="a > b">FNN &amp; Fiber &#x2014; &#85;pgrade &#8211; report&nbsp;2026</h1><p>More information.</p>', 'FNN & Fiber — Upgrade – report 2026'],
  ['<h2><a class="anchor" href="#report"></a><em>Vellum</em> Milestone <strong>1</strong> delivery report</h2><p>Details.</p>', 'Vellum Milestone 1 delivery report'],
  ['<h2>Weekly report<p>Malformed paragraph must not join the title.</p>', 'Weekly report'],
];
for (const [source, title] of fixtures) assert.equal(extractProgressUpdateTitle(source), title, source);

const completeHeading = `Progress update — ${'the complete descriptive report title '.repeat(12).trim()}`;
assert.equal(extractProgressUpdateTitle(`<h2>${completeHeading}</h2><p>Details follow.</p>`), completeHeading, 'An explicit title is preserved whole, without arbitrary word truncation');

const negativeFixtures = [
  '<p>We have completed the core implementation this week.</p><h2>Acceptance criteria</h2><p>All tests passed.</p>',
  '<p>This update summarizes ongoing development of the project.</p><h2>Milestone 2 completion report</h2><p>This later heading is not the post title.</p>',
  '<h2>Acceptance criteria</h2><p>The app builds and runs.</p>',
  '<h2>Acceptance criteria, as written in the proposal</h2><p>The app builds and runs.</p>',
  '<p><strong>Scope of work</strong></p><p>Integration work continues.</p>',
  '<p>Milestone 1 of the iOS grant is complete and tagged as ios-m1.</p><h3>What shipped</h3>',
  '<p>里程碑1现已更新，加入了新的范围要求。</p><h2>后续计划</h2>',
  '<p>我们已发布了周报，请在下面的链接中阅读详细内容。</p>',
  '<p>We continue working on the report and will publish it later this month.</p>',
  '<p><strong>1. Roadmap &amp; milestones</strong></p><p>Milestone 2 is planned for next month.</p>',
  '<p><strong>Budget:</strong> Monthly update costs remain unchanged.</p><h2>Report</h2>',
  '<p>Hi everyone,</p><h2>Acceptance criteria</h2><p>We have completed the delivery.</p>',
  '<p>大家好！</p><h2>工作范围</h2><p>本次仅修改工作范围。</p>',
  '<p>Hi everyone, we have completed the integration this week.</p><h2>Scope</h2><p>More details.</p>',
  'Hi everyone,\n\nWe have completed the implementation.\n\n# Acceptance criteria\n\nTests passed.',
];
for (const source of negativeFixtures) {
  assert.equal(extractProgressUpdateTitle(source, 'Existing source excerpt'), 'Existing source excerpt', `Do not invent a report title: ${source}`);
}

assert.equal(extractProgressUpdateTitle('<p>Short progress excerpt without a title.</p>'), 'Short progress excerpt without a title.');
assert.equal(extractProgressUpdateTitle('<p>Body</p>', 'x'.repeat(260)), `${'x'.repeat(240)}…`, 'The previous 240-character fallback remains unchanged');
assert.equal(extractProgressUpdateTitle('<p>正文</p>', '中'.repeat(260)), `${'中'.repeat(240)}…`, 'Chinese excerpt limits are unchanged');
assert.equal(extractProgressUpdateTitle('<blockquote><h2>Quoted update</h2>'), '', 'An unclosed quote cannot leak into the title or fallback');
assert.equal(extractProgressUpdateTitle('> An earlier weekly update\n\n```\nFake update code\n```\n\nA source excerpt without a title.'), 'A source excerpt without a title.', 'Markdown quotes and fenced code are excluded from fallback text too');
assert.equal(extractProgressUpdateTitle('<pre><code>Weekly report</code></pre><p>A plain source update.</p>'), 'A plain source update.');
assert.equal(extractProgressUpdateTitle('<code>Weekly report</code><p>A plain source update.</p>'), 'A plain source update.', 'Standalone code is excluded, unlike inline versions within real titles');
assert.equal(extractProgressUpdateTitle('<p><code>Weekly report</code></p><p>A plain source update.</p>'), 'A plain source update.', 'A code-only paragraph is not a report title');
assert.equal(extractProgressUpdateTitle('<h2>Report &#x1F44B; &#99999999; &quot;Fiber&quot;</h2>'), 'Report 👋 � "Fiber"', 'Malformed entities cannot throw');
assert.equal(extractProgressUpdateTitle(''), '');

const forumPosts = [
  { post_number: 1, username: 'Proposer', cooked: '<h2>Original proposal</h2><p>Weekly report planned.</p>' },
  { post_number: 2, username: 'Proposer', cooked: '<h2>Release v1.2.3</h2><p>We have shipped compatibility fixes and published source code.</p>', created_at: '2026-10-02T08:00:00Z' },
  { post_number: 3, username: 'OtherMember', cooked: '<h2>Weekly update</h2><p>We have completed the work.</p>' },
  { post_number: 4, username: 'Proposer', cooked: '<blockquote><h2>Weekly update</h2><p>We have completed the work.</p></blockquote>' },
  { post_number: 5, username: 'Proposer', cooked: '<p>Thank you for reading the weekly update!</p>' },
  { post_number: 6, username: 'Proposer', cooked: '<p>Thanks for the feedback on our milestone report.</p>' },
  { post_number: 7, username: 'Proposer', cooked: '<pre><code>We have shipped the weekly update.</code></pre>' },
  { post_number: 9, username: 'Proposer', cooked: '<code>We have shipped the weekly update.</code>' },
  { post_number: 10, username: 'Proposer', cooked: '<p><code>We have shipped the weekly update.</code></p>' },
  { post_number: 8, username: ' Proposer ', cooked: '<h2>Release v1.2.4</h2><p>We have shipped the next compatibility fix.</p>' },
  ...Array.from({ length: 9 }, (_, index) => ({ post_number: 20 + index, username: 'proposer', cooked: `<h2>Weekly update ${index + 1}</h2><p>We have completed implementation step ${index + 1}.</p>` })),
];
const selectedUpdates = selectForumProgressUpdates(forumPosts, 'PROPOSER', '10613', 'dis-vellum');
assert.equal(selectedUpdates.length, 11, 'Retain every verified report, including more than six reports');
assert.equal(selectedUpdates[0].title, 'Release v1.2.3', 'Classify the complete source before extracting its concise title');
assert.equal(selectedUpdates[0].date, '2026-10-02T08:00:00Z');
assert.equal(selectedUpdates[0].url, 'https://talk.nervos.org/t/dis-vellum/10613/2');
assert.deepEqual(selectedUpdates.map((update) => Number(update.url.split('/').at(-1))), [2, 8, 20, 21, 22, 23, 24, 25, 26, 27, 28], 'Exclude the initial post, community replies, quotes, code, and ordinary thank-you replies');
assert.ok(selectedUpdates.every((update) => update.source === 'forum'), 'Every selected source update retains forum provenance');
assert.equal(forumPosts[0].post_number, 1, 'Source post ordering is not mutated');

assert.equal(isManualProposalUpdate('7069', { url: 'https://example.com/update', source: 'manual' }), true);
assert.equal(isManualProposalUpdate('7069', { url: 'https://example.com/update', source: 'forum' }), false);
assert.equal(isManualProposalUpdate('unknown', { url: 'not a valid URL' }), false);
// 7069 has a reviewed governance note; query parameters must not hide its provenance.
const { proposalOverridesById } = await import('../lib/proposal-overrides.ts');
for (const [id, override] of Object.entries(proposalOverridesById)) {
  for (const update of override.updates ?? []) {
    const separator = update.url.includes('?') ? '&' : '?';
    assert.equal(isManualProposalUpdate(id, { url: `${update.url}${separator}u=reader#latest` }), true, `Manual update remains full text: ${id} ${update.url}`);
    const cleanUrl = new URL(update.url);
    assert.equal(isManualProposalUpdate(id, { url: `${cleanUrl.origin}${cleanUrl.pathname.replace(/\/+$/, '')}/` }), true);
  }
}

console.log('Validated bilingual report-title extraction, safe excerpt fallback, and manual update provenance.');
