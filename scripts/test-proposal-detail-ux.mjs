import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { detailStageStates, detailUpdateCategory, localizedSourceLabel, proposalUnavailableReason, reviewedDetailCache, sortDetailUpdates, updateMatchesFilter, updateMonthKey, validProposalId } from '../lib/proposal-detail-ux.ts';

const base = { voting: null, funded: false };
assert.deepEqual(detailStageStates(base, ['discussion']), ['current', 'upcoming', 'upcoming']);
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'unknown' } }, ['discussion']), ['current', 'upcoming', 'upcoming'], 'A discovered link is not a completed vote');
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'active' } }, ['voting']), ['complete', 'current', 'upcoming']);
assert.deepEqual(detailStageStates({ ...base, voting: { status: 'approved' } }, ['vote-passed', 'executing']), ['complete', 'complete', 'current'], 'In progress is not completed');
assert.deepEqual(detailStageStates(base, ['vote-passed', 'completed']), ['complete', 'complete', 'complete']);
assert.deepEqual(detailStageStates(base, ['vote-passed', 'ended']), ['complete', 'complete', 'ended']);
assert.deepEqual(detailStageStates({ ...base, executionComplete: false }, ['vote-passed']), ['complete', 'complete', 'upcoming']);
const updates = [{ url: 'old', date: '2026-09-01' }, { url: 'unknown' }, { url: 'new', date: '2026-10-02' }];
assert.deepEqual(sortDetailUpdates(updates).map((update) => update.url), ['new', 'old', 'unknown']);
assert.equal(updates[0].url, 'old', 'Sorting must not mutate source evidence');
assert.equal(updateMatchesFilter('weekly', 'major'), false);
assert.equal(updateMatchesFilter('milestone', 'major'), true);
assert.equal(updateMatchesFilter('general', 'major', 'Funds were refunded'), true);
assert.equal(updateMatchesFilter('milestone', 'completion'), false, 'A milestone completion is not whole-project completion');
assert.equal(updateMonthKey('2026-09-30T18:00:00Z'), '2026-10');
assert.equal(updateMonthKey('invalid'), 'unknown');
assert.equal(localizedSourceLabel('List of funded proposals', '', 'zh'), '已资助提案清单');
assert.equal(localizedSourceLabel('CKBoost product delivery report', '', 'zh'), '交付或完成记录');
assert.equal(proposalUnavailableReason(404), 'not-found');
assert.equal(proposalUnavailableReason(429), 'unavailable');
assert.equal(proposalUnavailableReason(503), 'unavailable');
assert.equal(validProposalId('10015'), true);
assert.equal(validProposalId('../10015'), false);
assert.equal(validProposalId(null), false);
assert.equal(validProposalId('0'), false);
for (const [title, milestone] of [
  ['Milestone 1 completed: repository and verification guide published', '1'],
  ['Milestone 2 completed: the code repository and verification guide were published.', '2'],
  ['里程碑 3 已完成：Proof of Buying 代码、检验指南和完整设计文档已发布', '3'],
]) {
  assert.deepEqual(detailUpdateCategory({ title }, { kind: 'general' }), { kind: 'milestone', milestone, completion: true });
}
assert.deepEqual(detailUpdateCategory({ title: 'Development report', titleZh: '里程碑 2 已完成：代码仓库与检验指南已发布' }, { kind: 'progress' }), { kind: 'milestone', milestone: '2', completion: true });
for (const title of ['Milestone 1 updated to include a revised scope', 'Milestone 1 is not complete', 'Weekly update · Milestone 1: Three checkpoints completed; final evidence remained', 'We plan to finish Milestone 1 next month', '里程碑1现已更新，加入新的要求']) {
  assert.deepEqual(detailUpdateCategory({ title }, { kind: 'general' }), { kind: 'general' }, `Do not promote a passing mention into a milestone report: ${title}`);
}
const oldCache = { titleEn: 'Old manual title', budgetLabel: '$150', overview: { objective: 'old', milestones: [] }, updates: [{ url: 'recent', title: 'Latest real weekly report' }] };
const review = { titleEn: 'New reviewed title', budgetLabel: '$2,500', overview: { objective: 'new', milestones: [{ title: 'Reviewed milestone' }] }, updates: [{ url: 'report', title: 'Reviewed delivery report' }] };
const restored = reviewedDetailCache(oldCache, review);
assert.equal(restored.titleEn, 'New reviewed title');
assert.equal(restored.budgetLabel, '$2,500');
assert.equal(restored.overview, review.overview);
assert.deepEqual(restored.updates.map((update) => update.url), ['recent', 'report'], 'Keep recent source updates while giving reviewed entries priority');
assert.equal(oldCache.titleEn, 'Old manual title', 'Do not mutate cached evidence');
assert.equal(reviewedDetailCache(oldCache), oldCache);
console.log('Validated detail stages, evidence ordering, filtering, localization, and safe error distinctions.');

