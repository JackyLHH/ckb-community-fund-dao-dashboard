export const subscriptionCategories = ['new', 'progress', 'discussion-ended', 'vote-started', 'vote-ended'] as const;
export type SubscriptionCategory = typeof subscriptionCategories[number];
export type SubscriptionPreferences = {
  version: 1;
  categories: SubscriptionCategory[];
  scope: 'all' | 'selected';
  proposalIds: string[];
};

/** Missing preferences preserve the original all-proposal, all-update subscription. */
export function normalizeSubscriptionPreferences(input?: unknown): SubscriptionPreferences {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const categories = Array.isArray(value.categories) ? value.categories : null;
  return {
    version: 1,
    categories: categories
      ? subscriptionCategories.filter((category) => categories.includes(category))
      : [...subscriptionCategories],
    scope: value.scope === 'selected' ? 'selected' : 'all',
    proposalIds: Array.isArray(value.proposalIds)
      ? [...new Set(value.proposalIds.map(String).filter((id) => /^[1-9]\d{0,8}$/.test(id)))].slice(0, 100)
      : [],
  };
}

type FilterableDigestItem = { topic: { id: number }; latestPostNumber?: number; lifecycleEvent?: { id: string; kind: string } };

/** Filter before rendering so recipient-specific counts never include excluded items. */
export function filterSubscriptionDigest<T extends FilterableDigestItem>(preferences: unknown, fresh: T[], updates: T[]) {
  const normalized = normalizeSubscriptionPreferences(preferences);
  const allowed = new Set(normalized.categories);
  const ids = new Set(normalized.proposalIds);
  const withinScope = (item: T) => normalized.scope === 'all' || ids.has(String(item.topic.id));
  const unique = (items: T[], type: 'new' | 'update') => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.lifecycleEvent?.id ?? `${type}:${item.topic.id}:${item.latestPostNumber ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return {
    fresh: allowed.has('new') ? unique(fresh.filter(withinScope), 'new') : [],
    updates: unique(updates.filter((item) => withinScope(item)
      && allowed.has((item.lifecycleEvent?.kind ?? 'progress') as SubscriptionCategory)), 'update'),
  };
}

export function maskedEmail(email: string) {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function confirmationCooldown(lastSentAt?: string | null, now = Date.now(), seconds = 60) {
  const previous = Date.parse(lastSentAt ?? '');
  return Number.isFinite(previous) ? Math.max(0, Math.ceil((previous + seconds * 1000 - now) / 1000)) : 0;
}
