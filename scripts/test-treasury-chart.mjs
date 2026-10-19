import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { buildSpendingChart, buildTreasuryChart, filterTreasuryDisplayPeriod, formatSpendingCkb, formatTreasuryTimestamp, TREASURY_CHART_START_AT } from '../lib/treasury-chart.ts';

assert.equal(formatSpendingCkb('123456789', 'en-US'), '1.235');
assert.equal(formatSpendingCkb('123450000', 'zh-CN'), '1.235');
assert.equal(formatSpendingCkb('99999999', 'en-US'), '1.000');
assert.equal(formatSpendingCkb('100000001', 'en-US'), '1.000');
assert.equal(formatSpendingCkb('0', 'zh-CN'), '0.000');
assert.equal(formatSpendingCkb('15625453541721220', 'zh-CN'), '156,254,535.417');
assert.equal(formatSpendingCkb('9876543212345678987654321', 'en-US'), '98,765,432,123,456,789.877');
assert.throws(() => formatSpendingCkb('-1', 'en-US'), /negative/);
assert.equal(formatTreasuryTimestamp('2026-10-19T06:53:51.132Z'), '2026/10/19 14:53:51', 'Show exact Beijing seconds, discarding subsecond precision without rounding.');
assert.equal(formatTreasuryTimestamp('2026-01-01T16:00:00Z'), '2026/01/02 00:00:00', 'Beijing midnight uses 00, never 24.');
assert.equal(formatTreasuryTimestamp('2026-01-01T15:59:59.999Z'), '2026/01/01 23:59:59');
assert.throws(() => formatTreasuryTimestamp('invalid'), /valid timestamp/);

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

const balances = [
  { txHash: 'funding', timestamp: '2022-01-01T00:00:00Z', balanceShannons: '100000000000' },
  { txHash: 'expense-1', timestamp: '2023-01-01T00:00:00Z', balanceShannons: '89999999900' },
  { txHash: 'refund', timestamp: '2023-06-01T00:00:00Z', balanceShannons: '94999999900' },
  { txHash: 'internal', timestamp: '2023-09-01T00:00:00Z', balanceShannons: '94999999850' },
  { txHash: 'expense-2', timestamp: '2026-01-01T00:00:00Z', balanceShannons: '74999999750' },
];
const expenses = [
  { txHash: 'expense-1', timestamp: balances[1].timestamp, amountShannons: '10000000000' },
  { txHash: 'expense-2', timestamp: balances[4].timestamp, amountShannons: '20000000000' },
];
const dualChart = buildTreasuryChart(expenses, balances);
assert.equal(dualChart.points.length, balances.length, 'Keep every on-chain transaction, not just expense timestamps.');
assert.equal(dualChart.totalShannons, '30000000000', 'Incoming transfers, refunds, and fees do not count as expenditure.');
assert.equal(dualChart.latestBalanceShannons, '74999999750', 'The actual balance retains fees and refunds to exact shannon precision.');
assert.deepEqual(dualChart.points.map((point) => point.cumulativeShannons), ['0', '10000000000', '10000000000', '10000000000', '30000000000']);
assert.deepEqual(dualChart.points.map((point) => point.balanceShannons), balances.map((point) => point.balanceShannons));
assert.equal(dualChart.points[0].x, 76);
assert.equal(dualChart.points.at(-1).x, 738);
assert.ok(dualChart.points[1].x > 76, 'The balance history starts before the first expense, on the shared full-history time axis.');
assert.equal(dualChart.points[2].spendingY, dualChart.points[1].spendingY, 'Refunds do not raise cumulative expenditure.');
assert.ok(dualChart.points[2].balanceY < dualChart.points[1].balanceY, 'A refund raises the balance line.');
assert.equal(dualChart.points[3].spendingY, dualChart.points[2].spendingY, 'Internal transfer fees are not counted as expenditures.');
assert.ok(dualChart.points[3].balanceY > dualChart.points[2].balanceY, 'Fees decrease the actual balance.');
assert.equal(dualChart.ticks[0].value, 0);
assert.equal(dualChart.ticks.at(-1).value, 1000, 'Both series share one CKB scale covering the historical maximum, not separate axes.');
assert.equal(dualChart.points[0].balanceY, 20);
assert.equal(dualChart.points[0].spendingY, 210);
assert.ok(dualChart.points.every((point) => point.spendingY >= 20 && point.spendingY <= 210 && point.balanceY >= 20 && point.balanceY <= 210));
assert.equal(buildTreasuryChart(entries).latestBalanceShannons, null, 'Legacy data must never invent historical balances.');
assert.ok(buildTreasuryChart(entries).points.every((point) => point.balanceY === null));
assert.equal(buildTreasuryChart([], balances).points.length, balances.length, 'Balances render even if no expenditures exist.');
assert.equal(buildTreasuryChart([]).points.length, 0);
assert.throws(() => buildTreasuryChart([], [{ ...balances[0], balanceShannons: '-1' }]), /negative/);
assert.throws(() => buildTreasuryChart([], [{ ...balances[0], timestamp: 'invalid' }]), /valid timestamp/);
assert.throws(() => buildTreasuryChart([{ ...expenses[0], timestamp: balances[0].timestamp }], balances), /conflicting timestamps/);
assert.throws(() => buildTreasuryChart([], [balances[1], balances[0]]), /verified chronological ledger order/, 'Never reorder authoritative balance states based on a regressing block clock.');
assert.throws(() => buildTreasuryChart([], [balances[0], balances[0]]), /duplicated/);
assert.throws(() => buildTreasuryChart([expenses[0], expenses[0]], balances), /duplicated/);
assert.throws(() => buildTreasuryChart(expenses, [balances[0]]), /requires its verified transaction balance/, 'Never silently infer a missing post-transaction balance.');

