'use client';

import { ThumbsUp } from 'lucide-react';
import { I18nText } from '@/components/i18n-text';
import { useLiveDataset } from '@/lib/use-live-data';

export function LiveProposalLike({ id }: { id: string }) {
  const { data } = useLiveDataset();
  const likes = data.proposals.find((proposal) => proposal.id === id)?.discussion.likes ?? '—';
  return <span className="inline-flex items-center gap-1.5"><ThumbsUp className="size-3.5" /> {likes} <I18nText zh="赞" en="likes" /></span>;
}
