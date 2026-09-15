import { StaticLink as Link } from '@/components/static-link';
import { ArrowLeft } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f5f7f2]">
      <SiteHeader />
      <section className="grid min-h-[65vh] place-items-center px-5 text-center">
        <div>
          <p className="label-caps text-[#087958]">404 · Not found</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-.04em]"><I18nText zh="没有找到这个提案" en="Proposal not found" /></h1>
          <p className="mt-3 text-sm text-black/45"><I18nText zh="它可能已更名，或尚未进入当前数据目录。" en="It may have been renamed or may not be in the current directory yet." /></p>
          <Link href="/projects" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#096c4c] px-5 py-3 text-sm font-black text-white"><ArrowLeft className="size-4" /><I18nText zh="返回提案目录" en="Back to proposals" /></Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
