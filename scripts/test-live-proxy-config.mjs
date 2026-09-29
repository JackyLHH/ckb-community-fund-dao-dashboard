import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import nextConfig from '../next.config.ts';

const vercelConfig = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
);

function liveRewrites(rewrites) {
  return rewrites
    .filter((rewrite) => rewrite.source.startsWith('/live/'))
    .map(({ source, destination }) => ({ source, destination }));
}

const resolvedNextRewrites = await nextConfig.rewrites?.();
const nextRewrites = Array.isArray(resolvedNextRewrites)
  ? resolvedNextRewrites
  : [
      ...(resolvedNextRewrites?.beforeFiles ?? []),
      ...(resolvedNextRewrites?.afterFiles ?? []),
      ...(resolvedNextRewrites?.fallback ?? []),
    ];

assert.deepEqual(
  liveRewrites(nextRewrites),
  liveRewrites(vercelConfig.rewrites ?? []),
  'The /live/* rewrites in next.config.ts must stay synchronized with vercel.json.',
);

console.log('Validated local and Vercel live proxy configurations stay synchronized.');
