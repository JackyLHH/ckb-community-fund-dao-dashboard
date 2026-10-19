import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const fixture = {
  id: '987654321',
  author: 'Contributor With An Intentionally Long Display Name',
  budget: '$123,456,789.000 USD / 8,263,000 CKB',
  updatedAt: '2026-10-19T06:53:51.132Z',
  title: {
    zh: '完整保留的中文提案标题',
    en: 'The full English proposal title is retained',
  },
  summary: {
    zh: '完整的中文提案概览仍然保留在卡片模式中，视觉上的三行限制不会截断源数据，也不会修改提案内容或翻译。',
    en: 'A full English overview is retained in card mode so visual three-line clamping never changes proposal content or its translation.',
  },
};
const bundled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ProjectCard } from './components/project-card.tsx';
    import { proposals } from './lib/proposals.ts';
    const fixture = ${JSON.stringify(fixture)};
    const proposal = {
      ...proposals[0],
      id: fixture.id,
      title: fixture.title.en,
      titleZh: fixture.title.zh,
      titleEn: fixture.title.en,
      author: fixture.author,
      budgetLabel: fixture.budget,
      projectType: 'Infrastructure',
      updatedAt: fixture.updatedAt,
      discussion: { likes: 38, replies: 13, views: 5678 },
      overview: {
        objective: fixture.summary.en,
        objectiveEn: fixture.summary.en,
        objectiveZh: fixture.summary.zh,
        milestones: [],
      },
    };
    export const render = (compact, missing = false) => renderToStaticMarkup(createElement(ProjectCard, {
      proposal: missing ? { ...proposal, budgetLabel: null, discussion: { likes: null, replies: null, views: null } } : proposal,
      compact,
    }));
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

// A small balanced-tag reader keeps assertions independent of incidental wrappers.
function elementWithAttribute(html, attribute, value) {
  const pattern = new RegExp(`<([a-z][\\w-]*)\\b[^>]*\\b${attribute}="${value}"[^>]*>`, 'i');
  const opening = pattern.exec(html);
  assert.ok(opening, `Expected ${attribute}="${value}"`);
  const tag = opening[1];
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tokens.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  let token;
  while ((token = tokens.exec(html))) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(opening.index, tokens.lastIndex);
  }
  assert.fail(`Unclosed element with ${attribute}="${value}"`);
}

