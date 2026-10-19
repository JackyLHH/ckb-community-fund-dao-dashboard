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
assert.equal(buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), '2026-10-20T08:00:00.000Z', full), full, 'No-op scans must not change generatedAt or create commits');

const previous = { ...full, transactionsScanned: 2 };
assert.equal(buildTreasurySpendingHistory([page([deposit, spending, refund, internal])], reference('6699989000', 4), verifiedAt, previous), previous, 'New inflows alone do not create new expenditure points or daily records');

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

const validAddress = { data: [{ attributes: { address_hash: TREASURY_ADDRESS, balance: '12345678901234567', transactions_count: '57' } }] };
assert.deepEqual(readExplorerAddressReference(validAddress), reference('12345678901234567', 57));
assert.throws(() => readExplorerAddressReference({ data: [{ attributes: { address_hash: 'wrong', balance: '1', transactions_count: '1' } }] }), /different address/);

const saved = JSON.parse(await readFile(new URL('../data/treasury-spending.generated.json', import.meta.url), 'utf8'));
assert.equal(saved.address, TREASURY_ADDRESS);
assert.equal(saved.complete, true);
assert.ok(saved.transactionsScanned >= 57 && saved.entries.length >= 45, 'Saved history must contain the complete historical ledger, not just the latest daily snapshot');
assert.equal(new Set(saved.entries.map((entry) => entry.txHash)).size, saved.entries.length);
for (let index = 0; index < saved.entries.length; index += 1) {
  const entry = saved.entries[index];
  assert.equal(shannonsToCkb(entry.amountShannons), entry.amountCkb);
  assert.equal(entry.recipients.reduce((total, recipient) => total + BigInt(recipient.amountShannons), 0n).toString(), entry.amountShannons);
  if (index > 0) assert.ok(entry.timestamp >= saved.entries[index - 1].timestamp);
}
console.log('Treasury expenditure tests passed: exact amounts, complete pagination, change/refund/fee exclusion, fail-closed classification, immutable history and no-op scans.');
