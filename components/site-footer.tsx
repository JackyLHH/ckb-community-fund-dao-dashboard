import { StaticLink as Link } from '@/components/static-link';
import { ArrowUpRight } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0b0f0e] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-[10px] bg-[#c8ff67] text-xs font-black text-[#0b0f0e]">CKB</span>
            <span className="text-sm font-bold">Community Fund DAO</span>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/50">
            <I18nText
              zh="社区维护的信息仪表盘。所有状态与金额均应回到原始论坛、投票页与链上交易进行核验。"
              en="A community information dashboard. Verify every status and amount against the original forum, voting page, and on-chain transaction."
            />
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 text-sm text-white/65">
          <Link href="/projects" className="hover:text-[#c8ff67]"><I18nText zh="提案目录" en="Proposals" /></Link>
          <Link href="/methodology" className="hover:text-[#c8ff67]"><I18nText zh="数据方法" en="Methodology" /></Link>
          <a
            href="https://github.com/CKB-Community-Fund-DAO/rules/blob/main/rules-en.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#c8ff67]"
          >
            <I18nText zh="治理规则" en="Rules" /> <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