// Render the actual detail component offline. Only browser/network hooks and
// unrelated page chrome are replaced; proposal normalization and vote/stage
// presentation remain the same code used by the public website.
const root = new URL('../', import.meta.url).pathname;
const bundled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { LiveProjectDetail } from './components/live-project-detail.tsx';
    import { proposals } from './lib/proposals.ts';
    export const realProposal = proposals.find((proposal) => proposal.id === '9879');
    if (!realProposal) throw new Error('The reviewed Pocket Node fixture is missing');
    export const render = (proposal = realProposal, hook = {}, props = {}) => {
      globalThis.__detailHook = { proposal, state: 'live', error: null, ...hook };
      return renderToStaticMarkup(createElement(LiveProjectDetail, {
        id: proposal?.id ?? '9879', initialProposal: proposal ?? undefined, ...props,
      }));
    };
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-proposal-detail', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'live-project', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/components\/(?:site-header|site-footer)$/ }, ({ path }) => ({ path, namespace: 'chrome' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__detailLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^live-project$/, namespace: 'fixture' }, () => ({ contents: `export function useLiveProject() { return { ...globalThis.__detailHook, retry() {} }; }` }));
    builder.onLoad({ filter: /.*/, namespace: 'chrome' }, ({ path }) => ({ contents: `export function ${path.endsWith('site-header') ? 'SiteHeader' : 'SiteFooter'}() { return null; }` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);
const realProposal = compiled.exports.realProposal;
assert.ok(realProposal.overview?.milestones.length > 0 && realProposal.updates.length > 0, 'The real fixture exercises reviewed bilingual milestones and updates');

function elementWithAttribute(html, attribute, value) {
  const condition = value === undefined ? `${attribute}(?:="[^"]*")?(?=[\\s>])` : `${attribute}="${value}"`;
  const opening = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\b${condition}[^>]*>`, 'i').exec(html);
  assert.ok(opening, `Expected ${attribute}${value === undefined ? '' : `="${value}"`}`);
  const tokens = new RegExp(`<\\/?${opening[1]}\\b[^>]*>`, 'gi');
  tokens.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  let token;
  while ((token = tokens.exec(html))) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(opening.index, tokens.lastIndex);
  }
  assert.fail(`Unclosed element with ${attribute}`);
}

function elementsWithAttribute(html, attribute) {
  return [...html.matchAll(new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\b${attribute}(?:="[^"]*")?(?=[\\s>])[^>]*>`, 'gi'))]
    .map((match) => elementWithAttribute(html.slice(match.index), attribute));
}

