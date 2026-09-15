import { StaticLink as Link } from '@/components/static-link';
import {
  ArrowUpRight,
  Ban,
  CircleCheck,
  Coins,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LiveFeaturedProposals } from '@/components/live-featured-proposals';
import { LiveHomeActivity } from '@/components/live-home-activity';
import { LiveTreasuryCard } from '@/components/live-treasury-card';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#0b0f0e]">
      <SiteHeader />

      <section className="overflow-hidden bg-[#0b0f0e] text-white">
        <div className="ledger-grid relative mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:py-28">
          <div className="pointer-events-none absolute -left-24 top-16 size-72 rounded-full bg-[#00cc8e]/15 blur-3xl" />
          <div className="relative z-10 max-w-3xl">
            <h1 className="max-w-3xl font-[var(--font-heading-stack)] text-[clamp(3.1rem,7vw,6.7rem)] font-black leading-[.88] tracking-[-.065em]">
              <I18nText
                zh={<>让每一笔社区资金<span className="mt-2 block text-[#c8ff67]">清晰可见</span></>}
                en={<>See every community fund<span className="mt-2 block text-[#c8ff67]">in the open</span></>}
              />
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
              <I18nText
                zh="一站查看 CKB Community Fund DAO 的治理规则、资金余额、提案投票与里程碑进展。"
                en="Explore the rules, treasury, votes, and milestone progress of the CKB Community Fund DAO in one place."
              />
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/projects"
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-[#c8ff67] px-6 text-sm font-bold text-[#102119] transition hover:bg-[#b9ed60]"
              >
                <I18nText zh="浏览所有提案" en="Explore all proposals" /> <ArrowUpRight data-icon="inline-end" />
              </Link>
              <a
                href="#governance"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <I18nText zh="了解申请流程" en="How funding works" />
              </a>
              <I18nText
                zh={(
                  <a
                    href="https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-cn.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    查看完整规则 <ArrowUpRight className="size-4" />
                  </a>
                )}
                en={(
                  <a
                    href="https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-en.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    View full rules <ArrowUpRight className="size-4" />
                  </a>
                )}
              />
            </div>
          </div>

          <div className="relative self-end lg:pl-8">
            <LiveTreasuryCard />
          </div>
        </div>
      </section>

      <section id="governance" className="bg-[#f5f7f2]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="label-caps text-[#087958]">Governance path</p>
            <h2 className="mt-4 max-w-md text-4xl font-black tracking-[-.04em] sm:text-5xl">
              <I18nText zh="从一个想法，到可验证的交付" en="From an idea to verifiable delivery" />
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-black/55">
              <I18nText
                zh="三个公开阶段让社区有时间理解、讨论、表决并持续监督资金的使用。"
                en="Three public stages give the community time to understand, discuss, vote, and monitor how funds are used."
              />
            </p>
          </div>
          <ol className="grid gap-4">
            {[
              {
                no: '01',
                icon: MessageCircle,
                titleZh: '讨论', titleEn: 'Discussion',
                metaZh: 'Nervos Talk · 至少 7 天', metaEn: 'Nervos Talk · At least 7 days',
                bodyZh: '发布以 [DIS] 开头的提案；一周内累计达到 30 个赞，方可通过讨论阶段。',
                bodyEn: 'Publish a proposal beginning with [DIS]. It must receive at least 30 likes within one week to pass discussion.',
              },
              {
                no: '02',
                icon: Vote,
                titleZh: '投票', titleEn: 'Voting',
                metaZh: 'Metaforo · 公开投票 7 天', metaEn: 'Metaforo · 7-day public vote',
                bodyZh: '预算类提案需至少 51% 赞成，且总投票权重不少于申请 CKB 数量的 3 倍；元规则修改提案需至少 67% 赞成，且总投票数不少于 185,000,000。',
                bodyEn: 'Budget proposals need at least 51% approval and voting weight of at least three times the requested CKB. Meta-rule amendments need at least 67% approval and 185,000,000 total votes.',
              },
              {
                no: '03',
                icon: CircleCheck,
                titleZh: '执行', titleEn: 'Execution',
                metaZh: 'Milestones · 持续披露', metaEn: 'Milestones · Ongoing disclosure',
                bodyZh: '通过后按规则拨款；提案人通过 [Status Update] 报告里程碑、交付物与资金使用。',
                bodyEn: 'Approved proposals receive funds under the rules and report milestones, deliverables, and spending through [Status Update] posts.',
              },
            ].map(({ no, icon: Icon, titleZh, titleEn, metaZh, metaEn, bodyZh, bodyEn }) => (
              <li
                key={no}
                className="group grid gap-5 rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#00a873]/40 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:p-6"
              >
                <span className="grid size-12 place-items-center rounded-full bg-[#e6f7ef] font-mono text-xs font-bold text-[#087958]">
                  {no}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold tracking-tight"><I18nText zh={titleZh} en={titleEn} /></h3>
                    <span className="rounded-full border border-black/10 bg-[#f5f7f2] px-2 py-1 text-[10px] font-semibold text-black/55">
                      <I18nText zh={metaZh} en={metaEn} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/55"><I18nText zh={bodyZh} en={bodyEn} /></p>
                </div>
                <Icon className="hidden size-6 text-[#087958] sm:block" aria-hidden="true" />
              </li>
            ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="label-caps text-[#087958]">Rules that protect the fund</p>
            <h2 className="mt-4 max-w-lg text-4xl font-black tracking-[-.04em] sm:text-5xl">
              <I18nText zh="规则不是装饰，是资金的护栏" en="Rules are the treasury’s guardrails" />
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-black/52">
              <I18nText
                zh="关键规则直接链接到治理主源；网站只做解释和聚合，不改变社区规则。"
                en="Every key rule links back to governance sources. This site explains and aggregates; it does not redefine governance."
              />
            </p>
            <I18nText
              zh={<a href="https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-cn.md" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#087958]">阅读完整规则 <ArrowUpRight className="size-4" /></a>}
              en={<a href="https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-en.md" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#087958]">Read the full rules <ArrowUpRight className="size-4" /></a>}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Ban, titleZh: '禁止投票激励', titleEn: 'No voting incentives', textZh: '不得向 DAO 投票者空投资产，以避免有偿拉票。', textEn: 'Proposers may not airdrop assets to DAO voters as an incentive for votes.' },
              { icon: ShieldCheck, titleZh: '只计算 DAO 存款', titleEn: 'Only DAO deposits count', textZh: '已解锁或已提取的 CKB 不计入 Metaforo 投票权重。', textEn: 'Unlocked or withdrawn CKB does not count toward Metaforo voting weight.' },
              { icon: Coins, titleZh: '大额预算分期拨付', titleEn: 'Large budgets use milestones', textZh: '超过 $10,000 的预算采用里程碑付款；首笔不超过 20%，且上限 $10,000。', textEn: 'Budgets over $10,000 use milestone payments. The first payment is capped at 20% and $10,000.' },
              { icon: FileCheck2, titleZh: '持续发布进展报告', titleEn: 'Ongoing delivery reports', textZh: '提案人需报告里程碑、目标完成情况与资金使用，供社区监督。', textEn: 'Teams report milestones, completed goals, and fund usage for community oversight.' },
            ].map(({ icon: Icon, titleZh, titleEn, textZh, textEn }) => (
              <div key={titleEn} className="rounded-[20px] border border-black/10 bg-white p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-[#e3f8ef] text-[#087958]"><Icon className="size-5" /></span>
                <h3 className="mt-5 font-black"><I18nText zh={titleZh} en={titleEn} /></h3>
                <p className="mt-2 text-xs leading-5 text-black/48"><I18nText zh={textZh} en={textEn} /></p>
              </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-[#eaf0eb]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="label-caps text-[#087958]">Featured proposals</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.035em]"><I18nText zh="正在执行的提案" en="Proposals in progress" /></h2>
            </div>
            <Link href="/projects?status=executing" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#087958]">
              <I18nText zh="更多正在执行中的提案" en="More proposals in progress" /> <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <LiveFeaturedProposals />
        </div>
      </section>

      <LiveHomeActivity />
      <SiteFooter />
    </main>
  );
}
