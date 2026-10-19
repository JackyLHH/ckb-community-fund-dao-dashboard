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
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
      <section aria-labelledby="directory-title" className="border-b border-white/10 bg-[#0b0f0e] text-white">
        <div className="ledger-grid mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-9">
          <div>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-wider text-[#7fe0bc]"><I18nText zh="提案目录" en="Proposal directory" /></p>
              <h1 id="directory-title" className="mt-3 text-3xl font-bold leading-tight tracking-[-.025em] sm:text-4xl">
                <I18nText zh="DAO 提案，一目了然" en="DAO proposals, at a glance" />
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                <I18nText
                  zh="查看社区提案、资助情况与交付进展。"
                  en="See what’s proposed, funded, and delivered."
                />
              </p>
            </div>
            <div className="mt-6"><LiveProjectStats /></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="directory-title" className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <ProjectsExplorer />
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}
