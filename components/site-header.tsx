import { StaticLink as Link } from '@/components/static-link';
import { ArrowUpRight } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { LanguageSwitch } from '@/components/language-switch';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f5f7f2]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="CKB Community Fund DAO">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[#0b0f0e] text-xs font-black text-[#c8ff67]">
            CKB
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:block">Community Fund DAO</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Main navigation">
          <Link href="/" className="hidden rounded-lg px-3 py-2 transition hover:bg-black/5 md:block">
            <I18nText zh="总览" en="Overview" />
          </Link>
          <Link href="/projects" className="rounded-lg px-3 py-2 transition hover:bg-black/5">
            <I18nText zh="提案" en="Proposals" />
          </Link>
          <Link href="/methodology" className="hidden rounded-lg px-3 py-2 transition hover:bg-black/5 sm:block">
            <I18nText zh="数据说明" en="Methodology" />
          </Link>
          <LanguageSwitch />
          <a
            href="https://talk.nervos.org/c/daos-funding/ckb-community-fund-dao/65"
            target="_blank"
            rel="noreferrer"
            className="ml-1 hidden h-9 items-center gap-1.5 rounded-full bg-[#096c4c] px-4 text-xs font-bold text-white transition hover:bg-[#07593f] lg:inline-flex"
          >
            Nervos Talk <ArrowUpRight className="size-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
