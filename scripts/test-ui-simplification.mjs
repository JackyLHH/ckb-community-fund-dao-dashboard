import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const bundled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { SiteHeader } from './components/site-header.tsx';
    import { HomeQuickActions } from './components/home-quick-actions.tsx';
    import { LiveSyncBadge } from './components/live-sync-badge.tsx';
    import { LiveTreasuryCard } from './components/live-treasury-card.tsx';
    import { LiveFeaturedProposals } from './components/live-featured-proposals.tsx';
    import { LiveHomeActivity } from './components/live-home-activity.tsx';
    import { proposals, getProposalOverview, getProposalTitle } from './lib/proposals.ts';
    const homepageIds = ['9756', '10015', '10583'];
    export const homepageProposals = homepageIds.map((id, index) => ({
      ...proposals.find((proposal) => proposal.id === id),
      author: 'Contributor With A Long Display Name ' + index,
      budgetLabel: '$123,456,789.000 USD / 8,263,000 CKB',
      discussion: { likes: 987654 + index, replies: 12, views: 3456 },
      updatedAt: '2026-10-' + (18 - index) + 'T06:53:51Z',
    }));
    homepageProposals.push({
      ...homepageProposals[0],
      id: '987654321',
      title: 'A complete activity fixture title',
      titleEn: 'A complete activity fixture title',
      titleZh: '完整保留的提案动态测试标题',
      updatedAt: '2026-10-19T06:53:51Z',
      overview: {
        objective: 'This full English overview deliberately exceeds the former 220-character limit. It describes the proposal and its work in detail so a one-line visual clamp can be distinguished from destructive string truncation. The ending remains available to assistive technology and in the underlying document.',
        objectiveEn: 'This full English overview deliberately exceeds the former 220-character limit. It describes the proposal and its work in detail so a one-line visual clamp can be distinguished from destructive string truncation. The ending remains available to assistive technology and in the underlying document.',
        objectiveZh: '这段完整的中文提案概览故意超过旧版程序的二百二十字截断限制，用于验证一行显示只影响视觉布局，而不会改变源数据、翻译或辅助技术可读取的完整内容。' + '界面应保持简洁，同时保留完整且准确的提案信息，方便用户进入详情页继续阅读。'.repeat(6) + '末尾内容必须完整保留。',
        milestones: [],
      },
    });
    export const homepageExpected = (proposal, locale) => ({ overview: getProposalOverview(proposal, locale), title: getProposalTitle(proposal, locale) });
    export const render = (name, props = {}) => renderToStaticMarkup(createElement({ SiteHeader, HomeQuickActions, LiveSyncBadge, LiveTreasuryCard, LiveFeaturedProposals, LiveHomeActivity }[name], props));
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-ui-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'dataset', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.endsWith('static-link') || path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export const localeChangeEvent = 'ckb-dao-locale-change'; export function useLocale() { const locale = globalThis.__uiTestLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^dataset$/, namespace: 'fixture' }, () => ({ contents: `export function useLiveDataset() { return { state: 'live', data: { meta: { generatedAt: '2026-10-19T06:19:00Z', proposalCount: globalThis.__uiTestProposals?.length ?? 0 }, proposals: globalThis.__uiTestProposals ?? [], treasury: { initialCkb: 276000000, remainingCkb: '156254535.4172122', remainingPercent: 56.61, fundedProposalCount: 17, asOf: '2026-10-19', forumAsOf: '2026-05-15', balanceSource: 'chain', sourceUrl: 'https://explorer.example/balance' } } }; }` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);
const { render } = compiled.exports;
const visibleText = (html) => html.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '');
const localizedText = (html, locale) => html
  .replace(new RegExp(`<span\\b[^>]*class="[^"]*\\bi18n-${locale === 'en' ? 'zh' : 'en'}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/span>`, 'g'), '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();
const cardLinks = (html) => [...html.matchAll(/<a\b[^>]*aria-labelledby="(?:featured|activity)-title-[^"]+"[^>]*>[\s\S]*?<\/a>/g)].map(([card]) => card);

try {
  for (const locale of ['zh', 'en']) {
    globalThis.__uiTestLocale = locale;
    const header = render('SiteHeader');
    const navs = [...header.matchAll(/<nav\b[\s\S]*?<\/nav>/g)].map(([nav]) => nav);
    assert.equal(navs.length, 2);
    for (const nav of navs) {
      const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
      assert.deepEqual(hrefs.slice(0, 4), ['/', '/projects', '/#subscribe', '/methodology']);
    }
    assert.match(header, /lucide-sun/);
    assert.doesNotMatch(header, /lucide-monitor/);
    const actions = render('HomeQuickActions');
    const hrefs = [...actions.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
    assert.deepEqual(hrefs, ['/projects?status=discussion', '/projects?status=voting', '#subscribe']);
    assert.match(actions, /lucide-mail/);
    const classes = [...actions.matchAll(/<a[^>]+class="([^"]+)"/g)].map(([, value]) => value);
    assert.equal(new Set(classes).size, 1, 'All three quick actions share one visual treatment');

    const live = render('LiveSyncBadge', { state: 'live', fetchedAt: '2026-10-19T06:19:00Z' });
    assert.equal(visibleText(live), locale === 'en' ? 'Live · 14:19' : '实时 · 14:19');
    assert.match(live, /2026/); assert.match(live, /UTC\+8/, 'Full timestamp remains accessible in tooltip and screen-reader copy');
    const cached = render('LiveSyncBadge', { state: 'fallback', fetchedAt: '2026-10-19T06:19:00Z' });
    assert.equal(visibleText(cached), locale === 'en' ? 'Cached' : '缓存');
    assert.equal(visibleText(render('LiveSyncBadge', { state: 'loading' })), locale === 'en' ? 'Updating' : '更新中');
    assert.doesNotMatch(render('LiveSyncBadge', { state: 'live', fetchedAt: 'invalid' }), /Invalid Date|NaN/);
    const treasury = render('LiveTreasuryCard');
    assert.match(treasury, /156,254,535\.417/);
    assert.doesNotMatch(treasury, /156254535\.4172122|完整读取值|Read value|清单内已资助提案|Funded proposals on the list|清单更新于|List dated|2026-05-15|A balance change is not necessarily/);

    globalThis.__uiTestProposals = compiled.exports.homepageProposals;
    const featured = render('LiveFeaturedProposals');
    const featuredCards = cardLinks(featured);
    assert.equal(featuredCards.length, 3, 'All three chosen in-progress proposals remain linked cards');
    assert.deepEqual(featuredCards.map((card) => card.match(/href="([^"]+)"/)[1]), ['/project?id=9756', '/project?id=10015', '/project?id=10583']);
    for (const [index, card] of featuredCards.entries()) {
      const proposal = compiled.exports.homepageProposals[index];
      const expected = compiled.exports.homepageExpected(proposal, locale);
      const overview = card.match(/<p class="([^"]*\bline-clamp-4\b[^"]*)">([\s\S]*?)<\/p>/);
      assert.ok(overview, 'Featured overviews use a four-line visual clamp');
      assert.equal(localizedText(overview[2], locale), expected.overview, 'Four-line clamping retains the full localized proposal overview');
      assert.ok(localizedText(card, locale).includes(expected.title), 'Localized proposal titles are preserved');
      assert.ok(card.includes(`aria-labelledby="featured-title-${proposal.id}"`));
      assert.ok(card.includes(`<h3 id="featured-title-${proposal.id}"`), 'The whole-card link remains named by its proposal title');
      const metadata = card.match(/<div class="([^"]*\bmt-auto\b[^"]*)">([\s\S]*?)<\/div>/);
      assert.ok(metadata, 'Proposer and budget retain a common metadata container');
      assert.match(metadata[1], /\bflex\b/);
      assert.doesNotMatch(metadata[1], /\bgrid\b|\bflex-col\b/, 'Proposer and budget share one row rather than a stacked list');
      assert.ok(metadata[2].includes(proposal.author));
      assert.ok(metadata[2].includes(proposal.budgetLabel));
      assert.match(metadata[2], /lucide-user-round/);
      assert.match(metadata[2], /lucide-wallet-cards/);
      assert.match(metadata[2], /\btruncate\b/, 'Long metadata remains available without forcing a wider card');
      assert.doesNotMatch(card, /lucide-(?:thumbs-up|arrow-right)|首帖赞|first-post likes|查看提案|View proposal/, 'Featured cards omit the repeated likes and per-card call to action');
      assert.ok(!card.includes(String(proposal.discussion.likes)), 'The removed first-post like count does not remain in card markup');
    }

    const activity = render('LiveHomeActivity');
    const activityCards = cardLinks(activity);
    const recent = [...compiled.exports.homepageProposals].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3);
    assert.equal(activityCards.length, 3);
    for (const [index, card] of activityCards.entries()) {
      const proposal = recent[index];
      const expected = compiled.exports.homepageExpected(proposal, locale);
      const overview = card.match(/<p class="([^"]*\bline-clamp-1\b[^"]*)">([\s\S]*?)<\/p>/);
      assert.ok(overview, 'Latest activity overviews use a one-line visual clamp');
      assert.equal(localizedText(overview[2], locale), expected.overview, 'One-line clamping preserves the complete localized overview, including content beyond 220 characters');
      assert.ok(card.includes(`href="/project?id=${proposal.id}"`));
      assert.ok(card.includes(`aria-labelledby="activity-title-${proposal.id}"`));
      assert.ok(card.includes(`<h3 id="activity-title-${proposal.id}"`));
      assert.match(card, /^<a\b[^>]*class="[^"]*\bmin-w-0\b[^"]*"/, 'Activity card grid items can shrink instead of overflowing with an intact overview');
      assert.match(card, /<div class="[^"]*\bmin-w-0\b[^"]*">/, 'The overview content column also allows shrinking');
    }
    assert.ok(compiled.exports.homepageExpected(recent[0], locale).overview.length > 220, 'The fixture exercises the previous content truncation boundary in both languages');
    assert.ok(activity.includes('href="/projects"'), 'The directory-level call to action is unaffected');
  }
} finally { delete globalThis.__uiTestLocale; delete globalThis.__uiTestProposals; }

const theme = await readFile(new URL('../components/theme-switch.tsx', import.meta.url), 'utf8');
assert.match(theme, /const dark = useSyncExternalStore\(subscribeTheme, currentDark/);
assert.match(theme, /classList\.contains\('dark'\)/);
assert.match(theme, /const Icon = dark \? Moon : Sun/);
assert.match(theme, /option value="system"/, 'System preference remains available while its icon reflects the effective theme');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
assert.match(home, /总投票数不少于申请 CKB 数量的 3 倍/);
assert.doesNotMatch(home, /总投票权重不少于申请/);
for (const file of ['project-card', 'live-home-activity', 'live-project-detail']) {
  const source = await readFile(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8');
  assert.match(source, /更新于/);
  assert.doesNotMatch(source, /t\('论坛活动 |t\('论坛最近活动：|zh="论坛活动"/);
}
console.log('Simplified UI: bilingual navigation, quick-action parity, compact freshness, three-decimal balance, effective theme icons, update labels, four-line featured cards, and one-line activity cards pass.');
