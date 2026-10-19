import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { buildSpendingChart, formatSpendingCkb } from '../lib/treasury-chart.ts';

assert.equal(formatSpendingCkb('123456789', 'en-US'), '1.235');
assert.equal(formatSpendingCkb('123450000', 'zh-CN'), '1.235');
assert.equal(formatSpendingCkb('99999999', 'en-US'), '1.000');
assert.equal(formatSpendingCkb('100000001', 'en-US'), '1.000');
assert.equal(formatSpendingCkb('0', 'zh-CN'), '0.000');
assert.equal(formatSpendingCkb('15625453541721220', 'zh-CN'), '156,254,535.417');
assert.equal(formatSpendingCkb('9876543212345678987654321', 'en-US'), '98,765,432,123,456,789.877');
assert.throws(() => formatSpendingCkb('-1', 'en-US'), /negative/);

const entries = [
  { txHash: 'first', timestamp: '2022-12-13T00:00:00Z', amountShannons: '123456789' },
  { txHash: 'second', timestamp: '2023-12-13T00:00:00Z', amountShannons: '987654321' },
  { txHash: 'third', timestamp: '2026-10-15T00:00:00Z', amountShannons: '100000001' },
];
const chart = buildSpendingChart(entries);
assert.equal(chart.points.length, 3, 'The line includes every expenditure, without synthetic daily observations.');
assert.equal(chart.totalShannons, '1211111111', 'Cumulative amounts remain exact in shannons.');
assert.deepEqual(chart.points.map((point) => point.cumulativeShannons), ['123456789', '1111111110', '1211111111']);
assert.equal(chart.ticks[0].value, 0, 'The vertical scale always starts at zero.');
assert.equal(chart.points[0].x, 76);
assert.equal(chart.points.at(-1).x, 738);
assert.ok(chart.points[1].x < (76 + 738) / 2, 'The horizontal scale represents elapsed time, not transaction index.');
assert.ok(chart.points.every((point) => point.y >= 20 && point.y <= 210));
assert.ok(chart.points[0].y > chart.points.at(-1).y, 'Cumulative expenditure rises on the chart.');
assert.equal(buildSpendingChart([]).totalShannons, '0');
assert.equal(buildSpendingChart([entries[0]]).points.length, 1);
assert.throws(() => buildSpendingChart([{ ...entries[0], amountShannons: '0' }]), /positive/);
assert.throws(() => buildSpendingChart([{ ...entries[0], timestamp: 'invalid' }]), /valid timestamp/);
assert.deepEqual(entries.map((entry) => entry.amountShannons), ['123456789', '987654321', '100000001'], 'The chart never mutates source data.');

const root = new URL('../', import.meta.url).pathname;
const compiled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { TreasuryHistoryChart } from './components/treasury-history.tsx';
    import history from './data/treasury-spending.generated.json';
    export const render = () => renderToStaticMarkup(createElement(TreasuryHistoryChart));
    export const transactionCount = history.entries.length;
    export const totalShannons = history.entries.reduce((total, entry) => total + BigInt(entry.amountShannons), BigInt(0)).toString();
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'chart-locale-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/use-locale$/ }, () => ({ path: 'locale', namespace: 'fixture' }));
    builder.onLoad({ filter: /^locale$/, namespace: 'fixture' }, () => ({ contents: `export function useLocale() { const locale = globalThis.__treasuryChartTestLocale ?? 'zh'; return { locale, t: (zh, en) => locale === 'en' ? en : zh }; }` }));
  } }],
});
const output = { exports: {} };
new Script(`(function(require, module, exports) { ${compiled.outputFiles[0].text}\n})`).runInThisContext()(createRequire(new URL('../package.json', import.meta.url)), output, output.exports);
const renderWarnings = [];
const originalConsoleError = console.error;
try {
  console.error = (...items) => renderWarnings.push(items.join(' '));
  for (const locale of ['zh', 'en']) {
    globalThis.__treasuryChartTestLocale = locale;
    const markup = output.exports.render();
    assert.match(markup, locale === 'en' ? /Treasury spending/ : /国库支出/);
    assert.match(markup, locale === 'en' ? /View each expenditure/ : /查看每次支出/);
    assert.doesNotMatch(markup, /View daily records|查看每日记录|Treasury balance history|国库余额记录/);
    assert.equal([...markup.matchAll(/https:\/\/explorer\.nervos\.org\/transaction\//g)].length, output.exports.transactionCount, 'Every historical expenditure has its own source transaction link.');
    assert.match(markup, /href="https:\/\/explorer\.nervos\.org\/address\//, 'The source action opens the human-readable explorer, not a JSON API.');
    assert.match(markup, /type="range"/, 'Keyboard users can inspect individual chart points.');
    assert.ok(markup.includes(formatSpendingCkb(output.exports.totalShannons, locale === 'en' ? 'en-US' : 'zh-CN')), 'The complete recorded history is rendered with three decimal places.');
    assert.equal([...markup.matchAll(/<title>[^<]+<\/title>/g)].length, output.exports.transactionCount, 'Every SVG title renders as one text node, without React SSR comment separators.');
  }
} finally {
  console.error = originalConsoleError;
  delete globalThis.__treasuryChartTestLocale;
}
assert.deepEqual(renderWarnings, [], 'SVG point titles and the complete chart must render without React hydration warnings.');

console.log('Validated exact cumulative expenditure, three-decimal presentation, zero-based chronological chart coordinates, and bilingual rendering with complete transaction links.');
