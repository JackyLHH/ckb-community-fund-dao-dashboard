'use client';

import { useCallback, useEffect, useState } from 'react';
import { dataset, type Proposal, type ProposalDataset } from '@/lib/proposals';
import { loadLiveDataset, loadLiveProjectWithState, translateLiveDataset, translateLiveProposal, type LiveDataState } from '@/lib/live-data';
import { reviewedDetailCache, validProposalId } from '@/lib/proposal-detail-ux';
import { proposalOverridesById } from '@/lib/proposal-overrides';

const detailMemory = new Map<string, Proposal>();
// Discard detail records containing outdated automatic terminology.
const detailCacheKey = (id: string) => `ckb-proposal-detail:v7:${id}`;

function readDetailCache(id: string) {
  const currentRecord = dataset.proposals.find((entry) => entry.id === id);
  const review = proposalOverridesById[id];
  const memory = detailMemory.get(id);
  if (memory) return reviewedDetailCache(memory, review, currentRecord);
  try {
    const value = JSON.parse(window.sessionStorage.getItem(detailCacheKey(id)) ?? 'null') as Proposal | null;
    if (value?.id === id && typeof value.title === 'string' && Array.isArray(value.updates) && Array.isArray(value.sources) && value.discussion) return reviewedDetailCache(value, review, currentRecord);
  } catch { /* Storage is optional, not a prerequisite for reading a proposal. */ }
  return currentRecord ?? null;
}

export function useLiveDataset() {
  const [data, setData] = useState<ProposalDataset>(dataset);
  const [state, setState] = useState<LiveDataState>('loading');

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let generation = 0;
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      const currentGeneration = ++generation;
      void loadLiveDataset().then((next) => {
        if (!active) return;
        setData(next);
        setState(next.meta.usedFallback ? 'fallback' : 'live');
        void translateLiveDataset(next, (translated) => {
          if (!active || generation !== currentGeneration) return;
          setData((current) => ({ ...current, proposals: current.proposals.map((entry) => entry.id === translated.id ? translated : entry) }));
        }, () => active && generation === currentGeneration);
      }).catch(() => {
        if (active) setState('fallback');
      }).finally(() => { refreshing = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  return { data, state };
}

export function useLiveProject(id: string | null, initialProposal?: Proposal) {
  const [proposal, setProposal] = useState<Proposal | null>(initialProposal ?? null);
  const [state, setState] = useState<LiveDataState>('loading');
  const [error, setError] = useState<'invalid' | 'not-found' | 'unavailable' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!validProposalId(id)) {
      if (id !== null) queueMicrotask(() => { setError('invalid'); setState('fallback'); setProposal(null); });
      return;
    }
    const proposalId = id as string;
    let active = true;
    let refreshing = false;
    let generation = 0;
    const cached = initialProposal?.id === proposalId ? initialProposal : readDetailCache(proposalId);
    queueMicrotask(() => {
      if (!active) return;
      setProposal(cached);
      setError(null);
      setState('loading');
    });
    let forceRefresh = attempt > 0;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      const currentGeneration = ++generation;
      if (active) setState('loading');
      try {
        const result = await loadLiveProjectWithState(proposalId, { forceRefresh });
        forceRefresh = false;
        if (!active) return;
        const next = result.proposal;
        if (next) {
          setProposal(next);
          detailMemory.set(proposalId, next);
          try { window.sessionStorage.setItem(detailCacheKey(proposalId), JSON.stringify(next)); } catch { /* Still usable without storage. */ }
          setError(result.error);
          setState(result.state);
          void translateLiveProposal(next).then((translated) => {
            if (!active || generation !== currentGeneration) return;
            setProposal(translated);
            detailMemory.set(proposalId, translated);
            try { window.sessionStorage.setItem(detailCacheKey(proposalId), JSON.stringify(translated)); } catch { /* Storage is optional. */ }
          }).catch(() => { /* Keep the source record already displayed. */ });
        } else {
          setError(result.error ?? 'unavailable');
          setState('fallback');
        }
      } catch {
        if (active) { setState('fallback'); setError('unavailable'); }
      } finally { refreshing = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [id, initialProposal, attempt]);

  return { proposal, state, error, retry };
}
