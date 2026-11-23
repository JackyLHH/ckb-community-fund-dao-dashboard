import { fetchTranslationResult } from './translation-timeout.js';
import { preserveTechnicalTerms, translationPolicyVersion } from './translation-terms.js';
import type { Proposal } from '@/lib/proposals';

type TargetLocale = 'zh' | 'en';
type TranslationResponse = { ok?: boolean; translation?: string };

const translationsInFlight = new Map<string, Promise<string | null>>();

// Only exact generic headings have a deterministic translation. Reviewed
// English and longer source titles retain their existing precedence.
const shortReportTitles = new Map<string, string>([
  ['日报', 'Daily Report'],
  ['周报', 'Weekly Report'],
  ['双周报', 'Biweekly Report'],
  ['月报', 'Monthly Report'],
  ['季报', 'Quarterly Report'],
  ['年报', 'Annual Report'],
]);

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
  return `proposal-update-translation:v2:${proposalId}:${hashValue(updateUrl)}:${target}:${hashValue(source)}`;
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
  if (cached) return preserveTechnicalTerms(cached, source);
  const pending = translationsInFlight.get(key);
  if (pending) return pending;

  const query = new URLSearchParams({ policy: translationPolicyVersion, proposalId, target, text: source, kind: 'proposal-update' });
  const request = fetchTranslationResult(fetcher, `/api/translation?${query}`)
    .then((result: TranslationResponse | null) => {
      if (!result) return null;
      const translation = preserveTechnicalTerms(result.translation?.trim() ?? '', source);
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
    let titleZh = update.titleZh?.trim() ? update.titleZh : (containsChinese(source) ? source : '');
    let titleEn = update.titleEn?.trim() ? update.titleEn : (!containsChinese(source) ? source : '');
    if (titleZh && titleEn) return update;

    // Resolve exact source headings before any automatic cache/provider read.
    // A complete titleEn above always wins, including reviewed long titles.
    const fixedEnglish = !titleEn ? shortReportTitles.get(titleZh.trim()) : undefined;
    if (fixedEnglish) return { ...update, titleZh, titleEn: fixedEnglish };

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
