import { readFile, writeFile } from 'node:fs/promises';
import { addTreasuryObservation, beijingDate, explorerBalanceShannons, TREASURY_BALANCE_API } from '../lib/treasury-history.ts';

const output = new URL('../data/treasury-history.generated.json', import.meta.url);
const saved = JSON.parse(await readFile(output, 'utf8'));
if (saved.observations.some((observation) => observation.date === beijingDate(new Date()))) {
  console.log('A verified treasury observation already exists for this Beijing calendar day.');
} else {
  const response = await fetch(TREASURY_BALANCE_API, {
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Explorer balance lookup failed (${response.status}); existing history is unchanged.`);
  const balance = explorerBalanceShannons(await response.json());
  const next = addTreasuryObservation(saved, balance, new Date());
  await writeFile(output, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Saved verified treasury balance for ${next.observations.at(-1).date}: ${next.observations.at(-1).balanceCkb} CKB.`);
}
