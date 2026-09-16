import type { Metadata } from 'next';
import { I18nText } from '@/components/i18n-text';
import { LiveProjectStats } from '@/components/live-project-directory-meta';
import { ProjectsExplorer } from '@/components/projects-explorer';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Proposals',
  description: 'Search and verify CKB Community Fund DAO proposals, voting, and delivery progress.',
};

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#0b0f0e]">
      <SiteHeader />
      <section className="border-b border-black/10 bg-[#0b0f0e] text-white">
        <div className="ledger-grid mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="label-caps text-[#7fe0bc]">Proposal directory</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-.045em] sm:text-6xl">
                <I18nText zh="查看每一个社区提案" en="Explore every community proposal" />
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                <I18nText
                  zh="从讨论帖到投票和拨款证据，用同一套结构追踪 CKB 生态建设提案。"
                  en="Track CKB ecosystem proposals from discussion through voting, funding, and delivery evidence."
                />
              </p>
            </div>
            <LiveProjectStats />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <ProjectsExplorer />
      </section>
      <SiteFooter />
    </main>
  );
}
