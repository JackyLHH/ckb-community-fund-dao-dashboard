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
    import { ProjectsExplorer } from './components/projects-explorer.tsx';
    import { LiveProjectStats } from './components/live-project-directory-meta.tsx';
    export const render = (name) => {
      globalThis.__directoryStateIndex = 0;
      return renderToStaticMarkup(createElement({ ProjectsExplorer, LiveProjectStats }[name]));
    };
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-directory-layout', setup(builder) {
    // Seed the actual explorer's initial filters for SSR-only interaction
    // fixtures, without replacing React or the component's markup/behavior.
    builder.onResolve({ filter: /^react$/ }, ({ importer }) => importer.endsWith('/components/projects-explorer.tsx') ? { path: 'directory-state', namespace: 'fixture' } : { path: 'react', external: true });
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'dataset', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__directoryLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^directory-state$/, namespace: 'fixture' }, () => ({ contents: `
      export * from 'react';
      import { useState as reactUseState } from 'react';
      const stateNames = ['query', 'status', 'projectType', 'fundedOnly', 'sort', 'filtersOpen', 'view', 'initialized', 'announcement'];
      export function useState(initial) {
        const key = stateNames[globalThis.__directoryStateIndex++];
        const fixture = globalThis.__directoryActiveFilters ?? {};
        return reactUseState(Object.hasOwn(fixture, key) ? fixture[key] : initial);
      }
    ` }));
    builder.onLoad({ filter: /^dataset$/, namespace: 'fixture' }, () => ({ contents: `
      import { proposals } from '@/lib/proposals';
      export function useLiveDataset() { return { state: 'live', data: { meta: { generatedAt: '2026-10-19T06:19:00Z' }, proposals: proposals.slice(0, globalThis.__directoryCount ?? 2) } }; }
    ` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);

function elementWithAttribute(html, attribute, value) {
  const condition = value === undefined ? `${attribute}(?:="[^"]*")?(?=[\\s>])` : `${attribute}="${value}"`;
  const opening = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\b${condition}[^>]*>`, 'i').exec(html);
  assert.ok(opening, `Expected ${attribute}${value === undefined ? '' : `="${value}"`}`);
  if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(opening[1])) return opening[0];
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

try {
  for (const locale of ['zh', 'en']) {
    globalThis.__directoryLocale = locale;
    for (const count of [0, 1, 2]) {
      globalThis.__directoryCount = count;
      const html = compiled.exports.render('ProjectsExplorer');
      const expectedCount = locale === 'en' ? `${count} ${count === 1 ? 'proposal' : 'proposals'} found` : `找到 ${count} 份提案`;
      assert.ok(html.includes(expectedCount), expectedCount);
      assert.doesNotMatch(html, /status-guide|提案状态说明|Proposal status guide|Funded proposals only|仅看已获资助的提案|论坛最近活动|Latest forum activity/);
      assert.match(html, /<search[^>]+aria-labelledby="directory-search-title"/);
      assert.match(html, /<label for="proposal-search"/);
      assert.equal([...html.matchAll(/<select\b/g)].length, 3, 'Status, type and sort remain labelled native controls');
      const controls = elementWithAttribute(html, 'data-directory-controls');
      const search = elementWithAttribute(controls, 'data-directory-search');
      const filters = elementsWithAttribute(controls, 'data-directory-filter-control');
      assert.match(controls, /md:grid-cols-12/, 'Desktop search/filter row uses a twelve-column grid');
      assert.match(search, /md:col-span-6/, 'Search occupies half of the desktop row');
      assert.equal(filters.length, 3, 'The remaining half contains status, type and sort');
      for (const [index, filter] of filters.entries()) {
        assert.match(filter, /^<label\b/, 'Each native select is associated with its visible enclosing label');
        assert.match(filter, /md:col-span-2/, 'Each dropdown occupies two of the twelve desktop columns');
        const label = (locale === 'en' ? ['Status', 'Type', 'Sort by'] : ['状态', '类型', '排序'])[index];
        assert.ok(filter.includes(`<span>${label}</span>`), `Visible ${label} label remains available`);
        const select = elementWithAttribute(filter, 'data-directory-filter-select');
        assert.match(select, /^<select\b/, 'Browser-native keyboard and assistive-technology behavior remains intact');
        assert.match(select, /cursor-pointer/, 'Selectable dropdowns use a pointer cursor');
        assert.match(select, /\bh-11\b/, 'Dropdowns retain a 44-pixel control height');
        assert.match(select, /\bappearance-none\b/);
        assert.match(select, /\bpr-10\b/, 'Selected text reserves room for the inset custom chevron');
        assert.match(select, /forced-colors:appearance-auto/, 'Forced-colors users retain the visible native select affordance');
        assert.match(select, /focus-visible:ring-2/, 'Keyboard focus remains visible');
        const chevron = elementWithAttribute(filter, 'data-directory-filter-chevron');
        assert.match(chevron, /^<svg\b/);
        assert.match(chevron, /lucide-chevron-down/);
        assert.match(chevron, /\bright-3\b/, 'Dropdown chevrons sit twelve pixels inside the edge');
        assert.match(chevron, /\bsize-4\b/);
        assert.match(chevron, /pointer-events-none/, 'The chevron never blocks the native dropdown click target');
        assert.match(chevron, /aria-hidden="true"/, 'The decorative chevron is not redundantly announced');
        assert.match(chevron, /forced-colors:hidden/, 'Forced colors does not display a duplicate custom chevron');
      }
      assert.match(html, /hidden md:contents/, 'Filters occupy the same desktop row but collapse on mobile');
      assert.match(html, /aria-controls="directory-filters"/);
      assert.match(html, /<output[^>]+aria-live="polite"/);
      const stats = compiled.exports.render('LiveProjectStats');
      const statNumbers = [...stats.matchAll(/<p class="([^"]*\btabular-nums\b[^"]*)">(\d+)<\/p>/g)];
      assert.equal(statNumbers.length, 5, 'All five directory statistics remain present');
      for (const [, classes] of statNumbers) {
        assert.ok(classes.split(/\s+/).includes('text-white'), 'All statistic numbers use the same white text in either theme and language');
        assert.doesNotMatch(classes, /(?:dark:)?text-\[#|dark:text-/, 'Statistic numbers must not regain a special color override');
      }
      assert.equal(Number(statNumbers[0][2]), count, 'All proposals retains the live proposal count');
      if (count === 0) assert.ok(statNumbers.every((number) => number[2] === '0'), 'Empty live data retains truthful zero counts');
      for (const query of ['', '?funded=1', '?type=Governance', '?status=discussion', '?status=voting']) {
        assert.ok(stats.includes(`href="/projects${query}#proposal-directory"`), `Statistic deep link remains available: ${query || 'all'}`);
      }
    }
    const stats = compiled.exports.render('LiveProjectStats');
    assert.doesNotMatch(stats, /Whole-directory overview|全站概况|these counts are not additive/);
    assert.match(stats, /href="\/projects\?funded=1#proposal-directory"/, 'Funded overview deep links remain supported');
    for (const filtersOpen of [false, true]) {
      globalThis.__directoryActiveFilters = { query: 'Fiber', status: 'vote-passed', projectType: 'Infrastructure', fundedOnly: true, sort: 'likes', filtersOpen };
      const filteredHtml = compiled.exports.render('ProjectsExplorer');
      const filterPanel = elementWithAttribute(filteredHtml, 'id', 'directory-filters');
      assert.match(filteredHtml, new RegExp(`aria-expanded="${filtersOpen}" aria-controls="directory-filters"`), 'Mobile disclosure state remains truthful');
      assert.match(filterPanel, filtersOpen ? /class="[^"]*\bgrid md:contents/ : /class="[^"]*\bhidden md:contents/, 'The same native controls can be disclosed on mobile');
      assert.match(elementWithAttribute(filteredHtml, 'id', 'proposal-search'), /value="Fiber"/, 'A seeded search still reaches the real input');
      assert.match(elementWithAttribute(filteredHtml, 'data-directory-filter-select'), /<option value="vote-passed" selected="">/, 'An active status remains selected in the native control');
      const chips = elementsWithAttribute(filteredHtml, 'data-filter-chip-button');
      assert.equal(chips.length, 5, 'Query, status, type, funding deep links and nondefault sort retain individually removable chips');
      for (const chip of chips) {
        const opening = chip.slice(0, chip.indexOf('>') + 1);
        assert.match(opening, /^<button\b[^>]*type="button"/, 'Each active filter remains a real button');
        assert.match(opening, /\bmin-h-11\b/, 'Compact filter pills retain a 44-pixel touch hit area');
        assert.match(opening, /cursor-pointer/);
        assert.match(opening, /aria-label="(?:移除条件：|Remove filter: )/, 'Every chip exposes its removal action and full condition to assistive technology');
        assert.match(opening, /focus-visible:ring-2/);
        assert.doesNotMatch(opening, /\bbg-primary\/10\b|\bborder-primary\/30\b/, 'The touch target is larger than the compact visible pill');
        const pill = elementWithAttribute(chip, 'data-filter-chip');
        assert.match(pill, /\bmin-h-7\b/, 'Visible pills are compact rather than forty-four pixels tall');
        assert.match(pill, /\bpx-2\.5\b/);
        assert.match(pill, /\bpy-1\b/);
        assert.match(pill, /\bgap-1\.5\b/);
        assert.match(pill, /\bleading-4\b/);
        assert.match(pill, /lucide-x size-3 shrink-0/, 'The remove icon is compact but retains the full button hit area');
      }
      assert.match(filteredHtml, locale === 'en' ? /Clear all filters/ : /清除所有筛选/, 'The clear-all action remains available');
    }
    delete globalThis.__directoryActiveFilters;
  }
} finally {
  delete globalThis.__directoryLocale;
  delete globalThis.__directoryCount;
  delete globalThis.__directoryActiveFilters;
  delete globalThis.__directoryStateIndex;
}
const source = await readFile(new URL('../components/projects-explorer.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(source, /statusGuidePreferenceKey|showStatusGuide|fundedRef|最近论坛活动/);
assert.match(source, /setFundedOnly\(params\.get\('funded'\) === '1'\)/);
assert.match(source, /if \(key === 'funded'\) setFundedOnly\(false\)/, 'A funded deep link still has a clear escape');
assert.match(source, /window\.addEventListener\('popstate', readLocation\)/);
assert.match(source, /window\.history\.replaceState/);
assert.match(source, /window\.localStorage\.setItem\(viewPreferenceKey, next\)/);
const page = await readFile(new URL('../app/projects/page.tsx', import.meta.url), 'utf8');
assert.match(page, /zh="DAO 提案，一目了然" en="DAO proposals, at a glance"/);
assert.match(page, /zh="查看社区提案、资助情况与交付进展。"/);
assert.match(page, /en="See what’s proposed, funded, and delivered\."/);
assert.doesNotMatch(page, /Explore every community proposal|Track CKB ecosystem proposals from discussion/);
console.log('Directory layout: bilingual half-width search, three native inset-chevron dropdowns, compact active pills with 44-pixel hit areas, mobile disclosure, preserved live statistics/deep links, concise counts, and URL compatibility pass.');
