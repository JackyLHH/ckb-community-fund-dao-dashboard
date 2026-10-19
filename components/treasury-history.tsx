'use client';

import { useState } from 'react';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import savedHistory from '@/data/treasury-spending.generated.json';
import { buildTreasuryChart, buildTreasuryMonthlyChart, filterTreasuryDisplayPeriod, formatSpendingCkb, formatTreasuryTimestamp, TREASURY_CHART_START_AT } from '@/lib/treasury-chart';
import { TREASURY_ADDRESS_URL, type TreasurySpendingHistory } from '@/lib/treasury-spending';
import { useLocale } from '@/lib/use-locale';

function shortAddress(address: string) {
  return address.length > 25 ? `${address.slice(0, 12)}…${address.slice(-8)}` : address;
}

export function TreasuryHistoryChart({ history = savedHistory as TreasurySpendingHistory }: { history?: TreasurySpendingHistory }) {
  const { locale, t } = useLocale();
  const [selectedBalanceIndex, setSelectedBalanceIndex] = useState<number | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const periodEntries = filterTreasuryDisplayPeriod(history.entries);
  const { points, ticks } = buildTreasuryChart(history.entries, history.balances ?? [], TREASURY_CHART_START_AT);
  const first = points[0];
  const last = points.at(-1);
  const balancePoints = points.filter((point) => point.balanceY !== null);
  const selectedBalance = balancePoints[Math.min(selectedBalanceIndex ?? balancePoints.length - 1, balancePoints.length - 1)];
  const monthly = buildTreasuryMonthlyChart(history.entries, last?.timestamp ?? TREASURY_CHART_START_AT);
  const selectedMonth = monthly.months[Math.min(selectedMonthIndex ?? monthly.months.length - 1, monthly.months.length - 1)];
  const numberLocale = locale === 'en' ? 'en-US' : 'zh-CN';
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric',
  });
  const monthFormatter = new Intl.DateTimeFormat(numberLocale, { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short' });
  const tickFormatter = new Intl.NumberFormat(numberLocale, { notation: 'compact', maximumFractionDigits: 1 });
  // Hold each verified balance until the next transaction, rather than inventing daily interpolation.
  const balanceLine = balancePoints.flatMap((point, index) => index === 0
    ? [`${point.x},${point.balanceY}`]
    : [`${point.x},${balancePoints[index - 1].balanceY}`, `${point.x},${point.balanceY}`]).join(' ');
  const balanceArea = balancePoints.length ? `${balancePoints[0].x},210 ${balanceLine} ${balancePoints.at(-1)?.x},210` : '';

  function selectNearest(clientX: number, clientY: number, svg: SVGSVGElement, series: 'balance' | 'monthly') {
    const transform = svg.getScreenCTM();
    const items = series === 'balance' ? balancePoints : monthly.months;
    if (!items.length || !transform) return;
    const { x } = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    let nearest = 0;
    for (let index = 1; index < items.length; index += 1) {
      if (Math.abs(items[index].x - x) < Math.abs(items[nearest].x - x)) nearest = index;
    }
    if (series === 'balance') setSelectedBalanceIndex(nearest);
    else setSelectedMonthIndex(nearest);
  }

  const balanceLabel = selectedBalance?.isOpening ? t('期初余额', 'Opening balance')
    : selectedBalance === balancePoints.at(-1) ? t('最新余额', 'Latest balance') : t('当时余额', 'Balance at this time');
  const balanceReadout = selectedBalance ? `${balanceLabel} ${formatSpendingCkb(selectedBalance.balanceShannons ?? '0', numberLocale)} CKB · ${formatTreasuryTimestamp(selectedBalance.timestamp)} (UTC+8)` : '';
  const cumulativeLabel = t('截至该月累计', 'Cumulative through month');
  const monthReadout = selectedMonth ? `${monthFormatter.format(new Date(selectedMonth.startAt))} · ${t('当月支出', 'Monthly spending')} ${formatSpendingCkb(selectedMonth.amountShannons, numberLocale)} CKB · ${cumulativeLabel} ${formatSpendingCkb(selectedMonth.cumulativeShannons, numberLocale)} CKB` : '';

  return (
    <section aria-labelledby="treasury-history-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="treasury-history-heading" className="flex items-center gap-2 text-xl font-bold">
            <ChartNoAxesCombined className="size-5 text-primary" aria-hidden="true" />
            {t('国库余额与支出', 'Treasury balance & spending')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('2023/01/12 起 · CKB', 'Since 12 Jan 2023 · CKB')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{t(`${periodEntries.length} 次支出`, `${periodEntries.length} expenditures`)}</span>
      </div>

      {first && last ? (
        <div className="mt-5 space-y-4">
          {balancePoints.length > 0 && (
            <figure aria-label={t('国库余额', 'Treasury balance')}>
              <header data-chart-header="balance" className="grid items-start gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <h3 className="inline-flex items-center gap-2 text-sm font-medium leading-5"><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />{t('国库余额', 'Treasury balance')}</h3>
                {selectedBalance && <div id="treasury-balance-readout" data-balance-readout={selectedBalance.txHash ?? 'opening'} className="min-w-0 text-center lg:col-start-2">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-sm leading-5">
                    <span className="text-xs text-muted-foreground">{balanceLabel}</span>
                    <span className="whitespace-nowrap font-mono font-medium tabular-nums">{formatSpendingCkb(selectedBalance.balanceShannons ?? '0', numberLocale)} <span className="text-xs font-normal text-muted-foreground">CKB</span></span>
                  </div>
                  <time dateTime={selectedBalance.timestamp} className="mt-0.5 block text-xs leading-5 text-muted-foreground tabular-nums">{formatTreasuryTimestamp(selectedBalance.timestamp)} (UTC+8)</time>
                </div>}
              </header>
              <div className="relative mt-2 h-32 sm:h-36">
                {ticks.map((tick) => <span key={tick.value} aria-hidden="true" style={{ top: `${(tick.y / 230) * 100}%` }} className="absolute left-0 w-12 -translate-y-1/2 text-right text-xs leading-none text-muted-foreground">{tickFormatter.format(tick.value)}</span>)}
                {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG charts require explicit image semantics. */}
                <svg role="img" viewBox="76 0 662 230" preserveAspectRatio="none"
                  aria-label={t('国库余额历史，绿色实线与浅绿色面积表示各次交易后的真实余额。', 'Historical treasury balance: the solid green line and pale green area show the actual balance after each transaction.')}
                  aria-describedby="treasury-balance-readout"
                  className="absolute inset-y-0 left-14 h-full w-[calc(100%_-_3.5rem)] touch-pan-y overflow-visible"
                  onPointerMove={(event) => { if (event.pointerType === 'mouse') selectNearest(event.clientX, event.clientY, event.currentTarget, 'balance'); }}
                  onPointerDown={(event) => selectNearest(event.clientX, event.clientY, event.currentTarget, 'balance')}
                >
                  {ticks.map((tick) => <line key={tick.value} x1="76" y1={tick.y} x2="738" y2={tick.y} stroke="currentColor" vectorEffect="non-scaling-stroke" className="text-border/70" />)}
                  <polygon data-series="balance-area" points={balanceArea} fill="currentColor" className="text-primary opacity-[0.07]" />
                  <polyline data-series="balance" points={balanceLine} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="text-primary" />
                  {balancePoints.map((point) => (
                    <line key={point.txHash ?? 'opening'} x1={point.x} y1={point.balanceY ?? 0} x2={point.x + 0.001} y2={point.balanceY ?? 0} stroke="currentColor" strokeWidth={selectedBalance === point || point === balancePoints.at(-1) ? 7 : 0} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="text-primary">
                      <title>{`${point.isOpening ? t('期初 · ', 'Opening · ') : ''}${formatTreasuryTimestamp(point.timestamp)} (UTC+8): ${t('国库余额', 'Treasury balance')} ${formatSpendingCkb(point.balanceShannons ?? '0', numberLocale)} CKB`}</title>
                    </line>
                  ))}
                </svg>
              </div>
              <div className="ml-14 flex justify-between gap-4 text-xs text-muted-foreground"><span>{dateFormatter.format(new Date(first.timestamp))}</span><span>{dateFormatter.format(new Date(last.timestamp))}</span></div>
              <input type="range" min="0" max={Math.max(balancePoints.length - 1, 0)} step="1" value={selectedBalanceIndex ?? balancePoints.length - 1}
                onChange={(event) => setSelectedBalanceIndex(Number(event.currentTarget.value))}
                aria-label={t('查看期初及各次交易后的余额，使用方向键选择', 'Inspect the opening and post-transaction balances using the arrow keys')}
                aria-valuetext={balanceReadout || undefined}
                className="sr-only accent-primary focus:not-sr-only focus:mt-2 focus:h-11 focus:w-full" />
            </figure>
          )}

          <figure aria-label={t('月度支出', 'Monthly spending')} className="border-t border-border pt-4">
            <header data-chart-header="monthly" className="grid items-start gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <h3 className="inline-flex items-center gap-2 text-sm font-medium leading-5"><span aria-hidden="true" className="size-2 shrink-0 rounded-sm bg-primary/70" />{t('月度支出', 'Monthly spending')}</h3>
              {selectedMonth && <div id="treasury-monthly-readout" data-month-readout={selectedMonth.key} className="min-w-0 text-center lg:col-start-2">
                <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-sm leading-5">
                  <span className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5"><span className="text-xs text-muted-foreground">{t('当月支出', 'Monthly spending')}</span><span className="whitespace-nowrap font-mono font-medium tabular-nums">{formatSpendingCkb(selectedMonth.amountShannons, numberLocale)} <span className="text-xs font-normal text-muted-foreground">CKB</span></span></span>
                  <span className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5"><span className="text-xs text-muted-foreground">{cumulativeLabel}</span><span className="whitespace-nowrap font-mono font-medium tabular-nums">{formatSpendingCkb(selectedMonth.cumulativeShannons, numberLocale)} <span className="text-xs font-normal text-muted-foreground">CKB</span></span></span>
                </div>
                <time dateTime={selectedMonth.startAt} className="mt-0.5 block text-xs leading-5 text-muted-foreground tabular-nums">{monthFormatter.format(new Date(selectedMonth.startAt))}</time>
              </div>}
            </header>
            <div className="relative mt-2 h-32 sm:h-36">
              {monthly.ticks.map((tick) => <span key={tick.value} aria-hidden="true" style={{ top: `${(tick.y / 230) * 100}%` }} className="absolute left-0 w-12 -translate-y-1/2 text-right text-xs leading-none text-muted-foreground">{tickFormatter.format(tick.value)}</span>)}
              {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG charts require explicit image semantics. */}
              <svg role="img" viewBox="76 0 662 230" preserveAspectRatio="none"
                aria-label={t(`自 2023 年 1 月 12 日起的月度支出柱状图，包含 ${periodEntries.length} 次支出。选择月份查看当月及截至该月的累计支出。`, `Monthly expenditures since 12 January 2023, including ${periodEntries.length} expenditures. Select a month to inspect that month's spending and the cumulative total through that month.`)}
                aria-describedby="treasury-monthly-readout"
                className="absolute inset-y-0 left-14 h-full w-[calc(100%_-_3.5rem)] touch-pan-y overflow-visible"
                onPointerMove={(event) => { if (event.pointerType === 'mouse') selectNearest(event.clientX, event.clientY, event.currentTarget, 'monthly'); }}
                onPointerDown={(event) => selectNearest(event.clientX, event.clientY, event.currentTarget, 'monthly')}
              >
                {monthly.ticks.map((tick) => <line key={tick.value} x1="76" y1={tick.y} x2="738" y2={tick.y} stroke="currentColor" vectorEffect="non-scaling-stroke" className="text-border/70" />)}
                {monthly.months.map((month) => (
                  <rect key={month.key} data-month={month.key} data-series="monthly-spending" x={month.x - month.width / 2} y={month.y} width={month.width} height={210 - month.y} rx="2" fill="currentColor" className={selectedMonth === month ? 'text-primary' : 'text-primary/65'}>
                    <title>{`${monthFormatter.format(new Date(month.startAt))} · ${t('当月支出', 'Monthly spending')} ${formatSpendingCkb(month.amountShannons, numberLocale)} CKB · ${cumulativeLabel} ${formatSpendingCkb(month.cumulativeShannons, numberLocale)} CKB`}</title>
                  </rect>
                ))}
              </svg>
            </div>
            <div className="ml-14 flex justify-between gap-4 text-xs text-muted-foreground"><span>{dateFormatter.format(new Date(first.timestamp))}</span><span>{dateFormatter.format(new Date(last.timestamp))}</span></div>
            <input type="range" min="0" max={Math.max(monthly.months.length - 1, 0)} step="1" value={selectedMonthIndex ?? monthly.months.length - 1}
              onChange={(event) => setSelectedMonthIndex(Number(event.currentTarget.value))}
              aria-label={t('查看每月及累计支出，使用方向键选择月份', 'Inspect monthly and cumulative spending using the arrow keys')}
              aria-valuetext={monthReadout}
              className="sr-only accent-primary focus:not-sr-only focus:mt-2 focus:h-11 focus:w-full" />
          </figure>
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-border px-4 py-6 text-sm text-muted-foreground">{t('暂无已核验的链上记录', 'No verified on-chain history yet')}</p>
      )}

      {periodEntries.length > 0 && (
        <details className="mt-4 rounded-xl border border-border">
          <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('查看每次支出', 'View each expenditure')}</summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">{t('自 2023 年 1 月 12 日起的链上对外支出，不含找零或手续费。时间为北京时间 UTC+8。', 'External on-chain expenditures since 12 January 2023, excluding change and transaction fees. Times are Beijing time, UTC+8.')}</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-3 pr-4 font-medium">{t('时间（UTC+8）', 'Time (UTC+8)')}</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">{t('支出（CKB）', 'Amount (CKB)')}</th>
                  <th scope="col" className="py-3 pr-4 font-medium">{t('接收地址', 'Recipient')}</th>
                  <th scope="col" className="py-3 whitespace-nowrap font-medium">{t('交易详情', 'Transaction details')}</th>
                </tr>
              </thead>
              <tbody>
                {[...periodEntries].reverse().map((entry) => (
                  <tr key={entry.txHash} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums"><time dateTime={entry.timestamp}>{formatTreasuryTimestamp(entry.timestamp)}</time></td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatSpendingCkb(entry.amountShannons, numberLocale)}</td>
                    <td className="py-3 pr-4">
                      {entry.recipients.map((recipient) => (
                        <a key={recipient.address} href={`https://explorer.nervos.org/address/${encodeURIComponent(recipient.address)}`} target="_blank" rel="noreferrer" title={recipient.address} className="block rounded font-mono text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{shortAddress(recipient.address)}</a>
                      ))}
                    </td>
                    <td className="py-3">
                      <a href={`https://explorer.nervos.org/transaction/${entry.txHash}`} target="_blank" rel="noreferrer" aria-label={t(`查看 ${formatTreasuryTimestamp(entry.timestamp)} 的链上支出交易`, `View the expenditure transaction on ${formatTreasuryTimestamp(entry.timestamp)}`)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight className="size-4" aria-hidden="true" /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <a href={TREASURY_ADDRESS_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        CKB Explorer<ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </section>
  );
}
