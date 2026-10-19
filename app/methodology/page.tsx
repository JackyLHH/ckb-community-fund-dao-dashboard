import type { Metadata } from 'next';
import { ArrowUpRight, Database, GitBranch, ShieldAlert } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveMethodologyStatus } from '@/components/live-methodology-status';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { LocaleLink } from '@/components/locale-link';
import { dataset, statusDescriptions, statusMeta } from '@/lib/proposals';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How the CKB Community Fund DAO Dashboard sources, syncs, and interprets its data.',
};

const sources = [
  { titleZh: '治理规则主源', titleEn: 'Governance rules', url: 'https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-en.md', urlZh: 'https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-cn.md', noteZh: '讨论、投票、执行与规则修订。', noteEn: 'Discussion, voting, execution, and rule amendments.' },
  { titleZh: 'Nervos Talk 提案分类', titleEn: 'Nervos Talk category', url: 'https://talk.nervos.org/c/daos-funding/ckb-community-fund-dao/65', noteZh: '提案发现、作者、互动和更新。', noteEn: 'Proposal discovery, authors, interactions, and updates.' },
  { titleZh: '已资助提案清单', titleEn: 'Funded proposals list', url: 'https://talk.nervos.org/t/list-of-funded-proposals/7793', noteZh: '资金余额、获批提案和拨款备注。', noteEn: 'Treasury snapshots, approved proposals, and disbursement notes.' },
  { titleZh: 'Metaforo 投票页', titleEn: 'Metaforo voting', url: 'https://dao.ckb.community', noteZh: '关联提案投票，并核验截止时间、参与权重与通过条件。', noteEn: 'Associated polls, with checks of closing time, voting weight, and approval thresholds.' },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
          <p className="label-caps text-primary"><I18nText zh="信息来源与核验方法" en="Trust through traceability" /></p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-.035em]">
            <I18nText zh="数据怎样变成一个状态" en="How evidence becomes a status" />
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
            <I18nText
              zh="这个网站聚合公开信息，但不替代原始论坛、投票页面或链上记录。每个结论都应可以沿来源返回验证。"
              en="This site aggregates public information but never replaces the forum, voting page, or on-chain records. Every conclusion should be traceable to its source."
            />
          </p>
          <nav aria-label="On this page / 本页导航" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-primary">
            <a className="touch-target inline-flex items-center rounded-lg underline underline-offset-4" href="#sources"><I18nText zh="数据来源" en="Sources" /></a>
            <a className="touch-target inline-flex items-center rounded-lg underline underline-offset-4" href="#statuses"><I18nText zh="状态说明" en="Status definitions" /></a>
            <a className="touch-target inline-flex items-center rounded-lg underline underline-offset-4" href="#freshness"><I18nText zh="更新与核验" en="Freshness & verification" /></a>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        <h2 id="sources" className="mb-5 text-2xl font-bold"><I18nText zh="原始信息来源" en="Primary sources" /></h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sources.map((source, index) => (
            <LocaleLink key={source.url} href={source.url} hrefZh={source.urlZh} target="_blank" rel="noreferrer" className="group rounded-[22px] border border-border bg-card p-6 transition hover:border-primary/60">
              <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-primary">0{index + 1}</span><ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" /></div>
              <h3 className="mt-5 text-lg font-bold"><I18nText zh={source.titleZh} en={source.titleEn} /></h3><p className="mt-2 text-sm leading-6 text-muted-foreground"><I18nText zh={source.noteZh} en={source.noteEn} /></p>
              <span className="sr-only"><I18nText zh="在新标签页打开" en="opens in a new tab" /></span>
            </LocaleLink>
          ))}
        </div>

        <div id="statuses" className="mt-12 grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="label-caps text-primary"><I18nText zh="提案状态说明" en="Status logic" /></p>
            <h2 className="mt-4 text-3xl font-black tracking-[-.035em]"><I18nText zh="谨慎判断，保留不确定性" en="Judge cautiously, preserve uncertainty" /></h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground"><I18nText zh="首帖需在 7 天内达到 30 个赞，并经核验后才可进入投票。当前赞数不一定等于讨论期结束时的赞数。达到门槛不代表投票通过，投票通过也不等于拨款已经到账。治理与交付状态是两个维度，可同时显示两个标签。" en="The first post must reach 30 likes within seven days and pass verification before voting. Today’s likes may differ from the count at the deadline. Meeting that threshold is not vote approval, and approval is not proof of disbursement. Governance and delivery are separate dimensions, so a proposal may carry two labels." /></p>
          </div>
          <div className="divide-y divide-border rounded-[22px] border border-border bg-card px-5">
            {(Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((key) => {
              const item = statusMeta[key];
              return <div key={key} className="grid items-start gap-3 py-5 sm:grid-cols-[150px_1fr]"><span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${item.className}`}><I18nText zh={item.zh} en={item.en} /></span><p className="text-sm leading-6 text-muted-foreground"><I18nText zh={statusDescriptions[key].zh} en={statusDescriptions[key].en} /></p></div>;
            })}
          </div>
        </div>

        <h2 id="freshness" className="mt-12 text-2xl font-bold"><I18nText zh="数据何时更新，如何核验" en="When data changes, and how it is checked" /></h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Database, titleZh: '缓存优先，尝试刷新', titleEn: 'Cached first, then refreshed', textZh: `先显示可用记录，再尝试读取论坛与链上来源。缓存日期会保留；静态后备目录有 ${dataset.meta.proposalCount} 份提案。`, textEn: `Available records load first, followed by forum and on-chain source checks. Cache dates are retained; the static fallback contains ${dataset.meta.proposalCount} proposals.` },
            { icon: GitBranch, titleZh: '人工覆盖', titleEn: 'Auditable overrides', textZh: '已资助、退款、终止和分阶段拨款等复杂事实使用可审计的人工覆盖。', textEn: 'Complex facts such as funding, refunds, termination, and milestone payments use auditable manual overrides.' },
            { icon: ShieldAlert, titleZh: '不猜测', titleEn: 'No guessing', textZh: '缺少投票数、汇率、预算或进展证据时显示“待核验”，不会补造数字。', textEn: 'Missing votes, exchange rates, budgets, or progress evidence is marked for verification; numbers are never invented.' },
          ].map(({ icon: Icon, titleZh, titleEn, textZh, textEn }) => (
            <div key={titleEn} className="rounded-[20px] border border-border bg-card p-6"><Icon className="size-5 text-primary" aria-hidden="true" /><h3 className="mt-4 font-bold"><I18nText zh={titleZh} en={titleEn} /></h3><p className="mt-2 text-sm leading-6 text-muted-foreground"><I18nText zh={textZh} en={textEn} /></p></div>
          ))}
        </div>

        <LiveMethodologyStatus />
        <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
          <p><I18nText zh="国库图表、累计支出、支出次数与明细统一从北京时间 2023 年 1 月 12 日零时起统计。更早的交易只用于核算真实期初余额。上图展示余额，下图按北京时间汇总月度支出；选择月份可查看当月金额及截至该月的累计支出，首月和末月只统计报告区间内的交易。余额包含入账、退款及手续费的影响；支出仅包含已核验的对外 CKB 转账，不含找零、同地址资金整理、入账退款和手续费。不会自动认定每笔转账都属于提案拨款；明细显示精确到秒的北京时间及交易详情。" en="The treasury chart, cumulative expenditure, expenditure count and records all begin at midnight on January 12, 2023, Beijing time. Earlier transactions only establish the true opening balance. The upper plot shows balance; the lower plot groups expenditure by Beijing calendar month. Selecting a month shows its expenditure and the cumulative amount through that month. Partial first and final months only include transactions in the reporting interval. Balance includes incoming funds, refunds and fees. Expenditure includes only verified external CKB transfers, excluding change, internal transfers, incoming refunds and fees. Transfers are not automatically attributed to proposal grants. Records show Beijing timestamps to the second and transaction details." /></p>
          <p><I18nText zh="概览、标题、里程碑和更新标题支持双语翻译；人工版本优先，自动翻译可能出错，请以原文为准。讨论的最近活动可能来自任何回复；进展列表仅保留提案人发布的进展或交付更新，以及明确人工补充的关联报告。" en="Overviews, titles, milestones, and update headings are bilingual. Human versions take priority; automatic translations may contain errors, so consult the source. Recent forum activity may come from any reply. Progress lists keep proposer-authored delivery updates and explicitly reviewed related reports." /></p>
          <p><I18nText zh="每日订阅在北京时间 16:00（UTC+8）汇总新提案、提案人进展及讨论和投票阶段变化；没有变化时不发送。邮件需确认订阅，可随时通过邮件中的个人链接选择语言、事件类型和关注提案，或退订。" en="Daily subscriptions summarize new proposals, proposer updates, and discussion or voting stage changes at 16:00 Beijing time (UTC+8). No changes means no message. Email requires confirmation; personal links let subscribers change language, event types, watched proposals, or unsubscribe." /></p>
          <p><I18nText zh="这是社区维护的信息工具，不代表 DAO 委员会的正式决定。如发现错误，欢迎回到原始来源核验，并通过 GitHub 提交问题或 PR。" en="This community-maintained tool does not represent official DAO committee decisions. If something looks wrong, check the source and share an issue or PR on GitHub." />{' '}<a href="https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/issues" target="_blank" rel="noreferrer" className="touch-target inline-flex items-center gap-1 rounded-lg font-bold text-primary underline underline-offset-4"><I18nText zh="反馈数据或界面问题" en="Report a data or interface issue" /><ArrowUpRight className="size-4" aria-hidden="true" /></a></p>
        </div>
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}
