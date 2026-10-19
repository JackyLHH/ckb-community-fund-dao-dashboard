import assert from 'node:assert/strict';
import { addTreasuryObservation, beijingDate, explorerBalanceShannons, shannonsToCkb, TREASURY_ADDRESS, TREASURY_BALANCE_API } from '../lib/treasury-history.ts';

assert.equal(beijingDate(new Date('2026-10-19T15:59:59Z')), '2026-10-19');
assert.equal(beijingDate(new Date('2026-10-19T16:00:00Z')), '2026-10-20');
assert.throws(() => beijingDate(new Date('invalid')), /Invalid/);
assert.equal(shannonsToCkb('123456789'), '1.23456789');
assert.equal(shannonsToCkb('100000001'), '1.00000001');
assert.equal(shannonsToCkb('100000000'), '1');
assert.equal(shannonsToCkb('0'), '0');
assert.equal(shannonsToCkb('9876543212345678987654321'), '98765432123456789.87654321');
for (const invalid of ['1.5', '-1', 'CKB', '']) assert.throws(() => shannonsToCkb(invalid));
assert.equal(explorerBalanceShannons({ data: [{ attributes: { balance: '000123' } }] }), '123');
for (const invalid of [null, {}, { data: [] }, { data: [{ attributes: { balance: 123 } }] }, { data: [{}, {}] }]) {
  assert.throws(() => explorerBalanceShannons(invalid));
}

const empty = { version: 1, address: TREASURY_ADDRESS, timezone: 'Asia/Shanghai', observations: [] };
const first = addTreasuryObservation(empty, '123456789', new Date('2026-10-19T08:00:00Z'));
assert.equal(empty.observations.length, 0, 'Never mutate the existing history');
assert.equal(first.observations.length, 1);
assert.equal(first.observations[0].date, '2026-10-19');
assert.equal(first.observations[0].balanceCkb, '1.23456789');
assert.equal(first.observations[0].sourceUrl, TREASURY_BALANCE_API);
assert.equal(addTreasuryObservation(first, '999999999', new Date('2026-10-19T15:59:00Z')), first, 'Same-day observations do not overwrite history');
const next = addTreasuryObservation(first, '234567891', new Date('2026-10-21T08:00:00Z'));
assert.deepEqual(next.observations.map((item) => item.date), ['2026-10-19', '2026-10-21'], 'Never interpolate missing dates');
assert.throws(() => addTreasuryObservation(next, '1', new Date('2026-10-20T08:00:00Z')), /predates/);
assert.throws(() => addTreasuryObservation({ ...empty, address: 'other' }, '1'), /Unsupported/);

console.log('Validated exact shannon conversion, Beijing day boundaries, once-per-day observations, source evidence, and no invented backfill.');