function textContent(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

function localized(record, field, locale) {
  return record[`${field}${locale === 'en' ? 'En' : 'Zh'}`] ?? record[field];
}

const longTitles = {
  zh: `维护更新：${'保留完整标题中的交付说明和核验信息，不能用“发布了更新”等分类文本替代。'.repeat(8)}`,
  en: `Maintenance update: ${'Keep the full delivery summary and verification information instead of replacing the title with a report-category label. '.repeat(4)}`,
};
const longUpdate = {
  title: longTitles.en, titleZh: longTitles.zh, titleEn: longTitles.en,
  date: '2026-10-19T06:53:51.132Z', author: realProposal.author,
  url: 'https://talk.nervos.org/t/pocket-node/9879/999',
};
const undatedUpdate = { title: 'Undated maintenance update', titleEn: 'Undated maintenance update', titleZh: '日期未核验的维护更新', url: 'https://talk.nervos.org/t/pocket-node/9879/998', author: realProposal.author };
const longProposal = { ...realProposal, updates: [undatedUpdate, ...realProposal.updates, longUpdate] };
const renderWarnings = [];
const previousConsoleError = console.error;
try {
  console.error = (...items) => renderWarnings.push(items.join(' '));
  for (const locale of ['zh', 'en']) {
    globalThis.__detailLocale = locale;
    for (const proposal of [realProposal, longProposal]) {
      const html = compiled.exports.render(proposal);
      const hero = elementWithAttribute(html, 'data-proposal-hero');
      const overview = elementWithAttribute(html, 'id', 'overview');
      const budget = elementWithAttribute(overview, 'data-detail-budget');
      const sidebar = elementWithAttribute(html, 'data-detail-sidebar');
      const sources = elementWithAttribute(sidebar, 'id', 'sources');
      const updatesPanel = elementWithAttribute(html, 'id', 'updates');
      const updateRows = elementsWithAttribute(updatesPanel, 'data-proposal-update');

      assert.match(hero, /ledger-grid/, 'The title uses the shared line-pattern hero background');
      assert.match(hero, /bg-\[#(?:0b0f0e|0c1715|0b1716)\]|bg-\[var\(--hero/, 'The title remains dark in either display theme');
      assert.doesNotMatch(textContent(hero), /#9879|Requested budget|申请预算|Latest proposer update|提案人最近公开更新|Copy link|复制链接/);
      assert.ok(hero.includes(`href="${escapeHtml(proposal.originalUrl)}"`), 'Original proposal action remains available');
      assert.ok(hero.includes(`href="/subscription?proposal=${proposal.id}"`), 'Proposal-specific subscription remains available');
      assert.ok(textContent(hero).includes(proposal.author), 'The proposer remains visible in the hero');
      assert.doesNotMatch(html, /<nav\b|On this page|本页导航|href="#(?:overview|milestones|governance|voting|updates|sources)"/, 'No redundant in-page navigation returns');
      assert.ok(budget.includes(escapeHtml(proposal.budgetLabel)), 'Requested budget moves into the overview unchanged');
      assert.ok(textContent(overview).includes(locale === 'en' ? 'Milestone structure' : '里程碑结构'), 'Budget and milestone structure remain in the overview');

      const milestoneHeadings = elementsWithAttribute(overview, 'data-milestone-heading');
      assert.equal(milestoneHeadings.length, proposal.overview.milestones.length);
      for (const [index, heading] of milestoneHeadings.entries()) {
        const milestone = proposal.overview.milestones[index];
        assert.match(heading, /class="[^"]*\bflex\b[^"]*"/, 'Milestone title and budget share a flex row');
        assert.ok(heading.includes(`<h3`) && heading.includes(escapeHtml(localized(milestone, 'title', locale))), 'Each reviewed localized milestone title remains intact');
        const amount = localized(milestone, 'budget', locale);
        if (amount) {
          const allocation = elementWithAttribute(heading, 'data-milestone-budget');
          assert.match(allocation, /\b(?:ml-auto|text-right)\b/, 'Allocation aligns to the right of its heading');
          assert.ok(allocation.includes(escapeHtml(amount)), 'Allocation comes from its own milestone, not another amount');
        }
      }
      assert.doesNotMatch(updatesPanel, /<fieldset\b|Filter update categories|按更新类别筛选|Newest posts first|最新发布的更新在前|The posting date can differ|发帖日期与报告涵盖的周期|No records in this category|此类别下暂无记录/);
      assert.equal(updateRows.length, proposal.updates.length, 'Every source update remains available without filters');
      for (const [index, update] of sortDetailUpdates(proposal.updates).entries()) {
        const row = updateRows[index];
        assert.match(row, /^<a\b/, 'The restored update is a single source link row');
        assert.ok(row.includes(`href="${escapeHtml(update.url)}"`), 'Update link points to the real public source');
        assert.match(row, /target="_blank"/);
        assert.ok(row.includes(escapeHtml(localized(update, 'title', locale))), 'Full localized source title remains in HTML, including titles over 150 characters');
        assert.match(row, /line-clamp-1/, 'Only visual one-line clamping shortens long update titles');
        assert.doesNotMatch(row, /line-clamp-[2-9]/, 'Update content never expands to multiple visible lines');
        assert.ok(row.includes(`title="${escapeHtml(localized(update, 'title', locale))}"`), 'Hover text preserves the complete localized title');
        assert.doesNotMatch(row, /更新者：|By |<p\b/, 'Update rows omit the redundant author line');
        assert.match(row, /lucide-external-link/, 'Each update retains its external-link affordance');
        assert.doesNotMatch(row, /View this update|查看本次更新|Published a weekly update|发布了周报/, 'Do not add redundant category/action prose to the full-title link row');
        if (update.date) {
          assert.ok(row.includes(`<time dateTime="${update.date}"`));
          assert.ok(row.indexOf('<time ') < row.indexOf(escapeHtml(localized(update, 'title', locale))), 'Publication date precedes the full localized title');
        } else assert.ok(textContent(row).includes(locale === 'en' ? 'Date unverified' : '日期待核验'));
      }
      assert.deepEqual([...sidebar.matchAll(/<section\b[^>]*aria-labelledby="([^"]+)"/g)].map((match) => match[1]), ['discussion-title', 'vote-title', 'sources-title'], 'Sidebar order is discussion, voting, then verification in DOM as well as visually');
      assert.doesNotMatch(sources, /Record read:|记录读取时间|Sources may have different update times|这不代表每个来源都在同一时间更新/);
      assert.ok(textContent(sources).includes(locale === 'en' ? 'Requested, approved, and disbursed amounts are different.' : '申请、批准和实际拨付是不同概念。'), 'The meaningful evidence/conflict warning is preserved');
      for (const source of proposal.sources) assert.ok(sources.includes(`href="${escapeHtml(source.url)}"`));
      const governance = elementWithAttribute(html, 'id', 'governance');
      const governanceSteps = elementsWithAttribute(governance, 'data-governance-step');
      assert.equal(governanceSteps.length, 3, 'Discussion, voting, and execution remain distinct stages');
      assert.doesNotMatch(governance, /空心圆|圆点：|勾：|横线：|Open circle:|Dot: in progress|Check: stage complete|Dash: ended|<svg\b|class="sr-only"|>—</, 'Governance has no redundant stage symbols or their legend');
      for (const [index, step] of governanceSteps.entries()) {
        assert.match(step, new RegExp(`data-governance-step="${index + 1}"`));
        const number = elementWithAttribute(step, 'data-governance-number');
        assert.equal(textContent(number), String(index + 1));
        assert.match(number, /\brounded-full\b/);
        assert.match(number, /\bbg-black\b/);
        assert.match(number, /\btext-white\b/);
        const label = (locale === 'en' ? ['Discussion', 'Voting', 'Execution'] : ['讨论', '投票', '执行'])[index];
        assert.match(step, /<h3\b/);
        assert.ok(textContent(step).includes(label));
        assert.ok(step.indexOf('data-governance-number') < step.indexOf(label), 'Each step number precedes its localized stage label');
        assert.match(step, /<p\b[^>]*>[^<]+<\/p>/, 'Each stage keeps its visible textual explanation rather than an icon or hidden duplicate');
      }
    }

    const emptyProposal = { ...realProposal, budgetLabel: null, updates: [], progressNoteZh: undefined, progressNoteEn: undefined, overview: { ...realProposal.overview, milestones: [] }, voting: null, votingPageNotFound: true };
    const emptyHtml = compiled.exports.render(emptyProposal);
    const emptyOverview = elementWithAttribute(emptyHtml, 'id', 'overview');
    assert.ok(textContent(elementWithAttribute(emptyOverview, 'data-detail-budget')).includes(locale === 'en' ? 'Not clearly stated' : '原帖未明确标注'));
    assert.doesNotMatch(emptyOverview, /id="milestones"|data-milestone-heading/);
    assert.ok(textContent(emptyOverview).includes(locale === 'en' ? 'The source does not explicitly break down milestones.' : '原始提案未明确拆分里程碑'));
    assert.ok(textContent(elementWithAttribute(emptyHtml, 'id', 'updates')).includes(locale === 'en' ? 'No verifiable progress or completion report' : '尚未发现提案人发布的可核验进展或完结报告'));
    assert.ok(textContent(elementWithAttribute(emptyHtml, 'id', 'voting')).includes(locale === 'en' ? 'No corresponding voting page was found.' : '未找到对应投票页。'));
    const unverifiedVote = elementWithAttribute(compiled.exports.render({ ...emptyProposal, votingPageNotFound: false }), 'id', 'voting');
    assert.equal(textContent(elementWithAttribute(unverifiedVote, 'class', 'mt-3 text-sm leading-6 text-muted-foreground')), locale === 'en' ? 'A corresponding voting page has not been verified.' : '尚未核验到对应投票页。');
    assert.doesNotMatch(unverifiedVote, /发现链接不代表|Finding a link alone/);
    for (const prefixLength of [0, 8]) {
      const noteProposal = {
        ...emptyProposal,
        progressNoteZh: `${'保留完整的维护说明及其核验信息。'.repeat(prefixLength)}已退还[资金](https://explorer.nervos.org/transaction/0x123)。`,
        progressNoteEn: `${'Keep the complete maintenance explanation and its verification information. '.repeat(prefixLength)}The [funds](https://explorer.nervos.org/transaction/0x123) were returned.`,
      };
      const notes = elementWithAttribute(compiled.exports.render(noteProposal), 'id', 'updates');
      const note = elementWithAttribute(notes, 'data-progress-note');
      assert.match(note, /href="https:\/\/explorer\.nervos\.org\/transaction\/0x123"/);
      assert.match(note, /class="[^"]*\bline-clamp-1\b/);
      assert.match(note, /focus-within:line-clamp-none/, 'A keyboard-focused inline link reveals its surrounding note');
      const expectedText = (locale === 'en' ? noteProposal.progressNoteEn : noteProposal.progressNoteZh).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      assert.equal(textContent(note.replace(/<[^>]*>/g, '')), expectedText, 'Visual clamping does not truncate the complete localized manual note');
      assert.ok(note.includes(`title="${escapeHtml(expectedText)}"`), 'Full hover text uses link labels, not Markdown or raw destination URLs');
      assert.ok(textContent(notes).includes(locale === 'en' ? 'were returned.' : '已退还'));
      assert.doesNotMatch(notes, /No verifiable progress|尚未发现提案人/, 'An explicit reviewed progress note replaces the generic absence message');
    }

    for (const [status, expectedZh, expectedEn] of [
      ['active', '正在投票 · 暂时数据', 'Voting open · provisional'],
      ['approved', '最终结果：通过', 'Final result: approved'],
      ['rejected', '最终结果：未通过', 'Final result: not passed'],
      ['unknown', '结果待核验', 'Result unverified'],
    ]) {
      const proposal = { ...realProposal, funded: false, status: 'discussion', statusTags: ['discussion'], voting: { url: 'https://dao.ckb.community/thread/test-vote-123', status, totalVotes: 244888704, yesPercent: 52.82, minimumVotes: 1000000, passPercent: 51, closed: status === 'approved' || status === 'rejected', verifiedAt: '2026-10-19T06:53:51.132Z' } };
      const html = compiled.exports.render(proposal);
      const vote = elementWithAttribute(html, 'id', 'voting');
      assert.ok(textContent(vote).includes(locale === 'en' ? expectedEn : expectedZh));
      assert.match(vote, /244,888,704/);
      assert.match(vote, /52\.82%/);
      assert.match(vote, /href="https:\/\/dao\.ckb\.community\/thread\/test-vote-123"/);
      assert.ok(textContent(vote).includes(locale === 'en' ? 'Voting data verified:' : '投票数据核验时间：'), 'Only the unnecessary source-card timestamp is removed');
      if (status === 'active') assert.ok(textContent(vote).includes(locale === 'en' ? 'Voting is still open.' : '投票尚未结束'));
    }
    for (const [tags, executionComplete, expected] of [
      [['vote-passed', 'executing'], true, ['正在进行中', 'In progress']],
      [['vote-passed', 'completed'], true, ['已完成', 'Completed']],
      [['vote-passed', 'ended'], false, ['已结束', 'Ended']],
    ]) {
      const html = compiled.exports.render({ ...realProposal, statusTags: tags, executionComplete });
      const governance = elementWithAttribute(html, 'id', 'governance');
      assert.ok(textContent(governance).includes(expected[locale === 'en' ? 1 : 0]), 'Execution retains the distinction between in progress, completed, and ended');
    }

    const fallback = compiled.exports.render(realProposal, { state: 'fallback', error: 'unavailable' });
    assert.ok(fallback.includes('data-proposal-hero'), 'A temporary network failure keeps the reviewed record readable');
    assert.ok(textContent(fallback).includes(locale === 'en' ? 'this does not imply the proposal ended.' : '不能据此判断提案已终止'));
    assert.ok(textContent(fallback).includes(locale === 'en' ? 'Retry' : '重试'));
    const loading = compiled.exports.render(null, { state: 'loading' });
    assert.match(loading, /aria-busy="true"/);
    assert.ok(textContent(loading).includes(locale === 'en' ? 'Loading proposal' : '正在读取提案'));
    for (const [error, labelZh, labelEn, retry] of [
      ['invalid', '提案编号无效', 'Invalid proposal ID', false],
      ['not-found', '没有找到这个提案', 'Proposal not found', true],
      ['unavailable', '暂时无法读取提案', 'Proposal temporarily unavailable', true],
    ]) {
      const html = compiled.exports.render(null, { state: 'fallback', error });
      assert.ok(textContent(html).includes(locale === 'en' ? labelEn : labelZh));
      assert.equal(/<button\b/.test(html), retry, 'Only retriable source errors offer a retry');
      assert.match(html, /href="\/projects"/, 'All error states provide a route back to proposals');
      assert.doesNotMatch(html, /data-proposal-hero|data-detail-sidebar/);
    }
    // A missing query ID cannot be resolved until the browser effect reads the
    // URL. SSR must keep it pending rather than prematurely call it a 404.
    const unresolved = compiled.exports.render(null, { state: 'loading', error: null }, { id: undefined });
    assert.match(unresolved, /aria-busy="true"/);
    assert.doesNotMatch(unresolved, /Proposal not found|没有找到这个提案|<button\b/);
  }
} finally {
  console.error = previousConsoleError;
  delete globalThis.__detailLocale;
  delete globalThis.__detailHook;
}
assert.deepEqual(renderWarnings, [], 'All bilingual detail SSR branches render without React warnings');
console.log('Detail layout: bilingual dark hero, overview budget, aligned allocations, complete source-update rows, ordered evidence sidebar, and resilient loading/voting/error states pass.');