assert.equal(TREASURY_CHART_START_AT, '2023-01-11T16:00:00.000Z', 'Reporting starts at Beijing midnight, not UTC midnight.');
const boundaryBalances = [
  { txHash: 'before', timestamp: '2023-01-11T15:59:59.999Z', balanceShannons: '90000000000' },
  { txHash: 'exact', timestamp: '2023-01-11T16:00:00.000Z', balanceShannons: '79999999900' },
  { txHash: 'after', timestamp: '2023-01-11T16:00:00.001Z', balanceShannons: '59999999800' },
  { txHash: 'later-refund', timestamp: '2026-02-01T00:00:00Z', balanceShannons: '64999999800' },
  { txHash: 'later-fee', timestamp: '2026-03-01T00:00:00Z', balanceShannons: '64999999750' },
  { txHash: 'future-inflow', timestamp: '2027-01-01T00:00:00Z', balanceShannons: '74999999750' },
];
const boundaryExpenses = boundaryBalances.slice(0, 3).map((balance, index) => ({ txHash: balance.txHash, timestamp: balance.timestamp, amountShannons: index === 2 ? '20000000000' : '10000000000' }));
const filteredExpenses = filterTreasuryDisplayPeriod(boundaryExpenses);
assert.deepEqual(filteredExpenses.map((entry) => entry.txHash), ['exact', 'after'], 'The boundary is inclusive; one millisecond earlier is excluded from counts and rows.');
assert.equal(boundaryExpenses.length, 3, 'Filtering never changes the full source ledger.');
assert.throws(() => filterTreasuryDisplayPeriod([], 'invalid'), /valid start timestamp/);
assert.throws(() => filterTreasuryDisplayPeriod([{ timestamp: 'invalid' }]), /valid timestamp/);
const periodChart = buildTreasuryChart(boundaryExpenses, boundaryBalances, TREASURY_CHART_START_AT);
assert.equal(periodChart.points[0].timestamp, TREASURY_CHART_START_AT, 'The x-axis begins at the exact reporting cutoff.');
assert.equal(periodChart.points[0].x, 76);
assert.equal(periodChart.points[0].txHash, null, 'The opening state is not a fabricated transaction.');
assert.equal(periodChart.points[0].isOpening, true);
assert.equal(periodChart.points[0].cumulativeShannons, '0', 'Cumulative spending resets at the requested period.');
assert.equal(periodChart.points[0].balanceShannons, '90000000000', 'The opening balance carries the last verified pre-period state.');
assert.equal(periodChart.points.filter((point) => point.txHash === 'exact').length, 1, 'A transaction exactly at the cutoff is counted once, independently of the opening state.');
assert.equal(periodChart.points[1].x, 76, 'The opening state and transaction at the same timestamp share the same x-coordinate.');
assert.ok(periodChart.points.every((point) => Date.parse(point.timestamp) >= Date.parse(TREASURY_CHART_START_AT)));
assert.equal(periodChart.totalShannons, '30000000000', 'Pre-period spending is excluded from the plotted cumulative amount.');
assert.equal(periodChart.latestBalanceShannons, '74999999750', 'Historical spending, refunds, fees and future inflows remain reflected in the real latest balance.');
assert.deepEqual(periodChart.points.slice(1).map((point) => point.balanceShannons), boundaryBalances.slice(1).map((balance) => balance.balanceShannons), 'Reporting filters never reconstruct balances as initial capital minus displayed spending.');
const noOpeningBalance = buildTreasuryChart([boundaryExpenses[1]], [boundaryBalances[1]], TREASURY_CHART_START_AT);
assert.equal(noOpeningBalance.points[0].balanceShannons, null, 'An unknown opening balance is not invented.');
assert.equal(noOpeningBalance.points[0].balanceY, null);
assert.equal(noOpeningBalance.points[1].balanceShannons, boundaryBalances[1].balanceShannons);
assert.ok(noOpeningBalance.points.every((point) => point.x === 76), 'Same-instant states are not stretched into a fictional time range.');
const prePeriodOnly = buildTreasuryChart([boundaryExpenses[0]], [boundaryBalances[0]], TREASURY_CHART_START_AT);
assert.equal(prePeriodOnly.points.length, 1, 'Only the opening state remains when all transactions precede the display period.');
assert.equal(prePeriodOnly.totalShannons, '0');
assert.equal(prePeriodOnly.latestBalanceShannons, boundaryBalances[0].balanceShannons);
assert.equal(buildTreasuryChart([], [], TREASURY_CHART_START_AT).points.length, 0, 'An empty ledger does not invent an opening record.');
assert.equal(buildTreasuryChart(boundaryExpenses, boundaryBalances).points.length, boundaryBalances.length, 'Generic callers retain the full-history behavior when no period is requested.');

