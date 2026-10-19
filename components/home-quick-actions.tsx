'use client';

import { useLiveDataset } from '@/lib/use-live-data';
import { getProposalStatusTags } from '@/lib/proposals';
import { useLocale } from '@/lib/use-locale';
import { Mail, MessageCircle, Vote } from 'lucide-react';

export function HomeQuickActions() {
  const { data, state } = useLiveDataset();
  const { t } = useLocale();
  return <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
    {[
      { status: 'discussion' as const, icon: MessageCircle, label: t('参与讨论', 'Join the discussion') },
      { status: 'voting' as const, icon: Vote, label: t('正在投票', 'Voting now') },
    ].map(({ status, icon: Icon, label }) => <a key={status} href={`/projects?status=${status}`} className="touch-target inline-flex items-center gap-2 rounded-lg underline-offset-4 hover:text-[#c8ff67] hover:underline">
      <Icon className="size-4" aria-hidden="true" />{label} <span className="font-mono font-bold">{state === 'loading' ? '—' : data.proposals.filter(proposal => getProposalStatusTags(proposal).includes(status)).length}</span>
    </a>)}
    <a href="#subscribe" className="touch-target inline-flex items-center gap-2 rounded-lg underline-offset-4 hover:text-[#c8ff67] hover:underline"><Mail className="size-4" aria-hidden="true" />{t('订阅每日动态', 'Get daily updates')}</a>
  </div>;
}
