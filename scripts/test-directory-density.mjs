import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const bundled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ProjectCard } from './components/project-card.tsx';
    import { proposals } from './lib/proposals.ts';
    const proposal = { ...proposals[0], id: 'density-fixture', overview: {
      objective: 'Density fixture overview.',
      objectiveEn: 'A full English overview is retained in the document so visual line clamping never changes proposal content or its translation.',
      objectiveZh: '完整的中文提案概览仍然保留在页面中，视觉上的行数限制不会截断源数据，也不会修改提案内容或翻译。',
      milestones: [],
    } };
    export const render = (compact) => renderToStaticMarkup(createElement(ProjectCard, { proposal, compact }));
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'offline-density-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__densityLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);

try {
  for (const locale of ['zh', 'en']) {
    globalThis.__densityLocale = locale;
    for (const compact of [false, true]) {
      const html = compiled.exports.render(compact);
      const summary = html.match(/<p class="([^"]*text-sm leading-6[^"]*)">([^<]+)<\/p>/);
      assert.ok(summary, 'Every proposal mode renders its overview');
      assert.match(summary[1], compact ? /\bline-clamp-1\b/ : /\bline-clamp-3\b/);
      assert.doesNotMatch(summary[1], /\bline-clamp-(2|6)\b/);
      assert.equal(summary[2], locale === 'en'
        ? 'A full English overview is retained in the document so visual line clamping never changes proposal content or its translation.'
        : '完整的中文提案概览仍然保留在页面中，视觉上的行数限制不会截断源数据，也不会修改提案内容或翻译。');
    }
  }
} finally { delete globalThis.__densityLocale; }
console.log('Directory summaries: bilingual cards clamp to three lines, compact rows to one line, without truncating source content.');
