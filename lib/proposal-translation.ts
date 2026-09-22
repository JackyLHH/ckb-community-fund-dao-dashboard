import type { Proposal, ProposalOverview } from '@/lib/proposals';

type TargetLocale = 'zh' | 'en';
type TranslationResponse = { ok?: boolean; translation?: string };

const translationsInFlight = new Map<string, Promise<string | null>>();

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function cacheKey(proposalId: string, target: TargetLocale, source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `proposal-overview-translation:v1:${proposalId}:${target}:${(hash >>> 0).toString(36)}`;
}

function readBrowserCache(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeBrowserCache(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Translation still works when storage is blocked or full.
  }
}

async function requestTranslation(
  proposalId: string,
  target: TargetLocale,
  source: string,
  fetcher: typeof fetch,
) {
  const key = cacheKey(proposalId, target, source);
  const cached = readBrowserCache(key);
  if (cached) return cached;
  const pending = translationsInFlight.get(key);
  if (pending) return pending;

  const request = fetcher('/api/translation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId, target, text: source }),
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const result = await response.json() as TranslationResponse;
      const translation = result.translation?.trim() ?? '';
      if (!result.ok || !translation) return null;
      writeBrowserCache(key, translation);
      return translation;
    })
    .catch(() => null)
    .finally(() => translationsInFlight.delete(key));

  translationsInFlight.set(key, request);
  return request;
}

function normalizeSourceOverview(overview: ProposalOverview) {
  const generic = overview.objective?.trim() ?? '';
  const objectiveEn = overview.objectiveEn?.trim() || (!containsChinese(generic) ? generic : '');
  const objectiveZh = overview.objectiveZh?.trim() || (containsChinese(generic) ? generic : '');
  return { generic, objectiveEn, objectiveZh };
}

export function needsProposalOverviewTranslation(proposal: Proposal) {
  if (!proposal.overview) return false;
  const { objectiveEn, objectiveZh } = normalizeSourceOverview(proposal.overview);
  return Boolean((objectiveEn && !objectiveZh) || (objectiveZh && !objectiveEn));
}

// Human-written objectiveEn/objectiveZh values always win. Only the missing side
// is generated, so later editorial overrides can replace machine translations.
export async function translateMissingProposalOverview(
  proposal: Proposal,
  fetcher: typeof fetch = fetch,
): Promise<Proposal> {
  if (!proposal.overview) return proposal;
  const overview = proposal.overview;
  const { objectiveEn, objectiveZh } = normalizeSourceOverview(overview);
  if (objectiveEn && objectiveZh) {
    if (overview.objectiveEn && overview.objectiveZh) return proposal;
    return { ...proposal, overview: { ...overview, objectiveEn, objectiveZh } };
  }

  const target: TargetLocale | null = objectiveEn && !objectiveZh ? 'zh' : objectiveZh && !objectiveEn ? 'en' : null;
  const source = target === 'zh' ? objectiveEn : target === 'en' ? objectiveZh : '';
  if (!target || !source) return proposal;

  const translation = await requestTranslation(proposal.id, target, source, fetcher);
  if (!translation) return {
    ...proposal,
    overview: { ...overview, ...(objectiveEn ? { objectiveEn } : {}), ...(objectiveZh ? { objectiveZh } : {}) },
  };

  return {
    ...proposal,
    overview: {
      ...overview,
      ...(objectiveEn ? { objectiveEn } : {}),
      ...(objectiveZh ? { objectiveZh } : {}),
      ...(target === 'zh' ? { objectiveZh: translation } : { objectiveEn: translation }),
    },
  };
}
