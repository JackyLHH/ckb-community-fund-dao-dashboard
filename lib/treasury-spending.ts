export const TREASURY_ADDRESS = 'ckb1qyqnrg4jfx82g29l44q6d93jnrm5ytcp0d8sjfev2q';
export const TREASURY_ADDRESS_URL = `https://explorer.nervos.org/address/${TREASURY_ADDRESS}`;
export const TREASURY_BALANCE_API = `https://mainnet-api.explorer.nervos.org/api/v1/addresses/${TREASURY_ADDRESS}`;
export const TREASURY_SPENDING_URL = `https://mainnet-api.explorer.nervos.org/api/v1/address_transactions/${TREASURY_ADDRESS}`;

export type TreasuryRecipient = {
  address: string;
  amountShannons: string;
  amountCkb: string;
};

export type TreasurySpendingEntry = {
  txHash: string;
  timestamp: string;
  amountShannons: string;
  amountCkb: string;
  feeShannons: string;
  recipients: TreasuryRecipient[];
};

/** Exact treasury balance immediately after each confirmed address transaction. */
export type TreasuryBalanceEntry = {
  txHash: string;
  timestamp: string;
  balanceShannons: string;
};

export type TreasurySpendingHistory = {
  version: 1;
  address: string;
  generatedAt: string;
  complete: boolean;
  sourceUrl: string;
  transactionsScanned: number;
  entries: TreasurySpendingEntry[];
  balances: TreasuryBalanceEntry[];
};

/** Existing version-1 expenditure-only files are upgraded by a full ledger scan. */
type SavedTreasurySpendingHistory = Omit<TreasurySpendingHistory, 'balances'> & {
  balances?: TreasuryBalanceEntry[];
};

type ExplorerCell = {
  address: string;
  capacity: string;
  cellType: string;
  typeScript: unknown;
};

export type TreasuryTransaction = {
  id: string;
  txHash: string;
  timestamp: string;
  blockNumber: string;
  inputs: ExplorerCell[];
  outputs: ExplorerCell[];
};

export type TreasuryTransactionPage = {
  total: number;
  totalPages: number;
  pageSize: number;
  transactions: TreasuryTransaction[];
};

export type TreasuryAddressReference = {
  address: string;
  balanceShannons: string;
  transactionsCount: number;
};

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as Record<string, unknown>;
}

function unsignedInteger(value: unknown, name: string, decimalZeros = false): string {
  if (typeof value !== 'string' || !(decimalZeros ? /^\d+(?:\.0+)?$/ : /^\d+$/).test(value)) {
    throw new Error(`Invalid ${name}; exact integer strings are required`);
  }
  return BigInt(value.split('.')[0]).toString();
}

