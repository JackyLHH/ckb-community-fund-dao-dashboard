import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildTreasurySpendingHistory, readExplorerAddressReference, readExplorerTransactionsPage,
  shannonsToCkb, TREASURY_ADDRESS, TREASURY_SPENDING_URL,
} from '../lib/treasury-spending.ts';

const other = 'ckb-public-recipient';
const third = 'ckb-second-recipient';
const cell = (address, capacity, extra = {}) => ({ address_hash: address, capacity: `${capacity}.0`, cell_type: 'normal', type_script: '', ...extra });
const hash = (id) => `0x${BigInt(id).toString(16).padStart(64, '0')}`;
const transaction = (id, inputs, outputs, extra = {}) => ({
  id: String(id), type: 'ckb_transactions', attributes: {
    is_cellbase: false, transaction_hash: hash(id), block_number: String(id), block_timestamp: String(1_700_000_000_000 + id * 1000),
    display_inputs_count: inputs.length, display_outputs_count: outputs.length,
    display_inputs: inputs, display_outputs: outputs, ...extra,
  },
});
const rawPage = (data, total = data.length, pageSize = total || 1) => ({ data, meta: { total, page_size: pageSize, total_pages: Math.ceil(total / pageSize) } });
const page = (data, total, pageSize) => readExplorerTransactionsPage(rawPage(data, total, pageSize));
const reference = (balance, transactionsCount) => ({ address: TREASURY_ADDRESS, balanceShannons: String(balance), transactionsCount });
const verifiedAt = '2026-10-19T08:00:00.000Z';

assert.equal(shannonsToCkb('100000000'), '1');
assert.equal(shannonsToCkb('1'), '0.00000001');
assert.equal(shannonsToCkb('900719925474099312345'), '9007199254740.99312345');
assert.throws(() => shannonsToCkb('1.1'), /integer strings/);
assert.throws(() => shannonsToCkb('-1'), /integer strings/);

const deposit = transaction(1, [cell(other, '10001000000')], [cell(TREASURY_ADDRESS, '10000000000')]);
const spending = transaction(2, [cell(TREASURY_ADDRESS, '10000000000')], [
  cell(TREASURY_ADDRESS, '4699990000'), cell(other, '3000000000'), cell(other, '2000000000'), cell(third, '300000000'),
]);
const refund = transaction(3, [cell(other, '2000100000')], [cell(TREASURY_ADDRESS, '2000000000')]);
const internal = transaction(4, [cell(TREASURY_ADDRESS, '4699990000'), cell(TREASURY_ADDRESS, '2000000000')], [cell(TREASURY_ADDRESS, '6699989000')]);
const full = buildTreasurySpendingHistory([page([internal, refund, spending, deposit])], reference('6699989000', 4), verifiedAt);
assert.equal(full.complete, true);
assert.equal(full.entries.length, 1, 'Refunds, incoming funds and change/internal transfers are not expenses');
assert.equal(full.entries[0].amountCkb, '53');
assert.equal(full.entries[0].feeShannons, '10000', 'Fees are not included in expenditure amount');
assert.deepEqual(full.entries[0].recipients.map((recipient) => recipient.amountCkb).sort(), ['3', '50']);
assert.equal(full.transactionsScanned, 4);
assert.equal(full.sourceUrl, TREASURY_SPENDING_URL);
assert.deepEqual(full.balances, [
  { txHash: hash(1), timestamp: '2023-11-14T22:13:21.000Z', balanceShannons: '10000000000' },
  { txHash: hash(2), timestamp: '2023-11-14T22:13:22.000Z', balanceShannons: '4699990000' },
  { txHash: hash(3), timestamp: '2023-11-14T22:13:23.000Z', balanceShannons: '6699990000' },
  { txHash: hash(4), timestamp: '2023-11-14T22:13:24.000Z', balanceShannons: '6699989000' },
], 'Every chronological address transaction has an exact post-transaction balance, including deposits, refunds and internal fees');
assert.ok(BigInt(full.balances[2].balanceShannons) > BigInt(full.balances[1].balanceShannons), 'Refunds raise the treasury balance without reducing cumulative expenditure');
assert.equal(BigInt(full.balances[2].balanceShannons) - BigInt(full.balances[3].balanceShannons), 1000n, 'Internal consolidation fees reduce the true balance but are not expenses');
assert.equal(buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), '2026-10-20T08:00:00.000Z', full), full, 'No-op scans must not change generatedAt or create commits');

