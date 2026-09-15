import type { Metadata } from 'next';
import { ArrowUpRight, Database, GitBranch, ShieldAlert } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveMethodologyStatus } from '@/components/live-methodology-status';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { dataset, statusMeta } from '@/lib/proposals';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How the CKB Community Fund DAO Dashboard sources, syncs, and interprets its data.',
};

const sources = [
  { titleZh: '治理规则主源', titleEn: 'Governance rules', url: 'https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-en.md', noteZh: '讨论、投票、执行与规则修订。', noteEn: 'Discussion, voting, execution, and rule amendments.' },
  { titleZh: 'Nervos Talk 提案分类', titleEn: 'Nervos Talk category', url: 'https://talk.nervos.org/c/daos-funding/ckb-community-fund-dao/65', noteZh: '提案发现、作者、互动和更新。', noteEn: 'Proposal discovery, authors, interactions, and updates.' },
  { titleZh: '已资助提案清单', titleEn: 'Funded proposals list', url: 'https://talk.nervos.org/t/list-of-funded-proposals/7793', noteZh: '资金余额、获批提案和拨款备注。', noteEn: 'Treasury snapshots, approved proposals, and disbursement notes.' },
  { titleZh: 'Metaforo 投票页', titleEn: 'Metaforo voting', url: 'https://dao.ckb.community', noteZh: '投票详情；仅在原帖提供链接时关联。', noteEn: 'Voting details, linked only when the proposal provides a voting URL.' },
];

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#0b0f0e]">
      <SiteHeader />
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center lg:px-8 lg:py-24">
          <p className="label-caps text-[#087958]">Trust through traceability</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">
            <I18nText zh="数据怎样变成一个状态" en="How evidence becomes a status" />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-black/55">
            <I18nText
              zh="这个网站聚合公开信息，但不替代原始论坛、投票页面或链上记录。每个结论都应可以沿来源返回验证。"
              en="This site aggregates public information but never replaces the forum, voting page, or on-chain records. Every conclusion should be traceable to its source."
            />
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">
        <div className="grid gap-5 sm:grid-cols-2">
          {sources.map((source, index) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="group rounded-[22px] border border-black/10 bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#00a873]/45">
              <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-full bg-[#e3f8ef] font-mono text-xs font-bold text-[#087958]">0{index + 1}</span><ArrowUpRight className="size-4 text-black/25 group-hover:text-[#087958]" /></div>
              <h2 className="mt-6 text-lg font-black"><I18nText zh={source.titleZh} en={source.titleEn} /></h2><p className="mt-2 text-sm leading-6 text-black/48"><I18nText zh={source.noteZh} en={source.noteEn} /></p>
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="label-caps text-[#087958]">Status logic</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-.035em]"><I18nText zh="谨慎判断，保留不确定性" en="Judge cautiously, preserve uncertainty" /></h2>
            <p className="mt-4 text-sm leading-6 text-black/50"><I18nText zh="网站只计算原始提案首帖的赞数：首帖需在 7 天内达到 30 个赞才可进入投票。达到门槛不代表投票通过或已经获得拨款；更可靠的投票和交付证据优先。" en="Only likes on the proposal's first post are counted: it must reach 30 likes within seven days to enter voting. Reaching that threshold does not mean the vote passed or funding was received; stronger voting and delivery evidence takes priority." /></p>
          </div>
          <div className="divide-y divide-black/8 rounded-[22px] border border-black/10 bg-white px-6">
            {(Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((key) => {
              const item = statusMeta[key];
              const descriptions = {
                discussion: { zh: '提案仍在 7 天讨论期内，且尚未进入投票。', en: 'The proposal is still within its seven-day discussion window and has not entered voting.' },
                voting: { zh: 'Metaforo 投票仍在进行，关闭前结果仍可能变化。', en: 'Metaforo voting is open and the result can still change before closing.' },
                'vote-passed': { zh: '当前或最终票数同时满足法定票数与通过比例。', en: 'The current or final tally meets both quorum and approval thresholds.' },
                executing: { zh: '提案已获资助，且仍有工作或里程碑处于执行阶段。', en: 'The proposal was funded and still has work or milestones in progress.' },
                'vote-failed': { zh: '最终投票未达到通过比例或法定票数要求。', en: 'The final vote did not meet its approval or quorum requirement.' },
                completed: { zh: '公开的状态更新或交付证据表明全部提案工作已经完成。', en: 'Public updates or delivery evidence show that all proposed work was completed.' },
                ended: { zh: '首帖未在 7 天内达到 30 个赞，或提案已终止、退款、投票失败或完成。', en: 'The first post missed 30 likes in seven days, or the proposal ended through rejection, termination, refund, or completion.' },
              };
              return <div key={key} className="grid gap-2 py-5 sm:grid-cols-[150px_1fr]"><span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${item.className}`}><I18nText zh={item.zh} en={item.en} /></span><p className="text-sm leading-6 text-black/52"><I18nText zh={descriptions[key].zh} en={descriptions[key].en} /></p></div>;
            })}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Database, titleZh: '打开即更新', titleEn: 'Refreshes on open', textZh: `每次打开都会读取 Nervos Talk 和链上余额；当前静态后备目录包含 ${dataset.meta.proposalCount} 个提案。`, textEn: `Nervos Talk and the on-chain balance are read whenever the site opens. The static fallback currently contains ${dataset.meta.proposalCount} proposals.` },
            { icon: GitBranch, titleZh: '人工覆盖', titleEn: 'Auditable overrides', textZh: '已资助、退款、终止和分阶段拨款等复杂事实使用可审计的人工覆盖。', textEn: 'Complex facts such as funding, refunds, termination, and milestone payments use auditable manual overrides.' },
            { icon: ShieldAlert, titleZh: '不猜测', titleEn: 'No guessing', textZh: '缺少投票数、汇率、预算或进展证据时显示“待核验”，不会补造数字。', textEn: 'Missing votes, exchange rates, budgets, or progress evidence is marked for verification; numbers are never invented.' },
          ].map(({ icon: Icon, titleZh, titleEn, textZh, textEn }) => (
            <div key={titleEn} className="rounded-[20px] bg-[#0b0f0e] p-6 text-white"><Icon className="size-5 text-[#7fe0bc]" /><h3 className="mt-5 font-black"><I18nText zh={titleZh} en={titleEn} /></h3><p className="mt-2 text-xs leading-5 text-white/48"><I18nText zh={textZh} en={textEn} /></p></div>
          ))}
        </div>

        <LiveMethodologyStatus />
      </section>
      <SiteFooter />
    </main>
  );
}
