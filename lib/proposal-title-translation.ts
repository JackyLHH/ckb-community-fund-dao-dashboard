import type { Proposal } from '@/lib/proposals';
import rawTranslations from '../data/proposal-title-translations.json' with { type: 'json' };

type TargetLocale = 'zh' | 'en';
type TranslationResponse = { ok?: boolean; translation?: string };
type SavedTitleTranslation = { sourceTitle: string; zh: string; en: string };

const translationsInFlight = new Map<string, Promise<string | null>>();
const proposalTitleTranslationsById = rawTranslations.translations as Record<string, SavedTitleTranslation>;

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function normalizeSourceTitle(value: string) {
  return value.replace(/^\s*\[DIS\]\s*/i, '').replace(/\s+/g, ' ').trim();
}

function splitBilingualTitle(source: string) {
  const normalized = normalizeSourceTitle(source);
  const parts = normalized.split(/\s*(?:\||｜|\s\/\s|\s—\s|\s–\s)\s*/u).filter(Boolean);
  if (parts.length < 2) return { zh: '', en: '' };
  const zh = parts.find((part) => containsChinese(part)) ?? '';
  const en = parts.find((part) => !containsChinese(part) && /[A-Za-z]/u.test(part)) ?? '';
  return { zh, en };
}

function sourceLanguagePair(source: string) {
  const normalized = normalizeSourceTitle(source);
  const split = splitBilingualTitle(normalized);
  if (split.zh && split.en) return split;
  return containsChinese(normalized) ? { zh: normalized, en: '' } : { zh: '', en: normalized };
}

function matchingHistorical(proposalId: string, source: string, useHistorical: boolean) {
  if (!useHistorical) return undefined;
  const saved = proposalTitleTranslationsById[proposalId];
  if (!saved) return undefined;
  return normalizeSourceTitle(saved.sourceTitle) === normalizeSourceTitle(source) ? saved : undefined;
}

function localizedTitlePair(proposal: Proposal, useHistorical = true) {
  const source = normalizeSourceTitle(proposal.title);
  const sourcePair = sourceLanguagePair(source);
  const historical = matchingHistorical(proposal.id, source, useHistorical);
  return {
    zh: proposal.titleZh?.trim() || sourcePair.zh || historical?.zh?.trim() || '',
    en: proposal.titleEn?.trim() || sourcePair.en || historical?.en?.trim() || '',
  };
}

function cacheKey(proposalId: string, target: TargetLocale, source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `proposal-title-translation:v1:${proposalId}:${target}:${(hash >>> 0).toString(36)}`;
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

  const query = new URLSearchParams({ proposalId, target, text: source, kind: 'proposal-title' });
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

export function applyPersistedTitleTranslation(proposal: Proposal, useHistorical = true): Proposal {
  const pair = localizedTitlePair(proposal, useHistorical);
  if ((!pair.zh || proposal.titleZh === pair.zh) && (!pair.en || proposal.titleEn === pair.en)) return proposal;
  return {
    ...proposal,
    ...(pair.zh ? { titleZh: pair.zh } : {}),
    ...(pair.en ? { titleEn: pair.en } : {}),
  };
}

// Human titleZh/titleEn values always win. A saved translation is used only
// while its source title still matches; changed source text gets a fresh,
// source-hashed automatic translation instead of reusing stale history.
export async function translateMissingProposalTitle(
  proposal: Proposal,
  fetcher: typeof fetch = fetch,
  options: { useHistorical?: boolean } = {},
): Promise<Proposal> {
  const withHistorical = applyPersistedTitleTranslation(proposal, options.useHistorical ?? true);
  const pair = localizedTitlePair(withHistorical, options.useHistorical ?? true);
  if (pair.zh && pair.en) return withHistorical;

  const target: TargetLocale | null = pair.en && !pair.zh ? 'zh' : pair.zh && !pair.en ? 'en' : null;
  const source = target === 'zh' ? pair.en : target === 'en' ? pair.zh : '';
  if (!target || !source) return withHistorical;
  const translation = await requestTranslation(proposal.id, target, source, fetcher);
  if (!translation) return withHistorical;
  return {
    ...withHistorical,
    ...(target === 'zh' ? { titleZh: translation } : { titleEn: translation }),
  };
}
