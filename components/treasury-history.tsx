'use client';

import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import savedHistory from '@/data/treasury-history.generated.json';
import { TREASURY_ADDRESS_URL, type TreasuryHistory } from '@/lib/treasury-history';
import { useLocale } from '@/lib/use-locale';

function exactCkb(value: string, locale: string) {
  const [whole, fraction] = value.split('.');
  return `${new Intl.NumberFormat(locale).format(BigInt(whole))}${fraction ? `.${fraction}` : ''}`;
}

export function TreasuryHistoryChart({ history = savedHistory as TreasuryHistory }: { history?: TreasuryHistory }) {
  const { locale, t } = useLocale();
  const observations = history.observations;
  const first = observations[0];
  const last = observations.at(-1);
  const numberLocale = locale === 'en' ? 'en-US' : 'zh-CN';
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat(numberLocale, { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const values = observations.map((observation) => Number(BigInt(observation.balanceShannons) / BigInt(100_000_000)));
  const chartAvailable = observations.length >= 2 && values.every(Number.isSafeInteger);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const padding = Math.max((maximum - minimum) * 0.15, 1);
  const range = maximum - minimum + 2 * padding;
  const firstTime = first ? Date.parse(first.date) : 0;
  const lastTime = last ? Date.parse(last.date) : 0;
  const points = observations.map((observation, index) => ({
    x: 20 + ((Date.parse(observation.date) - firstTime) / (lastTime - firstTime || 1)) * 680,
    y: 180 - ((values[index] - minimum + padding) / range) * 160,
  }));

  return (
    <section aria-labelledby="treasury-history-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="treasury-history-heading" className="flex items-center gap-2 text-xl font-bold"><ChartNoAxesCombined className="size-5 text-primary" aria-hidden="true" />{t('国库余额记录', 'Treasury balance history')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('按北京时间每天记录一次实际读取的链上余额；不补造历史数据。余额变化不能直接视为资助支出。', 'One observed on-chain balance per Beijing calendar day, with no estimated backfill. Balance changes must not be treated as grant spending.')}</p></div>
        {last && <p className="text-right text-sm"><span className="block text-xs text-muted-foreground">{t('最近一次观察', 'Latest observation')}</span><span className="mt-1 block font-mono font-semibold tabular-nums">{exactCkb(last.balanceCkb, numberLocale)} CKB</span><time dateTime={last.observedAt} className="mt-1 block text-xs text-muted-foreground">{timeFormatter.format(new Date(last.observedAt))} (UTC+8)</time></p>}
      </div>

      {chartAvailable && first && last ? <figure className="mt-5">
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- A native SVG chart needs explicit image semantics. */}
        <svg viewBox="0 0 720 200" role="img" aria-label={t(`从 ${first.date} 到 ${last.date} 的 ${observations.length} 次国库余额观察，详细数字见下方记录表。`, `${observations.length} treasury balance observations from ${first.date} to ${last.date}. Exact figures are available in the record table below.`)} className="h-auto max-h-64 w-full overflow-visible">
          <line x1="20" y1="180" x2="700" y2="180" stroke="currentColor" className="text-border" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className="text-primary" />
          {points.map((point, index) => <circle key={observations[index].date} cx={point.x} cy={point.y} r="3.5" fill="currentColor" className="text-primary"><title>{observations[index].date}: {exactCkb(observations[index].balanceCkb, numberLocale)} CKB</title></circle>)}
        </svg>
        <div className="mt-1 flex justify-between gap-4 text-xs text-muted-foreground"><span>{dateFormatter.format(new Date(first.observedAt))}</span><span>{dateFormatter.format(new Date(last.observedAt))}</span></div>
        <p className="mt-3 text-xs text-muted-foreground">{t('观察范围：', 'Observed range: ')}{minimum.toLocaleString(numberLocale)}–{maximum.toLocaleString(numberLocale)} CKB</p>
        <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{t('纵轴按观察范围自动缩放，不从零开始。折线仅连接实际观察点，并非逐笔资金流向图；图表按整 CKB 展示，记录表保留完整精度。', 'The vertical scale fits the observed range and does not start at zero. The line connects observations, not individual transfers. The chart uses whole CKB; the table retains full precision.')}</figcaption>
      </figure> : <div className="mt-5 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm leading-6 text-muted-foreground">{t('余额历史从经过核验的真实观察开始，不估算过去的余额。积累至少两天记录后，这里将显示趋势图。', 'History starts with verified observations, not historical estimates. A trend chart will appear once at least two daily records are available.')}</div>}

      {observations.length > 0 && <details className="mt-4 rounded-xl border border-border">
        <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t(`查看每日记录（${observations.length}）`, `View daily records (${observations.length})`)}</summary>
        <div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[480px] text-left text-sm"><caption className="sr-only">{t('国库实际余额读取记录，所有时间均为北京时间 UTC+8', 'Observed treasury balances. All times are Beijing time, UTC+8.')}</caption><thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-3 pr-4 font-medium">{t('读取时间（UTC+8）', 'Observed at (UTC+8)')}</th><th scope="col" className="py-3 text-right font-medium">{t('余额（CKB）', 'Balance (CKB)')}</th></tr></thead><tbody>{[...observations].reverse().map((observation) => <tr key={observation.date} className="border-b border-border last:border-0"><td className="py-3 pr-4"><time dateTime={observation.observedAt}>{timeFormatter.format(new Date(observation.observedAt))}</time></td><td className="py-3 text-right font-mono tabular-nums">{exactCkb(observation.balanceCkb, numberLocale)}</td></tr>)}</tbody></table></div>
      </details>}
      <a href={TREASURY_ADDRESS_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('在 CKB Explorer 查看当前地址余额', 'View the current address balance on CKB Explorer')}<ArrowUpRight className="size-4" aria-hidden="true" /></a>
    </section>
  );
}
