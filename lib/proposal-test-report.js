// A completed test run needs both an explicit successful execution and
// technical context; a future test plan or a bare "passed" reply is insufficient.
export function isCompletedTestRun(text = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return /\bwe\s+(?:ran|tested)\s+[^.!?]{0,60}\ball\s+(?:\w+\s+)?passed\b/i.test(normalized)
    && /\b(?:testnet|retry|recovery|watchtower|channel)\b/i.test(normalized);
}