const beforeRefund = buildTreasurySpendingHistory([page([deposit, spending])], reference('4699990000', 2), verifiedAt);
const afterRefund = buildTreasurySpendingHistory([page([deposit, spending, refund])], reference('6699990000', 3), '2026-10-20T08:00:00.000Z', beforeRefund);
assert.notEqual(afterRefund, beforeRefund, 'New inflows must update saved balance data even if no new expenditure appears');
assert.deepEqual(afterRefund.entries, beforeRefund.entries);
assert.equal(afterRefund.balances.length, 3);
assert.equal(afterRefund.generatedAt, '2026-10-20T08:00:00.000Z');
assert.equal(buildTreasurySpendingHistory([page([refund, deposit, spending])], reference('6699990000', 3), '2026-10-21T08:00:00.000Z', afterRefund), afterRefund, 'Repeated scans after an inflow are still idempotent');

const legacy = { ...full };
delete legacy.balances;
const migrated = buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), '2026-10-20T08:00:00.000Z', legacy);
assert.notEqual(migrated, legacy, 'Legacy version-1 expenditure files must be backfilled from the fully reconciled ledger');
assert.equal(migrated.version, 1);
assert.deepEqual(migrated.entries, legacy.entries, 'A migration cannot modify previously verified expenditure');
assert.deepEqual(migrated.balances, full.balances);
assert.equal(migrated.generatedAt, '2026-10-20T08:00:00.000Z');
assert.equal(buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), '2026-10-21T08:00:00.000Z', migrated), migrated, 'Migration happens once, not on every scan');
const malformedBalances = { ...full, balances: full.balances.slice(1) };
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), verifiedAt, malformedBalances), /Unsupported saved treasury balance/);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending])], reference('4699990000', 2), verifiedAt, afterRefund), /balance changed or disappeared/, 'A previously verified incoming/refund balance cannot silently disappear');
const changedRefund = structuredClone(refund);
changedRefund.attributes.display_outputs[0].capacity = '2000000001.0';
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending, changedRefund, internal])], reference('6699989001', 4), verifiedAt, full), /balance changed or disappeared/, 'Changed historical balance values require review even if all expenditure is unchanged');
const changedDepositTimestamp = structuredClone(deposit);
changedDepositTimestamp.attributes.block_timestamp = '1700000001001';
assert.throws(() => buildTreasurySpendingHistory([page([changedDepositTimestamp, spending, refund, internal])], reference('6699989000', 4), verifiedAt, full), /balance changed or disappeared/, 'Balance timestamps are part of verified history');

const secondSpend = transaction(5, [cell(TREASURY_ADDRESS, '6699989000')], [cell(TREASURY_ADDRESS, '5699988000'), cell(other, '1000000000')]);
const multiple = buildTreasurySpendingHistory([page([secondSpend, internal, refund, spending, deposit])], reference('5699988000', 5), verifiedAt, full);
assert.deepEqual(multiple.entries.map((entry) => entry.txHash), [hash(2), hash(5)], 'Expenditures are chronological, not API/page order');

const paged = buildTreasurySpendingHistory([
  page([deposit, spending], 3, 2), page([spending, refund], 3, 2),
], reference('6699990000', 3), verifiedAt);
assert.equal(paged.entries.length, 1, 'Identical transaction duplicates must not be counted twice');
assert.equal(paged.transactionsScanned, 3);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending], 3, 2)], reference('4699990000', 3), verifiedAt), /coverage/);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending], 3, 2), page([spending], 3, 2)], reference('4699990000', 3), verifiedAt), /duplicate-only/);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending])], reference('1', 2), verifiedAt), /reconcile/);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending])], reference('4699990000', 3), verifiedAt), /coverage/);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending])], reference('4699990000', 2), verifiedAt, multiple), /disappeared/, 'Changed/reorged historical expenditures require review');
const sameBlockSpending = structuredClone(spending);
sameBlockSpending.attributes.block_number = deposit.attributes.block_number;
assert.throws(() => buildTreasurySpendingHistory([page([sameBlockSpending, deposit])], reference('4699990000', 2), verifiedAt), /same block need verified transaction order/, 'Database IDs must not be mistaken for a verified same-block execution order');
const regressingTimestamp = structuredClone(spending);
regressingTimestamp.attributes.block_timestamp = '1699999999999';
assert.throws(() => buildTreasurySpendingHistory([page([regressingTimestamp, deposit])], reference('4699990000', 2), verifiedAt), /timestamps regress/, 'Canonical balance order must never be silently rearranged to fit a chronological chart');