function count(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${name}`);
  return value;
}

/** Convert exact shannons without ever passing monetary values through a JS number. */
export function shannonsToCkb(value: string): string {
  const amount = BigInt(unsignedInteger(value, 'amount'));
  const unit = BigInt(100_000_000);
  const whole = amount / unit;
  const fraction = (amount % unit).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function readCell(value: unknown): ExplorerCell {
  const cell = object(value, 'Explorer cell');
  if (typeof cell.address_hash !== 'string' || !cell.address_hash) throw new Error('Missing cell address');
  if (typeof cell.cell_type !== 'string') throw new Error('Missing cell type');
  if (!Object.hasOwn(cell, 'type_script')) throw new Error('Missing cell type script information');
  return {
    address: cell.address_hash,
    capacity: unsignedInteger(cell.capacity, 'cell capacity', true),
    cellType: cell.cell_type,
    typeScript: cell.type_script,
  };
}

/** Refuse preview-truncated transactions rather than mistaking missing change for spending. */
function readTransaction(value: unknown): TreasuryTransaction {
  const record = object(value, 'transaction record');
  const attributes = object(record.attributes, 'transaction attributes');
  const txHash = attributes.transaction_hash;
  if (typeof txHash !== 'string' || !/^0x[\da-f]{64}$/i.test(txHash)) throw new Error('Invalid transaction hash');
  if (attributes.is_cellbase !== false) throw new Error('Unsupported cellbase transaction; manual review required');
  if (!Array.isArray(attributes.display_inputs) || !Array.isArray(attributes.display_outputs)) throw new Error('Missing transaction cells');
  if (attributes.display_inputs.length !== count(attributes.display_inputs_count, 'input count', 1)
    || attributes.display_outputs.length !== count(attributes.display_outputs_count, 'output count', 1)) {
    throw new Error('Explorer truncated transaction cells; existing spending history is unchanged');
  }
  const timestamp = unsignedInteger(attributes.block_timestamp, 'block timestamp');
  const milliseconds = Number(timestamp);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || !Number.isFinite(new Date(milliseconds).getTime())) {
    throw new Error('Invalid block timestamp');
  }
  return {
    id: unsignedInteger(record.id, 'transaction ID'),
    txHash: txHash.toLowerCase(),
    timestamp: new Date(milliseconds).toISOString(),
    blockNumber: unsignedInteger(attributes.block_number, 'block number'),
    inputs: attributes.display_inputs.map(readCell),
    outputs: attributes.display_outputs.map(readCell),
  };
}

export function readExplorerTransactionsPage(value: unknown): TreasuryTransactionPage {
  const response = object(value, 'Explorer transaction response');
  const meta = object(response.meta, 'transaction pagination');
  if (!Array.isArray(response.data)) throw new Error('Missing transaction records');
  const total = count(meta.total, 'transaction total');
  const pageSize = count(meta.page_size, 'page size', 1);
  const totalPages = count(meta.total_pages, 'page total', total > 0 ? 1 : 0);
  if (totalPages !== Math.ceil(total / pageSize)) throw new Error('Incomplete Explorer pagination');
  if (response.data.length > pageSize) throw new Error('Explorer exceeded the declared page size');
  return { total, totalPages, pageSize, transactions: response.data.map(readTransaction) };
}

export function readExplorerAddressReference(value: unknown): TreasuryAddressReference {
  const response = object(value, 'Explorer address response');
  if (!Array.isArray(response.data) || response.data.length !== 1) throw new Error('Explorer did not return exactly one address');
  const attributes = object(object(response.data[0], 'address record').attributes, 'address attributes');
  if (attributes.address_hash !== TREASURY_ADDRESS) throw new Error('Explorer returned a different address');
  const transactionsCount = Number(unsignedInteger(attributes.transactions_count, 'address transaction count'));
  if (!Number.isSafeInteger(transactionsCount)) throw new Error('Unsafe address transaction count');
  return {
    address: TREASURY_ADDRESS,
    balanceShannons: unsignedInteger(attributes.balance, 'address balance'),
    transactionsCount,
  };
}

function sum(cells: ExplorerCell[]): bigint {
  return cells.reduce((total, cell) => total + BigInt(cell.capacity), BigInt(0));
}

function sameTransaction(a: TreasuryTransaction, b: TreasuryTransaction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Rebuild the complete address ledger, retaining every post-transaction balance
 * and classifying external outflows separately.
 * Change outputs, deposits, refunds and transaction fees are not expenditure.
 * Mixed-input/typed transactions fail closed: external funding cannot safely be
 * attributed to this treasury without additional review.
 */
export function buildTreasurySpendingHistory(
  pages: TreasuryTransactionPage[],
  reference: TreasuryAddressReference,
  generatedAt: string,
  previous?: SavedTreasurySpendingHistory,
): TreasurySpendingHistory {
  if (reference.address !== TREASURY_ADDRESS || pages.length === 0) throw new Error('Unsupported treasury ledger');
  if (!Number.isFinite(new Date(generatedAt).getTime())) throw new Error('Invalid spending verification time');
  const first = pages[0];
  if (pages.length !== first.totalPages || first.total !== reference.transactionsCount) {
    throw new Error('Transaction coverage changed or is incomplete; retry a fresh Explorer snapshot');
  }
  const unique = new Map<string, TreasuryTransaction>();
  for (const page of pages) {
    if (page.total !== first.total || page.pageSize !== first.pageSize || page.totalPages !== first.totalPages) {
      throw new Error('Explorer pagination changed during the scan');
    }
    for (const transaction of page.transactions) {
      const existing = unique.get(transaction.txHash);
      if (existing && !sameTransaction(existing, transaction)) throw new Error('Conflicting duplicate transaction');
      unique.set(transaction.txHash, transaction);
    }
  }
  if (unique.size !== first.total) throw new Error('Missing or duplicate-only transaction pages');
  // Explorer record IDs are not a documented in-block execution order. Without
  // a verified transaction index, refuse ambiguous post-transaction balances.
  const transactionBlocks = new Set<string>();
  for (const transaction of unique.values()) {
    if (transactionBlocks.has(transaction.blockNumber)) {
      throw new Error('Multiple treasury transactions in the same block need verified transaction order; manual review required');
    }
    transactionBlocks.add(transaction.blockNumber);
  }
  const transactions = [...unique.values()].sort((a, b) => {
    const blockDifference = BigInt(a.blockNumber) - BigInt(b.blockNumber);
    if (blockDifference !== BigInt(0)) return blockDifference < BigInt(0) ? -1 : 1;
    const idDifference = BigInt(a.id) - BigInt(b.id);
    return idDifference < BigInt(0) ? -1 : idDifference > BigInt(0) ? 1 : 0;
  });
  for (let index = 1; index < transactions.length; index += 1) {
    if (transactions[index].timestamp < transactions[index - 1].timestamp) {
      throw new Error('Treasury block timestamps regress in canonical order; time-series display needs manual review');
    }
  }
  const entries: TreasurySpendingEntry[] = [];
  const balances: TreasuryBalanceEntry[] = [];
  let balance = BigInt(0);
  for (const transaction of transactions) {
    const ownInputs = transaction.inputs.filter((cell) => cell.address === TREASURY_ADDRESS);
    const ownOutputs = transaction.outputs.filter((cell) => cell.address === TREASURY_ADDRESS);
    if (ownInputs.length === 0 && ownOutputs.length === 0) throw new Error('Unrelated transaction in address history');
    if (ownInputs.length > 0 && ownInputs.length !== transaction.inputs.length) {
      throw new Error('Mixed-funded transaction needs manual review before classifying expenditure');
    }
    if ([...ownInputs, ...ownOutputs].some((cell) => cell.cellType !== 'normal' || (cell.typeScript != null && cell.typeScript !== ''))) {
      throw new Error('Treasury DAO/typed cell movement needs manual review');
    }
    const fee = sum(transaction.inputs) - sum(transaction.outputs);
    if (fee < BigInt(0)) throw new Error('Transaction outputs exceed inputs');
    balance += sum(ownOutputs) - sum(ownInputs);
    if (balance < BigInt(0)) throw new Error('Transaction history is incomplete or out of order');
    balances.push({
      txHash: transaction.txHash,
      timestamp: transaction.timestamp,
      balanceShannons: balance.toString(),
    });
    if (ownInputs.length === 0) continue;
    const external = transaction.outputs.filter((cell) => cell.address !== TREASURY_ADDRESS);
    if (external.some((cell) => cell.cellType !== 'normal' || (cell.typeScript != null && cell.typeScript !== ''))) {
      throw new Error('Typed external transfer needs manual review before classifying expenditure');
    }
    const amount = sum(external);
    if (amount === BigInt(0)) continue;
    const recipientAmounts = new Map<string, bigint>();
    for (const cell of external) recipientAmounts.set(cell.address, (recipientAmounts.get(cell.address) ?? BigInt(0)) + BigInt(cell.capacity));
    entries.push({
      txHash: transaction.txHash,
      timestamp: transaction.timestamp,
      amountShannons: amount.toString(),
      amountCkb: shannonsToCkb(amount.toString()),
      feeShannons: fee.toString(),
      recipients: [...recipientAmounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([address, capacity]) => ({
        address, amountShannons: capacity.toString(), amountCkb: shannonsToCkb(capacity.toString()),
      })),
    });
  }
  if (balance !== BigInt(unsignedInteger(reference.balanceShannons, 'reference balance'))) {
    throw new Error('Full transaction ledger does not reconcile with the live address balance; retry a fresh snapshot');
  }
  if (previous) {
    if (previous.version !== 1 || previous.address !== TREASURY_ADDRESS || previous.complete !== true || !Array.isArray(previous.entries)) {
      throw new Error('Unsupported saved spending history');
    }
    const nextByHash = new Map(entries.map((entry) => [entry.txHash, entry]));
    if (previous.entries.some((entry) => JSON.stringify(nextByHash.get(entry.txHash)) !== JSON.stringify(entry))) {
      throw new Error('A previously verified expenditure changed or disappeared; manual review required');
    }
    if (previous.balances !== undefined) {
      if (!Array.isArray(previous.balances)
        || previous.balances.length !== previous.transactionsScanned
        || new Set(previous.balances.map((entry) => entry.txHash)).size !== previous.balances.length) {
        throw new Error('Unsupported saved treasury balance history');
      }
      const nextBalancesByHash = new Map(balances.map((entry) => [entry.txHash, entry]));
      if (previous.balances.some((entry) => JSON.stringify(nextBalancesByHash.get(entry.txHash)) !== JSON.stringify(entry))) {
        throw new Error('A previously verified treasury balance changed or disappeared; manual review required');
      }
      // Deposits/refunds create balance points even when expenditure is unchanged.
      // Unchanged complete scans retain their verification time and avoid commits.
      if (JSON.stringify(previous.entries) === JSON.stringify(entries)
        && JSON.stringify(previous.balances) === JSON.stringify(balances)
        && previous.sourceUrl === TREASURY_SPENDING_URL) return previous as TreasurySpendingHistory;
    }
  }
  return {
    version: 1,
    address: TREASURY_ADDRESS,
    generatedAt: new Date(generatedAt).toISOString(),
    complete: true,
    sourceUrl: TREASURY_SPENDING_URL,
    transactionsScanned: unique.size,
    entries,
    balances,
  };
}