function visibleText(html, locale) {
  return html
    .replace(/<span\b[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(new RegExp(`<span\\b[^>]*class="[^"]*\\bi18n-${locale === 'en' ? 'zh' : 'en'}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/span>`, 'g'), '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertOrder(html, fields, description) {
  let previous = -1;
  for (const field of fields) {
    const position = html.indexOf(field);
    assert.ok(position > previous, `${description}: expected ${field} after the previous field`);
    previous = position;
  }
}

try {
  for (const locale of ['zh', 'en']) {
    globalThis.__densityLocale = locale;
    const type = locale === 'en' ? 'Infrastructure' : '基础设施';
    const likesExplanation = locale === 'en'
      ? 'Current first-post likes; not the verified count at the seven-day deadline'
      : '当前首帖赞数，不等同于 7 天讨论期截止时的赞数';
    for (const compact of [false, true]) {
      const mode = compact ? 'compact' : 'card';
      for (const missing of [false, true]) {
        const html = compiled.exports.render(compact, missing);
        const card = elementWithAttribute(html, 'data-proposal-card', mode);
        const metadata = elementWithAttribute(card, 'data-proposal-metadata', mode);
        const text = visibleText(card, locale);
        const metadataText = visibleText(metadata, locale);
        const budget = missing ? (locale === 'en' ? 'To verify' : '待核验') : fixture.budget;

        assert.match(card, /^<a\b/);
        assert.match(card, /data-testid="proposal-card"/);
        assert.ok(card.includes(`href="/project?id=${fixture.id}"`), 'The detail link keeps the authoritative forum topic ID');
        assert.ok(card.includes(`aria-labelledby="proposal-title-${fixture.id}"`));
        assert.ok(card.includes(`<h2 id="proposal-title-${fixture.id}"`));
        assert.ok(text.includes(fixture.title[locale]), 'Localized titles remain complete and accessible');
        assert.ok(!text.includes(fixture.id), 'Forum topic IDs are not displayed in either mode');
        assert.ok(!text.includes('当前首帖赞') && !text.includes('current first-post likes'), 'Likes omit the repeated visible label');
        const likes = elementWithAttribute(metadata, 'data-proposal-field', 'likes');
        assert.ok(likes.includes('lucide-thumbs-up'), 'The thumbs-up icon represents first-post likes');
        assert.ok(likes.includes(`title="${likesExplanation}"`), 'The exact first-post/deadline distinction remains discoverable');
        assert.match(likes, /class="[^"]*\bsr-only\b[^"]*"/, 'Likes retain screen-reader context');
        assert.equal(visibleText(likes, locale), missing ? '—' : '38', 'Visible likes contain only the actual count, including unknown values');
        assert.doesNotMatch(card, /\b(?:NaN|undefined|null)\b/, 'Missing values have an intentional display rather than leaking raw values');

        if (compact) {
          assert.equal((card.match(/data-proposal-metadata="compact"/g) ?? []).length, 1, 'Compact metadata uses one shared flow row');
          assert.match(metadata, /class="[^"]*\bflex\b[^"]*\bflex-wrap\b[^"]*"/, 'Metadata wraps safely when a long author or budget cannot fit');
          assert.deepEqual([...metadata.matchAll(/data-proposal-field="([^"]+)"/g)].map((match) => match[1]), ['type', 'author', 'budget', 'likes', 'updated']);
          assertOrder(metadataText, [type, fixture.author, budget], 'Compact type, author, and budget order');
          assertOrder(metadata, [budget, 'lucide-thumbs-up', `<time dateTime="${fixture.updatedAt}"`], 'Compact budget, likes, and update time order');
          assert.ok(!card.includes(fixture.summary.zh) && !card.includes(fixture.summary.en), 'Compact rows render no proposal overview');
          assert.doesNotMatch(card, /lucide-(?:message-circle|eye)\b/, 'Compact rows omit reply and view statistics');
          assert.ok(metadata.includes(fixture.author), 'Long author names remain available in the shared row');
        } else {
          const summary = card.match(/<p class="([^"]*text-sm leading-6[^"]*)">([^<]+)<\/p>/);
          assert.ok(summary, 'Cards preserve the proposal overview');
          assert.match(summary[1], /\bline-clamp-3\b/);
          assert.doesNotMatch(summary[1], /\bline-clamp-(1|2|6)\b/);
          assert.equal(summary[2], fixture.summary[locale], 'Visual clamping does not truncate the localized overview source');
          assert.ok(metadataText.includes(type), 'The proposal type is in the card statistic row');
          assert.deepEqual([...metadata.matchAll(/data-proposal-field="([^"]+)"/g)].map((match) => match[1]), ['type', 'likes', 'replies', 'views'], 'Card type precedes likes in the same statistic row');
          assert.match(metadata, /lucide-message-circle/);
          assert.match(metadata, /lucide-eye/);
          assert.equal(visibleText(elementWithAttribute(metadata, 'data-proposal-field', 'replies'), locale), missing ? '—' : '13');
          assert.equal(visibleText(elementWithAttribute(metadata, 'data-proposal-field', 'views'), locale), missing ? '—' : '5.7K');
          assert.ok(text.includes(budget), 'The requested budget remains visible');
          assert.ok(text.includes(fixture.author), 'The author remains visible in card mode');
          assert.ok(!metadata.includes(fixture.author), 'The card author remains in the separate bottom row');
          assert.ok(!metadata.includes('<time '), 'The card update time remains in the separate bottom row');
          assert.ok(card.includes(`<time dateTime="${fixture.updatedAt}"`));
        }
      }
    }
  }
} finally { delete globalThis.__densityLocale; }
console.log('Directory density: bilingual three-line cards, summary-free compact metadata rows, icon-only likes, no visible IDs, and resilient long/missing data.');
