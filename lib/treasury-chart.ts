const SHANNONS_PER_CKB = BigInt(100_000_000);
const SHANNONS_PER_MILLICKB = BigInt(100_000);

export type TreasuryChartEntry = {
  txHash: string;
  timestamp: string;
  amountShannons: string;
};

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
  const toChartCkb = (amount: bigint) => Number(amount / SHANNONS_PER_CKB) + Number(amount % SHANNONS_PER_CKB) / 100_000_000;
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
  const ticks = Array.from({ length: Math.round(scale.maximum / scale.step) + 1 }, (_, index) => ({
    value: index * scale.step,
    y: 210 - ((index * scale.step) / scale.maximum) * 190,
  }));
  return { points, ticks, totalShannons: cumulative.toString() };
}
