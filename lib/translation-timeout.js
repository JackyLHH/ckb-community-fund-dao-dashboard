// A race is necessary as some providers/mocks may ignore AbortSignal. Keep
// cache writes outside this operation so late responses cannot become success.
/**
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} operation
 * @param {number} milliseconds
 * @returns {Promise<T>}
 */
export async function withTranslationTimeout(operation, milliseconds = 8_000) {
  const controller = new AbortController();
  let timer;
  /** @type {Promise<never>} */
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Translation deadline exceeded'));
    }, milliseconds);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function fetchTranslationResult(fetcher, url) {
  return withTranslationTimeout(async (signal) => {
    const response = await fetcher(url, { signal });
    return response.ok ? await response.json() : null;
  });
}
