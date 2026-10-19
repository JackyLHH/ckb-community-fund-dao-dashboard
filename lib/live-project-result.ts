export class PublicSourceError extends Error {
  status: number;

  constructor(status: number, statusText = '') {
    super(`${status} ${statusText}`.trim());
    this.name = 'PublicSourceError';
    this.status = status;
  }
}

export type ProjectReadResult<T> = {
  proposal: T | null;
  state: 'live' | 'fallback';
  error: 'not-found' | 'unavailable' | null;
};

// Keep a good record visible when a single detail source fails, while exposing
// the failure explicitly instead of presenting a cached record as freshly read.
export async function resolveDetailSource<T>(
  base: T | null,
  read: () => Promise<T>,
  prepareFallback: (value: T) => Promise<T> = async (value) => value,
): Promise<ProjectReadResult<T>> {
  try {
    return { proposal: await read(), state: 'live', error: null };
  } catch (error) {
    let proposal = base;
    if (base) {
      try { proposal = await prepareFallback(base); } catch { /* A translation failure cannot hide a known record. */ }
    }
    return {
      proposal,
      state: 'fallback',
      error: error instanceof PublicSourceError && error.status === 404 ? 'not-found' : 'unavailable',
    };
  }
}
