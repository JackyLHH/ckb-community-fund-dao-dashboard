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
    export const render = (name, props = {}) => renderToStaticMarkup(createElement({ SiteHeader, HomeQuickActions, LiveSyncBadge, LiveTreasuryCard }[name], props));
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-ui-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'dataset', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.endsWith('static-link') || path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export const localeChangeEvent = 'ckb-dao-locale-change'; export function useLocale() { const locale = globalThis.__uiTestLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^dataset$/, namespace: 'fixture' }, () => ({ contents: `export function useLiveDataset() { return { state: 'live', data: { meta: { generatedAt: '2026-10-19T06:19:00Z' }, proposals: [], treasury: { initialCkb: 276000000, remainingCkb: '156254535.4172122', remainingPercent: 56.61, fundedProposalCount: 17, asOf: '2026-10-19', forumAsOf: '2026-05-15', balanceSource: 'chain', sourceUrl: 'https://explorer.example/balance' } } }; }` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);
const { render } = compiled.exports;
const visibleText = (html) => html.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '');

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
  }
} finally { delete globalThis.__uiTestLocale; }

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
console.log('Simplified UI: bilingual navigation, quick-action parity, compact freshness states, three-decimal balance, effective theme icons, and update labels pass.');
