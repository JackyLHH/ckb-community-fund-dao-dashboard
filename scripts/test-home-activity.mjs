import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const bundled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { LiveHomeActivity } from './components/live-home-activity.tsx';
    export const render = () => renderToStaticMarkup(createElement(LiveHomeActivity));
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, jsx: 'automatic',
  plugins: [{ name: 'home-activity-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/use-live-data$/ }, () => ({ path: 'dataset', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\// }, ({ path }) => ({ path: `${root}${path.slice(2)}${path.includes('/components/') ? '.tsx' : '.ts'}` }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__homeLocale; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
    builder.onLoad({ filter: /^dataset$/, namespace: 'fixture' }, () => ({ contents: `
      import { dataset } from '@/lib/proposals';
      export function useLiveDataset() { return { state: 'live', data: { ...dataset, proposals: [{
        ...dataset.proposals[0], id: 'unverified-vote', status: 'discussion', statusTags: [],
        voting: { status: globalThis.__homeVoteStatus, url: 'https://example.com/vote' },
      }] } }; }
    ` }));
  } }],
});
const compiled = { exports: {} };
new Script(`(function(require, module, exports) { ${bundled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), compiled, compiled.exports);
try {
  for (const locale of ['zh', 'en']) {
    globalThis.__homeLocale = locale;
    globalThis.__homeVoteStatus = 'unknown';
    const unknown = compiled.exports.render();
    assert.match(unknown, /project\?id=unverified-vote/);
    assert.match(unknown, /<time /);
    assert.doesNotMatch(unknown.match(/<a href="\/project\?id=unverified-vote"[\s\S]*?<\/a>/)[0], /size-2 rounded-full|undefined| · /, 'Unverified votes render without a status dot or dangling separator');
    globalThis.__homeVoteStatus = 'active';
    const active = compiled.exports.render();
    assert.match(active, /size-2 rounded-full bg-amber-500/);
    assert.match(active, locale === 'en' ? /Voting now · / : /正在投票 · /);
  }
} finally {
  delete globalThis.__homeLocale;
  delete globalThis.__homeVoteStatus;
}
console.log('Home activity handles unverified and active votes in both languages.');
