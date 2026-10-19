import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTreasuryMonthlyChart, filterTreasuryDisplayPeriod, TREASURY_CHART_START_AT } from '../lib/treasury-chart.ts';

const expense = (txHash, timestamp, amountShannons) => Object.freeze({ txHash, timestamp, amountShannons });
const entries = Object.freeze([
  expense('pre-cutoff', '2023-01-11T15:59:59.999Z', '999999999999'),
  expense('cutoff', TREASURY_CHART_START_AT, '100000001'),
  expense('jan-end', '2023-01-31T15:59:59.999Z', '200000002'),
  expense('feb-start', '2023-01-31T16:00:00.000Z', '300000003'),
  expense('feb-end', '2023-02-28T15:59:59.999Z', '400000004'),
  expense('mar-start', '2023-02-28T16:00:00.000Z', '500000005'),
  expense('at-observation', '2023-03-10T04:30:00.000Z', '600000006'),
  expense('after-observation', '2023-03-10T04:30:00.001Z', '700000007'),
]);
const originalOrder = entries.map((entry) => entry.txHash);
const chart = buildTreasuryMonthlyChart(entries, '2023-03-10T04:30:00.000Z');
assert.deepEqual(chart.months.map((month) => month.key), ['2023-01', '2023-02', '2023-03']);
assert.deepEqual(chart.months.map((month) => month.amountShannons), ['300000003', '700000007', '1100000011'], 'Beijing midnight, not UTC midnight, assigns transactions to a month.');
assert.deepEqual(chart.months.map((month) => month.cumulativeShannons), ['300000003', '1000000010', '2100000021'], 'Each hover total stops at its selected month, not the final global total.');
assert.deepEqual(chart.months.map((month) => month.count), [2, 2, 2]);
assert.equal(chart.totalShannons, '2100000021');
assert.equal(chart.months[0].startAt, TREASURY_CHART_START_AT, 'The first partial month excludes earlier January transactions.');
assert.equal(chart.months[0].endAt, '2023-01-31T15:59:59.999Z');
assert.equal(chart.months.at(-1).endAt, '2023-03-10T04:30:00.000Z', 'The last month ends at the explicitly observed instant.');
assert.ok(chart.months.every((month) => month.x >= 76 && month.x <= 738 && month.y >= 20 && month.y <= 210 && month.width > 0));
assert.ok(chart.months.every((month) => month.x - month.width / 2 >= 76 && month.x + month.width / 2 <= 738), 'Visible bar edges remain inside the shared plot domain.');
assert.ok(chart.months[0].width < chart.months[1].width, 'First partial month uses only its observed elapsed-time width.');
assert.ok(chart.months[2].width < chart.months[0].width, 'The current partial month is not stretched into a complete month.');
const duration = Date.parse('2023-03-10T04:30:00.000Z') - Date.parse(TREASURY_CHART_START_AT);
const januaryMidpoint = Date.parse(TREASURY_CHART_START_AT) + (Date.parse(chart.months[0].endAt) - Date.parse(TREASURY_CHART_START_AT)) / 2;
assert.equal(chart.months[0].x, 76 + ((januaryMidpoint - Date.parse(TREASURY_CHART_START_AT)) / duration) * 662, 'Monthly columns align to the balance chart’s shared elapsed-time domain.');
assert.equal(chart.ticks[0].value, 0);
assert.deepEqual(entries.map((entry) => entry.txHash), originalOrder, 'The verified source ledger remains untouched.');
assert.deepEqual(buildTreasuryMonthlyChart([...entries].reverse(), '2023-03-10T04:30:00.000Z'), chart, 'Expense aggregation is deterministic without mutating chronological source data.');

const zeroMonths = buildTreasuryMonthlyChart([entries[1]], '2023-04-04T00:00:00.000Z');
assert.deepEqual(zeroMonths.months.map((month) => month.key), ['2023-01', '2023-02', '2023-03', '2023-04']);
assert.deepEqual(zeroMonths.months.map((month) => month.amountShannons), ['100000001', '0', '0', '0']);
assert.deepEqual(zeroMonths.months.map((month) => month.cumulativeShannons), ['100000001', '100000001', '100000001', '100000001']);
assert.deepEqual(zeroMonths.months.map((month) => month.count), [1, 0, 0, 0], 'A zero-spending month never creates a fake expenditure.');
assert.equal(zeroMonths.months.at(-1).endAt, '2023-04-04T00:00:00.000Z');

const empty = buildTreasuryMonthlyChart([], '2023-03-15T00:00:00.000Z');
assert.equal(empty.months.length, 3, 'A known reporting period with no spending still retains its observed zero months.');
assert.equal(empty.totalShannons, '0');
assert.ok(empty.months.every((month) => month.y === 210 && month.count === 0));
assert.ok(empty.ticks.every((tick) => Number.isFinite(tick.y) && Number.isFinite(tick.value)), 'An all-zero chart does not divide by zero.');
const beforeStart = buildTreasuryMonthlyChart(entries, '2023-01-11T15:59:59.999Z');
assert.equal(beforeStart.months.length, 0);
assert.equal(beforeStart.totalShannons, '0');

