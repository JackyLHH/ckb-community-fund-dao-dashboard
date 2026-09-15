'use client';

import { useEffect, useState } from 'react';
import { dataset, type Proposal, type ProposalDataset } from '@/lib/proposals';
import { loadLiveDataset, loadLiveProject, type LiveDataState } from '@/lib/live-data';

export function useLiveDataset() {
  const [data, setData] = useState<ProposalDataset>(dataset);
  const [state, setState] = useState<LiveDataState>('loading');

  useEffect(() => {
    let active = true;
    void loadLiveDataset().then((next) => {
      if (!active) return;
      setData(next);
      setState(next.meta.usedFallback ? 'fallback' : 'live');
    });
    return () => { active = false; };
  }, []);

  return { data, state };
}

export function useLiveProject(id: string | null, initialProposal?: Proposal) {
  const [proposal, setProposal] = useState<Proposal | null>(initialProposal ?? null);
  const [state, setState] = useState<LiveDataState>('loading');

  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadLiveProject(id).then((next) => {
      if (!active) return;
      setProposal(next);
      setState(next ? 'live' : 'fallback');
    });
    return () => { active = false; };
  }, [id]);

  return { proposal, state };
}