const root = new URL('../', import.meta.url).pathname;
const compiled = await build({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { TreasuryHistoryChart } from './components/treasury-history.tsx';
    import history from './data/treasury-spending.generated.json';
    import { buildTreasuryChart, buildTreasuryMonthlyChart, filterTreasuryDisplayPeriod, TREASURY_CHART_START_AT } from './lib/treasury-chart.ts';
    export const render = (fixture = history) => renderToStaticMarkup(createElement(TreasuryHistoryChart, { history: fixture }));
    const period = filterTreasuryDisplayPeriod(history.entries);
    const chart = buildTreasuryChart(history.entries, history.balances, TREASURY_CHART_START_AT);
    const monthly = buildTreasuryMonthlyChart(history.entries, chart.points.at(-1).timestamp);
    export const transactionCount = period.length;
    export const titleCount = monthly.months.length + chart.points.filter((point) => point.balanceY !== null).length;
    export const months = monthly.months;
    export const latestBalanceShannons = history.balances.at(-1).balanceShannons;
    export const latestTimestamp = history.entries.at(-1).timestamp;
    export const totalShannons = period.reduce((total, entry) => total + BigInt(entry.amountShannons), BigInt(0)).toString();
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
    assert.match(markup, locale === 'en' ? /Treasury balance &amp; spending/ : /国库余额与支出/);
    assert.match(markup, locale === 'en' ? /Cumulative spending/ : /累计支出/);
    assert.match(markup, locale === 'en' ? /Treasury balance/ : /国库余额/);
    assert.match(markup, locale === 'en' ? /View each expenditure/ : /查看每次支出/);
    assert.doesNotMatch(markup, /View daily records|查看每日记录|Treasury balance history|国库余额记录/);
    assert.equal([...markup.matchAll(/https:\/\/explorer\.nervos\.org\/transaction\//g)].length, output.exports.transactionCount, 'Every in-period expenditure has its own source transaction link; the opening state does not.');
    assert.match(markup, /href="https:\/\/explorer\.nervos\.org\/address\//, 'The source action opens the human-readable explorer, not a JSON API.');
    assert.equal([...markup.matchAll(/type="range"/g)].length, 2, 'Keyboard users can inspect balance events and every month independently.');
    assert.doesNotMatch(markup, /data-series="spending"/, 'Do not overlay the former cumulative spending curve.');
    assert.match(markup, /data-series="monthly-spending"/, 'Aggregate expenditures into monthly columns.');
    assert.match(markup, /data-series="balance"/, 'Render the historical balance curve.');
    assert.match(markup, /data-series="balance-area"/, 'The balance curve has the selected reference style’s subtle area.');
    assert.doesNotMatch(markup, /stroke-dasharray|border-dashed|虚线|dashed/, 'Balance line and gridlines are solid.');
    assert.match(markup, /data-series="balance"[^>]*class="text-primary"/, 'The balance curve uses the website’s actual green theme token.');
    assert.doesNotMatch(markup, /(?:text|bg|border|fill|stroke)-blue|蓝色|\bblue\b/, 'Balance, icons, dots, and spending never introduce blue.');
    assert.match(markup, /bg-primary/, 'The balance and monthly-spending legend icons match the green theme.');
    assert.equal([...markup.matchAll(/data-series="monthly-spending"/g)].length, output.exports.months.length, 'Retain a selectable column slot for every month, including zero-spending months.');
    for (const month of output.exports.months) {
      const amount = formatSpendingCkb(month.amountShannons, locale === 'en' ? 'en-US' : 'zh-CN');
      const cumulative = formatSpendingCkb(month.cumulativeShannons, locale === 'en' ? 'en-US' : 'zh-CN');
      const column = markup.match(new RegExp(`<rect[^>]*data-month="${month.key}"[^>]*><title>([^<]+)</title>`));
      assert.ok(column, `Render the ${month.key} column with a plain-text native hover title.`);
      assert.ok(column[1].includes(amount) && column[1].includes(cumulative), 'Every monthly hover title includes its own spending AND cumulative spending through that month.');
      assert.match(column[1], locale === 'en' ? /Monthly spending.*Cumulative spending/ : /当月支出.*累计支出/);
    }
    assert.match(markup, /data-month-readout=/, 'A persistent readout supports pointer, tap, and keyboard inspection, not hover-only information.');
    assert.match(markup, /<th[^>]*>(?:Transaction details|交易详情)<\/th>/, 'The last column has a visible bilingual heading, not screen-reader-only text.');
    assert.ok(markup.includes(formatTreasuryTimestamp(output.exports.latestTimestamp)), 'Each expenditure displays full Beijing date and seconds.');
    assert.ok(markup.includes(formatSpendingCkb(output.exports.totalShannons, locale === 'en' ? 'en-US' : 'zh-CN')), 'The in-period cumulative total is rendered with three decimal places.');
    assert.ok(markup.includes(formatSpendingCkb(output.exports.latestBalanceShannons, locale === 'en' ? 'en-US' : 'zh-CN')), 'The exact latest balance is rendered with three decimal places.');
    assert.equal([...markup.matchAll(/<title>[^<]+<\/title>/g)].length, output.exports.titleCount, 'Each balance event and calendar month has a single-text-node SVG title.');
    assert.match(markup, locale === 'en' ? /Jan 12, 2023/ : /2023年1月12日/, 'The displayed x-axis starts on 12 January 2023 in Beijing time.');
    assert.ok([...markup.matchAll(/<time dateTime="([^"]+)"/g)].every((match) => Date.parse(match[1]) >= Date.parse(TREASURY_CHART_START_AT)), 'All displayed table and selected timestamps are within the reporting period.');
    const fixtureMarkup = output.exports.render({ complete: true, entries: boundaryExpenses.map((entry) => ({ ...entry, recipients: [] })), balances: boundaryBalances });
    assert.ok(!fixtureMarkup.includes('/transaction/before'), 'Pre-period transactions never appear in the expenditure table.');
    assert.ok(fixtureMarkup.includes('/transaction/exact') && fixtureMarkup.includes('/transaction/after'), 'Both exact-boundary and later expenses appear.');
    assert.match(fixtureMarkup, locale === 'en' ? /2 expenditures/ : /2 次支出/);
    assert.equal([...fixtureMarkup.matchAll(/https:\/\/explorer\.nervos\.org\/transaction\//g)].length, 2, 'Neither the opening anchor nor non-expense ledger events create transaction rows.');
  }
} finally {
  console.error = originalConsoleError;
  delete globalThis.__treasuryChartTestLocale;
}
assert.deepEqual(renderWarnings, [], 'SVG point titles and the complete chart must render without React hydration warnings.');

console.log('Validated inclusive Beijing cutoff, real balances, green balance-area and monthly-column panels, exact monthly/cumulative hover values, complete expenditure rows, and bilingual accessible rendering.');
