import type { Proposal } from '@/lib/proposals';

type TargetLocale = 'zh' | 'en';
type TranslationResponse = { ok?: boolean; translation?: string };

const translationsInFlight = new Map<string, Promise<string | null>>();

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function hashValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(proposalId: string, updateUrl: string, target: TargetLocale, source: string) {
  return `proposal-update-translation:v1:${proposalId}:${hashValue(updateUrl)}:${target}:${hashValue(source)}`;
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
  updateUrl: string,
  target: TargetLocale,
  source: string,
  fetcher: typeof fetch,
) {
  const key = cacheKey(proposalId, updateUrl, target, source);
  const cached = readBrowserCache(key);
  if (cached) return cached;
  const pending = translationsInFlight.get(key);
  if (pending) return pending;

  const query = new URLSearchParams({ proposalId, target, text: source, kind: 'proposal-update' });
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

// Human-written titleZh/titleEn values always win. A live update's source text
// fills its own language, and only the missing side is translated. The source
// hash in both browser and CDN request keys invalidates stale translations when
// an author edits an update.
export async function translateMissingProposalUpdates(
  proposal: Proposal,
  fetcher: typeof fetch = fetch,
): Promise<Proposal> {
  if (!proposal.updates.length) return proposal;
  const updates = await Promise.all(proposal.updates.map(async (update) => {
    const source = update.title.trim();
    let titleZh = update.titleZh?.trim() || (containsChinese(source) ? source : '');
    let titleEn = update.titleEn?.trim() || (!containsChinese(source) ? source : '');
    if (titleZh && titleEn) return update;

    const target: TargetLocale | null = titleEn && !titleZh ? 'zh' : titleZh && !titleEn ? 'en' : null;
    const sourceText = target === 'zh' ? titleEn : target === 'en' ? titleZh : '';
    if (!target || !sourceText) return update;
    const translation = await requestTranslation(proposal.id, update.url, target, sourceText, fetcher);
    if (translation) {
      if (target === 'zh') titleZh = translation;
      else titleEn = translation;
    }
    return {
      ...update,
      ...(titleZh ? { titleZh } : {}),
      ...(titleEn ? { titleEn } : {}),
    };
  }));
  return { ...proposal, updates };
}
