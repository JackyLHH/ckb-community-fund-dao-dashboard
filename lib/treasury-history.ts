export const TREASURY_ADDRESS = 'ckb1qyqnrg4jfx82g29l44q6d93jnrm5ytcp0d8sjfev2q';
export const TREASURY_BALANCE_API = `https://mainnet-api.explorer.nervos.org/api/v1/addresses/${TREASURY_ADDRESS}`;
export const TREASURY_ADDRESS_URL = `https://explorer.nervos.org/address/${TREASURY_ADDRESS}`;

export type TreasuryObservation = {
  date: string;
  observedAt: string;
  balanceShannons: string;
  balanceCkb: string;
  sourceUrl: string;
};

export type TreasuryHistory = {
  version: 1;
  address: string;
  timezone: 'Asia/Shanghai';
  observations: TreasuryObservation[];
};

export function beijingDate(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid observation time');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  return ['year', 'month', 'day'].map((name) => parts.find((part) => part.type === name)?.value).join('-');
}

/** Keep all eight possible decimal places without floating-point conversion. */
export function shannonsToCkb(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('The Explorer balance must be an unsigned integer in shannons');
  const amount = BigInt(value);
  const unit = BigInt(100_000_000);
  const whole = amount / unit;
  const fractional = (amount % unit).toString().padStart(8, '0').replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function explorerBalanceShannons(value: unknown): string {
  if (!value || typeof value !== 'object') throw new Error('Explorer did not return an address balance');
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== 1) throw new Error('Explorer did not return one address record');
  const balance = data[0]?.attributes?.balance;
  if (typeof balance !== 'string' || !/^\d+$/.test(balance)) throw new Error('Explorer returned an invalid balance');
  return BigInt(balance).toString();
}

/** One real observation per Beijing day. Never fabricate missing historical days. */
export function addTreasuryObservation(history: TreasuryHistory, balanceShannons: string, observedAt = new Date()): TreasuryHistory {
  if (history.version !== 1 || history.address !== TREASURY_ADDRESS || history.timezone !== 'Asia/Shanghai' || !Array.isArray(history.observations)) {
    throw new Error('Unsupported treasury history');
  }
  const balanceCkb = shannonsToCkb(balanceShannons);
  const date = beijingDate(observedAt);
  if (history.observations.some((observation) => observation.date === date)) return history;
  if (history.observations.some((observation) => observation.date > date)) throw new Error('Observation predates an existing record');
  return {
    ...history,
    observations: [...history.observations, {
      date,
      observedAt: observedAt.toISOString(),
      balanceShannons: BigInt(balanceShannons).toString(),
      balanceCkb,
      sourceUrl: TREASURY_BALANCE_API,
    }],
  };
}
