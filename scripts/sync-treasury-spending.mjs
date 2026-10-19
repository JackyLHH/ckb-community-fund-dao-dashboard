import { readFile, rename, writeFile } from 'node:fs/promises';
import {
  buildTreasurySpendingHistory, readExplorerAddressReference, readExplorerTransactionsPage,
  TREASURY_BALANCE_API, TREASURY_SPENDING_URL,
} from '../lib/treasury-spending.ts';

const output = new URL('../data/treasury-spending.generated.json', import.meta.url);
let saved;
try {
  saved = JSON.parse(await readFile(output, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const deadline = Date.now() + 55_000;
async function publicJson(url) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('Treasury verification timed out; saved expenditures and balances are unchanged');
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    signal: AbortSignal.timeout(Math.min(15_000, remaining)),
  });
  if (!response.ok) throw new Error(`Explorer request failed (${response.status}); saved expenditures and balances are unchanged`);
  return response.json();
}

// A transaction arriving between requests can shift pages. Verify the full scan
// against a freshly fetched address reference; retry the complete scan once.
let next;
for (let attempt = 0; attempt < 2; attempt += 1) {
  try {
    const first = readExplorerTransactionsPage(await publicJson(`${TREASURY_SPENDING_URL}?page=1&page_size=100`));
    if (first.totalPages > 100) throw new Error('Treasury history exceeds the safe scan limit; manual review required');
    const pages = [first];
    for (let page = 2; page <= first.totalPages; page += 1) {
      pages.push(readExplorerTransactionsPage(await publicJson(`${TREASURY_SPENDING_URL}?page=${page}&page_size=100`)));
    }
    const reference = readExplorerAddressReference(await publicJson(TREASURY_BALANCE_API));
    next = buildTreasurySpendingHistory(pages, reference, new Date().toISOString(), saved);
    break;
  } catch (error) {
    const race = /snapshot|pagination changed|duplicate-only/.test(error.message);
    if (!race || attempt === 1 || Date.now() >= deadline - 3_000) throw error;
  }
}
if (next === saved) {
  console.log(`Verified the full treasury ledger; ${saved.entries.length} expenditures and ${saved.balances.length} balance records are unchanged.`);
} else {
  const temporary = new URL('../data/treasury-spending.generated.json.tmp', import.meta.url);
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`Saved ${next.entries.length} exact external expenditures and ${next.balances.length} post-transaction balances from all ${next.transactionsScanned} verified address transactions.`);
}
