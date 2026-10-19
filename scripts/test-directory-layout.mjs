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
    export const render = (name) => renderToStaticMarkup(createElement({ ProjectsExplorer, LiveProjectStats }[name]));
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-directory-layout', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'dataset', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__directoryLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^dataset$/, namespace: 'fixture' }, () => ({ contents: `
      import { proposals } from '@/lib/proposals';
      export function useLiveDataset() { return { state: 'live', data: { meta: { generatedAt: '2026-10-19T06:19:00Z' }, proposals: proposals.slice(0, globalThis.__directoryCount ?? 2) } }; }
    ` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);

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
      assert.match(html, /md:grid-cols-\[minmax\(0,1\.6fr\)_repeat\(3,minmax\(0,1fr\)\)\]/);
      assert.match(html, /hidden md:contents/, 'Filters occupy the same desktop row but collapse on mobile');
      assert.match(html, /aria-controls="directory-filters"/);
      assert.match(html, /<output[^>]+aria-live="polite"/);
    }
    const stats = compiled.exports.render('LiveProjectStats');
    assert.doesNotMatch(stats, /Whole-directory overview|全站概况|these counts are not additive/);
    assert.match(stats, /href="\/projects\?funded=1#proposal-directory"/, 'Funded overview deep links remain supported');
  }
} finally {
  delete globalThis.__directoryLocale;
  delete globalThis.__directoryCount;
}
const source = await readFile(new URL('../components/projects-explorer.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(source, /statusGuidePreferenceKey|showStatusGuide|fundedRef|最近论坛活动/);
assert.match(source, /setFundedOnly\(params\.get\('funded'\) === '1'\)/);
assert.match(source, /if \(key === 'funded'\) setFundedOnly\(false\)/, 'A funded deep link still has a clear escape');
assert.match(source, /window\.addEventListener\('popstate', readLocation\)/);
assert.match(source, /window\.history\.replaceState/);
assert.match(source, /window\.localStorage\.setItem\(viewPreferenceKey, next\)/);
console.log('Directory layout: bilingual concise counts, no status panel or standalone funded toggle, one desktop control row, mobile disclosure, and URL compatibility pass.');