const conflict = structuredClone(spending);
conflict.attributes.display_outputs[1].capacity = '2999999999.0';
assert.throws(() => buildTreasurySpendingHistory([page([deposit, spending], 3, 2), page([conflict, refund], 3, 2)], reference('6699990000', 3), verifiedAt), /Conflicting duplicate/);
const mixed = transaction(2, [cell(TREASURY_ADDRESS, '10000000000'), cell(other, '1000000000')], [cell(TREASURY_ADDRESS, '10000000000'), cell(third, '999999000')]);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, mixed])], reference('10000000000', 2), verifiedAt), /Mixed-funded/);
const daoMovement = transaction(2, [cell(TREASURY_ADDRESS, '10000000000')], [cell(TREASURY_ADDRESS, '9999990000', { cell_type: 'nervos_dao_deposit' })]);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, daoMovement])], reference('9999990000', 2), verifiedAt), /typed cell/);
const typedExternal = transaction(2, [cell(TREASURY_ADDRESS, '10000000000')], [cell(other, '9999990000', { type_script: { code_hash: 'unknown' } })]);
assert.throws(() => buildTreasurySpendingHistory([page([deposit, typedExternal])], reference('0', 2), verifiedAt), /Typed external/);

const truncated = structuredClone(spending);
truncated.attributes.display_outputs_count += 1;
assert.throws(() => page([truncated]), /truncated/);
const numericCapacity = structuredClone(deposit);
numericCapacity.attributes.display_outputs[0].capacity = 10000000000;
assert.throws(() => page([numericCapacity]), /integer strings/);
assert.throws(() => readExplorerTransactionsPage({ data: [], meta: { total: 10001, total_pages: 100, page_size: 100 } }), /pagination/);

const preciseDeposit = transaction(1, [cell(other, '900719925474099312345')], [cell(TREASURY_ADDRESS, '900719925474099312345')]);
const preciseSpend = transaction(2, [cell(TREASURY_ADDRESS, '900719925474099312345')], [cell(TREASURY_ADDRESS, '1'), cell(other, '900719925474099312343')]);
const precise = buildTreasurySpendingHistory([page([preciseSpend, preciseDeposit])], reference('1', 2), verifiedAt);
assert.equal(precise.entries[0].amountShannons, '900719925474099312343');
assert.equal(precise.entries[0].amountCkb, '9007199254740.99312343');
assert.equal(precise.entries[0].feeShannons, '1');
assert.deepEqual(precise.balances.map((entry) => entry.balanceShannons), ['900719925474099312345', '1'], 'Balance history must retain integer precision far beyond JavaScript safe integers');

const validAddress = { data: [{ attributes: { address_hash: TREASURY_ADDRESS, balance: '12345678901234567', transactions_count: '57' } }] };
assert.deepEqual(readExplorerAddressReference(validAddress), reference('12345678901234567', 57));
assert.throws(() => readExplorerAddressReference({ data: [{ attributes: { address_hash: 'wrong', balance: '1', transactions_count: '1' } }] }), /different address/);

const saved = JSON.parse(await readFile(new URL('../data/treasury-spending.generated.json', import.meta.url), 'utf8'));
assert.equal(saved.address, TREASURY_ADDRESS);
assert.equal(saved.complete, true);
assert.ok(saved.transactionsScanned >= 57 && saved.entries.length >= 45, 'Saved history must contain the complete historical ledger, not just the latest daily snapshot');
assert.equal(new Set(saved.entries.map((entry) => entry.txHash)).size, saved.entries.length);
assert.equal(saved.balances.length, saved.transactionsScanned, 'Persisted balance history must include every verified address transaction');
assert.equal(new Set(saved.balances.map((entry) => entry.txHash)).size, saved.balances.length);
const savedBalances = new Map(saved.balances.map((entry) => [entry.txHash, entry]));
for (let index = 0; index < saved.balances.length; index += 1) {
  const entry = saved.balances[index];
  assert.match(entry.balanceShannons, /^\d+$/);
  assert.ok(Number.isFinite(new Date(entry.timestamp).getTime()));
  if (index > 0) assert.ok(entry.timestamp >= saved.balances[index - 1].timestamp);
}
for (let index = 0; index < saved.entries.length; index += 1) {
  const entry = saved.entries[index];
  assert.equal(savedBalances.get(entry.txHash)?.timestamp, entry.timestamp, 'Every expenditure must correspond to a verified post-transaction balance');
  assert.equal(shannonsToCkb(entry.amountShannons), entry.amountCkb);
  assert.equal(entry.recipients.reduce((total, recipient) => total + BigInt(recipient.amountShannons), 0n).toString(), entry.amountShannons);
  if (index > 0) assert.ok(entry.timestamp >= saved.entries[index - 1].timestamp);
}
console.log('Treasury ledger tests passed: exact expenditures and complete post-transaction balances, refunds/internal fees, legacy migration, immutable history and no-op scans.');
