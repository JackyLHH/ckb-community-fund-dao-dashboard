'use client';

import { useState } from 'react';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import savedHistory from '@/data/treasury-spending.generated.json';
import { buildSpendingChart, formatSpendingCkb } from '@/lib/treasury-chart';
import { TREASURY_ADDRESS_URL, type TreasurySpendingHistory } from '@/lib/treasury-spending';
import { useLocale } from '@/lib/use-locale';

function shortAddress(address: string) {
  return address.length > 25 ? `${address.slice(0, 12)}…${address.slice(-8)}` : address;
}

export function TreasuryHistoryChart({ history = savedHistory as TreasurySpendingHistory }: { history?: TreasurySpendingHistory }) {
  const { locale, t } = useLocale();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { points, totalShannons, ticks } = buildSpendingChart(history.entries);
  const selected = points[selectedIndex ?? points.length - 1];
  const first = points[0];
  const last = points.at(-1);
  const numberLocale = locale === 'en' ? 'en-US' : 'zh-CN';
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(numberLocale, {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const tickFormatter = new Intl.NumberFormat(numberLocale, { notation: 'compact', maximumFractionDigits: 1 });

  function selectNearest(clientX: number, clientY: number, svg: SVGSVGElement) {
    const transform = svg.getScreenCTM();
    if (!points.length || !transform) return;
    const { x } = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    let nearest = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (Math.abs(points[index].x - x) < Math.abs(points[nearest].x - x)) nearest = index;
    }
    setSelectedIndex(nearest);
  }

  return (
    <section aria-labelledby="treasury-history-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="treasury-history-heading" className="flex items-center gap-2 text-xl font-bold">
            <ChartNoAxesCombined className="size-5 text-primary" aria-hidden="true" />
            {t('国库支出', 'Treasury spending')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {history.complete ? t('全部链上支出 · 累计金额（CKB）', 'All on-chain expenditures · cumulative CKB') : t('已核验链上支出 · 累计金额（CKB）', 'Verified on-chain expenditures · cumulative CKB')}
          </p>
        </div>
        <p className="text-sm">
          <span className="block font-mono text-lg font-semibold tabular-nums">{formatSpendingCkb(totalShannons, numberLocale)} <span className="text-sm">CKB</span></span>
          <span className="mt-1 block text-right text-xs text-muted-foreground">{t(`${points.length} 次支出`, `${points.length} expenditures`)}</span>
        </p>
      </div>

      {first && last ? (
        <figure className="mt-5">
          <div className="relative h-52 sm:h-64">
            {ticks.map((tick) => <span key={tick.value} aria-hidden="true" style={{ top: `${(tick.y / 230) * 100}%` }} className="absolute left-0 w-12 -translate-y-1/2 text-right text-xs leading-none text-muted-foreground">{tickFormatter.format(tick.value)}</span>)}
            {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG charts require explicit image semantics. */}
            <svg role="img"
              viewBox="76 0 662 230"
              preserveAspectRatio="none"
              aria-label={t(`全部 ${points.length} 次链上支出的累计金额折线图，纵轴从零开始。逐笔金额见下方支出表。`, `A cumulative line chart covering all ${points.length} on-chain expenditures, with a zero-based vertical axis. Individual transfers are listed below.`)}
              className="absolute inset-y-0 left-14 h-full w-[calc(100%_-_3.5rem)] touch-pan-y overflow-visible"
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse') selectNearest(event.clientX, event.clientY, event.currentTarget);
              }}
              onPointerDown={(event) => selectNearest(event.clientX, event.clientY, event.currentTarget)}
            >
              {ticks.map((tick) => <line key={tick.value} x1="76" y1={tick.y} x2="738" y2={tick.y} stroke="currentColor" strokeDasharray={tick.value ? '3 5' : undefined} vectorEffect="non-scaling-stroke" className="text-border" />)}
              <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="text-primary" />
              {points.map((point) => (
                <line key={point.entry.txHash} x1={point.x} y1={point.y} x2={point.x + 0.001} y2={point.y} stroke="currentColor" strokeWidth={selected === point ? 9 : 4} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="text-primary">
                  <title>{`${timeFormatter.format(new Date(point.entry.timestamp))}: ${formatSpendingCkb(point.entry.amountShannons, numberLocale)} CKB`}</title>
                </line>
              ))}
            </svg>
          </div>
          <div className="ml-14 mt-1 flex justify-between gap-4 text-xs text-muted-foreground">
            <span>{dateFormatter.format(new Date(first.entry.timestamp))}</span>
            <span>{dateFormatter.format(new Date(last.entry.timestamp))}</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(points.length - 1, 0)}
            step="1"
            value={selectedIndex ?? points.length - 1}
            onChange={(event) => setSelectedIndex(Number(event.currentTarget.value))}
            aria-label={t('查看某次支出，使用方向键选择', 'Inspect an expenditure using the arrow keys')}
            aria-valuetext={selected ? `${timeFormatter.format(new Date(selected.entry.timestamp))}, ${t('本次支出', 'Expenditure')} ${formatSpendingCkb(selected.entry.amountShannons, numberLocale)} CKB, ${t('累计支出', 'Cumulative expenditure')} ${formatSpendingCkb(selected.cumulativeShannons, numberLocale)} CKB` : undefined}
            className="sr-only accent-primary focus:not-sr-only focus:mt-2 focus:h-11 focus:w-full"
          />
          {selected && (
            <figcaption className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <time dateTime={selected.entry.timestamp}>{timeFormatter.format(new Date(selected.entry.timestamp))} (UTC+8)</time>
              <span>{t('本次支出', 'Expenditure')}: <span className="font-mono font-semibold text-foreground tabular-nums">{formatSpendingCkb(selected.entry.amountShannons, numberLocale)} CKB</span></span>
            </figcaption>
          )}
        </figure>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{t('暂无已核验的链上支出', 'No verified on-chain expenditures yet')}</p>
      )}

      {points.length > 0 && (
        <details className="mt-4 rounded-xl border border-border">
          <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('查看每次支出', 'View each expenditure')}</summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">{t('链上对外支出，不含找零或手续费。时间为北京时间 UTC+8。', 'External on-chain expenditures, excluding change and transaction fees. Times are Beijing time, UTC+8.')}</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-3 pr-4 font-medium">{t('时间（UTC+8）', 'Date (UTC+8)')}</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">{t('支出（CKB）', 'Amount (CKB)')}</th>
                  <th scope="col" className="py-3 pr-4 font-medium">{t('接收地址', 'Recipient')}</th>
                  <th scope="col" className="py-3 font-medium"><span className="sr-only">{t('链上交易', 'On-chain transaction')}</span></th>
                </tr>
              </thead>
              <tbody>
                {[...history.entries].reverse().map((entry) => (
                  <tr key={entry.txHash} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4"><time dateTime={entry.timestamp}>{dateFormatter.format(new Date(entry.timestamp))}</time></td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatSpendingCkb(entry.amountShannons, numberLocale)}</td>
                    <td className="py-3 pr-4">
                      {entry.recipients.map((recipient) => (
                        <a key={recipient.address} href={`https://explorer.nervos.org/address/${encodeURIComponent(recipient.address)}`} target="_blank" rel="noreferrer" title={recipient.address} className="block rounded font-mono text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{shortAddress(recipient.address)}</a>
                      ))}
                    </td>
                    <td className="py-3">
                      <a href={`https://explorer.nervos.org/transaction/${entry.txHash}`} target="_blank" rel="noreferrer" aria-label={t(`查看 ${dateFormatter.format(new Date(entry.timestamp))} 的链上支出交易`, `View the expenditure transaction on ${dateFormatter.format(new Date(entry.timestamp))}`)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight className="size-4" aria-hidden="true" /></a>
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