const instant = buildTreasuryMonthlyChart([entries[1]], TREASURY_CHART_START_AT);
assert.equal(instant.months.length, 1);
assert.equal(instant.months[0].startAt, instant.months[0].endAt);
assert.equal(instant.months[0].amountShannons, '100000001');
assert.equal(instant.months[0].x, 76.5, 'A one-instant mark remains at the start edge without stretching across a fictional time range.');
assert.equal(instant.months[0].width, 1);
assert.ok(Number.isFinite(instant.months[0].y));
const exactNewMonth = buildTreasuryMonthlyChart([entries[2], entries[3]], entries[3].timestamp);
assert.deepEqual(exactNewMonth.months.map((month) => month.key), ['2023-01', '2023-02']);
assert.deepEqual(exactNewMonth.months.map((month) => month.count), [1, 1], 'An expense at a month boundary belongs to the new month exactly once.');
assert.ok(exactNewMonth.months.every((month) => month.x - month.width / 2 >= 76 && month.x + month.width / 2 <= 738), 'A boundary-only current month does not spill outside the right axis.');

const huge = '900719925474099300000001';
const precise = buildTreasuryMonthlyChart([
  expense('huge', '2023-01-12T00:00:00Z', huge),
  expense('tiny', '2023-02-12T00:00:00Z', '1'),
], '2023-03-01T00:00:00Z');
assert.equal(precise.months[0].amountShannons, huge);
assert.equal(precise.months[1].cumulativeShannons, (BigInt(huge) + 1n).toString(), 'Amounts and cumulative totals never pass through IEEE floating-point arithmetic.');
assert.equal(precise.totalShannons, (BigInt(huge) + 1n).toString());

assert.throws(() => buildTreasuryMonthlyChart([], 'invalid'), /valid end timestamp/);
assert.throws(() => buildTreasuryMonthlyChart([], TREASURY_CHART_START_AT, 'invalid'), /valid start timestamp/);
assert.throws(() => buildTreasuryMonthlyChart([expense('bad', 'invalid', '1')], TREASURY_CHART_START_AT), /valid timestamp/);
for (const amount of ['-1', '0', '1.5', 'NaN', '', '0x10', 1, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => buildTreasuryMonthlyChart([expense('bad', TREASURY_CHART_START_AT, amount)], TREASURY_CHART_START_AT), /positive integer/);
}
assert.throws(() => buildTreasuryMonthlyChart([entries[1], entries[1]], TREASURY_CHART_START_AT), /duplicated/);
assert.throws(() => buildTreasuryMonthlyChart([entries[0], entries[0]], TREASURY_CHART_START_AT), /duplicated/, 'Excluded historical transactions are also validated, never silently deduplicated.');

// Full ledger supplies only verified external expenditure entries. Its separate
// balance records include incoming funding, refunds and fees and are not summed.
const history = JSON.parse(await readFile(new URL('../data/treasury-spending.generated.json', import.meta.url), 'utf8'));
const fixedHorizon = '2026-10-19T06:53:51.132Z';
const fixed = buildTreasuryMonthlyChart(history.entries, fixedHorizon);
assert.equal(fixed.months.find((month) => month.key === '2026-10').amountShannons, '502406000000000', 'Known October 2026 prefix totals 5,024,060 CKB, not incoming transfers or fees.');
assert.equal(fixed.totalShannons, '12354595643096420');
assert.equal(fixed.months.at(-1).cumulativeShannons, '12354595643096420');
assert.equal(fixed.months.reduce((total, month) => total + month.count, 0), 41, 'Known cutoff-to-observation snapshot has 41 real expenditures.');
const observedEnd = history.balances.at(-1)?.timestamp ?? history.generatedAt;
const current = buildTreasuryMonthlyChart(history.entries, observedEnd);
const inPeriod = filterTreasuryDisplayPeriod(history.entries).filter((entry) => Date.parse(entry.timestamp) <= Date.parse(observedEnd));
const exactTotal = inPeriod.reduce((total, entry) => total + BigInt(entry.amountShannons), 0n).toString();
assert.equal(current.totalShannons, exactTotal, 'Future ledger additions continue to reconcile with the full in-period external expenditure ledger.');
assert.equal(current.months.reduce((total, month) => total + BigInt(month.amountShannons), 0n).toString(), exactTotal);
assert.equal(current.months.at(-1)?.cumulativeShannons, exactTotal);
assert.equal(current.months.reduce((total, month) => total + month.count, 0), inPeriod.length);
assert.equal(current.months.length, (Number(current.months.at(-1).key.slice(0, 4)) - 2023) * 12 + Number(current.months.at(-1).key.slice(5)), 'Every Beijing calendar month in the observation period exists, including zero-spending months.');

console.log('Validated Beijing calendar month boundaries, observed partial periods, zero months, exact per-month cumulative spending, source immutability, and complete historical reconciliation.');
