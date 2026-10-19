/** Search an exact proposal number pasted alone or inside a trusted proposal URL. */
export function directoryProposalId(value: string): string | null {
  const query = value.trim();
  if (/^#?\d+$/.test(query)) return query.replace(/^#/, '');
  try {
    const url = new URL(query);
    const host = url.hostname.toLowerCase();
    if (host === 'talk.nervos.org') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 't') return null;
      const candidate = /^\d+$/.test(parts[1] ?? '') ? parts[1] : parts[2];
      return candidate && /^\d+$/.test(candidate) ? candidate : null;
    }
    if (host === 'ckbcommunityfunddao.xyz' || host === 'ckb-community-fund-dao-dashboard.vercel.app' || host === 'site-hazel-one-84.vercel.app') {
      if (!/^\/project\/?$/.test(url.pathname)) return null;
      const id = url.searchParams.get('id');
      return id && /^\d+$/.test(id) ? id : null;
    }
  } catch {
    // Free text remains a normal text query, not an invalid-URL error.
  }
  return null;
}

export function matchesDirectoryQuery(id: string, searchableText: string, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const exactId = directoryProposalId(query);
  if (exactId) return id === exactId;
  return searchableText.toLocaleLowerCase().includes(normalized);
}

export function rememberDirectoryContext() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('ckb-dao-directory-context', JSON.stringify({
      url: `${window.location.pathname}${window.location.search}`,
      scrollY: window.scrollY,
    }));
  } catch {
    // Navigation still works when storage is disabled or unavailable.
  }
}
