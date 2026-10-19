const SHANNONS_PER_CKB = BigInt(100_000_000);
const SHANNONS_PER_MILLICKB = BigInt(100_000);

export type TreasuryChartEntry = {
  txHash: string;
  timestamp: string;
  amountShannons: string;
};

export type TreasuryChartBalance = {
  txHash: string;
  timestamp: string;
  balanceShannons: string;
};

/** Stable, unambiguous Beijing timestamps in either website language. */
export function formatTreasuryTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('Every treasury transaction needs a valid timestamp.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (name: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === name)?.value;
  return `${value('year')}/${value('month')}/${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}

/** Round only at presentation time; sums and persisted data remain exact. */
export function formatSpendingCkb(shannons: string | bigint, locale: string) {
  const amount = BigInt(shannons);
  if (amount < BigInt(0)) throw new Error('A treasury expenditure cannot be negative.');
  const millickb = (amount + SHANNONS_PER_MILLICKB / BigInt(2)) / SHANNONS_PER_MILLICKB;
  const whole = millickb / BigInt(1_000);
  const fraction = (millickb % BigInt(1_000)).toString().padStart(3, '0');
  return `${new Intl.NumberFormat(locale).format(whole)}.${fraction}`;
}

function chartCeiling(maximum: number) {
  if (maximum <= 0) return { maximum: 1, step: 0.25 };
  const approximateStep = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const multiplier = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= approximateStep) ?? 10;
  const step = multiplier * magnitude;
  return { maximum: Math.ceil(maximum / step) * step, step };
}

// Only graph coordinates use floating point. Persisted values and all sums stay exact.
function toChartCkb(amount: bigint) {
  return Number(amount / SHANNONS_PER_CKB) + Number(amount % SHANNONS_PER_CKB) / 100_000_000;
}

function buildTicks(scale: { maximum: number; step: number }) {
  return Array.from({ length: Math.round(scale.maximum / scale.step) + 1 }, (_, index) => ({
    value: index * scale.step,
    y: 210 - ((index * scale.step) / scale.maximum) * 190,
  }));
}

/** Both series share transaction timestamps and a single zero-based CKB scale. */
export function buildTreasuryChart(entries: readonly TreasuryChartEntry[], balances: readonly TreasuryChartBalance[] = []) {
  const events = new Map<string, { txHash: string; timestamp: string; expenditureShannons: string; balanceShannons: string | null }>();
  let previousTime = -Infinity;
  for (const balance of balances) {
    if (BigInt(balance.balanceShannons) < BigInt(0)) throw new Error('A treasury balance cannot be negative.');
    const time = Date.parse(balance.timestamp);
    if (!Number.isFinite(time)) throw new Error('Every treasury transaction needs a valid timestamp.');
    if (time < previousTime) throw new Error('Treasury balances must retain verified chronological ledger order.');
    if (events.has(balance.txHash)) throw new Error('A treasury balance transaction cannot be duplicated.');
    previousTime = time;
    events.set(balance.txHash, { ...balance, expenditureShannons: '0' });
  }
  const seenExpenses = new Set<string>();
  for (const entry of entries) {
    if (BigInt(entry.amountShannons) <= BigInt(0)) throw new Error('Every treasury expenditure must have a positive amount.');
    if (!Number.isFinite(Date.parse(entry.timestamp))) throw new Error('Every treasury expenditure needs a valid timestamp.');
    const event = events.get(entry.txHash);
    if (balances.length && !event) throw new Error('Every expenditure requires its verified transaction balance.');
    if (seenExpenses.has(entry.txHash)) throw new Error('A treasury expenditure transaction cannot be duplicated.');
    if (event && Date.parse(event.timestamp) !== Date.parse(entry.timestamp)) throw new Error('A transaction cannot have conflicting timestamps.');
    seenExpenses.add(entry.txHash);
    events.set(entry.txHash, { txHash: entry.txHash, timestamp: entry.timestamp, balanceShannons: event?.balanceShannons ?? null, expenditureShannons: entry.amountShannons });
  }

  let cumulative = BigInt(0);
  let maximum = BigInt(0);
  let latestBalance: string | null = null;
  // Canonical post-transaction states must not be silently reordered by a block clock.
  const ordered = balances.length ? [...events.values()] : [...events.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const values = ordered.map((event) => {
    cumulative += BigInt(event.expenditureShannons);
    if (event.balanceShannons !== null) latestBalance = event.balanceShannons;
    const balance = latestBalance === null ? BigInt(0) : BigInt(latestBalance);
    maximum = [maximum, balance, cumulative].reduce((largest, value) => value > largest ? value : largest);
    return { ...event, balanceShannons: latestBalance, cumulativeShannons: cumulative.toString() };
  });
  const scale = chartCeiling(toChartCkb(maximum));
  const firstTime = values.length ? Date.parse(values[0].timestamp) : 0;
  const lastTime = values.length ? Date.parse(values[values.length - 1].timestamp) : 0;
  const points = values.map((value, index) => ({
    ...value,
    x: 76 + (lastTime === firstTime ? index / Math.max(values.length - 1, 1) : (Date.parse(value.timestamp) - firstTime) / (lastTime - firstTime)) * 662,
    spendingY: 210 - (toChartCkb(BigInt(value.cumulativeShannons)) / scale.maximum) * 190,
    balanceY: value.balanceShannons === null ? null : 210 - (toChartCkb(BigInt(value.balanceShannons)) / scale.maximum) * 190,
  }));
  return { points, ticks: buildTicks(scale), totalShannons: cumulative.toString(), latestBalanceShannons: latestBalance };
}

export function buildSpendingChart(entries: readonly TreasuryChartEntry[]) {
  let cumulative = BigInt(0);
  const totals = entries.map((entry) => {
    const amount = BigInt(entry.amountShannons);
    if (amount <= BigInt(0)) throw new Error('Every treasury expenditure must have a positive amount.');
    if (!Number.isFinite(Date.parse(entry.timestamp))) throw new Error('Every treasury expenditure needs a valid timestamp.');
    cumulative += amount;
    return cumulative;
  });

  // The graph may use floating-point coordinates; monetary calculations never do.
  const scale = chartCeiling(toChartCkb(cumulative));
  const firstTime = entries.length ? Date.parse(entries[0].timestamp) : 0;
  const lastTime = entries.length ? Date.parse(entries[entries.length - 1].timestamp) : 0;
  const points = entries.map((entry, index) => ({
    entry,
    cumulativeShannons: totals[index].toString(),
    x: 76 + (lastTime === firstTime
      ? index / Math.max(entries.length - 1, 1)
      : (Date.parse(entry.timestamp) - firstTime) / (lastTime - firstTime)) * 662,
    y: 210 - (toChartCkb(totals[index]) / scale.maximum) * 190,
  }));
  const ticks = buildTicks(scale);
  return { points, ticks, totalShannons: cumulative.toString() };
}
