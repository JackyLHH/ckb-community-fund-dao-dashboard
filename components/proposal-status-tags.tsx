'use client';

import { I18nText } from '@/components/i18n-text';
import { getProposalStatusTags, statusMeta, type Proposal } from '@/lib/proposals';
import { statusDescriptions } from '@/lib/proposals';
import { useLocale } from '@/lib/use-locale';

export function ProposalStatusTags({ proposal, compact = false }: { proposal: Proposal; compact?: boolean }) {
  const { locale } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {getProposalStatusTags(proposal).map((tag) => {
        const item = statusMeta[tag];
        return (
          <span
            key={tag}
            title={statusDescriptions[tag][locale]}
            className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-bold ${item.className} ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'}`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-full ${item.dotClassName}`} />
            <I18nText zh={item.zh} en={item.en} />
          </span>
        );
      })}
    </div>
  );
}
