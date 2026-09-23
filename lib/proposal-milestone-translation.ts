import type { Proposal, ProposalOverview } from '@/lib/proposals';
import rawTranslations from '../data/proposal-milestone-translations.json' with { type: 'json' };

type TargetLocale = 'zh' | 'en';
type TranslatableField = 'milestone-title' | 'milestone-description';
type TranslationResponse = { ok?: boolean; translation?: string };

const translationsInFlight = new Map<string, Promise<string | null>>();
const proposalMilestoneTranslationsById = rawTranslations.translations as Record<
  string,
  Array<{
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
    budgetZh?: string | null;
    budgetEn?: string | null;
    etaZh?: string | null;
    etaEn?: string | null;
  }>
>;

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function cacheKey(
  proposalId: string,
  milestoneIndex: number,
  field: TranslatableField,
  target: TargetLocale,
  source: string,
) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `proposal-milestone-translation:v1:${proposalId}:${milestoneIndex}:${field}:${target}:${(hash >>> 0).toString(36)}`;
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
  milestoneIndex: number,
  field: TranslatableField,
  target: TargetLocale,
  source: string,
  fetcher: typeof fetch,
) {
  const key = cacheKey(proposalId, milestoneIndex, field, target, source);
  const cached = readBrowserCache(key);
  if (cached) return cached;
  const pending = translationsInFlight.get(key);
  if (pending) return pending;

  const query = new URLSearchParams({ proposalId, target, text: source, kind: field });
  const request = fetcher(`/api/translation?${query}`)
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

function localizedPair(
  generic: string,
  explicitZh?: string | null,
  explicitEn?: string | null,
  historicalZh?: string | null,
  historicalEn?: string | null,
) {
  const source = generic.trim();
  const zh = explicitZh?.trim()
    || (containsChinese(source) ? source : '')
    || historicalZh?.trim()
    || '';
  const en = explicitEn?.trim()
    || (!containsChinese(source) ? source : '')
    || historicalEn?.trim()
    || '';
  return { zh, en };
}

function mergeHistoricalMilestones(proposal: Proposal, useHistorical = true): ProposalOverview['milestones'] {
  const historical = useHistorical ? proposalMilestoneTranslationsById[proposal.id] ?? [] : [];
  return (proposal.overview?.milestones ?? []).map((milestone, index) => {
    const saved = historical[index];
    const title = localizedPair(
      milestone.title,
      milestone.titleZh,
      milestone.titleEn,
      saved?.titleZh,
      saved?.titleEn,
    );
    const description = localizedPair(
      milestone.description,
      milestone.descriptionZh,
      milestone.descriptionEn,
      saved?.descriptionZh,
      saved?.descriptionEn,
    );
    return {
      ...milestone,
      ...(title.zh ? { titleZh: title.zh } : {}),
      ...(title.en ? { titleEn: title.en } : {}),
      ...(description.zh ? { descriptionZh: description.zh } : {}),
      ...(description.en ? { descriptionEn: description.en } : {}),
      budgetZh: milestone.budgetZh ?? saved?.budgetZh ?? milestone.budget,
      budgetEn: milestone.budgetEn ?? saved?.budgetEn ?? milestone.budget,
      etaZh: milestone.etaZh ?? saved?.etaZh ?? milestone.eta,
      etaEn: milestone.etaEn ?? saved?.etaEn ?? milestone.eta,
    };
  });
}

export function applyPersistedMilestoneTranslations(proposal: Proposal, useHistorical = true): Proposal {
  if (!proposal.overview?.milestones.length) return proposal;
  return {
    ...proposal,
    overview: {
      ...proposal.overview,
      milestones: mergeHistoricalMilestones(proposal, useHistorical),
    },
  };
}

// Explicit titleZh/titleEn and descriptionZh/descriptionEn fields always win.
// Persisted translations fill historical gaps; only genuinely missing fields
// trigger an automatic, CDN-cacheable translation request.
export async function translateMissingProposalMilestones(
  proposal: Proposal,
  fetcher: typeof fetch = fetch,
  options: { useHistorical?: boolean } = {},
): Promise<Proposal> {
  if (!proposal.overview?.milestones.length) return proposal;
  const withHistorical = applyPersistedMilestoneTranslations(proposal, options.useHistorical ?? true);
  const milestones = await Promise.all(withHistorical.overview!.milestones.map(async (milestone, index) => {
    const title = localizedPair(milestone.title, milestone.titleZh, milestone.titleEn);
    const description = localizedPair(
      milestone.description,
      milestone.descriptionZh,
      milestone.descriptionEn,
    );
    const [titleZh, titleEn, descriptionZh, descriptionEn] = await Promise.all([
      title.zh || !title.en
        ? Promise.resolve(title.zh)
        : requestTranslation(proposal.id, index, 'milestone-title', 'zh', title.en, fetcher),
      title.en || !title.zh
        ? Promise.resolve(title.en)
        : requestTranslation(proposal.id, index, 'milestone-title', 'en', title.zh, fetcher),
      description.zh || !description.en
        ? Promise.resolve(description.zh)
        : requestTranslation(proposal.id, index, 'milestone-description', 'zh', description.en, fetcher),
      description.en || !description.zh
        ? Promise.resolve(description.en)
        : requestTranslation(proposal.id, index, 'milestone-description', 'en', description.zh, fetcher),
    ]);
    return {
      ...milestone,
      ...(titleZh ? { titleZh } : {}),
      ...(titleEn ? { titleEn } : {}),
      ...(descriptionZh ? { descriptionZh } : {}),
      ...(descriptionEn ? { descriptionEn } : {}),
    };
  }));
  return { ...withHistorical, overview: { ...withHistorical.overview!, milestones } };
}
