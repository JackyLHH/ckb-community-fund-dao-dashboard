const SHANNONS_PER_CKB = BigInt(100_000_000);
const SHANNONS_PER_MILLICKB = BigInt(100_000);

/** The public chart/reporting period begins at Beijing midnight on 12 January 2023. */
export const TREASURY_CHART_START_AT = '2023-01-11T16:00:00.000Z';

/** One inclusive reporting boundary shared by the chart, expenditure table and count. */
export function filterTreasuryDisplayPeriod<T extends { timestamp: string }>(entries: readonly T[], startAt = TREASURY_CHART_START_AT) {
  const startTime = Date.parse(startAt);
  if (!Number.isFinite(startTime)) throw new Error('The treasury reporting period needs a valid start timestamp.');
  return entries.filter((entry) => {
    const time = Date.parse(entry.timestamp);
    if (!Number.isFinite(time)) throw new Error('Every treasury transaction needs a valid timestamp.');
    return time >= startTime;
  });
}

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
export function buildTreasuryChart(entries: readonly TreasuryChartEntry[], balances: readonly TreasuryChartBalance[] = [], startAt?: string) {
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

  // Canonical post-transaction states must not be silently reordered by a block clock.
  const ordered = balances.length ? [...events.values()] : [...events.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const periodEvents = startAt === undefined ? ordered : filterTreasuryDisplayPeriod(ordered, startAt);
  const openingBalance = startAt === undefined ? null : ordered.filter((event) => Date.parse(event.timestamp) < Date.parse(startAt) && event.balanceShannons !== null).at(-1)?.balanceShannons ?? null;
  let cumulative = BigInt(0);
  let maximum = openingBalance === null ? BigInt(0) : BigInt(openingBalance);
  let latestBalance: string | null = openingBalance;
  const values: Array<{
    txHash: string | null;
    timestamp: string;
    expenditureShannons: string;
    balanceShannons: string | null;
    cumulativeShannons: string;
    isOpening: boolean;
  }> = startAt !== undefined && ordered.length ? [{
    txHash: null, timestamp: new Date(startAt).toISOString(), expenditureShannons: '0',
    balanceShannons: openingBalance, cumulativeShannons: '0', isOpening: true,
  }] : [];
  for (const event of periodEvents) {
    cumulative += BigInt(event.expenditureShannons);
    if (event.balanceShannons !== null) latestBalance = event.balanceShannons;
    const balance = latestBalance === null ? BigInt(0) : BigInt(latestBalance);
    maximum = [maximum, balance, cumulative].reduce((largest, value) => value > largest ? value : largest);
    values.push({ ...event, balanceShannons: latestBalance, cumulativeShannons: cumulative.toString(), isOpening: false });
  }
  const scale = chartCeiling(toChartCkb(maximum));
  const firstTime = values.length ? Date.parse(values[0].timestamp) : 0;
  const lastTime = values.length ? Date.parse(values[values.length - 1].timestamp) : 0;
  const points = values.map((value, index) => ({
    ...value,
    x: 76 + (lastTime === firstTime ? (startAt === undefined ? index / Math.max(values.length - 1, 1) : 0) : (Date.parse(value.timestamp) - firstTime) / (lastTime - firstTime)) * 662,
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

export type TreasuryMonthlyChartMonth = {
  key: string;
  /** Inclusive bounds of the observed part of this Beijing calendar month. */
  startAt: string;
  endAt: string;
  amountShannons: string;
  /** Spending since the reporting cutoff, through this month only. */
  cumulativeShannons: string;
  count: number;
  /** Centre and visible width on the shared elapsed-time axis, from 76 to 738. */
  x: number;
  y: number;
  width: number;
};

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1_000;

function beijingMonthStart(time: number) {
  const date = new Date(time + BEIJING_OFFSET_MS);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() - BEIJING_OFFSET_MS;
}

function nextBeijingMonth(time: number) {
  const date = new Date(time + BEIJING_OFFSET_MS);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime() - BEIJING_OFFSET_MS;
}

/**
 * Group verified external expenditures, not balance changes, by Beijing month.
 * The caller supplies an explicit observation horizon so server/client rendering
 * cannot disagree around midnight. Empty months are real zeroes, not predictions.
 */
export function buildTreasuryMonthlyChart(entries: readonly TreasuryChartEntry[], endAt: string, startAt = TREASURY_CHART_START_AT) {
  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt);
  if (!Number.isFinite(startTime)) throw new Error('The treasury reporting period needs a valid start timestamp.');
  if (!Number.isFinite(endTime)) throw new Error('The treasury reporting period needs a valid end timestamp.');

  const seen = new Set<string>();
  const periodEntries: Array<{ time: number; amount: bigint }> = [];
  for (const entry of entries) {
    const time = Date.parse(entry.timestamp);
    if (!Number.isFinite(time)) throw new Error('Every treasury expenditure needs a valid timestamp.');
    if (typeof entry.amountShannons !== 'string' || !/^[1-9]\d*$/.test(entry.amountShannons)) throw new Error('Every treasury expenditure must have a positive integer shannon amount string.');
    if (seen.has(entry.txHash)) throw new Error('A treasury expenditure transaction cannot be duplicated.');
    seen.add(entry.txHash);
    if (time >= startTime && time <= endTime) periodEntries.push({ time, amount: BigInt(entry.amountShannons) });
  }
  // A copied collection is sorted, never the authoritative ledger itself.
  periodEntries.sort((a, b) => a.time - b.time);

  const values: Array<Omit<TreasuryMonthlyChartMonth, 'x' | 'y' | 'width'> & { startTime: number; endTime: number }> = [];
  let cumulative = BigInt(0);
  let maximum = BigInt(0);
  let entryIndex = 0;
  for (let monthTime = beijingMonthStart(startTime); monthTime <= endTime && startTime <= endTime; monthTime = nextBeijingMonth(monthTime)) {
    if (values.length >= 12_000) throw new Error('The monthly treasury reporting period is too long.');
    const nextMonthTime = nextBeijingMonth(monthTime);
    if (!Number.isFinite(nextMonthTime) || nextMonthTime <= monthTime) throw new Error('The treasury reporting period exceeds the supported calendar range.');
    const observedStart = Math.max(monthTime, startTime);
    const observedEnd = Math.min(nextMonthTime - 1, endTime);
    let amount = BigInt(0);
    let count = 0;
    while (entryIndex < periodEntries.length && periodEntries[entryIndex].time < nextMonthTime) {
      amount += periodEntries[entryIndex].amount;
      count += 1;
      entryIndex += 1;
    }
    cumulative += amount;
    if (amount > maximum) maximum = amount;
    const date = new Date(monthTime + BEIJING_OFFSET_MS);
    values.push({
      key: `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`,
      startAt: new Date(observedStart).toISOString(), endAt: new Date(observedEnd).toISOString(),
      startTime: observedStart, endTime: observedEnd,
      amountShannons: amount.toString(), cumulativeShannons: cumulative.toString(), count,
    });
  }

  const scale = chartCeiling(toChartCkb(maximum));
  const duration = endTime - startTime;
  const months: TreasuryMonthlyChartMonth[] = values.map(({ startTime: observedStart, endTime: observedEnd, ...month }) => {
    // A same-instant observation still has a focusable one-unit mark, without
    // stretching the observed period or assigning it a full calendar month's width.
    const width = duration <= 0 ? 1 : Math.max(1, ((observedEnd - observedStart) / duration) * 662 * 0.76);
    const centre = duration <= 0 ? 76 : 76 + ((observedStart + (observedEnd - observedStart) / 2 - startTime) / duration) * 662;
    return {
      ...month,
      // Keep even an endpoint-only minimum-width mark inside the plot area.
      x: Math.min(738 - width / 2, Math.max(76 + width / 2, centre)),
      y: 210 - (toChartCkb(BigInt(month.amountShannons)) / scale.maximum) * 190,
      width,
    };
  });
  return { months, ticks: buildTicks(scale), totalShannons: cumulative.toString() };
}
